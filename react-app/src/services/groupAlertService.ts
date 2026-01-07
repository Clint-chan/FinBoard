/**
 * 分组异动监控服务 - 基于实时行情数据检测异动
 *
 * 算法原理：
 * 1. 主动攻击信号：量能放大 + 价格上涨 + 瞬时外盘占比>55%（三重验证）
 * 2. 快速拉升：短时间内价格涨幅 > 阈值
 * 3. 快速下跌：短时间内价格跌幅 > 阈值
 */

import type { StockData } from '@/types'
import type {
  GroupAlertStrategy,
  GroupAlertType,
  GroupAlertTriggeredStock,
} from '@/types/strategy'

// 外盘占比阈值（70%以上认为是主动买入）
const ACTIVE_BUY_RATIO_THRESHOLD = 0.7
// 逐笔数据取最近 N 笔计算外盘占比
const TICK_COUNT_FOR_RATIO = 30

/**
 * 获取股票最近N笔成交的外盘占比（瞬时）
 * @param code 股票代码（如 sh600519, sz000001）
 * @returns 外盘占比（0-1），获取失败返回 null
 */
async function fetchActiveBuyRatio(code: string): Promise<number | null> {
  try {
    // 解析代码
    const market = code.startsWith('sh') ? 1 : 0
    const symbol = code.slice(2)

    // 使用逐笔成交接口，获取最近 N 笔
    const url = `https://push2.eastmoney.com/api/qt/stock/details/get?fields1=f1,f2,f3,f4&fields2=f51,f52,f53,f54,f55&pos=-${TICK_COUNT_FOR_RATIO}&secid=${market}.${symbol}`
    const response = await fetch(url)
    const data = await response.json()

    if (data.rc !== 0 || !data.data || !data.data.details) {
      return null
    }

    const details = data.data.details as string[]
    if (details.length === 0) {
      return null
    }

    // 统计买盘和卖盘的成交量
    let buyVol = 0
    let sellVol = 0

    for (const detail of details) {
      const parts = detail.split(',')
      // parts[2] = 成交量（手）, parts[4] = 买卖方向（1=卖盘, 2=买盘, 4=中性）
      const vol = parseInt(parts[2]) || 0
      const direction = parts[4]

      if (direction === '2') {
        buyVol += vol // 买盘 = 外盘
      } else if (direction === '1') {
        sellVol += vol // 卖盘 = 内盘
      }
      // 中性盘(4)不计入
    }

    const total = buyVol + sellVol
    if (total <= 0) {
      return null
    }

    return buyVol / total
  } catch (err) {
    console.error('获取逐笔数据失败:', code, err)
    return null
  }
}

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
  initialPctChecked: boolean  // 是否已检查过开盘涨跌幅
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
        limit_open: 0
      },
      wasLimitUp: false,
      initialPctChecked: false
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
 * 检测量能异动（初筛）
 * 算法：
 * 1. 当前成交量增量 > 前N次平均增量 × 倍数阈值
 * 2. 放量期间价格上涨（当前价 > 放量开始时的价格）
 * 
 * @returns triggered: 是否通过初筛, value: 放量倍数, priceRise: 放量期间涨幅
 */
