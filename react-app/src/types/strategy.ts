/**
 * 策略监控中心 - 类型定义
 * 支持多种策略类型：价格预警、行业套利、AH溢价、假突破/异动
 */

// 策略类型
export type StrategyType = 'price' | 'sector_arb' | 'ah_premium' | 'fake_breakout'

// 策略状态
export type StrategyStatus = 'running' | 'triggered' | 'paused' | 'stopped'

// 基础策略接口
export interface BaseStrategy {
  id: string
  name: string
  type: StrategyType
  status: StrategyStatus
  enabled: boolean
  createdAt: number
  updatedAt: number
  triggeredAt?: number
  note?: string
}

// 价格预警策略
export interface PriceAlertStrategy extends BaseStrategy {
  type: 'price'
  code: string           // 股票代码 如 sh603166
  stockName?: string     // 股票名称
  conditions: PriceCondition[]
}

export interface PriceCondition {
  id?: string            // 唯一标识，用于动画
  type: 'price' | 'pct'
  operator: 'above' | 'below'
  value: number
  note?: string // 备注（用于浏览器通知）
  triggered?: boolean
  triggeredAt?: number
}

// 监控逻辑模式
export type PairMonitorMode = 'spread' | 'ratio' | 'return_diff'

// 配对监控策略（原行业套利）
export interface SectorArbStrategy extends BaseStrategy {
  type: 'sector_arb'
  stockACode: string       // 核心观察标的 (X)
  stockAName?: string
  stockBCode: string       // 对标/基准标的 (Y)
  stockBName?: string
  monitorMode: PairMonitorMode  // 监控逻辑模式
  threshold: number        // 偏离阈值 如 5%
  // 关联板块（可选）- 用于计算相对板块的溢价/折价
  sectorCode?: string      // 板块代码 如 BK0447
  sectorName?: string      // 板块名称 如 机器人
  // 统计数据
  correlation?: number     // 历史相关性
  beta?: number            // Beta系数
  // 实时数据
  stockAPrice?: number
  stockAPct?: number       // 标的A涨跌幅
  stockBPrice?: number
  stockBPct?: number       // 标的B涨跌幅
  sectorPct?: number       // 板块涨跌幅（当有关联板块时）
  deviation?: number       // 当前偏离度
  // 相对板块的溢价/折价（当有关联板块时）
  stockAVsSector?: number  // X 相对板块的溢价/折价
  stockBVsSector?: number  // Y 相对板块的溢价/折价
}

// AH溢价策略
export interface AHPremiumStrategy extends BaseStrategy {
  type: 'ah_premium'
  aCode: string          // A股代码 如 sh600036
  aName?: string
  hCode: string          // H股代码 如 03968
  hName?: string
  lowThreshold: number   // 低溢价阈值（做多A）如 25%
  highThreshold: number  // 高溢价阈值（做空A）如 40%
  avgPremium?: number    // 历史平均溢价率
  // 实时数据
  aPrice?: number
  hPrice?: number
  premium?: number       // 当前溢价率
  exchangeRate?: number  // 汇率
}

// 假突破/异动策略
export interface FakeBreakoutStrategy extends BaseStrategy {
  type: 'fake_breakout'
  sectorCode: string     // 板块代码 如 BK0447
  sectorName?: string    // 板块名称 如 半导体
  openThreshold: number  // 高开阈值 如 3%
  volumeRatioThreshold: number // 量比阈值 如 1
  // 实时数据
  sectorPct?: number     // 板块涨跌幅
  suspects?: FakeBreakoutSuspect[] // 疑似诱多标的
}

export interface FakeBreakoutSuspect {
  code: string
  name: string
  openPct: number        // 开盘涨幅
  currentPct: number     // 当前涨幅
  volumeRatio: number    // 量比
  sectorPct: number      // 板块涨幅
}

// 联合策略类型
export type Strategy = PriceAlertStrategy | SectorArbStrategy | AHPremiumStrategy | FakeBreakoutStrategy

// 策略配置（用于存储）
export interface StrategyConfig {
  strategies: Strategy[]
  lastUpdated: number
}

// 策略历史记录
export interface StrategyHistoryItem {
  strategyId: string
  strategyName: string
  strategyType: StrategyType
  triggeredAt: number
  confirmedAt: number
  details: string
}

// AH股比价数据
export interface AHComparisonData {
  aCode: string
  aName: string
  hCode: string
  hName: string
  aPrice: number
  hPrice: number
  premium: number        // 溢价率 %
  exchangeRate: number   // 港币兑人民币汇率
}

// 行业板块数据
export interface SectorData {
  code: string           // 板块代码 BK0447
  name: string           // 板块名称
  price: number          // 最新价
  pctChg: number         // 涨跌幅
  turnover: number       // 换手率
  upCount: number        // 上涨家数
  downCount: number      // 下跌家数
  leadStock: string      // 领涨股票
  leadStockPct: number   // 领涨股票涨跌幅
}
