/**
 * TradingSignals 组件 - 交易信号卡片
 * 显示 AI 生成的买卖点位，支持一键添加到 Alerts
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
  buy: { icon: '📈', color: '#10b981', bgColor: '#ecfdf5', label: '低吸' },
  sell: { icon: '📉', color: '#f59e0b', bgColor: '#fffbeb', label: '高抛' },
  stop: { icon: '🛑', color: '#ef4444', bgColor: '#fef2f2', label: '止损' },
}

export function TradingSignals({ data, onAddAlert }: TradingSignalsProps) {
  const [addedSignals, setAddedSignals] = useState<Set<number>>(new Set())

  const handleAddAlert = (signal: TradingSignal, index: number) => {
    if (onAddAlert) {
      const note = `${signal.label}: ${signal.reason}`
      onAddAlert(data.code, signal.price, signal.action, note)
      setAddedSignals((prev) => new Set(prev).add(index))
    }
  }

  return (
    <div className="trading-signals">
      <div className="signals-header">
        <span className="signals-title">交易信号</span>
        <span className="signals-stock">{data.name}</span>
      </div>

      <div className="signals-list">
        {data.signals.map((signal, i) => {
          const config = SIGNAL_CONFIG[signal.type]
          const isAdded = addedSignals.has(i)

          return (
            <div
              key={i}
              className={`signal-item ${signal.type}`}
              style={{ '--signal-color': config.color, '--signal-bg': config.bgColor } as React.CSSProperties}
            >
              <div className="signal-icon">{config.icon}</div>
              <div className="signal-info">
                <div className="signal-label">{signal.label}</div>
                <div className="signal-price">
                  ¥{signal.price.toFixed(2)}
                  <span className="signal-action">
                    {signal.action === 'above' ? '突破' : '跌破'}
                  </span>
                </div>
                <div className="signal-reason">{signal.reason}</div>
              </div>
              <button
                className={`signal-add-btn ${isAdded ? 'added' : ''}`}
                onClick={() => handleAddAlert(signal, i)}
                disabled={isAdded}
              >
                {isAdded ? (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                    <line x1="12" y1="2" x2="12" y2="4" />
                  </svg>
                )}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default TradingSignals
