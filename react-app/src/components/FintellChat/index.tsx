/**
 * FintellChat - 移动端全屏 AI 对话组件
 * 移植自电脑端 AnalysisDrawer 的 Fintell 界面
 * 保持所有交互细节一致：动画、气泡、markdown、思考过程、交易信号
 */
import { useState, useCallback, useRef, useEffect } from 'react'
import { ChatMessage as ChatMessageComponent } from '@/components/AnalysisDrawer/ChatMessage'
import { sendChatMessage, getUserQuota } from '@/services/aiChatService'
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
  const [aiModeOpen, setAiModeOpen] = useState(false)
  const [stockSelectOpen, setStockSelectOpen] = useState(false)
  
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const messagesRef = useRef<HTMLDivElement>(null)
  const modalRef = useRef<HTMLDivElement>(null)

  // 键盘弹出时精确定位输入框
  useEffect(() => {
    if (!open) return
    
    const viewport = window.visualViewport
    if (!viewport) return

    const handleResize = () => {
      if (!modalRef.current) return
      
      // 直接使用 visualViewport 的高度作为 modal 高度
      // 这样输入框会紧贴键盘顶部
      const viewportHeight = viewport.height
      modalRef.current.style.height = `${viewportHeight}px`
      
      // 滚动到底部
      requestAnimationFrame(() => {
        if (messagesRef.current) {
          messagesRef.current.scrollTop = messagesRef.current.scrollHeight
        }
      })
    }

    // 初始化
    handleResize()
    
    viewport.addEventListener('resize', handleResize)
    viewport.addEventListener('scroll', handleResize)
    
    return () => {
      viewport.removeEventListener('resize', handleResize)
      viewport.removeEventListener('scroll', handleResize)
      // 恢复默认高度
      if (modalRef.current) {
        modalRef.current.style.height = ''
      }
    }
  }, [open])

  // 同步初始代码
  useEffect(() => {
    if (open && stockCode) {
      setCurrentCode(stockCode)
    }
  }, [open, stockCode])

  // 初始化聊天历史 - 与电脑端一致的欢迎语
  useEffect(() => {
    if (currentCode && !chatHistory[currentCode]) {
      const stockName = stockData[currentCode]?.name || currentCode
      setChatHistory(prev => ({
        ...prev,
        [currentCode]: [{
          role: 'ai',
          content: `我是 Fintell，你的智能投资助手。当前分析标的：**${stockName}**`
        }]
      }))
    }
  }, [currentCode, stockData, chatHistory])

  // 加载 AI 配额
  useEffect(() => {
    if (open) {
      getUserQuota().then(setAiQuota).catch(console.error)
    }
  }, [open])

  // 切换股票
  const switchStock = useCallback((code: string) => {
    setCurrentCode(code)
    setStockSelectOpen(false)
  }, [])

  // 发送消息 - 与电脑端完全一致的逻辑
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
      
      // 更新配额
      getUserQuota().then(setAiQuota).catch(console.error)
    } catch (error) {
      console.error('AI error:', error)
      console.error('Error details:', error instanceof Error ? error.message : String(error))
      
      let errorMsg = 'AI 服务暂时不可用'
      
      if (error instanceof Error) {
        const msg = error.message
        if (msg.includes('登录') || msg.includes('401')) {
          errorMsg = '请先登录后使用 AI 功能'
        } else if (msg.includes('429') || msg.includes('用完')) {
          errorMsg = '今日 AI 使用次数已用完'
        } else if (msg.includes('503') || msg.includes('不可用')) {
          errorMsg = 'AI 服务暂时不可用，请稍后重试'
        } else if (msg.includes('Failed to fetch') || msg.includes('NetworkError')) {
          errorMsg = '网络连接失败，请检查网络'
        } else if (msg) {
          // 显示实际错误信息（调试用）
          errorMsg = msg
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

  // 点击外部关闭下拉菜单
  useEffect(() => {
    const handleClickOutside = () => {
      setAiModeOpen(false)
      setStockSelectOpen(false)
    }
    if (aiModeOpen || stockSelectOpen) {
      document.addEventListener('click', handleClickOutside)
      return () => document.removeEventListener('click', handleClickOutside)
    }
  }, [aiModeOpen, stockSelectOpen])

  const currentStock = stockData[currentCode]
  const messages = chatHistory[currentCode] || []

  return (
    <div ref={modalRef} className={`fintell-modal ${open ? 'open' : ''} ${isDark ? 'dark' : ''}`}>
      {/* 头部 - 点击头像返回 */}
      <div className="fintell-header">
        <div className="fintell-identity" onClick={onClose}>
          <div className="fintell-avatar">F</div>
          <div className="fintell-info">
            <span className="fintell-name">Fintell</span>
            <span className="fintell-status">在线</span>
          </div>
        </div>

        <div className="fintell-action">
          {aiQuota && (
            <span className={`quota-badge ${aiQuota.remaining <= 1 ? (aiQuota.remaining === 0 ? 'exhausted' : 'low') : ''}`}>
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

      {/* 输入区域 - ChatGPT 风格 */}
      <div className="fintell-input-area">
        <div className="fintell-input-wrapper">
          <div className="fintell-input-main">
            <textarea
              ref={textareaRef}
              className="fintell-input"
              placeholder="想了解什么..."
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
              {/* 与电脑端一致的回车箭头图标 */}
              <svg viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 10l-5 5 5 5"/>
                <path d="M20 4v7a4 4 0 0 1-4 4H4"/>
              </svg>
            </button>
          </div>

          {/* 工具栏 - 与电脑端一致的选择器 */}
          <div className="fintell-toolbar">
            {/* AI 模式选择 */}
            <div 
              className={`toolbar-select ${aiModeOpen ? 'open' : ''}`}
              onClick={(e) => { e.stopPropagation(); setAiModeOpen(!aiModeOpen); setStockSelectOpen(false) }}
            >
              <svg className="select-icon ai" viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="10" rx="2"></rect>
                <circle cx="8.5" cy="16" r="1"></circle>
                <circle cx="15.5" cy="16" r="1"></circle>
                <path d="M12 11V6"></path>
                <path d="M8 6h8"></path>
              </svg>
              <span className="select-text">{AI_MODES[aiMode].replace('分析', '')}</span>
              <svg className="arrow" viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
              <div className="select-dropdown">
                {(Object.keys(AI_MODES) as AIMode[]).map(mode => (
                  <div
                    key={mode}
                    className={`select-option ${aiMode === mode ? 'active' : ''}`}
                    onClick={(e) => { e.stopPropagation(); setAiMode(mode); setAiModeOpen(false) }}
                  >
                    {AI_MODES[mode]}
                  </div>
                ))}
              </div>
            </div>

            {/* 股票选择 */}
            <div 
              className={`toolbar-select ${stockSelectOpen ? 'open' : ''}`}
              onClick={(e) => { e.stopPropagation(); setStockSelectOpen(!stockSelectOpen); setAiModeOpen(false) }}
            >
              <svg className="select-icon stock" viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="22 7 13.5 15.5 8.5 10.5 2 17"></polyline>
                <polyline points="16 7 22 7 22 13"></polyline>
              </svg>
              <span className="select-text">{currentStock?.name || currentCode}</span>
              <svg className="arrow" viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
              <div className="select-dropdown">
                {stockList.map(code => {
                  const d = stockData[code]
                  return (
                    <div
                      key={code}
                      className={`select-option ${code === currentCode ? 'active' : ''}`}
                      onClick={(e) => { e.stopPropagation(); switchStock(code) }}
                    >
                      {d?.name || code}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default FintellChat
