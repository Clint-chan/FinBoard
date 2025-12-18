import { useState, useCallback, useRef, useEffect } from 'react'
import type { StockData, AlertConfig } from '@/types'
import { normalizeCode } from '@/services/dataService'
import { fmtNum, fmtPrice, fmtVol, fmtAmt, calcPct, getPctClass } from '@/utils/format'
import { Sparkline } from '@/components/Sparkline'
import { useDragSort } from '@/hooks/useDragSort'
import './StockTable.css'

interface StockRowProps {
  code: string
  data?: StockData
  cost?: number
  hasAlert: boolean
  onContextMenu: (e: React.MouseEvent, code: string) => void
  onChartShow: (code: string, e: React.MouseEvent) => void
  onChartHide: () => void
  onDoubleClick: (code: string) => void
  onDragStart: (e: React.MouseEvent | React.TouchEvent) => void
  onMouseEnter?: () => void
  onMouseLeave?: (e: React.MouseEvent) => void
}

function StockRow({ code, data, cost, hasAlert, onContextMenu, onChartShow, onChartHide, onDoubleClick, onDragStart, onMouseEnter, onMouseLeave }: StockRowProps) {
  const longPressTimer = useRef<number | null>(null)
  const pct = calcPct(data?.price, data?.preClose)
  const pctClass = getPctClass(pct)
  const sign = pct > 0 ? '+' : ''
  
  let rangePos = 50
  if (data?.high !== data?.low && data?.high) {
    rangePos = Math.max(0, Math.min(100, ((data.price - data.low) / (data.high - data.low)) * 100))
  }

  let profitInfo = null
  if (cost && data?.price) {
    const profitPct = ((data.price - cost) / cost * 100).toFixed(2)
    const profitClass = parseFloat(profitPct) >= 0 ? 'up' : 'down'
    const profitSign = parseFloat(profitPct) >= 0 ? '+' : ''
    profitInfo = (
      <div className="cost-info">
        成本 {fmtNum(cost)} · <span className={`profit ${profitClass}`}>{profitSign}{profitPct}%</span>
      </div>
    )
  }

  // 长按触发右键菜单（移动端）
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    // 先检查是否是拖拽把手
    const handle = (e.target as HTMLElement).closest('.drag-handle')
    if (handle) {
      onDragStart(e)
      return
    }
    
    longPressTimer.current = window.setTimeout(() => {
      const touch = e.touches[0]
      // 创建一个模拟的 MouseEvent 用于右键菜单
      const fakeEvent = {
        preventDefault: () => {},
        clientX: touch.clientX,
        clientY: touch.clientY,
      } as React.MouseEvent
      onContextMenu(fakeEvent, code)
      // 震动反馈
      if (navigator.vibrate) navigator.vibrate(50)
      longPressTimer.current = null
    }, 500)
  }, [code, onContextMenu, onDragStart])

  const handleTouchEnd = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
  }, [])

  const handleTouchMove = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
  }, [])

  // 清理定时器
  useEffect(() => {
    return () => {
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current)
      }
    }
  }, [])

  // 对照原版 app.js 的 mouseover/mouseout 逻辑
  // 使用 ref 跟踪是否已经触发过，避免在同一行内移动时重复触发
  const hasTriggeredRef = useRef(false)
  
  const handleMouseEnterRow = useCallback((e: React.MouseEvent) => {
    if (!hasTriggeredRef.current) {
      hasTriggeredRef.current = true
      onChartShow(code, e)
    }
  }, [code, onChartShow])
  
  const handleMouseLeaveRow = useCallback(() => {
    hasTriggeredRef.current = false
    onChartHide()
  }, [onChartHide])

  return (
    <tr
      data-code={code}
      onContextMenu={(e) => onContextMenu(e, code)}
      onMouseEnter={(e) => {
        handleMouseEnterRow(e)
        onMouseEnter?.()
      }}
      onMouseLeave={(e) => {
        handleMouseLeaveRow()
        onMouseLeave?.(e)
      }}
      onDoubleClick={() => onDoubleClick(code)}
      onMouseDown={onDragStart}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchMove={handleTouchMove}
    >
      <td>
        <div className="symbol-cell">
          <div className="symbol-info">
            <div>
              {data?.name || '--'}
              {hasAlert && <span className="alert-icon">●</span>}
            </div>
            <span className="symbol-name">{code.toUpperCase()}</span>
            {profitInfo}
          </div>
          <Sparkline code={code} className={pctClass} />
        </div>
      </td>
      <td className="price-cell" style={{ color: pct >= 0 ? 'var(--color-up)' : 'var(--color-down)' }}>
        {fmtPrice(data?.price, code)}
      </td>
      <td>
        <span className={`change-badge ${pctClass}`}>
          {sign}{(pct * 100).toFixed(2)}%
        </span>
      </td>
      <td className="col-range">
        <div className="range-container">
          <span className="range-label">{fmtNum(data?.low)}</span>
          <div className="range-track">
            <div className="range-thumb" style={{ left: `${rangePos}%` }}></div>
          </div>
          <span className="range-label">{fmtNum(data?.high)}</span>
        </div>
      </td>
      <td className="vol-cell">{fmtVol(data?.vol)}</td>
      <td className="amt-cell col-amt">{fmtAmt(data?.amt)}</td>
      <td className="drag-cell">
        <div className="drag-handle">
          <span></span><span></span><span></span>
        </div>
      </td>
    </tr>
  )
}

