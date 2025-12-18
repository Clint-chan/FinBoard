/**
 * MobileStockList - 移动端自选股列表
 * 采用胶囊设计 (Pill Design)，优化信息层级
 * - 价格纯数字无背景，涨跌幅胶囊色块
 * - 中间迷你走势图 Sparkline
 * - 缩进分割线，更透气的布局
 */
import { useCallback, useRef, useEffect } from 'react'
import type { StockData, AlertConfig } from '@/types'
import { calcPct, getPctClass } from '@/utils/format'
import { Sparkline } from '@/components/Sparkline'
import './MobileStockList.css'

interface MobileStockItemProps {
  code: string
  data?: StockData
  cost?: number
  hasAlert: boolean
  onTap: (code: string) => void
  onLongPress: (code: string, e: { clientX: number; clientY: number }) => void
}

function MobileStockItem({ code, data, cost, hasAlert, onTap, onLongPress }: MobileStockItemProps) {
  const longPressTimer = useRef<number | null>(null)
  const touchStartPos = useRef<{ x: number; y: number } | null>(null)
  
  const pct = calcPct(data?.price, data?.preClose)
  const pctClass = getPctClass(pct)
  const sign = pct > 0 ? '+' : ''

  // 盈亏信息
  let profitInfo = null
  if (cost && data?.price) {
    const profitPct = ((data.price - cost) / cost * 100)
    const profitClass = profitPct >= 0 ? 'up' : 'down'
    const profitSign = profitPct >= 0 ? '+' : ''
    profitInfo = (
      <span className={`msl-profit ${profitClass}`}>
        成本{cost.toFixed(2)} {profitSign}{profitPct.toFixed(2)}%
      </span>
    )
  }

  // 长按处理
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0]
    touchStartPos.current = { x: touch.clientX, y: touch.clientY }
    
    longPressTimer.current = window.setTimeout(() => {
      onLongPress(code, { clientX: touch.clientX, clientY: touch.clientY })
      if (navigator.vibrate) navigator.vibrate(50)
      longPressTimer.current = null
    }, 500)
  }, [code, onLongPress])

  const handleTouchEnd = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current)
      longPressTimer.current = null
      // 短按 = 点击
      onTap(code)
    }
  }, [code, onTap])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!touchStartPos.current || !longPressTimer.current) return
    
    const touch = e.touches[0]
    const dx = Math.abs(touch.clientX - touchStartPos.current.x)
    const dy = Math.abs(touch.clientY - touchStartPos.current.y)
    
    // 移动超过 10px 取消长按
    if (dx > 10 || dy > 10) {
      clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
  }, [])

  useEffect(() => {
    return () => {
      if (longPressTimer.current) clearTimeout(longPressTimer.current)
    }
  }, [])

  return (
    <div 
      className="msl-item"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchMove={handleTouchMove}
      onClick={() => onTap(code)}
    >
      {/* 左侧：名称 + 代码 */}
      <div className="msl-left">
        <div className="msl-name">
          {data?.name || '--'}
          {hasAlert && <span className="msl-alert-dot">●</span>}
        </div>
        <div className="msl-code-row">
          <span className="msl-code">{code.toUpperCase()}</span>
          {profitInfo}
        </div>
      </div>

      {/* 中间：迷你走势图 */}
      <div className="msl-center">
        <Sparkline code={code} className="msl-sparkline" />
      </div>

      {/* 右侧：价格 + 涨跌幅胶囊 */}
      <div className="msl-right">
        <div className={`msl-price ${pctClass}`}>
          {data?.price?.toFixed(2) || '--'}
        </div>
        <span className={`msl-pct-pill ${pctClass}`}>
          {sign}{(pct * 100).toFixed(2)}%
        </span>
      </div>
    </div>
  )
}

interface MobileStockListProps {
  codes: string[]
  stockData: Record<string, StockData>
  costs?: Record<string, number>
  alerts?: Record<string, AlertConfig>
  onStockTap: (code: string) => void
  onStockLongPress: (code: string, pos: { clientX: number; clientY: number }) => void
  onAddStock: () => void
}

export function MobileStockList({
  codes,
  stockData,
  costs,
  alerts,
  onStockTap,
  onStockLongPress,
  onAddStock
}: MobileStockListProps) {
  return (
    <div className="mobile-stock-list">
      {/* 列表头部 */}
      <div className="msl-header">
        <span className="msl-header-left">自选股 ({codes.length})</span>
        <button className="msl-add-btn" onClick={onAddStock}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
        </button>
      </div>

      {/* 股票列表 */}
      <div className="msl-list">
        {codes.length === 0 ? (
          <div className="msl-empty" onClick={onAddStock}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="16"></line>
              <line x1="8" y1="12" x2="16" y2="12"></line>
            </svg>
            <p>暂无自选股</p>
            <span>点击添加</span>
          </div>
        ) : (
          codes.map(code => (
            <MobileStockItem
              key={code}
              code={code}
              data={stockData[code]}
              cost={costs?.[code]}
              hasAlert={(alerts?.[code]?.conditions?.length ?? 0) > 0}
              onTap={onStockTap}
              onLongPress={onStockLongPress}
            />
          ))
        )}
      </div>
    </div>
  )
}

export default MobileStockList
