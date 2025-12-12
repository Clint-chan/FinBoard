/**
 * AI Chat Service - 调用后端 AI API
 */

const AI_API_BASE = 'https://market-board-api.945036663.workers.dev' // Worker 默认地址

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

/**
 * 发送聊天消息（流式）
 */
export async function sendChatMessage(
  messages: ChatMessage[],
  stockData?: StockDataForAI,
  chartData?: ChartDataForAI,
  mode: AIMode = 'intraday',
  onChunk?: (content: string) => void
): Promise<string> {
  const response = await fetch(`${AI_API_BASE}/api/ai/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messages,
      stockData,
      chartData,
      mode
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
