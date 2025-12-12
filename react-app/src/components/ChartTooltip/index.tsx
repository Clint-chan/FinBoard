/**
 * ChartTooltip - 分时图悬浮组件
 * 完全对照原版 js/view.js 的 moveChart 函数实现位置计算
 */
import { useState, useCallback, useRef, useLayoutEffect } from 'react'
import { SuperChart } from '@/components/SuperChart'
import type { ChartConfig, ChartPeriod, SubIndicator } from '@/components/SuperChart/types'
import './ChartTooltip.css'

// 图表配置缓存 key
const CHART_CONFIG_CACHE_KEY = 'market_board_chart_config'

// 从 localStorage 读取配置缓存
function loadChartConfigCache(): Record<string, ChartConfig> {
  try {
    const cached = localStorage.getItem(CHART_CONFIG_CACHE_KEY)
    if (cached) {
      const data = JSON.parse(cached)
      // 检查是否是今天的缓存
      const today = new Date().toDateString()
      if (data.date === today) {
        return data.configs || {}
      }
    }
  } catch (e) {
    console.warn('Failed to load chart config cache:', e)
  }
  return {}
}

// 保存配置缓存到 localStorage
function saveChartConfigCache(configs: Record<string, ChartConfig>) {
  try {
    localStorage.setItem(CHART_CONFIG_CACHE_KEY, JSON.stringify({
      date: new Date().toDateString(),
      configs
    }))
  } catch (e) {
    console.warn('Failed to save chart config cache:', e)
  }
}

// 全局配置缓存
const chartConfigCache = loadChartConfigCache()

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

  // 获取缓存的配置
  const cachedConfig = code ? chartConfigCache[code] : null
  const defaultTab: ChartPeriod = cachedConfig?.tab || 'intraday'
  const defaultSubIndicators: SubIndicator[] = cachedConfig?.subIndicators || ['vol']
  const defaultShowBoll = cachedConfig?.showBoll || false

  // 配置变化时保存到缓存
  const handleConfigChange = useCallback((config: ChartConfig) => {
    if (!code) return
    chartConfigCache[code] = config
    saveChartConfigCache(chartConfigCache)
  }, [code])

  // 不显示时返回 null
  if (!visible || !code) return null

  return (
    <div
      ref={tooltipRef}
      className={`chart-tooltip show ${isHovered ? 'interactive' : ''}`}
      style={{ left: position.left, top: position.top }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <SuperChart
        code={code}
        width={440}
        isDark={isDark}
        defaultTab={defaultTab}
        defaultSubIndicators={defaultSubIndicators}
        showBoll={defaultShowBoll}
        initialName={stockName}
        initialPrice={stockPrice}
        initialPreClose={stockPreClose}
        onConfigChange={handleConfigChange}
      />
    </div>
  )
}

export default ChartTooltip
