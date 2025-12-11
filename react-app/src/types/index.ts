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

// 预警条件
export interface AlertCondition {
  type: 'price' | 'pct'
  operator: 'above' | 'below'
  value: number
}

// 预警配置
export interface AlertConfig {
  conditions: AlertCondition[]
}

// 用户配置
export interface UserConfig {
  codes: string[]
  interval: number
  pctThreshold: number
  alerts: Record<string, AlertConfig>
  costs: Record<string, number>
  theme: 'light' | 'dark' | 'auto'
  quoteSource?: QuoteSource // 数据源
  userProfile?: UserProfile
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
export type PageType = 'watchlist' | 'alerts' | 'settings'

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
