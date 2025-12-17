/**
 * MobileStockDetail - 移动端行情详情页
 * 对照 2.html 设计：顶部股票信息 + K线图 + 相关资讯
 */
import { useState } from 'react'
import { SuperChart } from '@/components/SuperChart'
import { StockNews } from '@/components/StockNews'
import type { StockData, AlertConfig } from '@/types'
import './MobileStockDetail.css'

interface MobileStockDetailProps {
  code: string
  stockData: Record<string, StockData>
  stockList?: string[]
  isDark?: boolean
  onBack?: () => void
  onStockChange?: (code: string) => void
  onOpenAlert?: (code: string, price?: number) => void
  alerts?: Record<string, AlertConfig>
}

export function MobileStockDetail({
  code,
  stockData,
  stockList = [],
  isDark = false,
  onBack,
  onStockChange,
  onOpenAlert,
  alerts = {}
}: MobileStockDetailProps) {
  const [showStockPicker, setShowStockPicker] = useState(false)
  const stock = stockData[code]

  if (!stock) {
    return (
      <div className="mobile-stock-detail">
        <div className="msd-loading">加载中...</div>
      </div>
    )
  }

  const pct = stock.preClose ? ((stock.price - stock.preClose) / stock.preClose * 100) : 0
  const change = stock.preClose ? stock.price - stock.preClose : 0
  const isUp = pct >= 0

  return (
    <div className={`mobile-stock-detail ${isDark ? 'dark' : ''}`}>
      {/* 顶部股票信息 */}
      <header className="msd-header">
        {onBack && (
          <button className="msd-back" onClick={onBack}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 18l-6-6 6-6"/>
            </svg>
          </button>
        )}
        <div 
          className="msd-stock-info"
          onClick={() => stockList.length > 1 && setShowStockPicker(!showStockPicker)}
        >
          <div className="msd-name-row">
            <h1 className="msd-name">{stock.name}</h1>
            <span className="msd-code">{code.toUpperCase()}</span>
            {stockList.length > 1 && (
              <svg className={`msd-arrow ${showStockPicker ? 'open' : ''}`} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
            )}
          </div>
          {/* 股票选择下拉 */}
          {showStockPicker && (
            <div className="msd-stock-picker">
              {stockList.map(c => {
                const s = stockData[c]
                if (!s) return null
                const p = s.preClose ? ((s.price - s.preClose) / s.preClose * 100) : 0
                return (
                  <div
                    key={c}
                    className={`msd-stock-option ${c === code ? 'active' : ''}`}
                    onClick={(e) => {
                      e.stopPropagation()
                      onStockChange?.(c)
                      setShowStockPicker(false)
                    }}
                  >
                    <span className="option-name">{s.name}</span>
                    <span className={`option-pct ${p >= 0 ? 'up' : 'down'}`}>
                      {p >= 0 ? '+' : ''}{p.toFixed(2)}%
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
        <div className={`msd-price-info ${isUp ? 'up' : 'down'}`}>
          <span className="msd-price">{stock.price.toFixed(2)}</span>
          <span className="msd-change">
            {isUp ? '+' : ''}{change.toFixed(2)} ({isUp ? '+' : ''}{pct.toFixed(2)}%)
          </span>
        </div>
      </header>

      {/* K线图区域 */}
      <div className="msd-chart-section">
        <SuperChart
          code={code}
          fillContainer
          isDark={isDark}
          defaultTab="daily"
          defaultSubIndicators={['vol', 'macd']}
          initialName={stock.name}
          initialPrice={stock.price}
          initialPreClose={stock.preClose}
          pe={stock.pe}
          onAddAlert={(price) => onOpenAlert?.(code, price)}
          alertLines={alerts[code]?.conditions
            .filter(c => c.type === 'price' && !c.triggered)
            .map(c => ({ price: c.value, operator: c.operator, note: c.note })) || []}
        />
      </div>

      {/* 资讯区域 */}
      <div className="msd-news-section">
        <StockNews 
          code={code} 
          stockName={stock.name}
          isDark={isDark}
        />
      </div>
    </div>
  )
}

export default MobileStockDetail
