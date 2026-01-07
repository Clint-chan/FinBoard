/**
 * useStrategyMonitor - 后台策略监控 Hook
 * 在 App 层级运行，确保策略检查在后台持续进行，不受页面切换影响
 */
import { useEffect, useRef, useCallback } from 'react'
import type { StockData, StrategyAlertHistoryItem, StockCategory } from '@/types'
import type { 
  PriceAlertStrategy, 
  SectorArbStrategy, 
  AHPremiumStrategy, 
  FakeBreakoutStrategy,
  GroupAlertStrategy
} from '@/types/strategy'
import {
  loadStrategies,
  saveStrategies,
  checkAllStrategies,
  getStrategyTypeLabel,
  getGroupAlertTypeLabel
} from '@/services/strategyService'
import { checkGroupAlert } from '@/services/groupAlertService'
import { sendNotification, isMarketOpen } from '@/utils/format'

interface UseStrategyMonitorOptions {
  stockData: Record<string, StockData>
  categories?: StockCategory[] // 股票分组
  strategyCheckInterval?: number // 非价格策略检查间隔（秒），默认30秒
  onAlertTriggered?: (item: StrategyAlertHistoryItem) => void
}

export function useStrategyMonitor({
  stockData,
  categories = [],
  strategyCheckInterval = 30,
  onAlertTriggered
}: UseStrategyMonitorOptions) {
  // 已通知的策略记录，避免重复通知（每日重置）
  const notifiedStrategies = useRef<Set<string>>(new Set())
  const lastResetDate = useRef<string>(new Date().toDateString())
  
  // 每日重置通知记录
  const resetIfNewDay = useCallback(() => {
    const today = new Date().toDateString()
    if (today !== lastResetDate.current) {
      notifiedStrategies.current.clear()
      lastResetDate.current = today
    }
  }, [])

  // 保存预警历史记录
  const saveAlertHistory = useCallback((item: StrategyAlertHistoryItem) => {
    onAlertTriggered?.(item)
  }, [onAlertTriggered])

  // 价格预警实时检查（跟随 stockData 变化）
  useEffect(() => {
    if (Object.keys(stockData).length === 0) return
    if (!isMarketOpen()) return
    
    resetIfNewDay()
    
    const strategies = loadStrategies()
    const priceStrategies = strategies.filter(s => s.type === 'price' && s.enabled) as PriceAlertStrategy[]
    if (priceStrategies.length === 0) return
    
    let hasUpdate = false
    const updatedStrategies = strategies.map(strategy => {
      if (strategy.type !== 'price' || !strategy.enabled) return strategy
      
      const ps = strategy as PriceAlertStrategy
      const stock = stockData[ps.code]
      if (!stock) return strategy
      
      const price = stock.price
      const pct = stock.preClose ? ((price - stock.preClose) / stock.preClose * 100) : 0
      
      // 检查每个条件
      let strategyTriggered = false
      const updatedConditions = ps.conditions.map((cond, condIdx) => {
        if (cond.triggered) return cond // 已触发的跳过
        
        let condTriggered = false
        if (cond.type === 'price') {
          condTriggered = cond.operator === 'above' ? price >= cond.value : price <= cond.value
        } else if (cond.type === 'pct') {
          const pctAbs = Math.abs(pct)
          condTriggered = cond.operator === 'above' ? pctAbs >= cond.value : pctAbs <= cond.value
        }
        
        if (condTriggered) {
          strategyTriggered = true
          hasUpdate = true
          
          // 发送通知（如果未通知过）
          const alertKey = `${ps.id}_cond${condIdx}`
          if (!notifiedStrategies.current.has(alertKey)) {
            notifiedStrategies.current.add(alertKey)
            
            const condTypeLabel = cond.type === 'price' ? '价格' : '涨跌幅'
            const condOpLabel = cond.operator === 'above' ? '突破' : '跌破'
            const title = cond.note 
              ? `${ps.stockName || ps.code} - ${cond.note}`
              : `${ps.stockName || ps.code} ${condTypeLabel}${condOpLabel}`
            const body = cond.type === 'price'
              ? `当前价 ${price.toFixed(2)}，${condOpLabel} ${cond.value}`
              : `当前涨跌幅 ${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%，${condOpLabel} ${cond.value}%`
            
            sendNotification(title, body)
            
            // 保存到历史记录
            saveAlertHistory({
              id: `${ps.id}_cond${condIdx}_${Date.now()}`,
              type: 'price',
              title: `${ps.stockName || ps.code} ${condTypeLabel}${condOpLabel}`,
              description: `${body}${cond.note ? ` (${cond.note})` : ''}`,
              timestamp: Date.now(),
              data: {
                code: ps.code,
                stockName: ps.stockName,
                conditionType: cond.type,
                conditionOperator: cond.operator,
                conditionValue: cond.value,
                price,
                note: cond.note
              }
            })
          }
          
          return { ...cond, triggered: true, triggeredAt: Date.now() }
        }
        return cond
      })
      
      if (strategyTriggered) {
        return {
          ...ps,
          conditions: updatedConditions,
          status: 'triggered' as const,
          triggeredAt: ps.triggeredAt || Date.now()
        }
      }
      return strategy
    })
    
    if (hasUpdate) {
      saveStrategies(updatedStrategies, true) // 静默保存，避免双重触发
      // 触发事件通知 StrategyCenter 刷新
      window.dispatchEvent(new CustomEvent('strategies-updated'))
    }
  }, [stockData, saveAlertHistory, resetIfNewDay])

  // 分组异动实时检查（跟随 stockData 变化）
  useEffect(() => {
    if (Object.keys(stockData).length === 0) return
    if (!isMarketOpen()) return
    
    const strategies = loadStrategies()
    const groupAlertStrategies = strategies.filter(
      s => s.type === 'group_alert' && s.enabled
    ) as GroupAlertStrategy[]
    
    if (groupAlertStrategies.length === 0) return

    let hasUpdate = false
    const updatedStrategies = strategies.map(strategy => {
      if (strategy.type !== 'group_alert' || !strategy.enabled) return strategy
      
      const gs = strategy as GroupAlertStrategy
      
      // 获取该分组的股票代码
      const category = categories.find(c => c.id === gs.categoryId)
      if (!category || category.codes.length === 0) return strategy
      
      // 检查异动
      const triggeredStocks = checkGroupAlert(gs, category.codes, stockData)
      
      if (triggeredStocks.length > 0) {
        hasUpdate = true
        
        // 发送浏览器通知
        for (const stock of triggeredStocks) {
          const alertKey = `${gs.id}_${stock.code}_${stock.alertType}`
          if (!notifiedStrategies.current.has(alertKey)) {
            notifiedStrategies.current.add(alertKey)
            
            const typeLabel = getGroupAlertTypeLabel(stock.alertType)
            const title = `${stock.name} ${typeLabel}`
            let body = ''
            
            if (stock.alertType === 'volume_surge') {
              body = `成交量放大 ${stock.value} 倍，当前价 ${stock.price.toFixed(2)}`
            } else if (stock.alertType === 'rapid_rise') {
              body = `短时涨幅 +${stock.value}%，当前价 ${stock.price.toFixed(2)}`
            } else if (stock.alertType === 'rapid_fall') {
              body = `短时跌幅 ${stock.value}%，当前价 ${stock.price.toFixed(2)}`
            } else if (stock.alertType === 'limit_up') {
              body = `封涨停！当前价 ${stock.price.toFixed(2)}，涨停价 ${stock.value.toFixed(2)}`
            } else if (stock.alertType === 'limit_open') {
              body = `涨停打开！当前价 ${stock.price.toFixed(2)}，涨停价 ${stock.value.toFixed(2)}`
            }
            
            sendNotification(title, body)
            
            // 保存到历史记录
            saveAlertHistory({
              id: `${gs.id}_${stock.code}_${stock.alertType}_${Date.now()}`,
              type: 'group_alert',
              title,
              description: body,
              timestamp: Date.now(),
              data: {
                code: stock.code,
                stockName: stock.name,
                alertType: stock.alertType,
                value: stock.value,
                price: stock.price,
                categoryName: gs.categoryName
              }
            })
          }
        }
        
        return {
          ...gs,
          triggeredStocks,
          lastCheckTime: Date.now(),
          status: 'triggered' as const,
          triggeredAt: gs.triggeredAt || Date.now()
        }
      }
      
      return {
        ...gs,
        lastCheckTime: Date.now()
      }
    })
    
    if (hasUpdate) {
      saveStrategies(updatedStrategies, true) // 静默保存，避免双重触发
      window.dispatchEvent(new CustomEvent('strategies-updated'))
    }
  }, [stockData, categories, saveAlertHistory])

  // 定时检查非价格策略（配对监控、AH溢价等需要请求API）
  useEffect(() => {
    const check = async () => {
      if (!isMarketOpen()) return
      
      resetIfNewDay()
      
      const strategies = loadStrategies()
      const nonPriceStrategies = strategies.filter(s => s.type !== 'price' && s.enabled)
      if (nonPriceStrategies.length === 0) return

      try {
        const updated = await checkAllStrategies(strategies)
        
        // 检查是否有新触发的策略，发送浏览器通知
        updated.forEach((strategy, idx) => {
          const oldStrategy = strategies[idx]
          // 如果策略从非触发状态变为触发状态，且未通知过
          if (strategy.status === 'triggered' && 
              oldStrategy?.status !== 'triggered' && 
              !notifiedStrategies.current.has(strategy.id)) {
            
            notifiedStrategies.current.add(strategy.id)
            
            // 根据策略类型生成通知内容
            let title = ''
            let body = ''
            let historyData: Record<string, unknown> = {}
            
            switch (strategy.type) {
              case 'sector_arb': {
                const s = strategy as SectorArbStrategy
                title = `配对监控触发: ${s.name}`
                body = `${s.stockAName || s.stockACode} vs ${s.stockBName || s.stockBCode}\n偏离度: ${s.deviation?.toFixed(2)}% (阈值 ${s.threshold}%)`
                historyData = { 
                  spread: s.deviation || 0, 
                  threshold: s.threshold,
                  stockA: s.stockAName || s.stockACode,
                  stockB: s.stockBName || s.stockBCode
                }
                break
              }
              case 'ah_premium': {
                const s = strategy as AHPremiumStrategy
                title = `AH溢价触发: ${s.name}`
                body = `当前溢价率: ${s.premium?.toFixed(1)}%\n阈值范围: ${s.lowThreshold}% ~ ${s.highThreshold}%`
                historyData = { 
                  premium: s.premium || 0,
                  lowThreshold: s.lowThreshold,
                  highThreshold: s.highThreshold
                }
                break
              }
              case 'fake_breakout': {
                const s = strategy as FakeBreakoutStrategy
                title = `假突破预警: ${s.name}`
                body = `${s.sectorName || s.sectorCode} 板块\n发现 ${s.suspects?.length || 0} 个疑似诱多标的`
                historyData = {
                  sectorName: s.sectorName || s.sectorCode,
                  suspectsCount: s.suspects?.length || 0
                }
                break
              }
            }
            
            // 如果没有匹配到具体类型，使用默认值
            if (!title) {
              title = `策略触发: ${strategy.name}`
              body = getStrategyTypeLabel(strategy.type)
            }
            
            // 发送浏览器通知
            sendNotification(title, body)
            
            // 保存到历史记录
            saveAlertHistory({
              id: `${strategy.id}_${Date.now()}`,
              type: strategy.type,
              title: strategy.name,
              description: body.replace('\n', ' '),
              timestamp: Date.now(),
              data: historyData
            })
          }
        })
        
        // 只有当策略有实际变化时才保存和触发事件
        const hasChanges = updated.some((s, i) => {
          const old = strategies[i]
          return s.status !== old?.status || s.triggeredAt !== old?.triggeredAt
        })
        
        if (hasChanges) {
          saveStrategies(updated, true) // 静默保存，避免双重触发
          // 触发事件通知 StrategyCenter 刷新
          window.dispatchEvent(new CustomEvent('strategies-updated'))
        }
      } catch (err) {
        console.error('[StrategyMonitor] 检查策略失败:', err)
      }
    }

    // 首次加载时检查
    check()

    // 定时检查
    const interval = setInterval(check, strategyCheckInterval * 1000)
    return () => clearInterval(interval)
  }, [strategyCheckInterval, saveAlertHistory, resetIfNewDay])
}

export default useStrategyMonitor
