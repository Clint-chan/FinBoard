/**
 * ChatMessage 组件 - 渲染单条聊天消息
 * 支持 AI 思考过程和交易信号卡片的流式展示
 */
import { useState, useMemo } from 'react'
import { Reasoning } from '@/components/Reasoning'
import { TradingSignals, type TradingSignalsData } from '@/components/TradingSignals'
import { renderMarkdown } from './markdown'

interface ChatMessageProps {
  role: 'user' | 'ai'
  content: string
  isStreaming?: boolean
  streamStartTime?: number
  onSaveAlerts?: (code: string, alerts: Array<{ price: number; operator: 'above' | 'below'; note: string }>) => void
  compact?: boolean // 紧凑模式，用于移动端全屏对话
}

interface ParsedContent {
  thinking: string
  reply: string
  tradingSignals: TradingSignalsData | null
  isThinkingComplete: boolean
}

// 尝试修复不完整的 JSON（流式传输时可能被截断）
function tryFixIncompleteJson(jsonStr: string): string | null {
  if (!jsonStr || jsonStr.length < 10) return null
  
  // 移除可能的结束标签残留
  let str = jsonStr.replace(/<\/trading_signals>?.*$/s, '').trim()
  
  // 如果已经是完整的 JSON，直接返回
  try {
    JSON.parse(str)
    return str
  } catch {
    // 继续尝试修复
  }
  
  // 尝试补全 JSON
  // 1. 检查是否在字符串中间被截断
  const lastQuote = str.lastIndexOf('"')
  const lastColon = str.lastIndexOf(':')
  const lastComma = str.lastIndexOf(',')
  
  // 如果最后是在字符串值中间截断，尝试补全
  if (lastQuote > lastColon && lastQuote > lastComma) {
    // 可能在字符串值中间，尝试截断到上一个完整的对象
    const lastCompleteObj = str.lastIndexOf('},')
    if (lastCompleteObj > 0) {
      str = str.slice(0, lastCompleteObj + 1)
    }
  }
  
  // 计算需要补全的括号
  let braceCount = 0
  let bracketCount = 0
  let inString = false
  let escape = false
  
  for (const char of str) {
    if (escape) {
      escape = false
      continue
    }
    if (char === '\\') {
      escape = true
      continue
    }
    if (char === '"') {
      inString = !inString
      continue
    }
    if (inString) continue
    
    if (char === '{') braceCount++
    else if (char === '}') braceCount--
    else if (char === '[') bracketCount++
    else if (char === ']') bracketCount--
  }
  
  // 如果在字符串中间，先闭合字符串
  if (inString) {
    str += '"'
  }
  
  // 补全括号
  while (bracketCount > 0) {
    str += ']'
    bracketCount--
  }
  while (braceCount > 0) {
    str += '}'
    braceCount--
  }
  
  // 验证修复后的 JSON
  try {
    JSON.parse(str)
    return str
  } catch {
    return null
  }
}

