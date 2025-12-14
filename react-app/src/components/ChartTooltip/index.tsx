/**
 * ChartTooltip - 分时图悬浮组件
 * 完全对照原版 js/view.js 的 moveChart 函数实现位置计算
 */
import { useState, useCallback, useRef, useLayoutEffect } from 'react'
import { SuperChart } from '@/components/SuperChart'
import type { ChartConfig, ChartPeriod, SubIndicator } from '@/components/SuperChart/types'
import './ChartTooltip.css'

// 图表配置缓存 key
const CHART_CONFIG_CACHE_KEY = 'market_board_tooltip_config'

// 全局图表配置 - 所有股票共享同一个配置（周期、副图指标等）
let globalChartConfig: ChartConfig = {
  tab: 'intraday',
  subIndicators: ['vol'],
  showBoll: false
}

// 从 localStorage 加载全局配置
function loadGlobalConfig(): void {
  try {
    const cached = localStorage.getItem(CHART_CONFIG_CACHE_KEY)
    if (cached) {
      const config = JSON.parse(cached)
      if (config.tab && config.subIndicators) {
        globalChartConfig = config
      }
    }
  } catch (e) {
    console.warn('Failed to load chart config:', e)
  }
}

// 保存全局配置到 localStorage
function saveGlobalConfig(): void {
  try {
    localStorage.setItem(CHART_CONFIG_CACHE_KEY, JSON.stringify(globalChartConfig))
  } catch (e) {
    console.warn('Failed to save chart config:', e)
  }
}

// 初始化加载配置
loadGlobalConfig()

interface ChartTooltipProps {
  visible: boolean
  code: string | null
  // 初始数据，避免加载时显示 '--'
  stockName?: string
  stockPrice?: number
  stockPreClose?: number
  x: number
  y: number
  onMouseEnter: () => void
  onMouseLeave: () => void
}

function ChartTooltip({
  visible,
  code,
  stockName,
  stockPrice,
  stockPreClose,
  x,
  y,
  onMouseEnter,
  onMouseLeave,
}: ChartTooltipProps) {
  const [isHovered, setIsHovered] = useState(false)
  const tooltipRef = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState({ left: 0, top: 0 })
  
  const handleMouseEnter = useCallback(() => {
    setIsHovered(true)
    onMouseEnter()
  }, [onMouseEnter])
  
  const handleMouseLeave = useCallback(() => {
    setIsHovered(false)
    onMouseLeave()
  }, [onMouseLeave])
  
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark'

  // 对照原版 view.js 的 moveChart 函数计算位置
  const calculatePosition = useCallback((tooltipW: number, tooltipH: number) => {
    const gap = 15
    const viewW = window.innerWidth
    const viewH = window.innerHeight
    
    // 计算水平位置：优先右侧，空间不足则左侧
    let left: number
    if (x + gap + tooltipW <= viewW) {
      left = x + gap
    } else if (x - gap - tooltipW >= 0) {
      left = x - gap - tooltipW
    } else {
      left = Math.max(0, viewW - tooltipW - 10)
    }
    
    // 计算垂直位置：优先下方，空间不足则上方
    let top: number
    if (y + gap + tooltipH <= viewH) {
      top = y + gap
    } else if (y - gap - tooltipH >= 0) {
      top = y - gap - tooltipH
    } else {
      top = Math.max(0, viewH - tooltipH - 10)
    }
    
    return { left, top }
  }, [x, y])

  // 使用 useLayoutEffect 在渲染后立即获取实际尺寸并调整位置
  useLayoutEffect(() => {
    if (!visible || !tooltipRef.current) return
    
    // 使用 requestAnimationFrame 确保 DOM 已更新
    const frame = requestAnimationFrame(() => {
      if (!tooltipRef.current) return
      const tooltipRect = tooltipRef.current.getBoundingClientRect()
      const tooltipW = tooltipRect.width || 460
      const tooltipH = tooltipRect.height || 350
      setPosition(calculatePosition(tooltipW, tooltipH))
    })
    
    return () => cancelAnimationFrame(frame)
  }, [visible, x, y, calculatePosition])
  
  // 初始位置使用估算值
  useLayoutEffect(() => {
    if (visible) {
      setPosition(calculatePosition(460, 350))
    }
  }, [visible, calculatePosition])

  // 使用全局配置 - 所有股票共享
  const defaultTab: ChartPeriod = globalChartConfig.tab
  const defaultSubIndicators: SubIndicator[] = globalChartConfig.subIndicators
  const defaultShowBoll = globalChartConfig.showBoll

  // 配置变化时立即更新全局配置并保存
  const handleConfigChange = useCallback((config: ChartConfig) => {
    globalChartConfig = config
    saveGlobalConfig()
  }, [])

  // 检测是否是移动端
  const isMobile = window.innerWidth <= 768
  
  // 移动端关闭处理
  const handleMobileClose = useCallback(() => {
    if (isMobile) {
      onMouseLeave()
    }
  }, [isMobile, onMouseLeave])

  // 不显示时返回 null
  if (!visible || !code) return null

  return (
    <div
      ref={tooltipRef}
      className={`chart-tooltip show ${isHovered ? 'interactive' : ''}`}
      style={isMobile ? {} : { left: position.left, top: position.top }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* 移动端关闭按钮 */}
      {isMobile && (
        <button
          className="chart-tooltip-close"
          onClick={handleMobileClose}
          aria-label="关闭"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
      
      <SuperChart
        key={code}
        code={code}
        width={isMobile ? window.innerWidth : 440}
        isDark={isDark}
        defaultTab={defaultTab}
        defaultSubIndicators={defaultSubIndicators}
        showBoll={defaultShowBoll}
        initialName={stockName}
        initialPrice={stockPrice}
        initialPreClose={stockPreClose}
        onConfigChange={handleConfigChange}
        fillContainer={isMobile}
      />
    </div>
  )
}

export default ChartTooltip
