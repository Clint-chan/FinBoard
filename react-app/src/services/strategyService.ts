/**
 * 策略监控服务 - 数据获取和策略检查
 */
import type {
  Strategy,
  StrategyConfig,
  AHComparisonData,
  SectorData,
  SectorArbStrategy,
  AHPremiumStrategy,
  FakeBreakoutStrategy,
  FakeBreakoutSuspect,
  GroupAlertStrategy,
  GroupAlertTriggeredStock,
  GroupAlertType
} from '@/types/strategy'
import { fetchQuotes } from './dataService'

const STRATEGY_STORAGE_KEY = 'fintell_strategies'

// ============ 本地存储 ============

export function loadStrategies(): Strategy[] {
  try {
    const cached = localStorage.getItem(STRATEGY_STORAGE_KEY)
    if (cached) {
      const config: StrategyConfig = JSON.parse(cached)
      return config.strategies || []
    }
  } catch (e) {
    console.warn('Failed to load strategies:', e)
  }
  return []
}

export function saveStrategies(strategies: Strategy[]): void {
  try {
    const config: StrategyConfig = {
      strategies,
      lastUpdated: Date.now()
    }
    localStorage.setItem(STRATEGY_STORAGE_KEY, JSON.stringify(config))
    // 触发策略更新事件，通知云同步
    window.dispatchEvent(new CustomEvent('strategies-updated'))
  } catch (e) {
    console.warn('Failed to save strategies:', e)
  }
}

// 上海指数代码列表（000开头的上海指数）
const SH_INDEX_CODES = [
  '000001', '000002', '000003', '000010', '000016', '000017',
  '000300', '000688', '000905', '000852'
]

// ============ 历史K线数据 ============

/**
 * 获取股票历史日K线数据
 * 东方财富接口
 */
export async function fetchHistoryKline(
  code: string,
  days: number = 60
): Promise<{ date: string; close: number; pctChg: number }[]> {
  const symbol = code.replace(/^(sh|sz)/i, '')
  // 优先使用前缀判断，回退时考虑上海指数
  let marketCode = 0
  if (code.toLowerCase().startsWith('sh')) {
    marketCode = 1
  } else if (code.toLowerCase().startsWith('sz')) {
    marketCode = 0
  } else if (symbol.startsWith('6') || SH_INDEX_CODES.includes(symbol)) {
    marketCode = 1
  }

  const url = 'https://push2his.eastmoney.com/api/qt/stock/kline/get'
  const params = new URLSearchParams({
    fields1: 'f1,f2,f3,f4,f5,f6',
    fields2: 'f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61',
    ut: '7eea3edcaed734bea9cbfc24409ed989',
    klt: '101', // 日K
    fqt: '1', // 前复权
    secid: `${marketCode}.${symbol}`,
    beg: '0',
    end: '20500101',
    lmt: days.toString()
  })

  try {
    const response = await fetch(`${url}?${params}`)
    const data = await response.json()

    if (!data.data?.klines) return []

    return data.data.klines.map((line: string) => {
      const parts = line.split(',')
      return {
        date: parts[0],
        close: parseFloat(parts[2]),
        pctChg: parseFloat(parts[8])
      }
    })
  } catch (err) {
    console.error('获取历史K线失败:', err)
    return []
  }
}

/**
 * 计算两只股票的相关性和Beta系数
 * @param codeA 股票A代码
 * @param codeB 股票B代码（基准）
 * @param days 计算天数
 */
