/**
 * ChatMessage 组件 - 渲染单条聊天消息
 * 支持 AI 思考过程的流式展示
 */
import { useState, useMemo } from 'react'
import { Reasoning } from '@/components/Reasoning'
import { renderMarkdown } from './markdown'

interface ChatMessageProps {
  role: 'user' | 'ai'
  content: string
  isStreaming?: boolean
  streamStartTime?: number
}

// 解析消息内容，分离思考过程和正式回复
function parseContent(content: string): { thinking: string; reply: string; isThinkingComplete: boolean } {
  // 完整的 <think>...</think>
  const completeMatch = content.match(/<think>([\s\S]*?)<\/think>([\s\S]*)/)
  if (completeMatch) {
    return {
      thinking: completeMatch[1].trim(),
      reply: completeMatch[2].trim(),
      isThinkingComplete: true
    }
  }
  
  // 未闭合的 <think>...（流式中）
  const pendingMatch = content.match(/<think>([\s\S]*)$/)
  if (pendingMatch) {
    return {
      thinking: pendingMatch[1].trim(),
      reply: '',
      isThinkingComplete: false
    }
  }
  
  // 没有 think 标签
  return {
    thinking: '',
    reply: content,
    isThinkingComplete: true
  }
}

export function ChatMessage({ role, content, isStreaming = false, streamStartTime }: ChatMessageProps) {
  const [startTime] = useState(() => streamStartTime || Date.now())
  
  // 解析内容
  const { thinking, reply, isThinkingComplete } = useMemo(() => parseContent(content), [content])
  
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
