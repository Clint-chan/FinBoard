/**
 * SuperChart 类型定义
 */

// 周期类型
export type ChartPeriod = 
  | 'intraday' 
  | '5min' | '15min' | '30min' | '60min' 
  | 'daily' | 'weekly' | 'monthly'

// 副图指标类型
export type SubIndicator = 'vol' | 'macd' | 'rsi'

// 周期配置
export interface PeriodConfig {
  label: string
  period: string | null
  group: 'minute' | 'day'
}

// 周期映射
export const PERIODS: Record<ChartPeriod, PeriodConfig> = {
  intraday: { label: '分时', period: null, group: 'minute' },
  '5min': { label: '5分', period: '5', group: 'minute' },
  '15min': { label: '15分', period: '15', group: 'minute' },
  '30min': { label: '30分', period: '30', group: 'minute' },
  '60min': { label: '60分', period: '60', group: 'minute' },
  daily: { label: '日K', period: '101', group: 'day' },
  weekly: { label: '周K', period: '102', group: 'day' },
  monthly: { label: '月K', period: '103', group: 'day' }
}

// 主题配色
export interface ChartTheme {
  bg: string
  text: string
  textSecondary: string
  grid: string
  up: string
  down: string
  line: string
  avgLine: string
  bollMid: string
  bollBand: string
  macdUp: string
  macdDown: string
  dif: string
  dea: string
  rsi: string
  tabBg: string
  tabActive: string
  border: string
}

// 浅色主题
export const LIGHT_THEME: ChartTheme = {
  bg: '#ffffff',
  text: '#374151',
  textSecondary: '#9ca3af',
  grid: 'rgba(0,0,0,0.04)',
  up: '#ef4444',
  down: '#10b981',
  line: '#3b82f6',
  avgLine: '#f59e0b',
  bollMid: '#8b5cf6',
  bollBand: 'rgba(139, 92, 246, 0.1)',
  macdUp: '#ef4444',
  macdDown: '#10b981',
  dif: '#3b82f6',
  dea: '#f59e0b',
  rsi: '#8b5cf6',
  tabBg: '#f3f4f6',
  tabActive: '#ffffff',
  border: '#e5e7eb'
}

// 深色主题
export const DARK_THEME: ChartTheme = {
  bg: '#1e293b',
  text: '#e2e8f0',
  textSecondary: '#64748b',
  grid: 'rgba(255,255,255,0.04)',
  up: '#f87171',
  down: '#34d399',
  line: '#60a5fa',
  avgLine: '#fbbf24',
  bollMid: '#a78bfa',
  bollBand: 'rgba(167, 139, 250, 0.15)',
  macdUp: '#f87171',
  macdDown: '#34d399',
  dif: '#60a5fa',
  dea: '#fbbf24',
  rsi: '#a78bfa',
  tabBg: '#334155',
  tabActive: '#475569',
  border: '#475569'
}

// 布局参数
export interface ChartLayout {
  padding: { top: number; right: number; bottom: number; left: number }
  headerH: number
  toolbarH: number
  mainH: number
  subH: number
  subGap: number
  mainSubGap: number
  axisTextGap: number
}

export const DEFAULT_LAYOUT: ChartLayout = {
  padding: { top: 8, right: 58, bottom: 12, left: 12 },
  headerH: 75,
  toolbarH: 38,
  mainH: 150,
  subH: 72,
  subGap: 10,
  mainSubGap: 15,
  axisTextGap: 5
}

// 移动端布局参数
export const MOBILE_LAYOUT: ChartLayout = {
  padding: { top: 6, right: 48, bottom: 10, left: 8 },
  headerH: 60,
  toolbarH: 34,
  mainH: 140,
  subH: 60,
  subGap: 8,
  mainSubGap: 12,
  axisTextGap: 4
}

// 根据屏幕宽度获取布局参数
export function getLayout(width: number): ChartLayout {
  return width <= 500 ? MOBILE_LAYOUT : DEFAULT_LAYOUT
}

// 图表配置（用于缓存）
export interface ChartConfig {
  tab: ChartPeriod
  subIndicators: SubIndicator[]
  showBoll: boolean
}

// 预警线
export interface AlertLine {
  price: number
  operator: 'above' | 'below'
  note?: string
}

// 组件 Props
export interface SuperChartProps {
  code: string
  width?: number
  height?: number
  fillContainer?: boolean
  isDark?: boolean
  defaultTab?: ChartPeriod
  defaultSubIndicators?: SubIndicator[]
  showBoll?: boolean
  onLoad?: () => void
  // 初始数据，避免加载时显示 '--'
  initialName?: string
  initialPrice?: number
  initialPreClose?: number
  pe?: number // 市盈率
  onAddAlert?: (price: number) => void // 添加预警回调
  onConfigChange?: (config: ChartConfig) => void // 配置变化回调
  alertLines?: AlertLine[] // 预警线列表
}

// 处理后的 K 线数据
export interface ProcessedKlineData {
  name: string
  code: string
  klines: import('@/services/chartService').KlinePoint[]
  closes: number[]
  macd: { dif: number[]; dea: number[]; macd: number[] }
  rsi: { rsi6: number[]; rsi12: number[]; rsi24: number[] }
  boll: { mid: number[]; upper: number[]; lower: number[] }
  lastPrice: number
  preClose: number
  priceRange: { min: number; max: number }
}
