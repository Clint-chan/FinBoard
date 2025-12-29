// 股票数据类型
export interface StockData {
  name: string
  price: number
  preClose: number
  open: number
  vol: number
  high: number
  low: number
  amt: number
  turnover?: number // 换手率
  pe?: number // 市盈率
  pb?: number // 市净率
}

// 数据源类型
export type QuoteSource = 'eastmoney' | 'tencent' | 'sina'

// 颜色模式类型
export type ColorMode = 'normal' | 'stealth'

// 预警条件
export interface AlertCondition {
  type: 'price' | 'pct'
  operator: 'above' | 'below'
  value: number
  note?: string // 备注（AI 策略理由等）
  triggered?: boolean // 是否已触发
  triggeredAt?: number // 触发时间戳
}

// 预警配置
export interface AlertConfig {
  conditions: AlertCondition[]
}

// 预警历史记录（策略中心使用的新格式）
export interface StrategyAlertHistoryItem {
  id: string
  type: 'sector_arb' | 'ah_premium' | 'fake_breakout' | 'price' | 'system'
  title: string
  description: string
  timestamp: number
  data?: Record<string, unknown>
}

// 旧版预警历史记录（保留兼容）
export interface AlertHistoryItem {
  code: string
  stockName: string
  condition: AlertCondition
  triggeredAt: number
  confirmedAt: number
  price: number // 触发时的价格
}

// 股票分类
export interface StockCategory {
  id: string
  name: string
  codes: string[] // 该分类下的股票代码
}

// 用户配置
export interface UserConfig {
  codes: string[]
  interval: number
  pctThreshold: number
  alerts: Record<string, AlertConfig>
  costs: Record<string, number>
  theme: 'light' | 'dark' | 'auto'
  colorMode?: ColorMode // 颜色模式：normal=红涨绿跌，stealth=低调黑白
  quoteSource?: QuoteSource // 数据源
  userProfile?: UserProfile
  alertHistory?: StrategyAlertHistoryItem[] // 策略预警历史记录（云同步）
  refreshOnlyInMarketHours?: boolean // 仅在交易时间刷新
  strategyCheckInterval?: number // 策略检查间隔（秒），用于非价格策略如配对监控、AH溢价等
  strategies?: unknown[] // 策略中心的策略列表（云同步）
  categories?: StockCategory[] // 股票分类
}

// 用户资料
export interface UserProfile {
  username: string
  avatar?: string
}

// 搜索结果
export interface SearchResult {
  code: string
  name: string
}

// 分时数据点
export interface IntradayPoint {
  time: string
  open: number
  price: number
  high: number
  low: number
  volume: number
  amount: number
  avgPrice: number
}

// 分时数据
export interface IntradayData {
  code: string
  name: string
  preClose: number
  trends: IntradayPoint[]
}

// 状态类型
export type LoadingStatus = 'loading' | 'success' | 'error' | 'closed'

// 页面类型
export type PageType = 'watchlist' | 'strategies' | 'admin' | 'daily'

// 右键菜单状态
export interface ContextMenuState {
  open: boolean
  x: number
  y: number
  code: string | null
}

// 图表悬浮状态
export interface ChartTooltipState {
  visible: boolean
  code: string | null
  x: number
  y: number
}

// 弹窗状态
export interface ModalState<T = null> {
  open: boolean
  data: T
}


// ============ Daily Report 类型 ============

// 情报项
export interface IntelItem {
  title: string
  tag: 'bullish' | 'bearish' | 'neutral'
  tagText: string
  summary: string
}

// 情报分类
export interface IntelCategory {
  category: string
  color: 'tech' | 'fin' | 'geo' | 'soc' | 'other'
  items: IntelItem[]
}

// 剧本步骤
export interface ScenarioStep {
  title: string
  desc: string
  active: boolean
}

// 大盘研判
export interface MarketPrediction {
  tone: string
  subtitle: string
  summary: string
  northbound: string
  volume: string
  scenarios: ScenarioStep[]
}

// 板块分析项
export interface SectorItem {
  name: string
  tag: 'bullish' | 'bearish' | 'neutral'
  tagText: string
  reason: string
  focus: string
}

// 板块分析
export interface SectorAnalysis {
  bullish: SectorItem[]
  bearish: SectorItem[]
}

// 交易策略
export interface ActionableSummary {
  avoid: string
  focus: string
}

// 日报内容
export interface DailyReportContent {
  date: string
  intelligence: IntelCategory[]
  prediction: MarketPrediction
  sectors: SectorAnalysis
  actionable: ActionableSummary
}

// 日报列表项
export interface DailyReportListItem {
  report_date: string
  news_count: number
  created_at: string
}
