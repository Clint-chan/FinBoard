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
  FakeBreakoutSuspect
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
  } catch (e) {
    console.warn('Failed to save strategies:', e)
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
 * 检查行业套利策略
 */
export async function checkSectorArbStrategy(
  strategy: SectorArbStrategy
): Promise<SectorArbStrategy> {
  const codes = [strategy.longCode, strategy.shortCode, strategy.benchmarkCode]
  const quotes = await fetchQuotes(codes)
  
  const longData = quotes[strategy.longCode]
  const shortData = quotes[strategy.shortCode]
  const benchmarkData = quotes[strategy.benchmarkCode]
  
  if (!longData || !shortData || !benchmarkData) {
    return strategy
  }
  
  const longPct = longData.preClose ? ((longData.price - longData.preClose) / longData.preClose * 100) : 0
  const shortPct = shortData.preClose ? ((shortData.price - shortData.preClose) / shortData.preClose * 100) : 0
  const benchmarkPct = benchmarkData.preClose ? ((benchmarkData.price - benchmarkData.preClose) / benchmarkData.preClose * 100) : 0
  
  // 计算偏离度：做多标的相对基准的超额 - 做空标的相对基准的超额
  const longExcess = longPct - benchmarkPct
  const shortExcess = shortPct - benchmarkPct
  const deviation = longExcess - shortExcess
  
  const triggered = Math.abs(deviation) >= strategy.threshold
  
  return {
    ...strategy,
    longName: longData.name,
    shortName: shortData.name,
    benchmarkName: benchmarkData.name,
    longPct,
    shortPct,
    benchmarkPct,
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
    sector_arb: '行业套利',
    ah_premium: 'AH溢价',
    fake_breakout: '假突破'
  }
  return labels[type] || type
}

export function getStrategyTypeColor(type: string): string {
  const colors: Record<string, string> = {
    price: 'type-price',
    sector_arb: 'type-sector-arb',
    ah_premium: 'type-ah-premium',
    fake_breakout: 'type-fake-breakout'
  }
  return colors[type] || 'type-default'
}
