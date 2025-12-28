/**
 * DailyReport - 每日早报组件
 */
import { useState, useEffect, useCallback, useRef } from 'react'
import html2canvas from 'html2canvas'
import type { DailyReportContent, DailyReportListItem, IntelCategory, SectorItem } from '@/types'
import './DailyReport.css'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const API_BASE = (import.meta as any).env?.VITE_API_URL || 'https://market-api.newestgpt.com'

interface DailyReportProps {
  isAdmin?: boolean
  token?: string | null
}

// 检测是否为截图模式（用于邮件截图）
const isScreenshotMode = () => {
  const params = new URLSearchParams(window.location.search)
  return params.get('screenshot') === '1'
}

// 检测是否为封面模式（只显示 Market Tone 卡片）
const isCoverMode = () => {
  const params = new URLSearchParams(window.location.search)
  return params.get('cover') === '1'
}

export function DailyReport({ isAdmin, token }: DailyReportProps) {
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [sharing, setSharing] = useState(false)
  const [report, setReport] = useState<DailyReportContent | null>(null)
  const [currentDate, setCurrentDate] = useState<string>('')
  const [historyOpen, setHistoryOpen] = useState(false)
  const [historyList, setHistoryList] = useState<DailyReportListItem[]>([])
  const reportRef = useRef<HTMLDivElement>(null)
  
  // 截图模式标记
  const screenshotMode = isScreenshotMode()
  const coverMode = isCoverMode()

  // 获取今日日报（或 URL 指定日期）
  const fetchTodayReport = useCallback(async () => {
    setLoading(true)
    try {
      // 检查 URL 是否指定了日期
      const params = new URLSearchParams(window.location.search)
      let urlDate = params.get('date')
      
      // 支持 20251228 格式转换为 2025-12-28
      if (urlDate && urlDate.length === 8 && !urlDate.includes('-')) {
        urlDate = `${urlDate.slice(0, 4)}-${urlDate.slice(4, 6)}-${urlDate.slice(6, 8)}`
      }
      
      // 获取今天的日期
      const today = new Date()
      const dateStr = urlDate || today.toISOString().split('T')[0]
      
      const res = await fetch(`${API_BASE}/api/daily/${dateStr}`)
      if (res.ok) {
        const data = await res.json()
        setReport(data.content)
        setCurrentDate(data.date)
      } else if (res.status === 404) {
        // 今日日报不存在，尝试获取最新的
        const listRes = await fetch(`${API_BASE}/api/daily/list?limit=1`)
        if (listRes.ok) {
          const listData = await listRes.json()
          if (listData.reports?.length > 0) {
            const latestDate = listData.reports[0].report_date
            const latestRes = await fetch(`${API_BASE}/api/daily/${latestDate}`)
            if (latestRes.ok) {
              const latestData = await latestRes.json()
              setReport(latestData.content)
              setCurrentDate(latestData.date)
            }
          }
        }
      }
    } catch (e) {
      console.error('获取日报失败:', e)
    } finally {
      setLoading(false)
    }
  }, [])

  // 获取历史列表
  const fetchHistory = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/daily/list?limit=30`)
      if (res.ok) {
        const data = await res.json()
        setHistoryList(data.reports || [])
      }
    } catch (e) {
      console.error('获取历史列表失败:', e)
    }
  }, [])

  // 加载指定日期的日报
  const loadReport = useCallback(async (date: string) => {
    setLoading(true)
    setHistoryOpen(false)
    try {
      const res = await fetch(`${API_BASE}/api/daily/${date}`)
      if (res.ok) {
        const data = await res.json()
        setReport(data.content)
        setCurrentDate(data.date)
      }
    } catch (e) {
      console.error('加载日报失败:', e)
    } finally {
      setLoading(false)
    }
  }, [])

  // 手动生成日报（管理员）
  const handleGenerate = async () => {
    if (!token || generating) return
    setGenerating(true)
    try {
      const res = await fetch(`${API_BASE}/api/daily/generate`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      })
      const data = await res.json()
      if (data.success) {
        await fetchTodayReport()
      } else {
        alert(data.error || '生成失败')
      }
    } catch (e) {
      console.error('生成日报失败:', e)
      alert('生成失败')
    } finally {
      setGenerating(false)
    }
  }

  // 分享为图片
  const handleShare = async () => {
    if (!reportRef.current || sharing) return
    setSharing(true)

    try {
      const canvas = await html2canvas(reportRef.current, {
        backgroundColor: '#ffffff',
        scale: 3, // 3倍高清
        useCORS: true,
        logging: false,
        windowWidth: 1200, // 固定宽度
      })

      // 转换为图片并下载
      const link = document.createElement('a')
      link.download = `Fintell早报_${currentDate}.png`
      link.href = canvas.toDataURL('image/png')
      link.click()
    } catch (e) {
      console.error('生成图片失败:', e)
      alert('生成图片失败')
    } finally {
      setSharing(false)
    }
  }

  useEffect(() => {
    fetchTodayReport()
  }, [fetchTodayReport])

  // 打开历史弹窗时加载列表
  useEffect(() => {
    if (historyOpen) {
      fetchHistory()
    }
  }, [historyOpen, fetchHistory])

  if (loading) {
    return (
      <div className="daily-report">
        <div className="daily-loading">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 12a9 9 0 11-6.219-8.56" />
          </svg>
          <span>加载中...</span>
        </div>
      </div>
    )
  }

  if (!report) {
    return (
      <div className="daily-report">
        <div className="daily-empty">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
          </svg>
          <span>暂无日报</span>
          {isAdmin && (
            <button 
              onClick={handleGenerate} 
              disabled={generating}
              style={{ marginTop: 16, padding: '8px 16px', borderRadius: 6, background: '#7c3aed', color: 'white', border: 'none', cursor: 'pointer' }}
            >
              {generating ? '生成中...' : '生成今日日报'}
            </button>
          )}
        </div>
      </div>
    )
  }

  // 封面模式：只渲染 Market Tone 卡片（专业版）
  if (coverMode && report) {
    return (
      <div className="daily-cover-mode">
        {/* 顶部品牌栏 */}
        <div className="cover-header">
          <div className="cover-brand">
            <div className="cover-logo">F</div>
            <span className="cover-brand-name">Fintell</span>
          </div>
          <div className="cover-header-date">{currentDate?.replace(/-/g, '.')}</div>
        </div>
        
        {/* 主内容 */}
        <div className="cover-card">
          <span className="cover-label">MARKET TONE</span>
          <h1 className="cover-tone">{report.prediction.tone}</h1>
          <p className="cover-subtitle">{report.prediction.subtitle}</p>
        </div>
        
        {/* 底部信息 */}
        <div className="cover-footer">
          <span className="cover-footer-text">A股投资早报 · 每日6点更新</span>
        </div>
        
        {/* 装饰元素 */}
        <div className="cover-decoration cover-decoration-1" />
        <div className="cover-decoration cover-decoration-2" />
        <div className="cover-decoration cover-decoration-3" />
      </div>
    )
  }

  return (
    <div className="daily-report">
      {/* 日报内容 - 用于截图（包含标题） */}
      <div ref={reportRef} className="daily-content">
        {/* 中间水印 */}
        <div className="daily-watermark-center">Fintell</div>
        
        {/* Header - 包含在截图中 */}
        <header className="daily-header">
          <div className="daily-title">
            <div className="daily-logo">F</div>
            <h1>
              每日早报
              <span className="daily-date">{currentDate?.replace(/-/g, '.')}</span>
            </h1>
          </div>
        </header>

        {/* Intelligence Matrix */}
        <section>
          <div className="section-title">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
            </svg>
            全球情报矩阵 Intelligence Matrix
          </div>
        <div className="intel-grid">
          {report.intelligence.map((cat: IntelCategory, idx: number) => (
            <div key={idx} className={`intel-card ${cat.color}`}>
              <div className="intel-card-header">{cat.category}</div>
              {cat.items.map((item, i) => (
                <div key={i} className="intel-item">
                  <div className="intel-item-header">
                    <span className="intel-item-title">{item.title}</span>
                    <span className={`tag tag-${item.tag}`}>{item.tagText}</span>
                  </div>
                  <p className="intel-item-summary">{item.summary}</p>
                </div>
              ))}
            </div>
          ))}
        </div>
      </section>

      {/* Core Prediction */}
      <section>
        <div className="section-title">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          大盘核心研判 Core Prediction
        </div>
        <div className="prediction-card">
          <div className="prediction-content">
            <div className="prediction-main">
              <span className="prediction-label">Market Tone</span>
              <h2 className="prediction-tone">{report.prediction.tone}</h2>
              <h3 className="prediction-subtitle">{report.prediction.subtitle}</h3>
              <p 
                className="prediction-summary"
                dangerouslySetInnerHTML={{ __html: report.prediction.summary }}
              />
            </div>
            <div className="prediction-details">
              <div className="prediction-section">
                <h4>资金与情绪面</h4>
                <div className="prediction-box">
                  <div className="prediction-box-title">北向资金/外资</div>
                  <div 
                    className="prediction-box-content"
                    dangerouslySetInnerHTML={{ __html: report.prediction.northbound }}
                  />
                </div>
                <div className="prediction-box">
                  <div className="prediction-box-title">成交量预期</div>
                  <div 
                    className="prediction-box-content"
                    dangerouslySetInnerHTML={{ __html: report.prediction.volume }}
                  />
                </div>
              </div>
              <div className="prediction-section">
                <h4>A股全天剧本推演</h4>
                <div className="scenario-steps">
                  {report.prediction.scenarios.map((step, i) => (
                    <div key={i} className={`scenario-step ${step.active ? 'active' : ''}`}>
                      <div className="scenario-line" />
                      <div className="scenario-dot" />
                      <div className="scenario-title">{step.title}</div>
                      <div className="scenario-desc">{step.desc}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Sector Analysis */}
      <section>
        <div className="section-title">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
          </svg>
          板块逻辑深度推演 Sector Analysis
        </div>
        <div className="sector-grid">
          <SectorCard type="bullish" items={report.sectors.bullish} />
          <SectorCard type="bearish" items={report.sectors.bearish} />
        </div>
      </section>

      {/* Actionable Summary */}
      <div className="actionable-card">
        <div className="actionable-header">
          <div className="actionable-icon">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
          </div>
          <div>
            <div className="actionable-label">Actionable Summary</div>
            <div className="actionable-title">今日交易策略关键词</div>
          </div>
        </div>
        <div className="actionable-actions">
          <div className="actionable-box">
            <div className="actionable-box-label">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              防守避雷
            </div>
            <div className="actionable-box-value">{report.actionable.avoid}</div>
          </div>
          <div className="actionable-box focus">
            <div className="actionable-box-label">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              重点关注
            </div>
            <div className="actionable-box-value">{report.actionable.focus}</div>
          </div>
        </div>
      </div>

        {/* 水印 - 底部居中 */}
        <div className="daily-watermark">
          Fintell | board.newestgpt.com
        </div>
      </div>{/* 结束 daily-content */}

      {/* 浮动工具栏 - 截图模式下隐藏 */}
      {!screenshotMode && (
        <div className="daily-fab-toolbar">
          <button 
            className="fab-btn fab-history" 
            onClick={() => setHistoryOpen(true)}
            title="往期回顾"
          >
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </button>
          <button 
            className="fab-btn fab-share" 
            onClick={handleShare} 
            disabled={sharing}
            title={sharing ? '生成中...' : '分享图片'}
          >
            {sharing ? (
              <svg className="fab-spinner" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 12a9 9 0 11-6.219-8.56" />
              </svg>
            ) : (
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
              </svg>
            )}
          </button>
        </div>
      )}

      {/* History Modal */}
      {historyOpen && (
        <div className="history-modal-backdrop" onClick={() => setHistoryOpen(false)}>
          <div className="history-modal" onClick={e => e.stopPropagation()}>
            <div className="history-modal-header">
              <span className="history-modal-title">往期回顾</span>
              <div className="history-modal-close" onClick={() => setHistoryOpen(false)}>
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
            </div>
            <div className="history-modal-body">
              {historyList.length === 0 ? (
                <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-tertiary)' }}>
                  暂无历史日报
                </div>
              ) : (
                historyList.map(item => (
                  <div 
                    key={item.report_date} 
                    className="history-item"
                    onClick={() => loadReport(item.report_date)}
                  >
                    <span className="history-item-date">{item.report_date.replace(/-/g, '.')}</span>
                    <span className="history-item-meta">{item.news_count} 条新闻</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Sector Card Component
function SectorCard({ type, items }: { type: 'bullish' | 'bearish'; items: SectorItem[] }) {
  const isBullish = type === 'bullish'
  return (
    <div className={`sector-card ${type}`}>
      <div className="sector-card-header">
        <h3 className="sector-card-title">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {isBullish ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
            )}
          </svg>
          {isBullish ? '避险与利好板块' : '承压与利空板块'}
        </h3>
        <span className="sector-card-badge">
          {isBullish ? '可能上涨' : '可能下跌'}
        </span>
      </div>
      <div className="sector-card-body">
        {items.map((item, i) => (
          <div key={i} className="sector-item">
            <div className="sector-item-header">
              <span className="sector-item-name">{item.name}</span>
              <span className={`tag tag-${item.tag}`}>{item.tagText}</span>
            </div>
            <p className="sector-item-reason">{item.reason}</p>
            <div className="sector-item-focus">{item.focus}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default DailyReport
