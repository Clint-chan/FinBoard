/**
 * StockInfoCard - 股票详细信息卡片
 * 在 SuperChart 股票名称悬停时显示
 * 参考专业看盘软件的指标体系设计
 */
import { useState, useEffect } from 'react'
import { fetchStockDetailInfoCached, type StockDetailInfo } from '@/services/stockInfoService'
import { isETF } from '@/utils/format'
import './StockInfoCard.css'

interface StockInfoCardProps {
  code: string
  visible: boolean
  onLoad?: (info: StockDetailInfo) => void
}

export function StockInfoCard({ code, visible, onLoad }: StockInfoCardProps) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<StockDetailInfo | null>(null)

  useEffect(() => {
    if (!visible || !code) return

    const fetchStockInfo = async () => {
      setLoading(true)
      setError(null)

      try {
        const data = await fetchStockDetailInfoCached(code)
        
        // 验证数据有效性
        if (!data || !data.name) {
          throw new Error('数据无效')
        }
        
        setInfo(data)
        onLoad?.(data)
      } catch (err) {
        setError('暂无数据')
        console.error('Failed to fetch stock info:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchStockInfo()
  }, [code, visible, onLoad])

  if (!visible) return null

  if (loading) {
    return (
      <div className="stock-info-card">
        <div className="info-loading">加载中...</div>
      </div>
    )
  }

  if (error || !info) {
    return (
      <div className="stock-info-card">
        <div className="info-error">{error || '暂无数据'}</div>
      </div>
    )
  }

  const pct = ((info.price - info.preClose) / info.preClose) * 100
  const isUp = pct >= 0

  // 格式化函数 - 增加类型检查，防止非数字值导致错误
  const fmtNum = (val?: number, digits = 2) => {
    if (val == null || typeof val !== 'number' || isNaN(val)) return '--'
    return val.toFixed(digits)
  }
  // ETF 价格显示 3 位小数
  const priceDigits = isETF(code) ? 3 : 2
  const fmtBigNum = (val?: number) => {
    if (val == null || typeof val !== 'number' || isNaN(val)) return '--'
    if (val >= 10000) return (val / 10000).toFixed(2) + '万'
    return val.toFixed(2)
  }
  const fmtMarketCap = (val?: number) => {
    if (val == null || typeof val !== 'number' || isNaN(val)) return '--'
    return val.toFixed(2) + '亿'
  }

  return (
    <div className="stock-info-card">
      {/* 头部：股票名称和价格 */}
      <div className="info-header">
        <div className="info-title">
          <span className="info-name">{info.name}</span>
          <span className="info-code">{info.code}</span>
        </div>
        <div className="info-price-section">
          <div className={`info-price ${isUp ? 'up' : 'down'}`}>
            ¥{fmtNum(info.price, priceDigits)}
          </div>
        </div>
      </div>

      {/* 分组信息 */}
      <div className="info-body">
        {/* 市值与股本 */}
        <div className="info-section">
          <div className="section-title">市值股本</div>
          <div className="info-grid">
            <div className="info-item">
              <span className="item-label">总市值</span>
              <span className="item-value">{fmtMarketCap(info.totalMarketCap)}</span>
            </div>
            <div className="info-item">
              <span className="item-label">流通市值</span>
              <span className="item-value">{fmtMarketCap(info.floatMarketCap)}</span>
            </div>
            <div className="info-item">
              <span className="item-label">总股本</span>
              <span className="item-value">{fmtBigNum(info.totalShares)}</span>
            </div>
            <div className="info-item">
              <span className="item-label">流通股</span>
              <span className="item-value">{fmtBigNum(info.floatShares)}</span>
            </div>
          </div>
        </div>

        {/* 估值指标 */}
        <div className="info-section">
          <div className="section-title">估值指标</div>
          <div className="info-grid">
            <div className="info-item">
              <span className="item-label">市盈率(动)</span>
              <span className="item-value">{fmtNum(info.pe)}</span>
            </div>
            <div className="info-item">
              <span className="item-label">市净率</span>
              <span className="item-value">{fmtNum(info.pb)}</span>
            </div>
            {info.ps != null && (
              <div className="info-item">
                <span className="item-label">市销率</span>
                <span className="item-value">{fmtNum(info.ps)}</span>
              </div>
            )}
            <div className="info-item">
              <span className="item-label">换手率</span>
              <span className="item-value">{fmtNum(info.turnoverRate)}%</span>
            </div>
          </div>
        </div>

        {/* 交易数据 */}
        {(info.amplitude != null || info.volume != null) && (
          <div className="info-section">
            <div className="section-title">交易数据</div>
            <div className="info-grid">
              {info.amplitude != null && (
                <div className="info-item">
                  <span className="item-label">振幅</span>
                  <span className="item-value">{fmtNum(info.amplitude)}%</span>
                </div>
              )}
              {info.volume != null && (
                <div className="info-item">
                  <span className="item-label">成交量</span>
                  <span className="item-value">{fmtBigNum(info.volume / 100)}手</span>
                </div>
              )}
              {info.amount != null && (
                <div className="info-item full-width">
                  <span className="item-label">成交额</span>
                  <span className="item-value">{(info.amount / 100000000).toFixed(2)}亿</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 基本信息 */}
        <div className="info-section">
          <div className="section-title">基本信息</div>
          <div className="info-grid">
            <div className="info-item full-width">
              <span className="item-label">所属行业</span>
              <span className="item-value">{info.industry || '--'}</span>
            </div>
            <div className="info-item full-width">
              <span className="item-label">上市时间</span>
              <span className="item-value">{info.listDate || '--'}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
