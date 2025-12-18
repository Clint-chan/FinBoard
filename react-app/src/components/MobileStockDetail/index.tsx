/**
 * MobileStockDetail - 移动端行情详情页
 * 布局：顶部固定导航 + 可滚动内容（基础信息 + K线图 + 资讯/股吧）
 */
import { useState } from 'react'
import { SuperChart } from '@/components/SuperChart'
import { StockNews } from '@/components/StockNews'
import type { StockData, AlertConfig } from '@/types'
import { fmtVol, fmtAmt } from '@/utils/format'
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
  alerts = {},
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

  const pct = stock.preClose ? ((stock.price - stock.preClose) / stock.preClose) * 100 : 0
  const change = stock.preClose ? stock.price - stock.preClose : 0
  const isUp = pct >= 0
  const colorClass = isUp ? 'is-up' : 'is-down'

  return (
    <div className={`mobile-stock-detail ${isDark ? 'dark' : ''}`}>
      {/* 顶部导航栏 - 固定 */}
      <header className="msd-navbar">
        {onBack && (
          <button className="msd-back" onClick={onBack}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
        )}
        <div
          className="msd-title-area"
          onClick={() => stockList.length > 1 && setShowStockPicker(!showStockPicker)}
        >
          <span className="msd-title">{stock.name}</span>
          <span className="msd-code">{code.toUpperCase()}</span>
          {stockList.length > 1 && (
            <svg
              className={`msd-arrow ${showStockPicker ? 'open' : ''}`}
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
          )}
        </div>
        {/* 股票切换下拉 */}
        {showStockPicker && stockList.length > 1 && (
          <div className="msd-stock-picker">
            {stockList.map(c => {
              const s = stockData[c]
              const p = s?.preClose ? ((s.price - s.preClose) / s.preClose) * 100 : 0
              return (
                <div
                  key={c}
                  className={`msd-stock-option ${c === code ? 'active' : ''}`}
                  onClick={() => {
                    onStockChange?.(c)
                    setShowStockPicker(false)
                  }}
                >
                  <span className="option-name">{s?.name || c}</span>
                  <span className={`option-pct ${p >= 0 ? 'up' : 'down'}`}>
                    {p >= 0 ? '+' : ''}{p.toFixed(2)}%
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </header>

      {/* 可滚动内容区 */}
      <div className="msd-scroll-content">
        {/* 价格信息区 */}
        <div className="msd-price-section">
          <div className={`msd-main-price ${colorClass}`}>
            <span className="msd-price">{stock.price.toFixed(2)}</span>
            <span className="msd-change">
              {isUp ? '+' : ''}{change.toFixed(2)} ({isUp ? '+' : ''}{pct.toFixed(2)}%)
            </span>
          </div>
          <div className="msd-quote-grid">
            <div className="quote-item">
              <span className="quote-label">高</span>
              <span className="quote-value is-up">{stock.high?.toFixed(2) || '--'}</span>
            </div>
            <div className="quote-item">
              <span className="quote-label">低</span>
              <span className="quote-value is-down">{stock.low?.toFixed(2) || '--'}</span>
            </div>
            <div className="quote-item">
              <span className="quote-label">开</span>
              <span className="quote-value">{stock.open?.toFixed(2) || '--'}</span>
            </div>
            <div className="quote-item">
              <span className="quote-label">昨收</span>
              <span className="quote-value">{stock.preClose?.toFixed(2) || '--'}</span>
            </div>
            <div className="quote-item">
              <span className="quote-label">成交量</span>
              <span className="quote-value">{fmtVol(stock.vol)}</span>
            </div>
            <div className="quote-item">
              <span className="quote-label">成交额</span>
              <span className="quote-value">{fmtAmt(stock.amt)}</span>
            </div>
          </div>
        </div>

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
            onAddAlert={price => onOpenAlert?.(code, price)}
            alertLines={
              alerts[code]?.conditions
                .filter(c => c.type === 'price' && !c.triggered)
                .map(c => ({ price: c.value, operator: c.operator, note: c.note })) || []
            }
          />
        </div>

        {/* 资讯/股吧区域 */}
        <div className="msd-news-section">
          <StockNews code={code} stockName={stock.name} isDark={isDark} />
        </div>
      </div>
    </div>
  )
}

export default MobileStockDetail
