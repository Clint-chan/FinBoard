/**
 * BidAskModal - 内外盘数据弹窗
 * 显示全天累计和瞬时外盘占比，带历史趋势图
 */
import { useState, useEffect, useCallback, useRef } from 'react'
import { fetchBidAskData, type BidAskData } from '@/services/bidAskService'
import './Modal.css'

interface BidAskModalProps {
  open: boolean
  code: string
  onClose: () => void
}

// 历史记录点
interface HistoryPoint {
  buyRatio: number
  sellRatio: number
  time: number
}

export function BidAskModal({ open, code, onClose }: BidAskModalProps) {
  const [data, setData] = useState<BidAskData | null>(null)
  const [loading, setLoading] = useState(false)
  const [autoRefresh, setAutoRefresh] = useState(false)
  const [history, setHistory] = useState<HistoryPoint[]>([])
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)
  const chartRef = useRef<SVGSVGElement>(null)

  // 加载数据（手动刷新不记录历史）
  const loadData = useCallback(async (recordHistory = false) => {
    if (!code) return
    setLoading(true)
    const result = await fetchBidAskData(code)
    setData(result)
    // 只在自动刷新时记录历史数据
    if (result && recordHistory) {
      setHistory(prev => {
        const newHistory = [
          ...prev,
          {
            buyRatio: result.instantBuyRatio,
            sellRatio: 100 - result.instantBuyRatio,
            time: Date.now()
          }
        ]
        return newHistory.slice(-30)
      })
    }
    setLoading(false)
  }, [code])

  // 首次加载（不记录历史）
  useEffect(() => {
    if (open && code) {
      setHistory([])
      loadData(false)
    }
  }, [open, code, loadData])

  // 自动刷新（记录历史）
  useEffect(() => {
    if (!open || !autoRefresh) return
    // 开启自动刷新时立即记录一个点
    loadData(true)
    const timer = setInterval(() => loadData(true), 3000)
    return () => clearInterval(timer)
  }, [open, autoRefresh, loadData])

  if (!open) return null

  // 累计数据的颜色判断
  const getDailyRatioColor = (ratio: number) => {
    if (ratio >= 60) return '#ef4444'
    if (ratio >= 55) return '#f97316'
    if (ratio <= 40) return '#22c55e'
    if (ratio <= 45) return '#84cc16'
    return '#64748b'
  }

  const getDailyRatioLabel = (ratio: number) => {
    if (ratio >= 60) return '强势买入'
    if (ratio >= 55) return '偏多'
    if (ratio <= 40) return '偏空'
    if (ratio <= 45) return '轻微偏空'
    return '均衡'
  }

  // 瞬时数据的颜色判断（更激进）
  const getInstantRatioColor = (ratio: number) => {
    if (ratio >= 70) return '#ef4444'
    if (ratio >= 60) return '#f97316'
    if (ratio <= 30) return '#22c55e'
    if (ratio <= 40) return '#84cc16'
    return '#64748b'
  }

  const getInstantRatioLabel = (ratio: number) => {
    if (ratio >= 70) return '强势买入'
    if (ratio >= 60) return '偏多'
    if (ratio <= 30) return '偏空'
    if (ratio <= 40) return '轻微偏空'
    return '均衡'
  }

  // 生成堆叠面积图路径
  const generateChartPaths = () => {
    if (history.length < 2) return { buyPath: '', sellPath: '' }
    
    const width = 340
    const height = 80
    const padding = 0
    const chartWidth = width - padding * 2
    const chartHeight = height - padding * 2
    
    const xStep = chartWidth / (history.length - 1)
    
    // 买盘区域（从底部到buyRatio高度）
    let buyPath = `M ${padding} ${height - padding}`
    history.forEach((point, i) => {
      const x = padding + i * xStep
      const y = height - padding - (point.buyRatio / 100) * chartHeight
      buyPath += ` L ${x} ${y}`
    })
    buyPath += ` L ${padding + (history.length - 1) * xStep} ${height - padding} Z`
    
    // 卖盘区域（从buyRatio高度到顶部）
    let sellPath = `M ${padding} ${height - padding - (history[0].buyRatio / 100) * chartHeight}`
    history.forEach((point, i) => {
      const x = padding + i * xStep
      const y = height - padding - (point.buyRatio / 100) * chartHeight
      sellPath += ` L ${x} ${y}`
    })
    // 连接到顶部
    for (let i = history.length - 1; i >= 0; i--) {
      const x = padding + i * xStep
      sellPath += ` L ${x} ${padding}`
    }
    sellPath += ' Z'
    
    return { buyPath, sellPath }
  }

  // 处理鼠标移动
  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!chartRef.current || history.length < 2) return
    const rect = chartRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const width = 340
    const index = Math.round((x / width) * (history.length - 1))
    setHoveredIndex(Math.max(0, Math.min(history.length - 1, index)))
  }

  const { buyPath, sellPath } = generateChartPaths()

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="bid-ask-modal" onClick={e => e.stopPropagation()}>
        <div className="bam-header">
          <div className="bam-title">
            <span className="bam-name">{data?.name || code}</span>
            <span className="bam-code">{code.toUpperCase()}</span>
            {data && (
              <span className={`bam-pct ${data.pctChg >= 0 ? 'up' : 'down'}`}>
                {data.pctChg >= 0 ? '+' : ''}{data.pctChg.toFixed(2)}%
              </span>
            )}
          </div>
          <button className="bam-close" onClick={onClose}>×</button>
        </div>

        <div className="bam-body">
          {loading && !data ? (
            <div className="bam-loading">加载中...</div>
          ) : data ? (
            <>
              {/* 全天累计 */}
              <div className="bam-section">
                <div className="bam-section-title">
                  <span>全天累计</span>
                  <span className="bam-hint">开盘至今</span>
                </div>
                <div className="bam-ratio-bar">
                  <div 
                    className="bam-ratio-fill outer"
                    style={{ width: `${data.dailyOuterRatio}%` }}
                  />
                </div>
                <div className="bam-ratio-row">
                  <div className="bam-ratio-item">
                    <span className="bam-label">外盘</span>
                    <span className="bam-value outer">{(data.dailyOuterVol / 10000).toFixed(1)}万手</span>
                  </div>
                  <div className="bam-ratio-center">
                    <span 
                      className="bam-ratio-value"
                      style={{ color: getDailyRatioColor(data.dailyOuterRatio) }}
                    >
                      {data.dailyOuterRatio}%
                    </span>
                    <span className="bam-ratio-label">{getDailyRatioLabel(data.dailyOuterRatio)}</span>
                  </div>
                  <div className="bam-ratio-item right">
                    <span className="bam-label">内盘</span>
                    <span className="bam-value inner">{(data.dailyInnerVol / 10000).toFixed(1)}万手</span>
                  </div>
                </div>
              </div>

              {/* 瞬时数据 */}
              <div className="bam-section">
                <div className="bam-section-title">
                  <span>瞬时数据</span>
                  <span className="bam-hint">最近30笔</span>
                </div>
                <div className="bam-ratio-bar">
                  <div 
                    className="bam-ratio-fill buy"
                    style={{ width: `${data.instantBuyRatio}%` }}
                  />
                </div>
                <div className="bam-ratio-row">
                  <div className="bam-ratio-item">
                    <span className="bam-label">买盘</span>
                    <span className="bam-value buy">{data.instantBuyVol}手</span>
                  </div>
                  <div className="bam-ratio-center">
                    <span 
                      className="bam-ratio-value"
                      style={{ color: getInstantRatioColor(data.instantBuyRatio) }}
                    >
                      {data.instantBuyRatio}%
                    </span>
                    <span className="bam-ratio-label">{getInstantRatioLabel(data.instantBuyRatio)}</span>
                  </div>
                  <div className="bam-ratio-item right">
                    <span className="bam-label">卖盘</span>
                    <span className="bam-value sell">{data.instantSellVol}手</span>
                  </div>
                </div>

                {/* 瞬时数据历史趋势图 */}
                {history.length >= 2 && (
                  <div className="bam-chart-container">
                    <svg 
                      ref={chartRef}
                      className="bam-chart"
                      viewBox="0 0 340 80"
                      onMouseMove={handleMouseMove}
                      onMouseLeave={() => setHoveredIndex(null)}
                    >
                      {/* 50%参考线 */}
                      <line x1="0" y1="40" x2="340" y2="40" stroke="#94a3b8" strokeWidth="1" strokeDasharray="4 2" opacity="0.5" />
                      
                      {/* 卖盘区域（上方绿色） */}
                      <path d={sellPath} fill="#22c55e" opacity="0.6" />
                      
                      {/* 买盘区域（下方红色） */}
                      <path d={buyPath} fill="#ef4444" opacity="0.6" />
                      
                      {/* 分界线 */}
                      {history.length >= 2 && (
                        <path 
                          d={history.map((p, i) => {
                            const x = (i / (history.length - 1)) * 340
                            const y = 80 - (p.buyRatio / 100) * 80
                            return `${i === 0 ? 'M' : 'L'} ${x} ${y}`
                          }).join(' ')}
                          fill="none"
                          stroke="#fff"
                          strokeWidth="2"
                        />
                      )}
                      
                      {/* 悬停指示器 */}
                      {hoveredIndex !== null && history[hoveredIndex] && (
                        <>
                          <line 
                            x1={(hoveredIndex / (history.length - 1)) * 340} 
                            y1="0" 
                            x2={(hoveredIndex / (history.length - 1)) * 340} 
                            y2="80" 
                            stroke="#fff" 
                            strokeWidth="1"
                            opacity="0.8"
                          />
                          <circle 
                            cx={(hoveredIndex / (history.length - 1)) * 340}
                            cy={80 - (history[hoveredIndex].buyRatio / 100) * 80}
                            r="4"
                            fill="#fff"
                            stroke="#333"
                            strokeWidth="1"
                          />
                        </>
                      )}
                    </svg>
                    
                    {/* 悬停提示 */}
                    {hoveredIndex !== null && history[hoveredIndex] && (
                      <div className="bam-chart-tooltip">
                        <span className="buy">买 {history[hoveredIndex].buyRatio.toFixed(1)}%</span>
                        <span className="sell">卖 {history[hoveredIndex].sellRatio.toFixed(1)}%</span>
                      </div>
                    )}
                    
                    {/* 图例 */}
                    <div className="bam-chart-legend">
                      <span className="legend-item"><span className="dot buy"></span>买盘</span>
                      <span className="legend-item"><span className="dot sell"></span>卖盘</span>
                      <span className="legend-hint">共 {history.length} 个采样点</span>
                    </div>
                  </div>
                )}
                
                {history.length < 2 && autoRefresh && (
                  <div className="bam-chart-placeholder">
                    <span>📊 趋势图采集中...</span>
                  </div>
                )}
              </div>

              {/* 信号判断 */}
              <div className="bam-signal">
                <div className="bam-signal-title">主动攻击信号判断</div>
                <div className="bam-signal-item">
                  <span>瞬时外盘占比 ≥ 70%</span>
                  <span className={data.instantBuyRatio >= 70 ? 'pass' : 'fail'}>
                    {data.instantBuyRatio >= 70 ? '✓ 通过' : '— 未达标'}
                  </span>
                </div>
              </div>
            </>
          ) : (
            <div className="bam-error">获取数据失败</div>
          )}
        </div>

        <div className="bam-footer">
          <label className="bam-auto-refresh">
            <input 
              type="checkbox" 
              checked={autoRefresh} 
              onChange={e => setAutoRefresh(e.target.checked)}
            />
            <span>自动刷新 (3秒)</span>
          </label>
          <button className="bam-refresh-btn" onClick={() => loadData(false)} disabled={loading}>
            {loading ? '刷新中...' : '手动刷新'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default BidAskModal