function detectVolumeSurgePrescreen(
  code: string,
  multiplierThreshold: number
): { triggered: boolean; value: number; priceRise: number } {
  const state = monitorStates.get(code)
  if (!state || state.snapshots.length < MIN_SNAPSHOTS_FOR_VOLUME + 1) {
    return { triggered: false, value: 0, priceRise: 0 }
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
    return { triggered: false, value: 0, priceRise: 0 }
  }

  // 最新增量
  const latestDelta = volumeDeltas[volumeDeltas.length - 1]
  
  // 前N次增量的平均值（不包括最新的）
  const prevDeltas = volumeDeltas.slice(0, -1)
  const avgDelta = prevDeltas.reduce((a, b) => a + b, 0) / prevDeltas.length

  if (avgDelta <= 0) {
    return { triggered: false, value: 0, priceRise: 0 }
  }

  const multiplier = latestDelta / avgDelta
  
  // 条件1：量能放大
  if (multiplier < multiplierThreshold) {
    return { triggered: false, value: 0, priceRise: 0 }
  }

  // 条件2：放量期间价格上涨
  // 取最早快照的价格作为基准
  const baselinePrice = snapshots[0].price
  const currentPrice = snapshots[len - 1].price
  
  if (baselinePrice <= 0) {
    return { triggered: false, value: 0, priceRise: 0 }
  }
  
  const priceRise = ((currentPrice - baselinePrice) / baselinePrice) * 100
  
  // 价格必须上涨（涨幅 > 0.3%）
  if (priceRise < 0.3) {
    return { triggered: false, value: 0, priceRise: 0 }
  }

  return {
    triggered: true,
    value: Math.round(multiplier * 10) / 10,
    priceRise: Math.round(priceRise * 100) / 100
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
 * 检测开盘涨跌幅（相对昨收）
 * 用于捕获开盘就高开/低开超过阈值的情况
 */
function detectInitialPct(
  code: string,
  stockData: StockData,
  threshold: number,
  direction: 'rise' | 'fall'
): { triggered: boolean; value: number } {
  const state = monitorStates.get(code)
  if (!state) {
    return { triggered: false, value: 0 }
  }

  // 只在首次检查时触发
  if (state.initialPctChecked) {
    return { triggered: false, value: 0 }
  }

  const { price, preClose } = stockData
  if (!preClose || preClose <= 0) {
    return { triggered: false, value: 0 }
  }

  // 计算相对昨收的涨跌幅
  const pct = ((price - preClose) / preClose) * 100

  let triggered = false
  if (direction === 'rise') {
    triggered = pct >= threshold
  } else {
    triggered = pct <= -threshold
  }

  return {
    triggered,
    value: Math.round(pct * 100) / 100
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
export async function checkGroupAlert(
  strategy: GroupAlertStrategy,
  stockCodes: string[],
  stockData: Record<string, StockData>
): Promise<GroupAlertTriggeredStock[]> {
  const triggeredStocks: GroupAlertTriggeredStock[] = []
  const now = Date.now()

  // 计算分组平均涨跌幅（用于 Alpha 过滤）
  let groupAvgPct = 0
  const alphaThreshold = strategy.alphaThreshold || 2
  
  if (strategy.alphaMonitorEnabled) {
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

  // 收集需要二次验证的量能异动候选
  const volumeSurgeCandidates: Array<{
    code: string
    name: string
    multiplier: number
    priceRise: number
    price: number
  }> = []

  for (const code of stockCodes) {
    const data = stockData[code]
    if (!data) continue

    // 更新快照
    updateSnapshot(code, data)

    // Alpha 过滤器检查：如果启用了龙头过滤，只处理跑赢分组平均的股票
    let passAlphaFilter = true
    if (strategy.alphaMonitorEnabled && data.preClose && data.preClose > 0) {
      const stockPct = ((data.price - data.preClose) / data.preClose) * 100
      const alpha = stockPct - groupAvgPct
      // 必须跑赢分组平均 + 阈值，且股票本身上涨
      passAlphaFilter = alpha >= alphaThreshold && stockPct > 0
    }

    // 如果没有通过 Alpha 过滤器，跳过所有异动检测
    if (!passAlphaFilter) {
      continue
    }

    // 检查量能异动（初筛：放量 + 价格上涨）
    if (strategy.alertTypes.includes('volume_surge')) {
      if (!isInCooldown(code, 'volume_surge')) {
        const result = detectVolumeSurgePrescreen(code, strategy.volumeSurgeMultiplier)
        if (result.triggered) {
          // 通过初筛，加入候选列表等待二次验证
          volumeSurgeCandidates.push({
            code,
            name: data.name,
            multiplier: result.value,
            priceRise: result.priceRise,
            price: data.price
          })
        }
      }
    }

    // 检查快速拉升
    if (strategy.alertTypes.includes('rapid_rise')) {
      if (!isInCooldown(code, 'rapid_rise')) {
        const state = monitorStates.get(code)
        
        // 首次检查：检测开盘涨幅是否已超过阈值
        if (state && !state.initialPctChecked) {
          const initialResult = detectInitialPct(code, data, strategy.rapidRiseThreshold, 'rise')
          if (initialResult.triggered) {
            recordAlertTime(code, 'rapid_rise')
            triggeredStocks.push({
              code,
              name: data.name,
              alertType: 'rapid_rise',
              value: initialResult.value,
              price: data.price,
              triggeredAt: now
            })
          }
        }
        
        // 常规检查：短时间内的价格变化
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
        const state = monitorStates.get(code)
        
        // 首次检查：检测开盘跌幅是否已超过阈值
        if (state && !state.initialPctChecked) {
          const initialResult = detectInitialPct(code, data, strategy.rapidFallThreshold, 'fall')
          if (initialResult.triggered) {
            recordAlertTime(code, 'rapid_fall')
            triggeredStocks.push({
              code,
              name: data.name,
              alertType: 'rapid_fall',
              value: initialResult.value,
              price: data.price,
              triggeredAt: now
            })
          }
        }
        
        // 常规检查：短时间内的价格变化
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

    // 标记已完成首次涨跌幅检查
    const stateToMark = monitorStates.get(code)
    if (stateToMark && !stateToMark.initialPctChecked) {
      stateToMark.initialPctChecked = true
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
  }

  // 二次验证：对量能异动候选进行外盘占比检测
  if (volumeSurgeCandidates.length > 0) {
    // 并行请求所有候选股票的内外盘数据
    const verifyPromises = volumeSurgeCandidates.map(async (candidate) => {
      const activeBuyRatio = await fetchActiveBuyRatio(candidate.code)
      
      // 外盘占比 > 70% 才认为是有效的主动攻击
      if (activeBuyRatio !== null && activeBuyRatio >= ACTIVE_BUY_RATIO_THRESHOLD) {
        recordAlertTime(candidate.code, 'volume_surge')
        return {
          code: candidate.code,
          name: candidate.name,
          alertType: 'volume_surge' as GroupAlertType,
          value: candidate.multiplier,
          price: candidate.price,
          triggeredAt: now,
          // 额外信息：外盘占比
          activeBuyRatio: Math.round(activeBuyRatio * 100)
        }
      }
      return null
    })

    const verifyResults = await Promise.all(verifyPromises)
    
    // 添加通过二次验证的股票
    for (const result of verifyResults) {
      if (result) {
        triggeredStocks.push(result)
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
