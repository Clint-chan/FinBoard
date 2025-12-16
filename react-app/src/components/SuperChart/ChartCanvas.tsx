/**
 * SuperChart Canvas 组件 - 完整搬运原版 js/superChart.js 的所有绑定功能
 * 包括：十字线、触摸事件、副图指标信息、分割线等
 */
import { useRef, useEffect, useCallback, useState } from 'react'
import type { ChartData } from '@/services/chartService'
import type { SubIndicator, ProcessedKlineData } from './types'
import { LIGHT_THEME, DARK_THEME, DEFAULT_LAYOUT } from './types'

interface ChartCanvasProps {
  width: number
  height: number
  isDark: boolean
  isIntraday: boolean
  intradayData: (ChartData & { name?: string }) | null
  klineData: ProcessedKlineData | null
  subIndicators: SubIndicator[]
  showBoll: boolean
  crosshair: { x: number; y: number } | null
  onCrosshairChange: (pos: { x: number; y: number } | null) => void
  onWheel: (deltaY: number) => void
  onCrosshairData?: (data: CrosshairData | null) => void
  onPanToEdge?: () => void // 拖动到左边界时触发加载更多
}

// 十字线数据类型
export interface CrosshairData {
  time?: string
  price?: number
  open?: number
  high?: number
  low?: number
  close?: number
  prevClose?: number
  turnover?: number // 换手率
}

