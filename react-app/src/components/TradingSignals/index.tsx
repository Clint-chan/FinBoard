/**
 * TradingSignals 组件 - 交易信号卡片
 * 参考设计：日内策略配置卡片
 */
import { useState } from 'react'
import './TradingSignals.css'

export interface TradingSignal {
  type: 'buy' | 'sell' | 'stop'
  price: number
  label: string
  action: 'above' | 'below'
  reason: string
}

export interface TradingSignalsData {
  code: string
  name: string
  signals: TradingSignal[]
}

interface TradingSignalsProps {
  data: TradingSignalsData
  onAddAlert?: (code: string, price: number, direction: 'above' | 'below', note: string) => void
}

const SIGNAL_CONFIG = {
  sell: { label: '高抛点 (卖出)', tag: '压力位', color: 'red' },
  buy: { label: '低吸点 (买入)', tag: '支撑位', color: 'green' },
  stop: { label: '止损点 (风控)', tag: '止损线', color: 'gray' },
}

export function TradingSignals({ data, onAddAlert }: TradingSignalsProps) {
  const [prices, setPrices] = useState<Record<number, number>>(() => {
    const initial: Record<number, number> = {}
    data.signals.forEach((s, i) => { initial[i] = s.price })
    return initial
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)

  const handlePriceChange = (index: number, value: string) => {
    const num = parseFloat(value)
    if (!isNaN(num)) {
      setPrices(prev => ({ ...prev, [index]: num }))
    }
  }

  const handleSubmit = () => {
    if (!onAddAlert || isSubmitted) return
    
    setIsSubmitting(true)
    
    // 添加所有信号到 Alerts
    data.signals.forEach((signal, i) => {
      const price = prices[i] || signal.price
      const note = `${SIGNAL_CONFIG[signal.type].label}: ${signal.reason}`
      onAddAlert(data.code, price, signal.action, note)
    })
    
    setTimeout(() => {
      setIsSubmitting(false)
      setIsSubmitted(true)
    }, 500)
  }

  // 按 sell -> buy -> stop 顺序排序
  const sortedSignals = [...data.signals].sort((a, b) => {
    const order = { sell: 0, buy: 1, stop: 2 }
    return order[a.type] - order[b.type]
  })

  return (
    <div className="trading-signals-card">
      {/* 头部 */}
      <div className="signals-card-header">
        <div className="header-info">
          <div className="header-title">
            <h2>{data.name}</h2>
            <span className="stock-code">{data.code}</span>
          </div>
          <p className="header-desc">AI 智能生成的日内 T+0 策略建议</p>
        </div>
        <div className="header-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
            <path d="M18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z" />
          </svg>
        </div>
      </div>

      {/* 信号列表 */}
      <div className="signals-card-body">
        {sortedSignals.map((signal, i) => {
          const config = SIGNAL_CONFIG[signal.type]
          const originalIndex = data.signals.indexOf(signal)
          
          return (
            <div key={i} className={`signal-row ${config.color}`}>
              <div className="signal-bar"></div>
              <div className="signal-content">
                <div className="signal-header">
                  <div className="signal-title">
                    <span className="signal-label">{config.label}</span>
                    <span className="signal-reason">理由: {signal.reason}</span>
                  </div>
                  <span className={`signal-tag ${config.color}`}>{config.tag}</span>
                </div>
                <div className="signal-input-row">
                  <div className="price-input-wrapper">
                    <span className="price-prefix">触发价 ¥</span>
                    <input
                      type="number"
                      value={prices[originalIndex]}
                      onChange={(e) => handlePriceChange(originalIndex, e.target.value)}
                      step="0.01"
                      className="price-input"
                    />
                  </div>
                  <span className="action-hint">
                    {signal.action === 'above' ? '突破触发' : '跌破触发'}
                  </span>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* 底部操作 */}
      <div className="signals-card-footer">
        <button 
          className={`submit-btn ${isSubmitted ? 'submitted' : ''}`}
          onClick={handleSubmit}
          disabled={isSubmitting || isSubmitted}
        >
          {isSubmitted ? (
            <>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              已添加至盯盘监控
            </>
          ) : (
            <>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
              {isSubmitting ? '添加中...' : '确认并添加至盯盘监控'}
            </>
          )}
        </button>
        <p className="footer-hint">*策略仅供参考，请结合实盘动态调整</p>
      </div>
    </div>
  )
}

export default TradingSignals