// 解析消息内容，分离思考过程、正式回复和交易信号
function parseContent(content: string): ParsedContent {
  let thinking = ''
  let reply = ''
  let tradingSignals: TradingSignalsData | null = null
  let isThinkingComplete = true

  // 1. 解析 <think> 标签
  const thinkStart = content.indexOf('<think>')
  const thinkEnd = content.indexOf('</think>')

  if (thinkStart !== -1) {
    // 移除 <think> 前面的内容（通常是大模型重复的问候语）
    // const beforeThink = content.slice(0, thinkStart).trim()
    
    if (thinkEnd !== -1) {
      thinking = content.slice(thinkStart + 7, thinkEnd).trim()
      reply = content.slice(thinkEnd + 8).trim()
      isThinkingComplete = true
    } else {
      // 检查部分结束标签
      const partialEndTags = ['</think', '</thin', '</thi', '</th', '</t', '</']
      let foundPartial = false
      for (const partial of partialEndTags) {
        if (content.endsWith(partial)) {
          thinking = content.slice(thinkStart + 7, -partial.length).trim()
          isThinkingComplete = false
          foundPartial = true
          break
        }
      }
      if (!foundPartial) {
        thinking = content.slice(thinkStart + 7).trim()
        isThinkingComplete = false
      }
    }
  } else {
    // 检查是否有部分的 <think 标签（流式中）
    const partialThinkTags = ['<think', '<thin', '<thi', '<th', '<t']
    let hasPartialThink = false
    for (const partial of partialThinkTags) {
      if (content.endsWith(partial)) {
        reply = content.slice(0, -partial.length).trim()
        hasPartialThink = true
        break
      }
    }
    if (!hasPartialThink) {
      reply = content
    }
  }

  // 2. 解析 <trading_signals> 标签
  const signalsStart = reply.indexOf('<trading_signals>')
  const signalsEnd = reply.indexOf('</trading_signals>')

  if (signalsStart !== -1 && signalsEnd !== -1) {
    const jsonStr = reply.slice(signalsStart + 17, signalsEnd).trim()
    const textBeforeSignals = reply.slice(0, signalsStart).trim()

    try {
      tradingSignals = JSON.parse(jsonStr)
    } catch (e) {
      console.error('Failed to parse trading signals:', e, jsonStr)
    }

    reply = textBeforeSignals
  } else if (signalsStart !== -1) {
    // 信号标签未闭合，尝试解析不完整的 JSON
    const jsonStr = reply.slice(signalsStart + 17).trim()
    const textBeforeSignals = reply.slice(0, signalsStart).trim()
    
    // 尝试修复不完整的 JSON
    const fixedJson = tryFixIncompleteJson(jsonStr)
    if (fixedJson) {
      try {
        tradingSignals = JSON.parse(fixedJson)
      } catch (e) {
        // 解析失败，保持 null
      }
    }
    
    reply = textBeforeSignals
  } else {
    // 检查是否有部分的开始标签（流式中可能被拆分）
    const partialStartTags = [
      '<trading_signals',
      '<trading_signal',
      '<trading_signa',
      '<trading_sign',
      '<trading_sig',
      '<trading_si',
      '<trading_s',
      '<trading_',
      '<trading',
      '<tradin',
      '<tradi',
      '<trad',
      '<tra',
    ]
    for (const partial of partialStartTags) {
      if (reply.endsWith(partial)) {
        reply = reply.slice(0, -partial.length).trim()
        break
      }
    }
  }

  // 3. 移除 "交易信号数据" 标题（如果存在）
  reply = reply.replace(/###\s*交易信号数据\s*$/m, '').trim()

  return { thinking, reply, tradingSignals, isThinkingComplete }
}

export function ChatMessage({
  role,
  content,
  isStreaming = false,
  streamStartTime,
  onSaveAlerts,
  compact = false,
}: ChatMessageProps) {
  const [startTime] = useState(() => streamStartTime || Date.now())

  // 解析内容
  const { thinking, reply, tradingSignals, isThinkingComplete } = useMemo(
    () => parseContent(content),
    [content]
  )

  // 用户消息
  if (role === 'user') {
    return (
      <div className="chat-message user">
        <div className="bubble">{content}</div>
      </div>
    )
  }

  // AI 消息
  return (
    <div className={`chat-message ai ${compact ? 'compact' : ''}`}>
      <div className="bubble">
        {/* 思考过程 */}
        {thinking && (
          <Reasoning
            content={thinking}
            isStreaming={!isThinkingComplete}
            startTime={startTime}
          />
        )}

        {/* 正式回复 */}
        {reply && (
          <div
            className="reply-content"
            dangerouslySetInnerHTML={{ __html: renderMarkdown(reply) }}
          />
        )}

        {/* 交易信号卡片 */}
        {tradingSignals && (
          <TradingSignals data={tradingSignals} onSaveAlerts={onSaveAlerts} />
        )}

        {/* 空内容时显示加载状态 */}
        {!thinking && !reply && isStreaming && (
          <div className="loading-dots">
            <span></span>
            <span></span>
            <span></span>
          </div>
        )}
      </div>
    </div>
  )
}

export default ChatMessage
