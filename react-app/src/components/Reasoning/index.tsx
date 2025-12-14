/**
 * Reasoning 组件 - AI 思考过程展示
 * 参考 Vercel AI SDK 的设计风格
 */
import { useState, useEffect, useRef } from 'react'
import { renderMarkdown } from '../AnalysisDrawer/markdown'
import './Reasoning.css'

interface ReasoningProps {
  content: string
  isStreaming: boolean
  startTime?: number
}

export function Reasoning({ content, isStreaming, startTime }: ReasoningProps) {
  const [isOpen, setIsOpen] = useState(true)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [finalSeconds, setFinalSeconds] = useState(0)
  const contentRef = useRef<HTMLDivElement>(null)
  const [contentHeight, setContentHeight] = useState<number>(0)

  // 计时器
  useEffect(() => {
    if (!isStreaming) {
      // 流式结束，记录最终时间
      if (elapsedSeconds > 0) {
        setFinalSeconds(elapsedSeconds)
      }
      return
    }

    const start = startTime || Date.now()
    const timer = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - start) / 1000))
    }, 1000)

    return () => clearInterval(timer)
  }, [isStreaming, startTime, elapsedSeconds])

  // 流式结束时自动折叠（带延迟）
  useEffect(() => {
    if (!isStreaming && content) {
      const timer = setTimeout(() => setIsOpen(false), 800)
      return () => clearTimeout(timer)
    }
  }, [isStreaming, content])

  // 计算内容高度用于动画
  useEffect(() => {
    if (contentRef.current) {
      setContentHeight(contentRef.current.scrollHeight)
    }
  }, [content])

  if (!content) return null

  // 状态文字：Thinking... / Thought for X seconds
  const displaySeconds = isStreaming ? elapsedSeconds : (finalSeconds || elapsedSeconds)
  const statusText = isStreaming
    ? `Thinking${elapsedSeconds > 0 ? ` for ${elapsedSeconds} seconds` : '...'}`
    : `Thought for ${displaySeconds} second${displaySeconds !== 1 ? 's' : ''}`

  return (
    <div className={`reasoning ${isOpen ? 'open' : 'closed'} ${isStreaming ? 'streaming' : ''}`}>
      <button
        className="reasoning-trigger"
        onClick={() => setIsOpen(!isOpen)}
        type="button"
      >
        <svg className="reasoning-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
        <span className="reasoning-status">{statusText}</span>
        <svg className="reasoning-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      <div
        className="reasoning-content-wrapper"
        style={{ height: isOpen ? contentHeight : 0 }}
      >
        <div 
          className="reasoning-content" 
          ref={contentRef}
          dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }}
        />
      </div>
    </div>
  )
}

export default Reasoning
