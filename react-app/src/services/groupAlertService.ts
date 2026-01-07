/**
 * 分组异动监控服务 - 基于实时行情数据检测异动
 * 
 * 算法原理：
 * 1. 量能异动：当前刷新周期的成交量增量 > 前N次平均增量 × 倍数阈值
 * 2. 快速拉升：短时间内价格涨幅 > 阈值
 * 3. 快速下跌：短时间内价格跌幅 > 阈值
 */

import type { StockData } from '@/types'
import type { GroupAlertStrategy, GroupAlertType, GroupAlertTriggeredStock } from '@/types/strategy'

// 股票快照数据
interface StockSnapshot {
  price: number      // 最新价
  volume: number     // 累计成交量
  pct: number        // 涨跌幅
  timestamp: number  // 时间戳
}

// 监控状态
interface MonitorState {
  snapshots: StockSnapshot[]  // 最近N次快照（环形缓冲）
  lastAlertTime: Record<GroupAlertType, number>  // 上次预警时间（按类型）
  wasLimitUp: boolean  // 上一次是否涨停（用于检测开板）
}

// 全局监控状态
const monitorStates: Map<string, MonitorState> = new Map()

// 配置常量
const MAX_SNAPSHOTS = 20        // 保留最近20次快照（约1分钟，按3秒刷新计算）
const ALERT_COOLDOWN = 60000    // 同一股票同一类型预警冷却时间（60秒）
const MIN_SNAPSHOTS_FOR_VOLUME = 5  // 量能检测需要的最小快照数

/**
 * 更新股票快照
 */
function updateSnapshot(code: string, stockData: StockData): void {
  const now = Date.now()
  const snapshot: StockSnapshot = {
    price: stockData.price,
    volume: stockData.vol,
    pct: stockData.preClose ? ((stockData.price - stockData.preClose) / stockData.preClose * 100) : 0,
    timestamp: now
  }

  let state = monitorStates.get(code)
  if (!state) {
    state = {
      snapshots: [],
      lastAlertTime: {
        volume_surge: 0,
        rapid_rise: 0,
        rapid_fall: 0,
        limit_up: 0,
        limit_open: 0,
        alpha_lead: 0
      },
      wasLimitUp: false
    }
    monitorStates.set(code, state)
  }

  // 添加新快照，保持最大数量
  state.snapshots.push(snapshot)
  if (state.snapshots.length > MAX_SNAPSHOTS) {
    state.snapshots.shift()
  }
}

/**
 * 检测量能异动
 * 算法：当前成交量增量 > 前N次平均增量 × 倍数阈值
 */
function detectVolumeSurge(
  code: string,
  multiplierThreshold: number
): { triggered: boolean; value: number } {
  const state = monitorStates.get(code)
  if (!state || state.snapshots.length < MIN_SNAPSHOTS_FOR_VOLUME + 1) {
    return { triggered: false, value: 0 }
  }

  const snapshots = state.snapshots
  const len = snapshots.length

  // 计算成交量增量序列
  const volumeDeltas: number[] = []
  for (let i = 1; i < len; i++) {
    const delta = snapshots[i].volume - snapshots[i - 1].volume
    if (delta > 0) {
      volumeDeltas.push(delta)
    }
  }

  if (volumeDeltas.length < MIN_SNAPSHOTS_FOR_VOLUME) {
    return { triggered: false, value: 0 }
  }

  // 最新增量
  const latestDelta = volumeDeltas[volumeDeltas.length - 1]
  
  // 前N次增量的平均值（不包括最新的）
  const prevDeltas = volumeDeltas.slice(0, -1)
  const avgDelta = prevDeltas.reduce((a, b) => a + b, 0) / prevDeltas.length

  if (avgDelta <= 0) {
    return { triggered: false, value: 0 }
  }

  const multiplier = latestDelta / avgDelta
  const triggered = multiplier >= multiplierThreshold

  return {
    triggered,
    value: Math.round(multiplier * 10) / 10
  }
}

/**
 * 检测快速拉升/下跌
 * 算法：比较当前价格与N次前的价格，计算涨跌幅
 */