export async function calculateCorrelationAndBeta(
  codeA: string,
  codeB: string,
  days: number = 60
): Promise<{ correlation: number; beta: number } | null> {
  try {
    // 并行获取两只股票的历史数据
    const [historyA, historyB] = await Promise.all([
      fetchHistoryKline(codeA, days),
      fetchHistoryKline(codeB, days)
    ])

    if (historyA.length < 20 || historyB.length < 20) {
      console.warn('历史数据不足，无法计算相关性')
      return null
    }

    // 对齐日期，取交集
    const dateSetB = new Set(historyB.map(d => d.date))
    const alignedA = historyA.filter(d => dateSetB.has(d.date))
    const alignedB = historyB.filter(d => alignedA.some(a => a.date === d.date))

    if (alignedA.length < 20) {
      console.warn('对齐后数据不足')
      return null
    }

    // 提取收益率序列
    const returnsA = alignedA.map(d => d.pctChg)
    const returnsB = alignedB.map(d => d.pctChg)

    // 计算均值
    const meanA = returnsA.reduce((a, b) => a + b, 0) / returnsA.length
    const meanB = returnsB.reduce((a, b) => a + b, 0) / returnsB.length

    // 计算协方差和方差
    let covariance = 0
    let varianceA = 0
    let varianceB = 0

    for (let i = 0; i < returnsA.length; i++) {
      const diffA = returnsA[i] - meanA
      const diffB = returnsB[i] - meanB
      covariance += diffA * diffB
      varianceA += diffA * diffA
      varianceB += diffB * diffB
    }

    covariance /= returnsA.length
    varianceA /= returnsA.length
    varianceB /= returnsB.length

    // 计算相关系数
    const stdA = Math.sqrt(varianceA)
    const stdB = Math.sqrt(varianceB)
    const correlation = stdA > 0 && stdB > 0 ? covariance / (stdA * stdB) : 0

    // 计算 Beta = Cov(A, B) / Var(B)
    const beta = varianceB > 0 ? covariance / varianceB : 0

    return {
      correlation: Math.round(correlation * 100) / 100,
      beta: Math.round(beta * 100) / 100
    }
  } catch (err) {
    console.error('计算相关性失败:', err)
    return null
  }
}

// ============ AH股比价数据 ============

/**
 * 获取AH股比价列表
 * 东方财富接口: https://push2.eastmoney.com/api/qt/clist/get
 */
export async function fetchAHComparisonList(): Promise<AHComparisonData[]> {
  const url = 'https://push2.eastmoney.com/api/qt/clist/get'
  const params = new URLSearchParams({
    np: '1',
    fltt: '2',
    invt: '2',
    fs: 'b:DLMK0101',  // AH股比价
    fields: 'f12,f14,f2,f3,f191,f192,f193',
    // f12: A股代码, f14: 名称, f2: A股价格, f3: A股涨跌幅
    // f191: H股代码, f192: H股价格, f193: 溢价率
    fid: 'f3',
    pn: '1',
    pz: '200',
    po: '1'
  })

  try {
    const response = await fetch(`${url}?${params}`)
    const data = await response.json()
    
    if (!data.data?.diff) return []
    
    return data.data.diff.map((item: any) => ({
      aCode: item.f12?.startsWith('6') ? `sh${item.f12}` : `sz${item.f12}`,
      aName: item.f14 || '--',
      hCode: item.f191 || '',
      hName: item.f14 || '--',
      aPrice: item.f2 || 0,
      hPrice: item.f192 || 0,
      premium: item.f193 || 0,
      exchangeRate: 0.92 // 默认汇率，实际应从接口获取
    }))
  } catch (err) {
    console.error('获取AH比价数据失败:', err)
    return []
  }
}

// ============ 行业板块数据 ============

/**
 * 获取行业板块列表
 * 东方财富接口
 */
export async function fetchSectorList(): Promise<SectorData[]> {
  const url = 'https://17.push2.eastmoney.com/api/qt/clist/get'
  const params = new URLSearchParams({
    pn: '1',
    pz: '100',
    po: '1',
    np: '1',
    ut: 'bd1d9ddb04089700cf9c27f6f7426281',
    fltt: '2',
    invt: '2',
    fid: 'f3',
    fs: 'm:90 t:2 f:!50',
    fields: 'f12,f14,f2,f3,f8,f104,f105,f140,f141'
  })

  try {
    const response = await fetch(`${url}?${params}`)
    const data = await response.json()
    
    if (!data.data?.diff) return []
    
    return data.data.diff.map((item: any) => ({
      code: item.f12 || '',
      name: item.f14 || '--',
      price: item.f2 || 0,
      pctChg: item.f3 || 0,
      turnover: item.f8 || 0,
      upCount: item.f104 || 0,
      downCount: item.f105 || 0,
      leadStock: item.f140 || '--',
      leadStockPct: item.f141 || 0
    }))
  } catch (err) {
    console.error('获取板块数据失败:', err)
    return []
  }
}

/**
 * 获取板块成分股
 */
