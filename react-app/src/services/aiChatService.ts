/**
 * AI Chat Service - 调用后端 AI API
 */

const AI_API_BASE = 'https://market-api.newestgpt.com' // Worker 自定义域名

export type AIMode = 'intraday' | 'trend' | 'fundamental'

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

export interface StockDataForAI {
  code: string
  name: string
  price: number
  preClose: number
  high: number
  low: number
  vol: number
  amt: number
}

export interface ChartDataForAI {
  klines?: Array<{
    date: string
    open: number
    high: number
    low: number
    close: number
    vol: number
  }>
  macd?: {
    dif: number[]
    dea: number[]
    macd: number[]
  }
  rsi?: {
    rsi6: number[]
    rsi12: number[]
    rsi24: number[]
  }
}

// 大模型 API 配置（直接调用，不通过 Worker）
const LLM_CONFIG = {
  apiUrl: 'http://frp3.ccszxc.site:14266/v1/chat/completions',
  apiKey: 'zxc123',
  model: 'gemini-3-pro-preview-thinking'
}

/**
 * 发送聊天消息（流式）
 * 直接调用大模型 API，不通过 Worker 中转
 */
export async function sendChatMessage(
  messages: ChatMessage[],
  stockData?: StockDataForAI,
  chartData?: ChartDataForAI,
  mode: AIMode = 'intraday',
  onChunk?: (content: string) => void
): Promise<string> {
  // 构建系统提示词
  const systemPrompt = mode === 'intraday' 
    ? '你是专业的A股短线交易分析师，专注日内做T策略。基于多周期K线、量价配合、技术指标，给出具体买卖点位、止损止盈和仓位建议。'
    : ''

  // 如果有股票数据，先获取详细数据
  let dataContext = ''
  if (stockData?.code) {
    try {
      const dataResponse = await fetch(`${AI_API_BASE}/api/stock/data/${stockData.code}`)
      if (dataResponse.ok) {
        const data = await dataResponse.json()
        dataContext = data.context || ''
      }
    } catch (error) {
      console.warn('获取股票数据失败:', error)
    }
  }

  // 构建完整消息
  const fullMessages = [
    { role: 'system', content: systemPrompt },
    ...messages.map((msg, idx) => 
      msg.role === 'user' && dataContext && idx === 0
        ? { role: 'user', content: `${dataContext}\n\n${msg.content}` }
        : msg
    )
  ]

  // 直接调用大模型 API
  const response = await fetch(LLM_CONFIG.apiUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${LLM_CONFIG.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: LLM_CONFIG.model,
      messages: fullMessages,
      stream: true
    })
  })

  if (!response.ok) {
    throw new Error(`AI API error: ${response.status}`)
  }

  const reader = response.body?.getReader()
  if (!reader) {
    throw new Error('No response body')
  }

  const decoder = new TextDecoder()
  let fullContent = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    const chunk = decoder.decode(value, { stream: true })
    const lines = chunk.split('\n').filter(line => line.trim())

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = line.slice(6)
        if (data === '[DONE]') continue

        try {
          const json = JSON.parse(data)
          if (json.content) {
            fullContent += json.content
            onChunk?.(json.content)
          }
          if (json.error) {
            throw new Error(json.error)
          }
        } catch (e) {
          console.error('Parse error:', e)
        }
      }
    }
  }

  return fullContent
}

/**
 * 获取 AI 配置
 */
export async function getAIConfig() {
  const response = await fetch(`${AI_API_BASE}/api/ai/config`)
  if (!response.ok) {
    throw new Error('Failed to get AI config')
  }
  return response.json()
}

/**
 * 更新 AI 配置（管理员）
 */
export async function updateAIConfig(config: {
  apiUrl?: string
  apiKey?: string
  model?: string
}) {
  const response = await fetch(`${AI_API_BASE}/api/ai/config`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(config)
  })

  if (!response.ok) {
    throw new Error('Failed to update AI config')
  }

  return response.json()
}
