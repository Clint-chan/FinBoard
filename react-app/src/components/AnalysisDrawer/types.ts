/**
 * AnalysisDrawer 类型定义
 */
import type { StockData } from '@/types'

// AI 分析模式
export type AIMode = 'intraday' | 'trend' | 'fundamental'

// AI 模式配置
export const AI_MODES: Record<AIMode, string> = {
  intraday: '日内做T分析',
  trend: '中期趋势分析',
  fundamental: '财务基本面'
}

// 聊天消息
export interface ChatMessage {
  role: 'user' | 'ai'
  content: string
  isStreaming?: boolean
  streamStartTime?: number
}

// 组件 Props
export interface AnalysisDrawerProps {
  open: boolean
  code: string
  onClose: () => void
  stockList: string[]
  stockData: Record<string, StockData>
  isDark?: boolean
}
