/**
 * 示例策略数据 - 用于演示和测试
 */
import type { Strategy, SectorArbStrategy, AHPremiumStrategy, FakeBreakoutStrategy, PriceAlertStrategy } from '@/types/strategy'

export const SAMPLE_STRATEGIES: Strategy[] = [
  // 行业套利策略 - 机器人板块
  {
    id: 'sample_sector_arb_1',
    name: '机器人板块强弱配对',
    type: 'sector_arb',
    status: 'triggered',
    enabled: true,
    createdAt: Date.now() - 86400000,
    updatedAt: Date.now(),
    triggeredAt: Date.now() - 3600000,
    note: '策略逻辑: 多头超额收益 > 5% 且 空头跑输行业',
    longCode: 'sh603166',
    longName: '福达股份',
    shortCode: 'sz002050',
    shortName: '三花智控',
    benchmarkCode: 'sz159770',
    benchmarkName: '机器人ETF',
    threshold: 5,
    longPct: 5.23,
    shortPct: -2.41,
    benchmarkPct: 2.1,
    deviation: 7.8
  } as SectorArbStrategy,

  // AH溢价策略 - 招商银行
  {
    id: 'sample_ah_premium_1',
    name: '招商银行溢价监控',
    type: 'ah_premium',
    status: 'running',
    enabled: true,
    createdAt: Date.now() - 172800000,
    updatedAt: Date.now(),
    note: '策略逻辑: 溢价率超出 25%-40% 区间',
    aCode: 'sh600036',
    aName: '招商银行',
    hCode: '03968',
    hName: '招商银行',
    lowThreshold: 25,
    highThreshold: 40,
    avgPremium: 30,
    aPrice: 35.20,
    hPrice: 28.50,
    premium: 32.5,
    exchangeRate: 0.92
  } as AHPremiumStrategy,

  // 假突破策略 - 半导体板块
  {
    id: 'sample_fake_breakout_1',
    name: '半导体板块 · 诱多监控',
    type: 'fake_breakout',
    status: 'running',
    enabled: true,
    createdAt: Date.now() - 259200000,
    updatedAt: Date.now(),
    note: '监控逻辑：个股高开 > 3% 且 竞价量比 < 1，同时板块指数低开或走弱',
    sectorCode: 'BK0447',
    sectorName: '半导体',
    openThreshold: 3,
    volumeRatioThreshold: 1,
    sectorPct: -0.5,
    suspects: [
      {
        code: 'sh603501',
        name: '韦尔股份',
        openPct: 3.2,
        currentPct: 1.5,
        volumeRatio: 0.8,
        sectorPct: -0.5
      }
    ]
  } as FakeBreakoutStrategy,

  // 价格预警策略 - 福达股份
  {
    id: 'sample_price_alert_1',
    name: '福达股份',
    type: 'price',
    status: 'running',
    enabled: true,
    createdAt: Date.now() - 345600000,
    updatedAt: Date.now(),
    note: '日线 MACD 金叉',
    code: 'sh603166',
    stockName: 'SH603166',
    conditions: [
      {
        type: 'price',
        operator: 'above',
        value: 15.00,
        triggered: false
      }
    ]
  } as PriceAlertStrategy
]

/**
 * 初始化示例策略（仅在没有策略时）
 */
export function initSampleStrategies(): Strategy[] {
  const STORAGE_KEY = 'fintell_strategies'
  const cached = localStorage.getItem(STORAGE_KEY)
  
  if (!cached) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      strategies: SAMPLE_STRATEGIES,
      lastUpdated: Date.now()
    }))
    return SAMPLE_STRATEGIES
  }
  
  try {
    const config = JSON.parse(cached)
    return config.strategies || []
  } catch {
    return []
  }
}
