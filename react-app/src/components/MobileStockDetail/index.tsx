/**
 * MobileStockDetail - 移动端行情详情页
 * 布局：顶部导航 + 可滚动内容（价格信息 + K线图 + 资讯）
 */
import { useState, useEffect } from 'react'
import { SuperChart } from '@/components/SuperChart'
import { StockNews } from '@/components/StockNews'
import { fetchStockDetailInfoCached, type StockDetailInfo } from '@/services/stockInfoService'
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

// 格式化大数字
function fmtBigNum(val?: number): string {
  if (val == null || isNaN(val)) return '--'
  if (val >= 10000) return (val / 10000).toFixed(2) + '万亿'
  if (val >= 1) return val.toFixed(2) + '亿'
  return (val * 10000).toFixed(0) + '万'
}

// 格式化成交额
function fmtAmt(val?: number): string {
  if (val == null || isNaN(val)) return '--'
  if (val >= 1e8) return (val / 1e8).toFixed(2) + '亿'
  return (val / 1e4).toFixed(0) + '万'
}

// 格式化百分比
function fmtPct(val?: number): string {
  if (val == null || isNaN(val)) return '--'
  return val.toFixed(2) + '%'
}

export function MobileStockDetail({
  code,
  stockData,
  stockList = [],
  isDark = false,
  onStockChange,
  onOpenAlert,
  alerts = {},
}: MobileStockDetailProps) {
  const [showStockPicker, setShowStockPicker] = useState(false)
  const [detailInfo, setDetailInfo] = useState<StockDetailInfo | null>(null)
  const stock = stockData[code]

  // 加载详细信息
  useEffect(() => {
    if (!code) return
    fetchStockDetailInfoCached(code)
      .then(setDetailInfo)
      .catch(() => setDetailInfo(null))
  }, [code])

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
      {/* 可滚动内容区 */}
      <div className="msd-scroll-content">
        {/* 价格信息区 - 股票名称 + 价格 */}
        <div className="msd-price-section">
          <div
            className="msd-stock-name"
            onClick={() => stockList.length > 1 && setShowStockPicker(!showStockPicker)}
          >
            {stock.name}
            {stockList.length > 1 && (
              <svg className={`msd-arrow ${showStockPicker ? 'open' : ''}`} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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
                    onClick={() => { onStockChange?.(c); setShowStockPicker(false) }}
                  >
                    <span className="option-name">{s?.name || c}</span>
                    <span className={`option-pct ${p >= 0 ? 'is-up' : 'is-down'}`}>
                      {p >= 0 ? '+' : ''}{p.toFixed(2)}%
                    </span>
                  </div>
                )
              })}
            </div>
          )}
          <div className={`msd-main-price ${colorClass}`}>
            <span className="msd-price">{stock.price.toFixed(2)}</span>
            <span className="msd-change">
              {isUp ? '+' : ''}{change.toFixed(2)} ({isUp ? '+' : ''}{pct.toFixed(2)}%)
            </span>
          </div>
        </div>

        {/* 行情数据网格 - 3行3列 */}
        <div className="msd-quote-section">
          <div className="msd-quote-grid">
            {/* 第一列：高、低、开 */}
            <div className="quote-item">
              <span className="quote-label">高</span>
              <span className="quote-value is-up">{stock.high?.toFixed(2) || '--'}</span>
            </div>
            {/* 第二列：市值、流通、市盈 */}
            <div className="quote-item">
              <span className="quote-label">市值</span>
              <span className="quote-value">{fmtBigNum(detailInfo?.totalMarketCap)}</span>
            </div>
            {/* 第三列：量比、换手、成交额 */}
            <div className="quote-item">
              <span className="quote-label">量比</span>
              <span className="quote-value">--</span>
            </div>

            <div className="quote-item">
              <span className="quote-label">低</span>
              <span className="quote-value is-down">{stock.low?.toFixed(2) || '--'}</span>
            </div>
            <div className="quote-item">
              <span className="quote-label">流通</span>
              <span className="quote-value">{fmtBigNum(detailInfo?.floatMarketCap)}</span>
            </div>
            <div className="quote-item">
              <span className="quote-label">换手</span>
              <span className="quote-value">{fmtPct(detailInfo?.turnoverRate || stock.turnover)}</span>
            </div>

            <div className="quote-item">
              <span className="quote-label">开</span>
              <span className="quote-value">{stock.open?.toFixed(2) || '--'}</span>
            </div>
            <div className="quote-item">
              <span className="quote-label">市盈</span>
              <span className="quote-value">{detailInfo?.pe?.toFixed(2) || stock.pe?.toFixed(2) || '--'}</span>
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