export async function fetchSectorStocks(sectorCode: string): Promise<any[]> {
  const url = 'https://29.push2.eastmoney.com/api/qt/clist/get'
  const params = new URLSearchParams({
    pn: '1',
    pz: '50',
    po: '1',
    np: '1',
    ut: 'bd1d9ddb04089700cf9c27f6f7426281',
    fltt: '2',
    invt: '2',
    fid: 'f3',
    fs: `b:${sectorCode} f:!50`,
    fields: 'f12,f13,f14,f2,f3,f17,f50'
    // f12: 代码, f13: 市场, f14: 名称, f2: 最新价, f3: 涨跌幅, f17: 今开, f50: 量比
  })

  try {
    const response = await fetch(`${url}?${params}`)
    const data = await response.json()
    
    if (!data.data?.diff) return []
    
    return data.data.diff.map((item: any) => {
      const prefix = item.f13 === 1 ? 'sh' : 'sz'
      const openPct = item.f17 && item.f2 ? ((item.f17 - item.f2) / item.f2 * 100) : 0
      return {
        code: `${prefix}${item.f12}`,
        name: item.f14 || '--',
        price: item.f2 || 0,
        pctChg: item.f3 || 0,
        open: item.f17 || 0,
        openPct: openPct,
        volumeRatio: item.f50 || 0
      }
    })
  } catch (err) {
    console.error('获取板块成分股失败:', err)
    return []
  }
}

// ============ 策略检查 ============

/**
 * 检查配对监控策略（原行业套利）
 */
export async function checkSectorArbStrategy(
  strategy: SectorArbStrategy
): Promise<SectorArbStrategy> {
  const codes = [strategy.stockACode, strategy.stockBCode]
  const quotes = await fetchQuotes(codes)
  
  const stockAData = quotes[strategy.stockACode]
  const stockBData = quotes[strategy.stockBCode]
  
  if (!stockAData || !stockBData) {
    return strategy
  }
  
  const stockAPct = stockAData.preClose ? ((stockAData.price - stockAData.preClose) / stockAData.preClose * 100) : 0
  const stockBPct = stockBData.preClose ? ((stockBData.price - stockBData.preClose) / stockBData.preClose * 100) : 0
  
  // 根据监控模式计算偏离度
  let deviation = 0
  switch (strategy.monitorMode) {
    case 'spread':
      // 价差偏离：(A价格 - B价格) 的变化率
      deviation = stockAPct - stockBPct
      break
    case 'ratio':
      // 比价偏离：A/B 比值的变化率
      deviation = stockAPct - stockBPct
      break
    case 'return_diff':
    default:
      // 涨跌幅差值
      deviation = stockAPct - stockBPct
      break
  }
  
  const triggered = Math.abs(deviation) >= strategy.threshold
  
  // 如果有关联板块ETF，获取ETF行情数据
  let sectorPct: number | undefined
  let sectorName: string | undefined
  let stockAVsSector: number | undefined
  let stockBVsSector: number | undefined
  
  if (strategy.sectorCode) {
    try {
      // sectorCode 现在存储的是 ETF 代码，直接获取行情
      const sectorQuotes = await fetchQuotes([strategy.sectorCode])
      const sectorData = sectorQuotes[strategy.sectorCode]
      if (sectorData) {
        sectorPct = sectorData.preClose ? ((sectorData.price - sectorData.preClose) / sectorData.preClose * 100) : 0
        sectorName = sectorData.name || strategy.sectorName
        stockAVsSector = stockAPct - sectorPct
        stockBVsSector = stockBPct - sectorPct
      }
    } catch (err) {
      console.error('获取板块ETF数据失败:', err)
    }
  }
  
  return {
    ...strategy,
    stockAName: stockAData.name,
    stockBName: stockBData.name,
    stockAPrice: stockAData.price,
    stockBPrice: stockBData.price,
    stockAPct,
    stockBPct,
    sectorPct,
    sectorName: sectorName || strategy.sectorName,
    stockAVsSector,
    stockBVsSector,
    deviation,
    status: triggered ? 'triggered' : 'running',
    triggeredAt: triggered && strategy.status !== 'triggered' ? Date.now() : strategy.triggeredAt
  }
}

/**
 * 检查AH溢价策略
 */