function detectRapidMove(
  code: string,
  threshold: number,
  direction: 'rise' | 'fall'
): { triggered: boolean; value: number } {
  const state = monitorStates.get(code)
  if (!state || state.snapshots.length < 2) {
    return { triggered: false, value: 0 }
  }

  const snapshots = state.snapshots
  const latest = snapshots[snapshots.length - 1]
  
  // 取最早的快照作为基准（约1分钟前）
  const baseline = snapshots[0]
  
  if (baseline.price <= 0) {
    return { triggered: false, value: 0 }
  }

  // 计算这段时间内的涨跌幅
  const pctChange = ((latest.price - baseline.price) / baseline.price) * 100
  
  let triggered = false
  if (direction === 'rise') {
    triggered = pctChange >= threshold
  } else {
    triggered = pctChange <= -threshold
  }

  return {
    triggered,
    value: Math.round(pctChange * 100) / 100
  }
}

/**
 * 检查是否在冷却期内
 */
function isInCooldown(code: string, alertType: GroupAlertType): boolean {
  const state = monitorStates.get(code)
  if (!state) return false
  
  const lastTime = state.lastAlertTime[alertType]
  return Date.now() - lastTime < ALERT_COOLDOWN
}

/**
 * 记录预警时间
 */
function recordAlertTime(code: string, alertType: GroupAlertType): void {
  const state = monitorStates.get(code)
  if (state) {
    state.lastAlertTime[alertType] = Date.now()
  }
}

/**
 * 判断是否为ST股票
 */
function isSTStock(name: string): boolean {
  return name.includes('ST') || name.includes('*ST')
}

/**
 * 计算涨停价
 */
function calcLimitUpPrice(preClose: number, isST: boolean): number {
  const limitPct = isST ? 0.05 : 0.10
  // 涨停价 = 昨收 × (1 + 涨停幅度)，四舍五入到分
  return Math.round(preClose * (1 + limitPct) * 100) / 100
}

/**
 * 检测涨停
 */
function detectLimitUp(
  stockData: StockData
): { isLimitUp: boolean; limitPrice: number } {
  const { price, preClose, name } = stockData
  if (!preClose || preClose <= 0) {
    return { isLimitUp: false, limitPrice: 0 }
  }

  const isST = isSTStock(name)
  const limitPrice = calcLimitUpPrice(preClose, isST)
  
  // 当前价格 >= 涨停价 视为涨停
  const isLimitUp = price >= limitPrice

  return { isLimitUp, limitPrice }
}

/**
 * 检测开板（涨停打开）
 */
function detectLimitOpen(
  code: string,
  stockData: StockData
): { triggered: boolean; limitPrice: number } {
  const state = monitorStates.get(code)
  if (!state) {
    return { triggered: false, limitPrice: 0 }
  }

  const { isLimitUp, limitPrice } = detectLimitUp(stockData)
  
  // 如果上一次是涨停，这一次不是涨停，说明开板了
  const triggered = state.wasLimitUp && !isLimitUp
  
  // 更新涨停状态
  state.wasLimitUp = isLimitUp

  return { triggered, limitPrice }
}

/**
 * 检查分组异动预警
 * @param strategy 分组预警策略
 * @param stockCodes 分组内的股票代码
 * @param stockData 当前行情数据
 * @returns 触发的异动列表
 */
