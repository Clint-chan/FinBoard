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
  timestamp?: string // 当前时间戳（ISO格式）
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
 * 获取用户 AI 配额
 */
// 获取存储的 token
function getStoredToken(): string | null {
  try {
    const auth = localStorage.getItem('market_board_auth')
    if (auth) {
      const parsed = JSON.parse(auth)
      return parsed.token || null
    }
  } catch {
    // ignore
  }
  return null
}

/**
 * 获取用户 AI 配额
 */
export async function getUserQuota(): Promise<{
  quota: number
  used: number
  remaining: number
}> {
  const token = getStoredToken()
  if (!token) {
    throw new Error('未登录')
  }

  const response = await fetch(`${AI_API_BASE}/api/user/quota`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  })

  if (!response.ok) {
    throw new Error('获取配额失败')
  }

  return response.json()
}

/**
 * 发送聊天消息（流式）
 */
export async function sendChatMessage(
  messages: ChatMessage[],
  stockData?: StockDataForAI,
  _chartData?: ChartDataForAI,
  mode: AIMode = 'intraday',
  onChunk?: (content: string) => void
): Promise<string> {
  // 获取 token 用于配额验证
  const token = getStoredToken()
  
  // 通过 Worker 调用 AI（Worker 负责系统提示词和数据采集）
  const response = await fetch(`${AI_API_BASE}/api/ai/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messages,
      stockData,
      mode,
      token // 传递 token 用于配额验证
    })
  })

  if (!response.ok) {
    // 检查是否是配额用尽
    if (response.status === 429) {
      const data = await response.json()
      throw new Error(data.error || '今日 AI 使用次数已用完')
    }
    
    // 尝试解析错误信息
    try {
      const errorData = await response.json()
      // 使用后端返回的错误信息（已经过滤敏感信息）
      throw new Error(errorData.error || errorData.details || 'AI 服务暂时不可用')
    } catch (e) {
      // 如果无法解析 JSON，返回通用错误
      throw new Error('AI 服务暂时不可用')
    }
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
