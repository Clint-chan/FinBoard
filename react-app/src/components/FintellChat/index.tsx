/**
 * FintellChat - 全屏 AI 对话组件
 * 对照 2.html 设计的 Fintell Modal
 */
import { useState, useCallback, useRef, useEffect } from 'react'
import { ChatMessage as ChatMessageComponent } from '@/components/AnalysisDrawer/ChatMessage'
import type { StockData } from '@/types'
import { type AIMode, AI_MODES, type ChatMessage } from '@/components/AnalysisDrawer/types'
import './FintellChat.css'

interface FintellChatProps {
  open: boolean
  onClose: () => void
  stockCode?: string
  stockData?: Record<string, StockData>
  stockList?: string[]
  isDark?: boolean
  onSaveAlerts?: (code: string, alerts: Array<{ price: number; operator: 'above' | 'below'; note: string }>) => void
}

export function FintellChat({
  open,
  onClose,
  stockCode,
  stockData = {},
  stockList = [],
  isDark = false,
  onSaveAlerts
}: FintellChatProps) {
  const [currentCode, setCurrentCode] = useState(stockCode || stockList[0] || '')
  const [aiMode, setAiMode] = useState<AIMode>('intraday')
  const [chatHistory, setChatHistory] = useState<Record<string, ChatMessage[]>>({})
  const [inputValue, setInputValue] = useState('')
  const [aiQuota, setAiQuota] = useState<{ quota: number; used: number; remaining: number } | null>(null)
  const [showStockSelect, setShowStockSelect] = useState(false)
  const [showModeSelect, setShowModeSelect] = useState(false)
  
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const messagesRef = useRef<HTMLDivElement>(null)

  // 同步初始代码
  useEffect(() => {
    if (open && stockCode) {
      setCurrentCode(stockCode)
    }
  }, [open, stockCode])

  // 初始化聊天历史
  useEffect(() => {
    if (currentCode && !chatHistory[currentCode]) {
      const stockName = stockData[currentCode]?.name || currentCode
      setChatHistory(prev => ({
        ...prev,
        [currentCode]: [{
          role: 'ai',
          content: `你好！我是 Fintell。当前正在分析 **${stockName}**。\n\n你想了解它的基本面数据，还是技术面分析？`
        }]
      }))
    }
  }, [currentCode, stockData, chatHistory])

  // 加载 AI 配额
  useEffect(() => {
    if (open) {
      import('@/services/aiChatService').then(({ getUserQuota }) => {
        getUserQuota().then(setAiQuota).catch(console.error)
      })
    }
  }, [open])

  // 发送消息
  const sendMessage = useCallback(async () => {
    const text = inputValue.trim()
    if (!text || !currentCode) return

    setInputValue('')
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }

    const currentMessages = chatHistory[currentCode] || []
    const aiMsgIndex = currentMessages.length + 1
    const streamStartTime = Date.now()

    const userMsg = { role: 'user' as const, content: text }
    const aiMsg = { role: 'ai' as const, content: '', isStreaming: true, streamStartTime }
    setChatHistory(prev => ({
      ...prev,
      [currentCode]: [...(prev[currentCode] || []), userMsg, aiMsg]
    }))

    try {
      const { sendChatMessage } = await import('@/services/aiChatService')
      
      const currentStock = stockData[currentCode]
      const stockDataForAI = currentStock ? {
        code: currentCode,
        name: currentStock.name,
        price: currentStock.price,
        preClose: currentStock.preClose,
        high: currentStock.high || currentStock.price,
        low: currentStock.low || currentStock.price,
        vol: currentStock.vol || 0,
        amt: currentStock.amt || 0,
        timestamp: new Date().toISOString()
      } : undefined

      const historyMessages = (chatHistory[currentCode] || []).map(msg => ({
        role: msg.role === 'ai' ? 'assistant' as const : msg.role,
        content: msg.content
      }))

      await sendChatMessage(
        [...historyMessages, { role: 'user', content: text }],
        stockDataForAI,
        undefined,
        aiMode,
        (chunk) => {
          setChatHistory(prev => {
            const messages = [...(prev[currentCode] || [])]
            if (messages[aiMsgIndex]) {
              messages[aiMsgIndex] = {
                ...messages[aiMsgIndex],
                content: messages[aiMsgIndex].content + chunk
              }
            }
            return { ...prev, [currentCode]: messages }
          })
        }
      )
      
      setChatHistory(prev => {
        const messages = [...(prev[currentCode] || [])]
        if (messages[aiMsgIndex]) {
          messages[aiMsgIndex] = { ...messages[aiMsgIndex], isStreaming: false }
        }
        return { ...prev, [currentCode]: messages }
      })
      
      import('@/services/aiChatService').then(({ getUserQuota }) => {
        getUserQuota().then(setAiQuota).catch(console.error)
      })
    } catch (error) {
      console.error('AI error:', error)
      let errorMsg = 'AI 服务暂时不可用'
      
      if (error instanceof Error) {
        if (error.message.includes('登录') || error.message.includes('401')) {
          errorMsg = '请先登录后使用 AI 功能'
        } else if (error.message.includes('429') || error.message.includes('用完')) {
          errorMsg = '今日 AI 使用次数已用完'
        }
      }
      
      setChatHistory(prev => {
        const messages = [...(prev[currentCode] || [])]
        if (messages[aiMsgIndex]) {
          messages[aiMsgIndex] = { role: 'ai', content: `抱歉，${errorMsg}`, isStreaming: false }
        }
        return { ...prev, [currentCode]: messages }
      })
    }
  }, [inputValue, currentCode, stockData, aiMode, chatHistory])

  // 处理输入框变化
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputValue(e.target.value)
    e.target.style.height = 'auto'
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'
  }, [])

  // 处理键盘事件
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }, [sendMessage])

  // 滚动到底部
  useEffect(() => {
    if (messagesRef.current) {
      messagesRef.current.scrollTop = messagesRef.current.scrollHeight
    }
  }, [chatHistory, currentCode])

  const currentStock = stockData[currentCode]
  const messages = chatHistory[currentCode] || []

  return (
    <div className={`fintell-modal ${open ? 'open' : ''} ${isDark ? 'dark' : ''}`}>
      {/* 头部 */}
      <div className="fintell-header">
        <div className="fintell-close" onClick={onClose}>✕</div>
        <div className="fintell-title">Fintell 智能助手</div>
        <div className="fintell-action">
          {aiQuota && (
            <span className={`quota-badge ${aiQuota.remaining <= 1 ? 'low' : ''}`}>
              {aiQuota.remaining}/{aiQuota.quota}
            </span>
          )}
        </div>
      </div>

      {/* 聊天内容 */}
      <div className="fintell-content" ref={messagesRef}>
        {messages.map((msg, i) => (
          <div key={i} className={`chat-row ${msg.role}`}>
            {msg.role === 'ai' && <div className="chat-avatar">F</div>}
            <ChatMessageComponent
              role={msg.role}
              content={msg.content}
              isStreaming={msg.isStreaming}
              streamStartTime={msg.streamStartTime}
              onSaveAlerts={onSaveAlerts}
              compact
            />
          </div>
        ))}
      </div>

      {/* 输入区域 */}
      <div className="fintell-input-area">
        {/* 快捷选择栏 */}
        <div className="fintell-toolbar">
          {/* 股票选择 */}
          <div 
            className={`toolbar-chip ${showStockSelect ? 'active' : ''}`}
            onClick={() => { setShowStockSelect(!showStockSelect); setShowModeSelect(false) }}
          >
            <span>{currentStock?.name || currentCode || '选择股票'}</span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
            {showStockSelect && (
              <div className="chip-dropdown">
                {stockList.map(code => {
                  const d = stockData[code]
                  return (
                    <div
                      key={code}
                      className={`chip-option ${code === currentCode ? 'active' : ''}`}
                      onClick={(e) => { e.stopPropagation(); setCurrentCode(code); setShowStockSelect(false) }}
                    >
                      {d?.name || code}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* AI 模式选择 */}
          <div 
            className={`toolbar-chip ${showModeSelect ? 'active' : ''}`}
            onClick={() => { setShowModeSelect(!showModeSelect); setShowStockSelect(false) }}
          >
            <span>{AI_MODES[aiMode].replace('分析', '')}</span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
            {showModeSelect && (
              <div className="chip-dropdown">
                {(Object.keys(AI_MODES) as AIMode[]).map(mode => (
                  <div
                    key={mode}
                    className={`chip-option ${aiMode === mode ? 'active' : ''}`}
                    onClick={(e) => { e.stopPropagation(); setAiMode(mode); setShowModeSelect(false) }}
                  >
                    {AI_MODES[mode]}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 输入框 */}
        <div className="fintell-input-row">
          <textarea
            ref={textareaRef}
            className="fintell-input"
            placeholder="输入你想问的问题..."
            rows={1}
            value={inputValue}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
          />
          <button
            className="fintell-send"
            disabled={!inputValue.trim()}
            onClick={sendMessage}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13"></line>
              <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}

export default FintellChat