export function checkGroupAlert(
  strategy: GroupAlertStrategy,
  stockCodes: string[],
  stockData: Record<string, StockData>
): GroupAlertTriggeredStock[] {
  const triggeredStocks: GroupAlertTriggeredStock[] = []
  const now = Date.now()

  // 计算分组平均涨跌幅（用于 Alpha 监控）
  let groupAvgPct = 0
  if (strategy.alertTypes.includes('alpha_lead') && strategy.alphaMonitorEnabled) {
    const pcts: number[] = []
    for (const code of stockCodes) {
      const data = stockData[code]
      if (data && data.preClose && data.preClose > 0) {
        const pct = ((data.price - data.preClose) / data.preClose) * 100
        pcts.push(pct)
      }
    }
    if (pcts.length > 0) {
      groupAvgPct = pcts.reduce((a, b) => a + b, 0) / pcts.length
    }
  }

  for (const code of stockCodes) {
    const data = stockData[code]
    if (!data) continue

    // 更新快照
    updateSnapshot(code, data)

    // 检查量能异动
    if (strategy.alertTypes.includes('volume_surge')) {
      if (!isInCooldown(code, 'volume_surge')) {
        const result = detectVolumeSurge(code, strategy.volumeSurgeMultiplier)
        if (result.triggered) {
          recordAlertTime(code, 'volume_surge')
          triggeredStocks.push({
            code,
            name: data.name,
            alertType: 'volume_surge',
            value: result.value,
            price: data.price,
            triggeredAt: now
          })
        }
      }
    }

    // 检查快速拉升
    if (strategy.alertTypes.includes('rapid_rise')) {
      if (!isInCooldown(code, 'rapid_rise')) {
        const result = detectRapidMove(code, strategy.rapidRiseThreshold, 'rise')
        if (result.triggered) {
          recordAlertTime(code, 'rapid_rise')
          triggeredStocks.push({
            code,
            name: data.name,
            alertType: 'rapid_rise',
            value: result.value,
            price: data.price,
            triggeredAt: now
          })
        }
      }
    }

    // 检查快速下跌
    if (strategy.alertTypes.includes('rapid_fall')) {
      if (!isInCooldown(code, 'rapid_fall')) {
        const result = detectRapidMove(code, strategy.rapidFallThreshold, 'fall')
        if (result.triggered) {
          recordAlertTime(code, 'rapid_fall')
          triggeredStocks.push({
            code,
            name: data.name,
            alertType: 'rapid_fall',
            value: result.value,
            price: data.price,
            triggeredAt: now
          })
        }
      }
    }

    // 检查涨停
    if (strategy.alertTypes.includes('limit_up')) {
      if (!isInCooldown(code, 'limit_up')) {
        const { isLimitUp, limitPrice } = detectLimitUp(data)
        const state = monitorStates.get(code)
        // 只在首次涨停时触发（之前不是涨停状态）
        if (isLimitUp && state && !state.wasLimitUp) {
          recordAlertTime(code, 'limit_up')
          triggeredStocks.push({
            code,
            name: data.name,
            alertType: 'limit_up',
            value: limitPrice,
            price: data.price,
            triggeredAt: now
          })
        }
        // 更新涨停状态
        if (state) {
          state.wasLimitUp = isLimitUp
        }
      }
    }

    // 检查开板
    if (strategy.alertTypes.includes('limit_open')) {
      if (!isInCooldown(code, 'limit_open')) {
        const result = detectLimitOpen(code, data)
        if (result.triggered) {
          recordAlertTime(code, 'limit_open')
          triggeredStocks.push({
            code,
            name: data.name,
            alertType: 'limit_open',
            value: result.limitPrice,
            price: data.price,
            triggeredAt: now
          })
        }
      }
    }

    // 检查 Alpha 领先（超额收益）
    if (strategy.alertTypes.includes('alpha_lead') && strategy.alphaMonitorEnabled) {
      if (!isInCooldown(code, 'alpha_lead')) {
        const threshold = strategy.alphaThreshold || 2
        if (data.preClose && data.preClose > 0) {
          const stockPct = ((data.price - data.preClose) / data.preClose) * 100
          const alpha = stockPct - groupAvgPct
          
          // 超额收益 > 阈值 且 股票本身是上涨的
          if (alpha >= threshold && stockPct > 0) {
            recordAlertTime(code, 'alpha_lead')
            triggeredStocks.push({
              code,
              name: data.name,
              alertType: 'alpha_lead',
              value: Math.round(alpha * 100) / 100,
              price: data.price,
              triggeredAt: now
            })
          }
        }
      }
    }
  }

  return triggeredStocks
}

/**
 * 清除指定股票的监控状态
 */
export function clearMonitorState(code: string): void {
  monitorStates.delete(code)
}

/**
 * 清除所有监控状态
 */
export function clearAllMonitorStates(): void {
  monitorStates.clear()
}

/**
 * 获取监控状态（调试用）
 */
export function getMonitorState(code: string): MonitorState | undefined {
  return monitorStates.get(code)
}