interface StockTableProps {
  codes: string[]
  stockData: Record<string, StockData>
  costs?: Record<string, number>
  alerts?: Record<string, AlertConfig>
  onContextMenu: (e: React.MouseEvent, code: string) => void
  onChartShow: (code: string, e: React.MouseEvent) => void
  onChartHide: () => void
  onReorder: (fromIndex: number, toIndex: number) => void
  onAddStock: () => void
  onDoubleClick: (code: string) => void
}

type SortColumn = 'price' | 'pct' | 'amt' | null

function StockTable({
  codes,
  stockData,
  costs,
  alerts,
  onContextMenu,
  onChartShow,
  onChartHide,
  onReorder,
  onAddStock,
  onDoubleClick,
}: StockTableProps) {
  const [sortColumn, setSortColumn] = useState<SortColumn>(null)
  const [sortAsc, setSortAsc] = useState(false)
  const [addRowShow, setAddRowShow] = useState(false) // 对照原版的添加行展开状态
  const tableRef = useRef<HTMLTableElement>(null)

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortAsc(!sortAsc)
    } else {
      setSortColumn(column)
      setSortAsc(false)
    }
  }

  // 排序后的代码列表
  const sortedCodes = [...codes].map(c => normalizeCode(c))
  if (sortColumn) {
    sortedCodes.sort((a, b) => {
      const dataA = stockData[a]
      const dataB = stockData[b]
      if (!dataA && !dataB) return 0
      if (!dataA) return 1
      if (!dataB) return -1

      let valA = 0, valB = 0
      if (sortColumn === 'pct') {
        valA = dataA.preClose ? (dataA.price - dataA.preClose) / dataA.preClose : 0
        valB = dataB.preClose ? (dataB.price - dataB.preClose) / dataB.preClose : 0
      } else if (sortColumn === 'amt') {
        valA = dataA.amt || 0
        valB = dataB.amt || 0
      } else if (sortColumn === 'price') {
        valA = dataA.price || 0
        valB = dataB.price || 0
      }
      
      const diff = valA - valB
      return sortAsc ? diff : -diff
    })
  }

  const getSortClass = (column: SortColumn) => {
    if (sortColumn !== column) return ''
    return sortAsc ? 'sort-asc' : 'sort-desc'
  }

  // 使用 useDragSort hook 实现拖拽
  useDragSort({
    containerRef: tableRef,
    itemSelector: 'tbody tr:not(.add-stock-row)',
    handleSelector: '.drag-handle',
    onReorder
  })
  
  // 简化的拖动处理（用于触发 useDragSort）
  const handleDragStart = useCallback((e: React.MouseEvent | React.TouchEvent, _index: number) => {
    // useDragSort 会自动处理，这里只需要阻止默认行为
    const handle = (e.target as HTMLElement).closest('.drag-handle')
    if (handle) {
      e.preventDefault()
    }
  }, [])

  return (
    <div className="table-responsive">
      <table ref={tableRef}>
        <thead>
          <tr>
            <th>标的</th>
            <th data-sort="price" className={getSortClass('price')} onClick={() => handleSort('price')}>最新价</th>
            <th data-sort="pct" className={getSortClass('pct')} onClick={() => handleSort('pct')}>涨跌幅</th>
            <th className="col-range">当日区间</th>
            <th>成交量</th>
            <th data-sort="amt" className={`col-amt ${getSortClass('amt')}`} onClick={() => handleSort('amt')}>成交额</th>
            <th className="drag-cell"></th>
          </tr>
        </thead>
        <tbody>
          {sortedCodes.map((code, index) => {
            const isLastRow = index === sortedCodes.length - 1
            return (
              <StockRow
                key={code}
                code={code}
                data={stockData[code]}
                cost={costs?.[code]}
                hasAlert={(alerts?.[code]?.conditions?.length ?? 0) > 0}
                onContextMenu={onContextMenu}
                onChartShow={onChartShow}
                onChartHide={onChartHide}
                onDoubleClick={onDoubleClick}
                onDragStart={(e) => handleDragStart(e, index)}
                // 对照原版：最后一行悬停时展开添加行
                onMouseEnter={isLastRow ? () => setAddRowShow(true) : undefined}
                onMouseLeave={isLastRow ? (e) => {
                  // 如果移动到添加行，保持显示
                  const relatedTarget = e.relatedTarget as HTMLElement
                  if (relatedTarget?.closest?.('.add-stock-row')) return
                  setAddRowShow(false)
                } : undefined}
              />
            )
          })}
          {/* 没有股票时直接显示添加按钮 */}
          <tr 
            className={`add-stock-row ${addRowShow || sortedCodes.length === 0 ? 'show' : ''}`}
            onClick={onAddStock}
            onMouseEnter={() => setAddRowShow(true)}
            onMouseLeave={(e) => {
              // 如果移动到最后一行，保持显示
              const relatedTarget = e.relatedTarget as HTMLElement
              const lastRow = relatedTarget?.closest?.('tr[data-code]')
              if (lastRow) return
              setAddRowShow(false)
            }}
          >
            <td colSpan={7}>
              <div className="add-stock-btn">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="12" y1="5" x2="12" y2="19"></line>
                  <line x1="5" y1="12" x2="19" y2="12"></line>
                </svg>
                <span>添加自选股</span>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}

export default StockTable
