/**
 * useAlertCheck - 预警检查 Hook
 * 检查股票价格是否触发预警条件
 */
import { useRef, useEffect, useCallback } from 'react'
import type { StockData, AlertConfig } from '@/types'
import { sendNotification, isMarketOpen } from '@/utils/format'

interface UseAlertCheckOptions {
  stockData: Record<string, StockData>
  alerts: Record<string, AlertConfig>
  pctThreshold: number
}

const TRIGGER_STORAGE_KEY = 'market_board_triggered_alerts'

function getToday(): string {
  return new Date().toISOString().slice(0, 10)
}

function loadTriggered(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(TRIGGER_STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as { date?: string; triggers?: Record<string, boolean> }
    if (parsed.date === getToday() && parsed.triggers) {
      return parsed.triggers
    }
  } catch (err) {
    console.warn('Failed to load triggered alerts cache:', err)
  }
  return {}
}

export function useAlertCheck({ stockData, alerts, pctThreshold, onAlertTriggered }: UseAlertCheckOptions & { onAlertTriggered?: (code: string, condIndex: number, price: number) => void }) {
  // 已触发的预警记录，避免重复通知
  const triggeredAlerts = useRef<Record<string, boolean>>(loadTriggered())

  const persistTriggered = useCallback(() => {
    try {
      localStorage.setItem(TRIGGER_STORAGE_KEY, JSON.stringify({
        date: getToday(),
        triggers: triggeredAlerts.current
      }))
    } catch (err) {
      console.warn('Failed to save triggered alerts cache:', err)
    }
  }, [])

  // 检查单个股票的预警
  const checkAlert = useCallback((code: string, price: number, pct: number): boolean => {
    let triggered = false
    const d = stockData[code]
    const alert = alerts[code]
    
    // 休市时不触发预警通知
    const marketOpen = isMarketOpen()
    
    // 多条件预警
    if (alert?.conditions?.length) {
      alert.conditions.forEach((cond, idx) => {
        const alertKey = `${code}_${cond.type}_${cond.operator}_${idx}`
        let condTriggered = false
        let msg = ''
        
        if (cond.type === 'price') {
          condTriggered = cond.operator === 'above' ? price >= cond.value : price <= cond.value
          msg = `当前价 ${price}，${cond.operator === 'above' ? '已突破' : '已跌破'} ${cond.value}`
        } else if (cond.type === 'pct') {
          // 涨跌幅使用绝对值比较
          const pctAbs = Math.abs(pct)
          condTriggered = cond.operator === 'above' ? pctAbs >= cond.value : pctAbs <= cond.value
          msg = `当前涨跌幅 ${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%，绝对值${cond.operator === 'above' ? '已超过' : '已低于'} ${cond.value}%`
        }
        
        if (condTriggered) {
          triggered = true
          if (!triggeredAlerts.current[alertKey] && marketOpen) {
            triggeredAlerts.current[alertKey] = true
            persistTriggered()
            sendNotification(`${d?.name || code} 预警`, msg)
            // 通知外部条件已触发
            onAlertTriggered?.(code, idx, price)
          }
        }
      })
    }
    
    // 全局涨跌幅阈值预警
    const pctAbs = Math.abs(pct)
    if (pctAbs >= pctThreshold) {
      const alertKey = code + '_pct'
      if (!triggeredAlerts.current[alertKey] && marketOpen) {
        triggeredAlerts.current[alertKey] = true
        persistTriggered()
        sendNotification(`${d?.name || code} 涨跌幅预警`, `当前涨跌幅 ${pct.toFixed(2)}%`)
      }
      triggered = true
    }
    
    return triggered
  }, [stockData, alerts, pctThreshold])

  // 检查所有股票
  const checkAllAlerts = useCallback(() => {
    const results: Record<string, boolean> = {}
    
    Object.entries(stockData).forEach(([code, data]) => {
      if (!data.preClose) return
      const pct = ((data.price - data.preClose) / data.preClose) * 100
      results[code] = checkAlert(code, data.price, pct)
    })
    
    return results
  }, [stockData, checkAlert])

  // 当股票数据变化时自动检查
  useEffect(() => {
    checkAllAlerts()
  }, [checkAllAlerts])

  // 重置已触发的预警（用于清除状态）
  const resetTriggered = useCallback((code?: string) => {
    if (code) {
      // 清除特定股票的预警
      Object.keys(triggeredAlerts.current).forEach(key => {
        if (key.startsWith(code)) {
          delete triggeredAlerts.current[key]
        }
      })
    } else {
      // 清除所有
      triggeredAlerts.current = {}
    }
    persistTriggered()
  }, [])

  return {
    checkAlert,
    checkAllAlerts,
    resetTriggered
  }
}

export default useAlertCheck
