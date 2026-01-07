/**
 * BidAskModal - 内外盘数据测试弹窗
 * 显示全天累计和瞬时外盘占比
 */
import { useState, useEffect, useCallback } from 'react'
import { fetchBidAskData, type BidAskData } from '@/services/bidAskService'
import './Modal.css'

interface BidAskModalProps {
  open: boolean
  code: string
  onClose: () => void
}

export function BidAskModal({ open, code, onClose }: BidAskModalProps) {
  const [data, setData] = useState<BidAskData | null>(null)
  const [loading, setLoading] = useState(false)
  const [autoRefresh, setAutoRefresh] = useState(false)

  const loadData = useCallback(async () => {
    if (!code) return
    setLoading(true)
    const result = await fetchBidAskData(code)
    setData(result)
    setLoading(false)
  }, [code])

  // 首次加载
  useEffect(() => {
    if (open && code) {
      loadData()
    }
  }, [open, code, loadData])

  // 自动刷新
  useEffect(() => {
    if (!open || !autoRefresh) return
    const timer = setInterval(loadData, 3000)
    return () => clearInterval(timer)
  }, [open, autoRefresh, loadData])

  if (!open) return null

  // 累计数据的颜色判断（55%为偏多阈值）
  const getDailyRatioColor = (ratio: number) => {
    if (ratio >= 60) return '#ef4444' // 红色 - 强势买入
    if (ratio >= 55) return '#f97316' // 橙色 - 偏多
    if (ratio <= 40) return '#22c55e' // 绿色 - 偏空
    if (ratio <= 45) return '#84cc16' // 浅绿 - 轻微偏空
    return '#64748b' // 灰色 - 均衡
  }

  const getDailyRatioLabel = (ratio: number) => {
    if (ratio >= 60) return '强势买入'
    if (ratio >= 55) return '偏多'
    if (ratio <= 40) return '偏空'
    if (ratio <= 45) return '轻微偏空'
    return '均衡'
  }

  // 瞬时数据的颜色判断（更激进，70%为强势阈值）
  const getInstantRatioColor = (ratio: number) => {
    if (ratio >= 70) return '#ef4444' // 红色 - 强势买入
    if (ratio >= 60) return '#f97316' // 橙色 - 偏多
    if (ratio <= 30) return '#22c55e' // 绿色 - 偏空
    if (ratio <= 40) return '#84cc16' // 浅绿 - 轻微偏空
    return '#64748b' // 灰色 - 均衡
  }

  const getInstantRatioLabel = (ratio: number) => {
    if (ratio >= 70) return '强势买入'
    if (ratio >= 60) return '偏多'
    if (ratio <= 30) return '偏空'
    if (ratio <= 40) return '轻微偏空'
    return '均衡'
  }

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
                <div className="bam-signal-item">
                  <span>累计外盘占比 ≥ 55%</span>
                  <span className={data.dailyOuterRatio >= 55 ? 'pass' : 'fail'}>
                    {data.dailyOuterRatio >= 55 ? '✓ 通过' : '— 未达标'}
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
          <button className="bam-refresh-btn" onClick={loadData} disabled={loading}>
            {loading ? '刷新中...' : '手动刷新'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default BidAskModal
