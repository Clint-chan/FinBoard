/**
 * AnalysisDrawer - 分析大屏组件
 */
import { useState, useCallback, useRef, useEffect } from 'react'
import { SuperChart } from '@/components/SuperChart'
import { StockNews } from '@/components/StockNews'
import type { StockData } from '@/types'
import { type AIMode, AI_MODES, type ChatMessage } from './types'
import { renderMarkdown } from './markdown'
import './AnalysisDrawer.css'

interface AnalysisDrawerProps {
  open: boolean
  code: string
  onClose: () => void
  stockList: string[]
  stockData: Record<string, StockData>
  isDark?: boolean
  onOpenAlert?: (code: string, price?: number) => void
}

export function AnalysisDrawer({
  open,
  code: initialCode,
  onClose,
  stockList,
  stockData,
  isDark = false,
  onOpenAlert
}: AnalysisDrawerProps) {
  // 当前选中的股票
  const [currentCode, setCurrentCode] = useState(initialCode)
  
  // AI 模式
  const [aiMode, setAiMode] = useState<AIMode>('intraday')
  const [aiModeOpen, setAiModeOpen] = useState(false)
  const [stockSelectOpen, setStockSelectOpen] = useState(false)
  
  // 聊天历史（按股票代码存储）
  const [chatHistory, setChatHistory] = useState<Record<string, ChatMessage[]>>({})
  

  
  // 输入框
  const [inputValue, setInputValue] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const messagesRef = useRef<HTMLDivElement>(null)
  
  // 拖拽调整宽度
  const [chatWidth, setChatWidth] = useState(400)
  const resizerRef = useRef<HTMLDivElement>(null)
  const isResizing = useRef(false)

  // 同步初始代码
  useEffect(() => {
    if (open && initialCode) {
      setCurrentCode(initialCode)
    }
  }, [open, initialCode])

  // 初始化聊天历史
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

  // 切换股票
  const switchStock = useCallback((code: string) => {
    setCurrentCode(code)
    setStockSelectOpen(false)
  }, [])

  // 发送消息
  const sendMessage = useCallback(async () => {
    const text = inputValue.trim()
    if (!text || !currentCode) return

    // 添加用户消息
    const userMsg = { role: 'user' as const, content: text }
    setChatHistory(prev => ({
      ...prev,
      [currentCode]: [...(prev[currentCode] || []), userMsg]
    }))

    setInputValue('')
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }

    // 添加空的 AI 消息用于流式更新
    const aiMsgIndex = (chatHistory[currentCode] || []).length + 1
    setChatHistory(prev => ({
      ...prev,
      [currentCode]: [...(prev[currentCode] || []), userMsg, { role: 'ai', content: '' }]
    }))

    try {
      const { sendChatMessage } = await import('@/services/aiChatService')
      
      // 准备股票数据
      const currentStock = stockData[currentCode]
      const stockDataForAI = currentStock ? {
        code: currentCode,
        name: currentStock.name,
        price: currentStock.price,
        preClose: currentStock.preClose,
        high: currentStock.high || currentStock.price,
        low: currentStock.low || currentStock.price,
        vol: currentStock.vol || 0,
        amt: currentStock.amt || 0
      } : undefined

      // 获取历史消息
      const historyMessages = (chatHistory[currentCode] || []).map(msg => ({
        role: msg.role === 'ai' ? 'assistant' as const : msg.role,
        content: msg.content
      }))

      await sendChatMessage(
        [...historyMessages, { role: 'user', content: text }],
        stockDataForAI,
        undefined, // 图表数据暂时不传，后端直接调用 akshare
        aiMode,
        (chunk) => {
          // 流式更新
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
    } catch (error) {
      console.error('AI error:', error)
      setChatHistory(prev => {
        const messages = [...(prev[currentCode] || [])]
        if (messages[aiMsgIndex]) {
          messages[aiMsgIndex] = {
            role: 'ai',
            content: '抱歉，AI 服务暂时不可用。请稍后再试。'
          }
        }
        return { ...prev, [currentCode]: messages }
      })
    }
  }, [inputValue, currentCode, stockData, aiMode, chatHistory])

  // 处理输入框变化
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputValue(e.target.value)
    e.target.style.height = 'auto'
    e.target.style.height = Math.min(e.target.scrollHeight, 200) + 'px'
  }, [])

  // 处理键盘事件
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }, [sendMessage])

  // 拖拽调整宽度
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing.current) return
      const newWidth = window.innerWidth - e.clientX - 12
      if (newWidth >= 250 && newWidth <= 800) {
        setChatWidth(newWidth)
      }
    }

    const handleMouseUp = () => {
      isResizing.current = false
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [])

  const startResize = useCallback(() => {
    isResizing.current = true
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }, [])

  // 滚动到底部
  useEffect(() => {
    if (messagesRef.current) {
      messagesRef.current.scrollTop = messagesRef.current.scrollHeight
    }
  }, [chatHistory, currentCode])

  // ESC 关闭
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) {
        e.stopPropagation()
        onClose()
      }
    }
    document.addEventListener('keydown', handleEsc)
    return () => document.removeEventListener('keydown', handleEsc)
  }, [open, onClose])

  if (!open) return null

  const currentStock = stockData[currentCode]
  const messages = chatHistory[currentCode] || []

  return (
    <div className={`analysis-drawer ${open ? 'open' : ''}`}>
      <div className="drawer-content">
        {/* 关闭按钮 */}
        <button className="close-drawer-btn" onClick={onClose} title="关闭">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2.5" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>

        {/* 左侧自选股列表 */}
        <div className="stock-sidebar">
          <div className="sidebar-header">自选股</div>
          <div className="sidebar-list">
            {stockList.map(code => {
              const d = stockData[code]
              if (!d) return null
              const pct = d.preClose ? ((d.price - d.preClose) / d.preClose * 100) : 0
              const isUp = pct >= 0
              const isActive = code === currentCode

              return (
                <div
                  key={code}
                  className={`sidebar-item ${isActive ? 'active' : ''}`}
                  onClick={() => switchStock(code)}
                >
                  <div className="item-left">
                    <span className="item-name">{d.name || '--'}</span>
                  </div>
                  <div className="item-right">
                    <span className={`item-price ${isUp ? 'up' : 'down'}`}>
                      {d.price?.toFixed(2) || '--'}
                    </span>
                    <span className={`item-pct ${isUp ? 'up' : 'down'}`}>
                      {isUp ? '+' : ''}{pct.toFixed(2)}%
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* 中间图表区域 */}
        <div className="chart-section">
          <div className="chart-wrapper">
            <SuperChart
              code={currentCode}
              fillContainer
              isDark={isDark}
              defaultTab="daily"
              defaultSubIndicators={['vol', 'macd', 'rsi']}
              initialName={currentStock?.name}
              initialPrice={currentStock?.price}
              initialPreClose={currentStock?.preClose}
              pe={currentStock?.pe}
              onAddAlert={(price) => onOpenAlert?.(currentCode, price)}
            />
          </div>
        </div>

        {/* 拖拽手柄 */}
        <div
          ref={resizerRef}
          className="drawer-resizer"
          onMouseDown={startResize}
        />


        {/* 右侧面板 */}
        <div className="chat-section" style={{ width: chatWidth }}>
          {/* 新闻区域 */}
          <div className="news-section">
            <StockNews 
              code={currentCode} 
              stockName={currentStock?.name}
              isDark={isDark}
            />
          </div>

          {/* AI 聊天面板 */}
          <div className="chat-container">
            <div className="chat-header">
              <div className="ai-identity">
                <div className="ai-avatar">F</div>
                <div className="ai-info">
                  <span className="ai-name">Fintell</span>
                  <span className="ai-status">在线</span>
                </div>
              </div>
            </div>

            <div 
              className="chat-messages" 
              ref={messagesRef}
              onClick={(e) => {
                // 事件委托：处理思考块的折叠/展开
                const header = (e.target as HTMLElement).closest('.thinking-header')
                if (header) {
                  const block = header.closest('.thinking-block')
                  block?.classList.toggle('collapsed')
                }
              }}
            >
            {messages.map((msg, i) => {
              // 对于 AI 消息，找到前一条用户消息用于过滤重复问题
              const prevUserMsg = msg.role === 'ai' && i > 0 
                ? messages.slice(0, i).reverse().find(m => m.role === 'user')?.content 
                : undefined
              return (
                <div key={i} className={`chat-message ${msg.role}`}>
                  <div 
                    className="bubble"
                    dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content, prevUserMsg) }}
                  />
                </div>
              )
            })}
          </div>

          <div className="chat-input-zone">
            <div className="input-wrapper">
              <div className="input-main">
                <textarea
                  ref={textareaRef}
                  className="chat-textarea"
                  placeholder="想了解什么..."
                  rows={1}
                  value={inputValue}
                  onChange={handleInputChange}
                  onKeyDown={handleKeyDown}
                />
                <button
                  className="send-btn"
                  disabled={!inputValue.trim()}
                  onClick={sendMessage}
                >
                  {/* 对照原版：回车箭头图标 */}
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 10l-5 5 5 5"/>
                    <path d="M20 4v7a4 4 0 0 1-4 4H4"/>
                  </svg>
                </button>
              </div>

              <div className="input-toolbar">
                {/* AI 模式选择 */}
                <div 
                  className={`toolbar-select ${aiModeOpen ? 'open' : ''}`}
                  onClick={() => { setAiModeOpen(!aiModeOpen); setStockSelectOpen(false) }}
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
                  onClick={() => { setStockSelectOpen(!stockSelectOpen); setAiModeOpen(false) }}
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
        </div>
      </div>
    </div>
  )
}

export default AnalysisDrawer
