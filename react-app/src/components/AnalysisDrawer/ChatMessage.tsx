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
  onAddAlert?: (code: string, price: number, direction: 'above' | 'below', note: string) => void
}

interface ParsedContent {
  thinking: string
  reply: string
  tradingSignals: TradingSignalsData | null
  isThinkingComplete: boolean
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
    reply = content
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
    // 信号标签未闭合（流式中），移除未完成的部分但不显示
    reply = reply.slice(0, signalsStart).trim()
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
  onAddAlert,
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
    <div className="chat-message ai">
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
          <TradingSignals data={tradingSignals} onAddAlert={onAddAlert} />
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