export async function checkAHPremiumStrategy(
  strategy: AHPremiumStrategy
): Promise<AHPremiumStrategy> {
  // 获取AH比价数据
  const ahList = await fetchAHComparisonList()
  const ahData = ahList.find(item => 
    item.aCode === strategy.aCode || 
    item.aCode.includes(strategy.aCode.replace(/^(sh|sz)/, ''))
  )
  
  if (!ahData) {
    return strategy
  }
  
  const triggered = ahData.premium <= strategy.lowThreshold || ahData.premium >= strategy.highThreshold
  
  return {
    ...strategy,
    aName: ahData.aName,
    hName: ahData.hName,
    aPrice: ahData.aPrice,
    hPrice: ahData.hPrice,
    premium: ahData.premium,
    exchangeRate: ahData.exchangeRate,
    status: triggered ? 'triggered' : 'running',
    triggeredAt: triggered && strategy.status !== 'triggered' ? Date.now() : strategy.triggeredAt
  }
}

/**
 * 检查假突破策略
 */
export async function checkFakeBreakoutStrategy(
  strategy: FakeBreakoutStrategy
): Promise<FakeBreakoutStrategy> {
  // 获取板块数据
  const sectors = await fetchSectorList()
  const sector = sectors.find(s => s.code === strategy.sectorCode)
  
  if (!sector) {
    return strategy
  }
  
  // 获取板块成分股
  const stocks = await fetchSectorStocks(strategy.sectorCode)
  
  // 筛选疑似诱多标的：高开但板块走弱
  const suspects: FakeBreakoutSuspect[] = stocks
    .filter(stock => 
      stock.openPct >= strategy.openThreshold && 
      stock.volumeRatio < strategy.volumeRatioThreshold &&
      sector.pctChg < 0
    )
    .map(stock => ({
      code: stock.code,
      name: stock.name,
      openPct: stock.openPct,
      currentPct: stock.pctChg,
      volumeRatio: stock.volumeRatio,
      sectorPct: sector.pctChg
    }))
    .slice(0, 5) // 最多显示5个
  
  const triggered = suspects.length > 0
  
  return {
    ...strategy,
    sectorName: sector.name,
    sectorPct: sector.pctChg,
    suspects,
    status: triggered ? 'triggered' : 'running',
    triggeredAt: triggered && strategy.status !== 'triggered' ? Date.now() : strategy.triggeredAt
  }
}

/**
 * 批量检查所有策略
 */
export async function checkAllStrategies(strategies: Strategy[]): Promise<Strategy[]> {
  const results: Strategy[] = []
  
  for (const strategy of strategies) {
    if (!strategy.enabled || strategy.status === 'paused') {
      results.push(strategy)
      continue
    }
    
    try {
      switch (strategy.type) {
        case 'sector_arb':
          results.push(await checkSectorArbStrategy(strategy as SectorArbStrategy))
          break
        case 'ah_premium':
          results.push(await checkAHPremiumStrategy(strategy as AHPremiumStrategy))
          break
        case 'fake_breakout':
          results.push(await checkFakeBreakoutStrategy(strategy as FakeBreakoutStrategy))
          break
        default:
          results.push(strategy)
      }
    } catch (err) {
      console.error(`检查策略 ${strategy.name} 失败:`, err)
      results.push(strategy)
    }
  }
  
  return results
}

// ============ 工具函数 ============