export function ChartCanvas({
  width,
  height,
  isDark,
  isIntraday,
  intradayData,
  klineData,
  subIndicators,
  showBoll,
  crosshair,
  onCrosshairChange,
  onWheel,
  onCrosshairData,
  onPanToEdge
}: ChartCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const colors = isDark ? DARK_THEME : LIGHT_THEME
  const layout = DEFAULT_LAYOUT
  const dprRef = useRef(window.devicePixelRatio || 1)
  
  // 触摸缩放状态 - 对照原版 pinchState
  const [pinchState, setPinchState] = useState<{ startDist: number; startCount: number } | null>(null)
  
  // Y轴拖拽状态 - 用于调整价格缩放
  const [yAxisDragging, setYAxisDragging] = useState<{ startY: number; startScale: number } | null>(null)
  const [priceScale, setPriceScale] = useState<number>(1.0) // 价格缩放比例，1.0为默认，>1放大，<1缩小
  
  // 图表拖拽状态 - 用于平移图表
  const [chartDragging, setChartDragging] = useState<{ startX: number; startY: number; startPanX: number; startPanY: number } | null>(null)
  const [panOffset, setPanOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 }) // 平移偏移量

  // 时间转 X 坐标 - 对照原版 timeToX
  const timeToX = useCallback((time: string): number => {
    const [h, m] = time.split(':').map(Number)
    const minutes = h * 60 + m
    if (minutes <= 690) return minutes - 570
    return 120 + (minutes - 780)
  }, [])

  // 格式化成交量 - 对照原版 formatVol
  const formatVol = useCallback((vol: number | null | undefined): string => {
    if (vol == null) return '--'
    if (vol >= 100000000) return (vol / 100000000).toFixed(2) + '亿'
    if (vol >= 10000) return (vol / 10000).toFixed(1) + '万'
    return vol.toString()
  }, [])

  // 绘制网格 - 对照原版 drawGrid，增强显示
  const drawGrid = useCallback((
    ctx: CanvasRenderingContext2D,
    x: number, y: number, w: number, h: number, rows: number
  ) => {
    ctx.strokeStyle = colors.grid
    ctx.lineWidth = 1
    
    // 水平线
    for (let i = 0; i <= rows; i++) {
      const yPos = Math.round(y + (h / rows) * i) + 0.5
      ctx.beginPath()
      ctx.moveTo(x, yPos)
      ctx.lineTo(x + w, yPos)
      ctx.stroke()
    }
    
    // 垂直线 - 添加网格列
    const cols = 8
    for (let i = 0; i <= cols; i++) {
      const xPos = Math.round(x + (w / cols) * i) + 0.5
      ctx.beginPath()
      ctx.moveTo(xPos, y)
      ctx.lineTo(xPos, y + h)
      ctx.stroke()
    }
  }, [colors])

  // 绘制分割线 - 对照原版 drawDivider
  const drawDivider = useCallback((
    ctx: CanvasRenderingContext2D,
    x: number, y: number, fullW: number
  ) => {
    ctx.strokeStyle = colors.border
    ctx.lineWidth = 1
    ctx.setLineDash([4, 3])
    ctx.beginPath()
    ctx.moveTo(x, Math.round(y) + 0.5)
    ctx.lineTo(x + fullW, Math.round(y) + 0.5)
    ctx.stroke()
    ctx.setLineDash([])
  }, [colors])

  // 绘制价格轴 - 增加刻度数量到7个
  const drawPriceAxis = useCallback((
    ctx: CanvasRenderingContext2D,
    axisStartX: number, y: number, h: number,
    range: { min: number; max: number },
    preClose?: number
  ) => {
    ctx.font = '10px Inter, -apple-system, sans-serif'
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    
    const tickLen = 4
    const textGap = 8
    const textX = axisStartX + textGap

    const drawTickLabel = (val: number, yPos: number, color: string) => {
      // 确保val是有效数字
      if (typeof val !== 'number' || isNaN(val)) return
      
      ctx.strokeStyle = colors.border
      ctx.beginPath()
      ctx.moveTo(axisStartX, yPos)
      ctx.lineTo(axisStartX + tickLen, yPos)
      ctx.stroke()
      ctx.fillStyle = color
      ctx.fillText(val.toFixed(2), textX, yPos)
    }

    // 绘制7个刻度：最高、最低、中间，以及它们之间的中间值
    const tickCount = 7
    for (let i = 0; i < tickCount; i++) {
      const ratio = i / (tickCount - 1)
      const val = range.max - (range.max - range.min) * ratio
      const yPos = y + h * ratio
      
      let color = colors.textSecondary
      if (i === 0) color = colors.up // 最高价
      else if (i === tickCount - 1) color = colors.down // 最低价
      else if (preClose && Math.abs(val - preClose) < (range.max - range.min) * 0.02) {
        // 如果接近昨收价，高亮显示
        color = colors.textSecondary
      }
      
      drawTickLabel(val, yPos, color)
    }
  }, [colors])

  // 绘制副图坐标轴标签 - 对照原版 _drawSubAxisLabel
  const drawSubAxisLabel = useCallback((
    ctx: CanvasRenderingContext2D,
    axisX: number, val: number | string, yPos: number, color: string
  ) => {
    ctx.beginPath()
    ctx.strokeStyle = colors.border
    ctx.moveTo(axisX, yPos)
    ctx.lineTo(axisX + 4, yPos)
    ctx.stroke()
    ctx.textBaseline = 'middle'
    ctx.fillStyle = color
    ctx.fillText(typeof val === 'number' ? val.toFixed(2) : val, axisX + 8, yPos)
  }, [colors])

  // 绘制折线 - 对照原版 _drawLine
  const drawLine = useCallback((
    ctx: CanvasRenderingContext2D,
    data: number[], x: number, w: number,
    yFn: (v: number, i: number) => number,
    color: string, lineW = 1
  ) => {
    const gap = w / data.length
    ctx.beginPath()
    ctx.strokeStyle = color
    ctx.lineWidth = lineW
    data.forEach((v, i) => {
      const px = x + i * gap + gap / 2
      const py = yFn(v, i)
      i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py)
    })
    ctx.stroke()
  }, [])

  // 绘制分时图主图 - 对照原版 drawIntradayMain，支持价格缩放和平移
  const drawIntradayMain = useCallback((
    ctx: CanvasRenderingContext2D,
    x: number, y: number, w: number, h: number,
    data: ChartData
  ) => {
    const { priceData, priceRange: originalRange, preClose } = data
    if (!priceData || priceData.length < 2) return

    // 应用价格缩放：调整价格范围
    const center = (originalRange.max + originalRange.min) / 2
    const range = (originalRange.max - originalRange.min) / priceScale
    // 应用Y轴平移：调整价格中心
    const panYRatio = panOffset.y / h
    const adjustedCenter = center + range * panYRatio
    const priceRange = {
      min: adjustedCenter - range / 2,
      max: adjustedCenter + range / 2
    }

    drawGrid(ctx, x, y, w, h, 4)

    // 昨收线
    const preY = y + h - ((preClose - priceRange.min) / (priceRange.max - priceRange.min)) * h
    ctx.strokeStyle = colors.textSecondary
    ctx.lineWidth = 0.5
    ctx.setLineDash([3, 3])
    ctx.beginPath()
    ctx.moveTo(x, preY)
    ctx.lineTo(x + w, preY)
    ctx.stroke()
    ctx.setLineDash([])

    const xStep = w / 240
    // 应用X轴平移偏移量
    const xOffset = panOffset.x

    // 价格线 - 跳过无效数据点
    ctx.beginPath()
    let priceLineStarted = false
    priceData.forEach((d) => {
      if (typeof d.value !== 'number' || isNaN(d.value)) return
      
      const px = x + timeToX(d.time) * xStep + xOffset
      const py = y + h - ((d.value - priceRange.min) / (priceRange.max - priceRange.min)) * h
      if (!priceLineStarted) {
        ctx.moveTo(px, py)
        priceLineStarted = true
      } else {
        ctx.lineTo(px, py)
      }
    })
    ctx.strokeStyle = colors.line
    ctx.lineWidth = 1.5
    ctx.stroke()

    // 均价线 - 跳过无效数据点
    ctx.beginPath()
    let avgLineStarted = false
    priceData.forEach((d) => {
      if (typeof d.avgPrice !== 'number' || isNaN(d.avgPrice)) return
      
      const px = x + timeToX(d.time) * xStep + xOffset
      const py = y + h - ((d.avgPrice - priceRange.min) / (priceRange.max - priceRange.min)) * h
      if (!avgLineStarted) {
        ctx.moveTo(px, py)
        avgLineStarted = true
      } else {
        ctx.lineTo(px, py)
      }
    })
    ctx.strokeStyle = colors.avgLine
    ctx.lineWidth = 1
    ctx.stroke()

    // Y轴
    drawPriceAxis(ctx, x + w, y, h, priceRange, preClose)
  }, [colors, drawGrid, timeToX, drawPriceAxis, priceScale, panOffset])

  // 绘制 K 线主图 - 对照原版 drawKlineMain，支持价格缩放和平移
  const drawKlineMain = useCallback((
    ctx: CanvasRenderingContext2D,
    x: number, y: number, w: number, h: number,
    data: ProcessedKlineData
  ) => {
    const { klines, boll, priceRange: originalRange } = data
    if (!klines || klines.length < 2) return

    // 应用价格缩放：调整价格范围
    const center = (originalRange.max + originalRange.min) / 2
    const range = (originalRange.max - originalRange.min) / priceScale
    // 应用Y轴平移：调整价格中心
    const panYRatio = panOffset.y / h
    const adjustedCenter = center + range * panYRatio
    const priceRange = {
      min: adjustedCenter - range / 2,
      max: adjustedCenter + range / 2
    }

    drawGrid(ctx, x, y, w, h, 4)

    const barW = Math.max(3, (w / klines.length) * 0.7)
    const gap = w / klines.length
    // 应用X轴平移偏移量
    const xOffset = panOffset.x

    // BOLL 布林带
    if (showBoll) {
      ctx.beginPath()
      klines.forEach((_, i) => {
        const px = x + i * gap + gap / 2 + xOffset
        const py = y + h - ((boll.upper[i] - priceRange.min) / (priceRange.max - priceRange.min)) * h
        if (i === 0) ctx.moveTo(px, py)
        else ctx.lineTo(px, py)
      })
      for (let i = klines.length - 1; i >= 0; i--) {
        const px = x + i * gap + gap / 2 + xOffset
        const py = y + h - ((boll.lower[i] - priceRange.min) / (priceRange.max - priceRange.min)) * h
        ctx.lineTo(px, py)
      }
      ctx.closePath()
      ctx.fillStyle = colors.bollBand
      ctx.fill()

      // 中轨
      ctx.beginPath()
      klines.forEach((_, i) => {
        const px = x + i * gap + gap / 2 + xOffset
        const py = y + h - ((boll.mid[i] - priceRange.min) / (priceRange.max - priceRange.min)) * h
        if (i === 0) ctx.moveTo(px, py)
        else ctx.lineTo(px, py)
      })
      ctx.strokeStyle = colors.bollMid
      ctx.lineWidth = 1
      ctx.stroke()
    }

    // K 线蜡烛
    klines.forEach((k, i) => {
      const px = x + i * gap + gap / 2 + xOffset
      const isUp = k.close >= k.open
      const color = isUp ? colors.up : colors.down

      const openY = y + h - ((k.open - priceRange.min) / (priceRange.max - priceRange.min)) * h
      const closeY = y + h - ((k.close - priceRange.min) / (priceRange.max - priceRange.min)) * h
      const highY = y + h - ((k.high - priceRange.min) / (priceRange.max - priceRange.min)) * h
      const lowY = y + h - ((k.low - priceRange.min) / (priceRange.max - priceRange.min)) * h

      // 影线
      ctx.strokeStyle = color
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(px, highY)
      ctx.lineTo(px, lowY)
      ctx.stroke()

      // 实体
      const bodyTop = Math.min(openY, closeY)
      const bodyH = Math.max(1, Math.abs(closeY - openY))
      ctx.fillStyle = color
      ctx.fillRect(px - barW / 2, bodyTop, barW, bodyH)
    })

    // Y轴
    drawPriceAxis(ctx, x + w, y, h, priceRange)
  }, [colors, drawGrid, showBoll, drawPriceAxis, priceScale, panOffset])

  // 计算当前数据索引 - 对照原版 _getDataIndex
  const getDataIndex = useCallback((
    mouseX: number, x: number, w: number, dataLen: number, isIntraday: boolean
  ): number => {
    const step = isIntraday ? w / 240 : w / dataLen
    const idx = Math.floor((mouseX - x) / step)
    return (idx >= 0 && idx < dataLen) ? idx : -1
  }, [])

  // 绘制单个副图 - 对照原版 drawSingleSubChart
  const drawSingleSubChart = useCallback((
    ctx: CanvasRenderingContext2D,
    x: number, y: number, w: number, h: number,
    indicator: SubIndicator,
    crosshairX: number | null
  ) => {
    const axisX = x + w
    
    // 获取数据
    const dataArr = isIntraday ? intradayData?.volumeData : klineData?.klines
    if (!dataArr?.length) return
    
    const dataIndex = crosshairX != null 
      ? getDataIndex(crosshairX, x, w, dataArr.length, isIntraday)
      : dataArr.length - 1
    const currentItem = dataIndex >= 0 ? dataArr[dataIndex] : null

    // 分时图 VOL - 对照原版
    if (isIntraday && indicator === 'vol' && intradayData) {
      const { volumeData, priceData } = intradayData
      // 过滤掉无效的成交量数据，防止 NaN 导致 toFixed 报错
      const validVolumes = volumeData
        .map(d => d.value)
        .filter(v => typeof v === 'number' && !isNaN(v) && v > 0)
      
      if (validVolumes.length > 0) {
        const maxVol = Math.max(...validVolumes)
        const xStep = w / 240
        const barW = Math.max(1.5, xStep * 0.7)
        ctx.globalAlpha = 0.5
        volumeData.forEach((d, i) => {
          // 跳过无效数据
          if (typeof d.value !== 'number' || isNaN(d.value) || d.value <= 0) return
          
          const px = x + timeToX(d.time) * xStep
          const barH = Math.max(1, (d.value / maxVol) * h * 0.75)
          ctx.fillStyle = (i > 0 && priceData[i].value >= priceData[i - 1].value) ? colors.up : colors.down
          ctx.fillRect(px - barW / 2, y + h - barH, barW, barH)
        })
        ctx.globalAlpha = 1
        drawSubAxisLabel(ctx, axisX, formatVol(maxVol), y + h * 0.25, colors.text)
      }
    }
    // K线图指标 - 对照原版
    else if (klineData) {
      const { klines, macd, rsi } = klineData
      const gap = w / klines.length
      const barW = Math.max(2, gap * 0.6)

      if (indicator === 'vol') {
        const maxVol = Math.max(...klines.map(k => k.volume))
        klines.forEach((k, i) => {
          const px = x + i * gap + gap / 2
          ctx.fillStyle = k.close >= k.open ? colors.up : colors.down
          const barH = (k.volume / maxVol) * h * 0.75
          ctx.fillRect(px - barW / 2, y + h - barH, barW, barH)
        })
        drawSubAxisLabel(ctx, axisX, formatVol(maxVol), y + h * 0.25, colors.text)

      } else if (indicator === 'macd') {
        const maxMacd = Math.max(...macd.macd.map(Math.abs))
        const midY = y + h / 2
        
        // 零轴
        ctx.strokeStyle = colors.text
        ctx.globalAlpha = 0.25
        ctx.setLineDash([4, 2])
        ctx.beginPath()
        ctx.moveTo(x, midY)
        ctx.lineTo(x + w, midY)
        ctx.stroke()
        ctx.setLineDash([])
        ctx.globalAlpha = 1

        // MACD 柱
        klines.forEach((_, i) => {
          const px = x + i * gap + gap / 2
          const val = macd.macd[i]
          const barH = (Math.abs(val) / maxMacd) * (h / 2) * 0.75
          ctx.fillStyle = val >= 0 ? colors.macdUp : colors.macdDown
          ctx.fillRect(px - barW / 2, val >= 0 ? midY - barH : midY, barW, barH)
        })

        // DIF/DEA 线
        const maxDif = Math.max(...macd.dif.map(Math.abs), ...macd.dea.map(Math.abs))
        const yFn = (v: number) => midY - (v / maxDif) * (h / 2) * 0.75
        drawLine(ctx, macd.dif, x, w, yFn, colors.dif)
        drawLine(ctx, macd.dea, x, w, yFn, colors.dea)

        drawSubAxisLabel(ctx, axisX, maxMacd, y + h * 0.125, colors.up)
        drawSubAxisLabel(ctx, axisX, -maxMacd, y + h * 0.875, colors.down)

      } else if (indicator === 'rsi') {
        const padY = 5
        const drawH = h - padY * 2
        const rsiToY = (val: number) => y + padY + drawH * (1 - val / 100)
        const y80 = rsiToY(80)
        const y50 = rsiToY(50)
        const y20 = rsiToY(20)

        // 色带
        ctx.globalAlpha = 0.06
        ctx.fillStyle = colors.up
        ctx.fillRect(x, y + padY, w, y80 - (y + padY))
        ctx.fillStyle = colors.down
        ctx.fillRect(x, y20, w, (y + h - padY) - y20)
        ctx.globalAlpha = 1

        // 阈值线
        const lines: [number, string, number[]][] = [
          [y80, colors.up, [2, 2]],
          [y50, colors.textSecondary, [4, 4]],
          [y20, colors.down, [2, 2]]
        ]
        lines.forEach(([yy, c, d]) => {
          ctx.strokeStyle = c
          ctx.globalAlpha = 0.5
          ctx.setLineDash(d)
          ctx.beginPath()
          ctx.moveTo(x, yy)
          ctx.lineTo(x + w, yy)
          ctx.stroke()
        })
        ctx.setLineDash([])
        ctx.globalAlpha = 1

        // RSI 三线 - 对照原版 rsiCfg
        const rsiCfg: [keyof typeof rsi, string][] = [
          ['rsi24', '#8b5cf6'],
          ['rsi12', '#3b82f6'],
          ['rsi6', '#f59e0b']
        ]
        rsiCfg.forEach(([k, c]) => {
          drawLine(ctx, rsi[k], x, w, (v) => rsiToY(v), c, 1.2)
        })

        drawSubAxisLabel(ctx, axisX, '80', y80, colors.up)
        drawSubAxisLabel(ctx, axisX, '20', y20, colors.down)
      }
    }

    // 左上角指标信息 - 对照原版
    ctx.font = '10px Inter, -apple-system, sans-serif'
    ctx.textBaseline = 'middle'
    ctx.textAlign = 'left'
    const textY = y + 8
    let curX = x + 2

    ctx.fillStyle = colors.text
    ctx.fillText(indicator.toUpperCase(), curX, textY)
    curX += ctx.measureText(indicator.toUpperCase()).width + 10

    if (dataIndex >= 0) {
      const drawVal = (lbl: string, val: number | string, clr: string) => {
        if (lbl) {
          ctx.fillStyle = colors.textSecondary
          ctx.fillText(lbl, curX, textY)
          curX += ctx.measureText(lbl).width + 2
        }
        ctx.fillStyle = clr
        const s = typeof val === 'number' ? val.toFixed(2) : val
        ctx.fillText(s, curX, textY)
        curX += ctx.measureText(s).width + 10
      }

      if (indicator === 'vol' && currentItem) {
        const vol = 'value' in currentItem ? currentItem.value : (currentItem as any).volume
        drawVal('', formatVol(vol), colors.textSecondary)
      } else if (indicator === 'macd' && klineData?.macd?.dif[dataIndex] !== undefined) {
        const { macd } = klineData
        drawVal('DIF:', macd.dif[dataIndex], colors.dif)
        drawVal('DEA:', macd.dea[dataIndex], colors.dea)
        const m = macd.macd[dataIndex]
        drawVal('MACD:', m, m >= 0 ? colors.up : colors.down)
      } else if (indicator === 'rsi' && klineData?.rsi?.rsi6[dataIndex] !== undefined) {
        const { rsi } = klineData
        drawVal('6:', rsi.rsi6[dataIndex], '#f59e0b')
        drawVal('12:', rsi.rsi12[dataIndex], '#3b82f6')
        drawVal('24:', rsi.rsi24[dataIndex], '#8b5cf6')
      }
    }
  }, [colors, isIntraday, intradayData, klineData, timeToX, formatVol, getDataIndex, drawSubAxisLabel, drawLine])

  // 绘制十字线 - 对照原版 drawCrosshair，添加右侧价格标记
  const drawCrosshair = useCallback((
    ctx: CanvasRenderingContext2D,
    padding: typeof layout.padding,
    mainH: number,
    subTotalH: number,
    chartW: number,
    crosshairPos: { x: number; y: number },
    priceRange: { min: number; max: number }
  ) => {
    const { x, y } = crosshairPos
    
    ctx.strokeStyle = colors.textSecondary
    ctx.lineWidth = 0.5
    ctx.setLineDash([3, 3])
    
    // 垂直线 - 贯穿主图和副图
    if (x >= padding.left && x <= padding.left + chartW) {
      const totalDrawH = mainH + (subTotalH > 0 ? layout.mainSubGap + subTotalH : 0)
      ctx.beginPath()
      ctx.moveTo(x, padding.top)
      ctx.lineTo(x, padding.top + totalDrawH)
      ctx.stroke()
    }
    
    // 水平线 - 仅在主图区域
    if (y >= padding.top && y <= padding.top + mainH) {
      ctx.beginPath()
      ctx.moveTo(padding.left, y)
      ctx.lineTo(padding.left + chartW, y)
      ctx.stroke()
      
      // 右侧价格标记
      const price = priceRange.max - ((y - padding.top) / mainH) * (priceRange.max - priceRange.min)
      
      // 确保价格是有效数字
      if (typeof price === 'number' && !isNaN(price)) {
        const axisX = padding.left + chartW
        const labelW = 50
        const labelH = 18
        const labelX = axisX + 4
        const labelY = y - labelH / 2
        
        // 背景
        ctx.fillStyle = colors.textSecondary
        ctx.fillRect(labelX, labelY, labelW, labelH)
        
        // 文字
        ctx.font = '11px Inter, -apple-system, sans-serif'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillStyle = colors.bg
        ctx.fillText(price.toFixed(2), labelX + labelW / 2, y)
      }
    }
    ctx.setLineDash([])
  }, [colors, layout])

  // 更新十字线数据 - 对照原版 updateCrosshairData
  const updateCrosshairData = useCallback((
    mouseX: number,
    padding: typeof layout.padding,
    chartW: number
  ) => {
    if (isIntraday && intradayData) {
      const { priceData, preClose } = intradayData
      if (!priceData?.length) return
      
      const xStep = chartW / 240
      const idx = Math.floor((mouseX - padding.left) / xStep)
      if (idx < 0 || idx >= priceData.length) return
      
      const p = priceData[idx]
      onCrosshairData?.({
        time: p.time,
        price: p.value,
        prevClose: preClose
      })
    } else if (klineData) {
      const { klines } = klineData
      if (!klines?.length) return
      
      const gap = chartW / klines.length
      const idx = Math.floor((mouseX - padding.left) / gap)
      if (idx < 0 || idx >= klines.length) return
      
      const k = klines[idx]
      const prevClose = idx > 0 ? klines[idx - 1].close : k.open
      onCrosshairData?.({
        time: k.time,
        open: k.open,
        high: k.high,
        low: k.low,
        close: k.close,
        prevClose,
        turnover: k.turnover
      })
    }
  }, [isIntraday, intradayData, klineData, onCrosshairData])

  // 主渲染 - 对照原版 render
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = dprRef.current
    
    // 对照原版 updateCanvasSize：根据副图数量动态计算高度
    const { padding, subH, subGap, mainSubGap } = layout
    const subCount = isIntraday ? 1 : subIndicators.length
    const totalSubH = subCount * subH + (subCount > 0 ? (subCount - 1) * subGap : 0)
    const currentMainSubGap = subCount > 0 ? mainSubGap : 0
    
    // 动态计算主图高度 - 副图固定在底部
    // 副图区域固定高度
    const subAreaHeight = totalSubH + (subCount > 0 ? currentMainSubGap : 0)
    // 主图高度 = 总高度 - padding - 副图区域
    const dynamicMainH = Math.max(120, height - padding.top - padding.bottom - subAreaHeight)
    
    // 副图固定在底部的Y坐标
    const subStartY = height - padding.bottom - totalSubH
    
    const actualHeight = height
    
    canvas.width = width * dpr
    canvas.height = actualHeight * dpr
    canvas.style.width = width + 'px'
    canvas.style.height = actualHeight + 'px'
    ctx.scale(dpr, dpr)

    // 清空
    ctx.fillStyle = colors.bg
    ctx.fillRect(0, 0, width, actualHeight)

    const chartW = width - padding.left - padding.right
    const axisX = padding.left + chartW

    // 绘制右侧 Y 轴分割线 - 对照原版
    ctx.strokeStyle = colors.border
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(axisX + 0.5, padding.top)
    ctx.lineTo(axisX + 0.5, actualHeight - padding.bottom)
    ctx.stroke()

    if (isIntraday && intradayData) {
      // 分时图
      drawIntradayMain(ctx, padding.left, padding.top, chartW, dynamicMainH, intradayData)
      // 分隔线在主图和副图之间
      drawDivider(ctx, padding.left, subStartY - currentMainSubGap / 2, width - padding.left)
      // 副图固定在底部
      drawSingleSubChart(ctx, padding.left, subStartY, chartW, subH, 'vol', crosshair?.x ?? null)
    } else if (klineData) {
      // K 线图
      drawKlineMain(ctx, padding.left, padding.top, chartW, dynamicMainH, klineData)
      // 分隔线在主图和副图之间
      if (subCount > 0) {
        drawDivider(ctx, padding.left, subStartY - currentMainSubGap / 2, width - padding.left)
      }
      
      // 副图固定在底部
      subIndicators.forEach((ind, i) => {
        const subY = subStartY + i * (subH + subGap)
        drawSingleSubChart(ctx, padding.left, subY, chartW, subH, ind, crosshair?.x ?? null)
        
        // 副图分割线
        if (i < subIndicators.length - 1) {
          const lineY = subY + subH + (subGap / 2)
          drawDivider(ctx, padding.left, lineY, width - padding.left)
        }
      })
    }

    // 绘制十字线 - 对照原版
    if (crosshair) {
      const subCount = isIntraday ? 1 : subIndicators.length
      const subTotalH = subCount * subH + (subCount > 0 ? (subCount - 1) * subGap : 0)
      const priceRange = isIntraday && intradayData 
        ? intradayData.priceRange 
        : klineData?.priceRange || { min: 0, max: 100 }
      drawCrosshair(ctx, padding, dynamicMainH, subTotalH, chartW, crosshair, priceRange)
      updateCrosshairData(crosshair.x, padding, chartW)
    } else {
      onCrosshairData?.(null)
    }
  }, [
    width, height, colors, layout, isIntraday, intradayData, klineData,
    subIndicators, showBoll, crosshair, priceScale, panOffset,
    drawIntradayMain, drawKlineMain, drawSingleSubChart, drawDivider, drawCrosshair, updateCrosshairData, onCrosshairData
  ])

  // 鼠标移动 - 支持Y轴拖拽调整价格缩放和图表拖拽平移
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return
    const dpr = dprRef.current
    const scaleX = (canvasRef.current?.width || 0) / rect.width / dpr
    const scaleY = (canvasRef.current?.height || 0) / rect.height / dpr
    const x = (e.clientX - rect.left) * scaleX
    const y = (e.clientY - rect.top) * scaleY
    
    // 如果正在拖拽Y轴 - 调整价格缩放比例
    if (yAxisDragging) {
      const deltaY = y - yAxisDragging.startY
      // 向上拉(deltaY<0) → 放大(scale>1) → K线变高
      // 向下拉(deltaY>0) → 缩小(scale<1) → K线变矮
      // 每移动100px改变1倍缩放
      const scaleDelta = -deltaY / 100
      const newScale = yAxisDragging.startScale * Math.pow(2, scaleDelta)
      // 限制缩放范围：0.3 到 5.0
      const clampedScale = Math.max(0.3, Math.min(5.0, newScale))
      setPriceScale(clampedScale)
      return
    }
    
    // 如果正在拖拽图表 - 平移图表
    if (chartDragging) {
      const deltaX = x - chartDragging.startX
      const deltaY = y - chartDragging.startY
      const newPanX = chartDragging.startPanX + deltaX
      
      setPanOffset({
        x: newPanX,
        y: chartDragging.startPanY + deltaY
      })
      
      // 检测是否拖动到左边界（向右拖动，panX > 某个阈值）
      // 对于K线图，当向右拖动超过一定距离时，触发加载更多
      if (!isIntraday && newPanX > 50 && onPanToEdge) {
        onPanToEdge()
        // 重置panX，避免重复触发
        setPanOffset({
          x: 0,
          y: chartDragging.startPanY + deltaY
        })
        // 更新拖拽起始点
        setChartDragging({
          ...chartDragging,
          startPanX: 0
        })
      }
      
      // 拖拽时不显示十字线
      return
    }
    
    // 检查是否在Y轴区域（右侧60px宽度）
    const chartW = width - layout.padding.left - layout.padding.right
    const axisX = layout.padding.left + chartW
    const isOnYAxis = x >= axisX && x <= width
    
    // 改变鼠标样式
    if (canvasRef.current) {
      canvasRef.current.style.cursor = isOnYAxis ? 'ns-resize' : 'crosshair'
    }
    
    onCrosshairChange({ x, y })
  }, [onCrosshairChange, yAxisDragging, chartDragging, width, layout])

  // 鼠标按下 - 添加Y轴拖拽或图表拖拽
  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return
    const dpr = dprRef.current
    const scaleX = (canvasRef.current?.width || 0) / rect.width / dpr
    const scaleY = (canvasRef.current?.height || 0) / rect.height / dpr
    const x = (e.clientX - rect.left) * scaleX
    const y = (e.clientY - rect.top) * scaleY
    
    // 检查是否在Y轴区域
    const chartW = width - layout.padding.left - layout.padding.right
    const axisX = layout.padding.left + chartW
    const isOnYAxis = x >= axisX && x <= width
    
    if (isOnYAxis) {
      // Y轴拖拽：调整价格缩放
      setYAxisDragging({ startY: y, startScale: priceScale })
      e.preventDefault()
    } else {
      // 图表区域拖拽：平移图表
      setChartDragging({ 
        startX: x, 
        startY: y, 
        startPanX: panOffset.x, 
        startPanY: panOffset.y 
      })
      e.preventDefault()
    }
  }, [width, layout, priceScale, panOffset])
  
  // 鼠标抬起 - 结束拖拽
  const handleMouseUp = useCallback(() => {
    setYAxisDragging(null)
    setChartDragging(null)
  }, [])

  // 鼠标离开 - 对照原版 handleMouseLeave
  const handleMouseLeave = useCallback(() => {
    onCrosshairChange(null)
    setYAxisDragging(null)
    setChartDragging(null)
    if (canvasRef.current) {
      canvasRef.current.style.cursor = 'crosshair'
    }
  }, [onCrosshairChange])

  // 滚轮缩放 - 对照原版 handleWheel
  const handleWheelEvent = useCallback((e: React.WheelEvent) => {
    if (isIntraday) return
    e.preventDefault()
    onWheel(e.deltaY)
  }, [isIntraday, onWheel])

  // 计算两指距离 - 对照原版 _getTouchDistance
  const getTouchDistance = useCallback((touches: React.TouchList): number => {
    const dx = touches[0].clientX - touches[1].clientX
    const dy = touches[0].clientY - touches[1].clientY
    return Math.sqrt(dx * dx + dy * dy)
  }, [])

  // 从触摸点更新十字光标 - 对照原版 _updateCrosshairFromTouch
  const updateCrosshairFromTouch = useCallback((touch: React.Touch) => {
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return
    const dpr = dprRef.current
    const scaleX = (canvasRef.current?.width || 0) / rect.width / dpr
    const scaleY = (canvasRef.current?.height || 0) / rect.height / dpr
    const x = (touch.clientX - rect.left) * scaleX
    const y = (touch.clientY - rect.top) * scaleY
    onCrosshairChange({ x, y })
  }, [onCrosshairChange])

  // 触摸开始 - 对照原版 handleTouchStart
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      e.preventDefault()
      const dist = getTouchDistance(e.touches)
      setPinchState({ startDist: dist, startCount: 50 }) // TODO: 从外部获取 klineCount
    } else if (e.touches.length === 1) {
      updateCrosshairFromTouch(e.touches[0])
    }
  }, [getTouchDistance, updateCrosshairFromTouch])

  // 触摸移动 - 对照原版 handleTouchMove
  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2 && pinchState && !isIntraday) {
      e.preventDefault()
      const dist = getTouchDistance(e.touches)
      const scale = dist / pinchState.startDist
      const newCount = Math.round(pinchState.startCount / scale)
      const delta = (newCount - pinchState.startCount) * 5
      onWheel(delta)
    } else if (e.touches.length === 1) {
      e.preventDefault()
      updateCrosshairFromTouch(e.touches[0])
    }
  }, [pinchState, isIntraday, getTouchDistance, updateCrosshairFromTouch, onWheel])

  // 触摸结束 - 对照原版 handleTouchEnd
  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 0) {
      setPinchState(null)
      // 延迟清除十字光标
      setTimeout(() => {
        onCrosshairChange(null)
      }, 1500)
    } else if (e.touches.length === 1) {
      setPinchState(null)
    }
  }, [onCrosshairChange])

  // 全局鼠标抬起事件 - 确保拖拽结束
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      setYAxisDragging(null)
      setChartDragging(null)
    }
    document.addEventListener('mouseup', handleGlobalMouseUp)
    return () => {
      document.removeEventListener('mouseup', handleGlobalMouseUp)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      style={{ display: 'block', touchAction: 'none', cursor: 'crosshair' }}
      onMouseMove={handleMouseMove}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
      onWheel={handleWheelEvent}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    />
  )
}
