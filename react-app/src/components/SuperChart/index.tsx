/**
 * SuperChart 组件 - 完整 K 线图
 * 对照原版 js/superChart.js 实现，包括十字线数据更新 Header
 */
import { useEffect, useRef, useState, useCallback } from 'react'
import { useSuperChart } from './useSuperChart'
import { ChartCanvas, type CrosshairData } from './ChartCanvas'
import { StockInfoCard } from '@/components/StockInfoCard'
import { isETF } from '@/utils/format'
import { PERIODS, DEFAULT_LAYOUT, type ChartPeriod, type SubIndicator, type SuperChartProps, type ChartConfig } from './types'
import './SuperChart.css'

export function SuperChart({
  code,
  width = 440,
  height: _height = 350, // 保留参数但不使用，高度由副图数量动态计算
  fillContainer = false,
  isDark = false,
  defaultTab = 'intraday',
  defaultSubIndicators = ['vol'],
  showBoll: initialShowBoll = false,
  onLoad,
  initialName = '',
  initialPrice,
  initialPreClose,
  pe,
  onAddAlert,
  onConfigChange,
  alertLines = []
}: SuperChartProps) {
  void _height // 避免 unused 警告
  const containerRef = useRef<HTMLDivElement>(null)
  
  // 下拉菜单状态 - 对照原版使用 click 切换 open 类
  const [openDropdown, setOpenDropdown] = useState<'minute' | 'day' | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  // 十字线悬停数据 - 对照原版 renderHeader(ohlcData)
  const [crosshairData, setCrosshairData] = useState<CrosshairData | null>(null)
  // 容器高度 - 用于 fillContainer 模式
  const [containerHeight, setContainerHeight] = useState(400)
  // 股票信息卡片显示状态
  const [showStockInfo, setShowStockInfo] = useState(false)
  const stockInfoTimerRef = useRef<number | null>(null)
  
  // 预警按钮状态 - 只记录 Y 位置和价格
  const [alertButtonPos, setAlertButtonPos] = useState<{ y: number; price: number } | null>(null)
  const alertButtonTimerRef = useRef<number | null>(null)
  
  // 预警线悬停状态
  const [hoveredAlertIndex, setHoveredAlertIndex] = useState<number | null>(null)
  
  const {
    currentTab,
    subIndicators,
    showBoll,
    loading,
    error,
    crosshair,
    stockName,
    intradayData,
    processedData,
    isIntraday,
    switchTab,
    toggleSubIndicator,
    setShowBoll,
    handleWheel,
    setCrosshair,
    handlePanToEdge
  } = useSuperChart({
    code,
    defaultTab,
    defaultSubIndicators,
    showBoll: initialShowBoll,
    initialName
  })

  // 立即同步配置到父组件，避免快速卸载时丢失（例如悬浮框瞬时隐藏）
  const syncConfig = useCallback((partial: Partial<ChartConfig> = {}) => {
    onConfigChange?.({
      tab: partial.tab ?? currentTab,
      subIndicators: partial.subIndicators ?? subIndicators,
      showBoll: partial.showBoll ?? showBoll
    })
  }, [currentTab, subIndicators, showBoll, onConfigChange])

  // 计算实际宽度
  const actualWidth = fillContainer && containerRef.current 
    ? containerRef.current.offsetWidth 
    : width

  // 监听容器尺寸变化 - fillContainer 模式
  useEffect(() => {
    if (!fillContainer || !containerRef.current) return
    
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerHeight(entry.contentRect.height)
      }
    })
    
    observer.observe(containerRef.current)
    // 初始化高度
    setContainerHeight(containerRef.current.clientHeight)
    
    return () => observer.disconnect()
  }, [fillContainer])

  // 加载完成回调
  useEffect(() => {
    if (!loading && (intradayData || processedData)) {
      onLoad?.()
    }
  }, [loading, intradayData, processedData, onLoad])

  // 计算价格和涨跌幅 - 对照原版 renderHeader
  // 如果有 crosshairData（十字光标悬停），显示该K线/分时的价格
  // 使用初始值作为 fallback，避免加载时显示 '--'
  const baseLastPrice = isIntraday 
    ? (intradayData?.lastPrice ?? initialPrice) 
    : (processedData?.lastPrice ?? initialPrice)
  const basePreClose = isIntraday 
    ? (intradayData?.preClose ?? initialPreClose) 
    : (processedData?.preClose ?? initialPreClose)
  
  let displayPrice: number | undefined
  let displayPreClose: number | undefined
  
  if (crosshairData) {
    displayPrice = crosshairData.close ?? crosshairData.price ?? baseLastPrice
    displayPreClose = crosshairData.prevClose ?? basePreClose
  } else {
    displayPrice = baseLastPrice
    displayPreClose = basePreClose
  }
  
  const pct = displayPreClose && displayPrice 
    ? ((displayPrice - displayPreClose) / displayPreClose * 100) 
    : 0
  const change = displayPreClose && displayPrice ? displayPrice - displayPreClose : 0
  const isUp = displayPrice != null && displayPreClose != null ? displayPrice >= displayPreClose : pct >= 0
  
  // ETF 价格显示 3 位小数
  const priceDigits = isETF(code) ? 3 : 2

  // 周期分组
  const isMinute = PERIODS[currentTab]?.group === 'minute'
  const isDay = PERIODS[currentTab]?.group === 'day'
  const minuteLabel = isMinute ? PERIODS[currentTab].label : '分时'
  const dayLabel = isDay ? PERIODS[currentTab].label : '日K'

  // 点击下拉按钮 - 对照原版 bindEvents 中的逻辑
  const handleDropdownClick = useCallback((group: 'minute' | 'day', e: React.MouseEvent) => {
    e.stopPropagation()
    setOpenDropdown(prev => prev === group ? null : group)
  }, [])

  // 点击选项 - 对照原版
  const handleOptionClick = useCallback((tab: ChartPeriod, e: React.MouseEvent) => {
    e.stopPropagation()
    switchTab(tab)
    setOpenDropdown(null)
    syncConfig({ tab })
  }, [switchTab, syncConfig])

  // 点击齿轮按钮 - 对照原版
  const handleGearClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    setMenuOpen(prev => !prev)
  }, [])

  // 点击菜单项 - 对照原版，阻止冒泡保持菜单打开
  const handleMenuItemClick = useCallback((action: SubIndicator | 'boll', e: React.MouseEvent) => {
    e.stopPropagation()
    if (action === 'boll') {
      const next = !showBoll
      setShowBoll(next)
      syncConfig({ showBoll: next })
    } else {
      let nextSubs = subIndicators
      const idx = subIndicators.indexOf(action)
      if (idx >= 0) {
        if (subIndicators.length > 1) {
          nextSubs = subIndicators.filter(i => i !== action)
        }
      } else if (subIndicators.length < 3) {
        nextSubs = [...subIndicators, action]
      }
      if (nextSubs !== subIndicators) {
        syncConfig({ subIndicators: nextSubs })
      }
      toggleSubIndicator(action)
    }
  }, [showBoll, subIndicators, setShowBoll, toggleSubIndicator, syncConfig])

  // 点击外部关闭下拉菜单 - 对照原版
  useEffect(() => {
    const handleClickOutside = () => {
      setOpenDropdown(null)
      setMenuOpen(false)
    }
    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [])

  // 生成 OHLC HTML - 对照原版 renderHeader 中的 ohlcHtml
  const renderOhlcInfo = () => {
    if (!crosshairData) return null
    
    if (!isIntraday && crosshairData.open != null) {
      // K线图显示 OHLC + 换手率 + 至今涨幅 + 市盈率（去掉涨幅，因为右上角已显示）
      const kIsUp = crosshairData.close! >= crosshairData.open
      const kColor = kIsUp ? 'var(--color-up)' : 'var(--color-down)'
      
      // 至今涨幅（从该K线到当前最新价）
      // 使用 baseLastPrice（最新价格）而不是 displayPrice（悬停时的价格）
      const latestPrice = baseLastPrice
      const toNowPct = latestPrice && crosshairData.close
        ? ((latestPrice - crosshairData.close) / crosshairData.close * 100)
        : null
      
      return (
        <div className="sc-ohlc" style={{ color: kColor }}>
          <span className="sc-ohlc-time">{crosshairData.time}</span>
          {crosshairData.open != null && <span>开 {crosshairData.open.toFixed(2)}</span>}
          {crosshairData.high != null && <span>高 {crosshairData.high.toFixed(2)}</span>}
          {crosshairData.low != null && <span>低 {crosshairData.low.toFixed(2)}</span>}
          {crosshairData.close != null && <span>收 {crosshairData.close.toFixed(2)}</span>}
          {toNowPct != null && !isNaN(toNowPct) && (
            <span>至今 {toNowPct >= 0 ? '+' : ''}{toNowPct.toFixed(2)}%</span>
          )}
          {crosshairData.turnover != null && (
            <span>换手 {crosshairData.turnover.toFixed(2)}%</span>
          )}
          {currentTab === 'daily' && pe != null && !isNaN(pe) && (
            <span>市盈率 {pe.toFixed(2)}</span>
          )}
        </div>
      )
    } else if (crosshairData.time) {
      // 分时图显示时间
      return (
        <div className="sc-ohlc" style={{ color: 'var(--color-text-secondary)' }}>
          <span className="sc-ohlc-time">{crosshairData.time}</span>
        </div>
      )
    }
    return null
  }

  // 对照原版 updateCanvasSize：计算容器动态高度
  const subCount = isIntraday ? 1 : subIndicators.length
  const { headerH, toolbarH, padding, subH, subGap, mainSubGap, mainH } = {
    headerH: 90, // 增加header高度以容纳更多信息
    toolbarH: 38,
    padding: { top: 8, bottom: 12 },
    subH: 72,
    subGap: 10,
    mainSubGap: 15,
    mainH: 150
  }
  const totalSubH = subCount * subH + (subCount > 0 ? (subCount - 1) * subGap : 0)
  const currentMainSubGap = subCount > 0 ? mainSubGap : 0
  const canvasContentH = padding.top + mainH + currentMainSubGap + totalSubH + padding.bottom
  const totalContainerH = headerH + toolbarH + canvasContentH

  // fillContainer 模式：铺满父容器
  const containerStyle = fillContainer 
    ? { height: '100%', transition: 'height 0.25s cubic-bezier(0.4, 0, 0.2, 1)' }
    : { height: totalContainerH, transition: 'height 0.25s cubic-bezier(0.4, 0, 0.2, 1)' }

  return (
    <div 
      className="super-chart" 
      ref={containerRef}
      style={containerStyle}
    >
      {/* 头部 - 对照原版 renderHeader，固定高度防止抖动 */}
      <div className="sc-header" style={{ height: headerH, flexShrink: 0 }}>
        <div className="sc-header-left">
          <div 
            className="sc-name sc-name-hoverable"
            onMouseEnter={() => {
              if (stockInfoTimerRef.current) clearTimeout(stockInfoTimerRef.current)
              stockInfoTimerRef.current = window.setTimeout(() => {
                setShowStockInfo(true)
              }, 300)
            }}
            onMouseLeave={() => {
              if (stockInfoTimerRef.current) clearTimeout(stockInfoTimerRef.current)
              stockInfoTimerRef.current = window.setTimeout(() => {
                setShowStockInfo(false)
              }, 200)
            }}
          >
            {stockName || '--'}
            {/* 股票信息卡片 */}
            {showStockInfo && (
              <div 
                className="sc-stock-info-popup"
                onMouseEnter={() => {
                  if (stockInfoTimerRef.current) clearTimeout(stockInfoTimerRef.current)
                }}
                onMouseLeave={() => {
                  setShowStockInfo(false)
                }}
              >
                <StockInfoCard code={code} visible={showStockInfo} />
              </div>
            )}
          </div>
          <div className="sc-code">{code.toUpperCase()}</div>
          {renderOhlcInfo()}
        </div>
        <div className="sc-header-right" style={{ color: isUp ? 'var(--color-up)' : 'var(--color-down)' }}>
          <div className="sc-price">{displayPrice != null ? displayPrice.toFixed(priceDigits) : '--'}</div>
          <div className="sc-change">
            {isUp ? '+' : ''}{(change || 0).toFixed(priceDigits)} ({isUp ? '+' : ''}{(pct || 0).toFixed(2)}%)
          </div>
        </div>
      </div>

      {/* 工具栏 - 对照原版使用 click 切换 open 类 */}
      <div className="sc-toolbar">
        <div className="sc-tabs">
          {/* 分钟级下拉 */}
          <div 
            className={`sc-tab-dropdown ${isMinute ? 'active' : ''} ${openDropdown === 'minute' ? 'open' : ''}`}
            onClick={(e) => handleDropdownClick('minute', e)}
          >
            <span className="sc-tab-label">{minuteLabel}</span>
            <svg className="sc-tab-arrow" width="10" height="10" viewBox="0 0 10 10">
              <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.5" fill="none"/>
            </svg>
            <div className="sc-tab-menu">
              {(['intraday', '5min', '15min', '30min', '60min'] as ChartPeriod[]).map(k => (
                <div 
                  key={k}
                  className={`sc-tab-option ${currentTab === k ? 'active' : ''}`}
                  onClick={(e) => handleOptionClick(k, e)}
                >
                  {PERIODS[k].label}
                </div>
              ))}
            </div>
          </div>
          
          {/* 日级下拉 */}
          <div 
            className={`sc-tab-dropdown ${isDay ? 'active' : ''} ${openDropdown === 'day' ? 'open' : ''}`}
            onClick={(e) => handleDropdownClick('day', e)}
          >
            <span className="sc-tab-label">{dayLabel}</span>
            <svg className="sc-tab-arrow" width="10" height="10" viewBox="0 0 10 10">
              <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.5" fill="none"/>
            </svg>
            <div className="sc-tab-menu">
              {(['daily', 'weekly', 'monthly'] as ChartPeriod[]).map(k => (
                <div 
                  key={k}
                  className={`sc-tab-option ${currentTab === k ? 'active' : ''}`}
                  onClick={(e) => handleOptionClick(k, e)}
                >
                  {PERIODS[k].label}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 指标设置 - 对照原版使用 click 切换 .show 类 */}
        <div className="sc-settings">
          <div className="sc-gear-btn" title="指标设置" onClick={handleGearClick}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="3"></circle>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
            </svg>
          </div>
          <div className={`sc-menu ${menuOpen ? 'show' : ''}`}>
            <div className="sc-menu-title">副图指标</div>
            {(['vol', 'macd', 'rsi'] as SubIndicator[]).map(ind => (
              <div 
                key={ind}
                className={`sc-menu-item ${subIndicators.includes(ind) ? 'active' : ''}`}
                onClick={(e) => handleMenuItemClick(ind, e)}
              >
                <span className="sc-menu-check">{subIndicators.includes(ind) ? '✓' : ''}</span>
                <span>{ind.toUpperCase()}</span>
              </div>
            ))}
            {!isIntraday && (
              <>
                <div className="sc-menu-divider"></div>
                <div className="sc-menu-title">主图叠加</div>
                <div 
                  className={`sc-menu-item ${showBoll ? 'active' : ''}`}
                  onClick={(e) => handleMenuItemClick('boll', e)}
                >
                  <span className="sc-menu-check">{showBoll ? '✓' : ''}</span>
                  <span>布林带 BOLL</span>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* 图表区域 - 对照原版使用计算后的高度，fillContainer 模式使用 flex */}
      <div 
        className="sc-canvas-wrap" 
        style={fillContainer ? { flex: 1, minHeight: 0 } : { height: canvasContentH }}
      >
        {loading ? (
          <div className="sc-loading">加载中...</div>
        ) : error && !intradayData && !processedData ? (
          <div className="sc-error">{error}</div>
        ) : (
          <ChartCanvas
            width={actualWidth}
            height={fillContainer ? Math.max(200, containerHeight - headerH - toolbarH) : canvasContentH}
            isDark={isDark}
            isIntraday={isIntraday}
            intradayData={intradayData}
            klineData={processedData}
            subIndicators={subIndicators}
            showBoll={showBoll}
            crosshair={crosshair}
            alertLines={alertLines}
            hoveredAlertIndex={hoveredAlertIndex}
            code={code}
            onCrosshairChange={(pos) => {
              setCrosshair(pos)
              
              // 检测是否悬停在预警线附近
              if (pos && alertLines.length > 0) {
                const priceRange = isIntraday && intradayData 
                  ? intradayData.priceRange 
                  : processedData?.priceRange || { min: 0, max: 100 }
                
                const mainH = canvasContentH - DEFAULT_LAYOUT.padding.top - DEFAULT_LAYOUT.padding.bottom - 
                  (isIntraday ? 1 : subIndicators.length) * (DEFAULT_LAYOUT.subH + DEFAULT_LAYOUT.subGap) - 
                  DEFAULT_LAYOUT.mainSubGap
                
                // 检查鼠标是否接近某条预警线
                let foundIndex: number | null = null
                const threshold = 8 // 8px 容差
                
                alertLines.forEach((alert, index) => {
                  if (alert.price < priceRange.min || alert.price > priceRange.max) return
                  
                  const alertY = DEFAULT_LAYOUT.padding.top + mainH - 
                    ((alert.price - priceRange.min) / (priceRange.max - priceRange.min)) * mainH
                  
                  if (Math.abs(pos.y - alertY) < threshold) {
                    foundIndex = index
                  }
                })
                
                setHoveredAlertIndex(foundIndex)
              } else {
                setHoveredAlertIndex(null)
              }
              
              // 更新预警按钮位置 - 只记录 Y 位置
              if (pos && crosshairData && (crosshairData.price || crosshairData.close)) {
                const price = crosshairData.price || crosshairData.close || 0
                setAlertButtonPos({ y: pos.y, price })
                
                // 清除之前的定时器
                if (alertButtonTimerRef.current) {
                  clearTimeout(alertButtonTimerRef.current)
                }
              } else {
                // 延迟隐藏按钮，给用户时间点击
                if (alertButtonTimerRef.current) {
                  clearTimeout(alertButtonTimerRef.current)
                }
                alertButtonTimerRef.current = window.setTimeout(() => {
                  setAlertButtonPos(null)
                }, 300)
              }
            }}
            onWheel={handleWheel}
            onCrosshairData={setCrosshairData}
            onPanToEdge={handlePanToEdge}
          />
        )}
      </div>

      {/* 十字线预警按钮 - 移到外层，避免被 overflow:hidden 裁剪 */}
      {alertButtonPos && onAddAlert && (
        <button
          className="sc-alert-btn"
          style={{
            right: `${DEFAULT_LAYOUT.padding.right + 8}px`,
            top: `${headerH + toolbarH + alertButtonPos.y - 12}px`
          }}
          onClick={(e) => {
            e.stopPropagation()
            e.preventDefault()
            console.log('Alert button clicked, price:', alertButtonPos.price)
            if (onAddAlert) {
              onAddAlert(alertButtonPos.price)
            }
          }}
          onMouseEnter={(e) => {
            e.stopPropagation()
            // 鼠标进入按钮时，清除隐藏定时器
            if (alertButtonTimerRef.current) {
              clearTimeout(alertButtonTimerRef.current)
            }
          }}
          onMouseLeave={(e) => {
            e.stopPropagation()
            // 鼠标离开按钮时，延迟隐藏
            alertButtonTimerRef.current = window.setTimeout(() => {
              setAlertButtonPos(null)
            }, 300)
          }}
          onMouseMove={(e) => e.stopPropagation()}
          title="添加价格预警"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
            <line x1="12" y1="9" x2="12" y2="13"/>
            <line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
        </button>
      )}
    </div>
  )
}

export default SuperChart
export * from './types'