export function generateStrategyId(): string {
  return `strategy_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

export function getStrategyTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    price: '价格预警',
    sector_arb: '配对监控',
    ah_premium: 'AH溢价',
    fake_breakout: '假突破',
    group_alert: '分组异动'
  }
  return labels[type] || type
}

export function getStrategyTypeColor(type: string): string {
  const colors: Record<string, string> = {
    price: 'type-price',
    sector_arb: 'type-sector-arb',
    ah_premium: 'type-ah-premium',
    fake_breakout: 'type-fake-breakout',
    group_alert: 'type-group-alert'
  }
  return colors[type] || 'type-default'
}

// ============ 1分钟K线数据 ============

interface MinuteKlinePoint {
  time: string
  open: number
  close: number
  high: number
  low: number
  volume: number
  amount: number
}

/**
 * 获取股票1分钟K线数据（最近6根）
 */
export async function fetch1MinKline(code: string): Promise<MinuteKlinePoint[]> {
  const symbol = code.replace(/^(sh|sz)/, '')
  let marketCode = '0' // 默认深圳
  
  if (code.startsWith('sh') || symbol.startsWith('6')) {
    marketCode = '1'
  } else if (SH_INDEX_CODES.includes(symbol)) {
    marketCode = '1'
  }
  
  const url = 'https://push2his.eastmoney.com/api/qt/stock/kline/get'
  const params = new URLSearchParams({
    fields1: 'f1,f2,f3,f4,f5,f6',
    fields2: 'f51,f52,f53,f54,f55,f56,f57',
    ut: '7eea3edcaed734bea9cbfc24409ed989',
    klt: '1',  // 1分钟K线
    fqt: '1',
    secid: `${marketCode}.${symbol}`,
    beg: '0',
    end: '20500000',
    lmt: '6'  // 只取最近6根
  })

  const response = await fetch(`${url}?${params}`)
  const data = await response.json()
  
  if (!data.data?.klines) {
    return []
  }

  return data.data.klines.map((item: string) => {
    const p = item.split(',')
    return {
      time: p[0],
      open: parseFloat(p[1]),
      close: parseFloat(p[2]),
      high: parseFloat(p[3]),
      low: parseFloat(p[4]),
      volume: parseInt(p[5]),
      amount: parseFloat(p[6])
    }
  })
}

/**
 * 检查分组异动预警策略
 */
export async function checkGroupAlertStrategy(
  strategy: GroupAlertStrategy,
  stockCodes: string[],
  stockNames: Record<string, string>
): Promise<GroupAlertStrategy> {
  if (stockCodes.length === 0) {
    return strategy
  }

  const triggeredStocks: GroupAlertTriggeredStock[] = []
  const now = Date.now()

  // 并行获取所有股票的1分钟K线
  const klinePromises = stockCodes.map(async (code) => {
    try {
      const klines = await fetch1MinKline(code)
      return { code, klines }
    } catch {
      return { code, klines: [] }
    }
  })

  const results = await Promise.all(klinePromises)

  for (const { code, klines } of results) {
    if (klines.length < 2) continue

    const latestKline = klines[klines.length - 1]
    const prevKlines = klines.slice(0, -1)
    
    // 计算前5根K线的平均成交量
    const avgVolume = prevKlines.reduce((sum, k) => sum + k.volume, 0) / prevKlines.length
    
    // 计算最新K线的涨跌幅
    const pctChange = latestKline.open > 0 
      ? ((latestKline.close - latestKline.open) / latestKline.open) * 100 
      : 0

    // 检查量能异动
    if (strategy.alertTypes.includes('volume_surge')) {
      const volumeMultiplier = avgVolume > 0 ? latestKline.volume / avgVolume : 0
      if (volumeMultiplier >= strategy.volumeSurgeMultiplier) {
        triggeredStocks.push({
          code,
          name: stockNames[code] || code,
          alertType: 'volume_surge',
          value: Math.round(volumeMultiplier * 10) / 10,
          price: latestKline.close,
          triggeredAt: now
        })
      }
    }

    // 检查快速拉升
    if (strategy.alertTypes.includes('rapid_rise')) {
      if (pctChange >= strategy.rapidRiseThreshold) {
        triggeredStocks.push({
          code,
          name: stockNames[code] || code,
          alertType: 'rapid_rise',
          value: Math.round(pctChange * 100) / 100,
          price: latestKline.close,
          triggeredAt: now
        })
      }
    }

    // 检查快速下跌
    if (strategy.alertTypes.includes('rapid_fall')) {
      if (pctChange <= -strategy.rapidFallThreshold) {
        triggeredStocks.push({
          code,
          name: stockNames[code] || code,
          alertType: 'rapid_fall',
          value: Math.round(pctChange * 100) / 100,
          price: latestKline.close,
          triggeredAt: now
        })
      }
    }
  }

  const triggered = triggeredStocks.length > 0

  return {
    ...strategy,
    triggeredStocks,
    lastCheckTime: now,
    status: triggered ? 'triggered' : 'running',
    triggeredAt: triggered && strategy.status !== 'triggered' ? now : strategy.triggeredAt
  }
}

/**
 * 获取分组异动类型的中文标签
 */
export function getGroupAlertTypeLabel(type: GroupAlertType): string {
  const labels: Record<GroupAlertType, string> = {
    volume_surge: '主动攻击',
    rapid_rise: '快速拉升',
    rapid_fall: '快速下跌',
    limit_up: '涨停',
    limit_open: '开板'
  }
  return labels[type] || type
}
