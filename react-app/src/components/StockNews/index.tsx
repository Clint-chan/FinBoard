/**
 * StockNews - 个股新闻组件
 * 支持折叠、自动滚动、停驻功能
 */
import { useState, useEffect, useRef } from 'react'
import { fetchStockNewsCached, type StockNews } from '@/services/stockNewsService'
import './StockNews.css'

interface StockNewsProps {
  code: string
  stockName?: string
  isDark?: boolean
}

export function StockNews({ code, stockName, isDark }: StockNewsProps) {
  const [news, setNews] = useState<StockNews[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [collapsed, setCollapsed] = useState(false)
  const [autoScroll, setAutoScroll] = useState(true)
  const [isPaused, setIsPaused] = useState(false)
  
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const scrollIntervalRef = useRef<number | null>(null)

  // 获取新闻数据
  useEffect(() => {
    if (!code) return

    const fetchNews = async () => {
      setLoading(true)
      setError(null)

      try {
        const data = await fetchStockNewsCached(code)
        setNews(data)
      } catch (err) {
        setError('加载失败')
        console.error('Failed to fetch stock news:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchNews()
  }, [code])

  // 自动滚动逻辑
  useEffect(() => {
    if (!autoScroll || isPaused || collapsed || !scrollContainerRef.current) {
      if (scrollIntervalRef.current) {
        clearInterval(scrollIntervalRef.current)
        scrollIntervalRef.current = null
      }
      return
    }

    const container = scrollContainerRef.current
    
    scrollIntervalRef.current = window.setInterval(() => {
      if (container.scrollTop + container.clientHeight >= container.scrollHeight - 10) {
        // 滚动到底部，回到顶部
        container.scrollTop = 0
      } else {
        // 平滑滚动
        container.scrollTop += 1
      }
    }, 50) // 每50ms滚动1px

    return () => {
      if (scrollIntervalRef.current) {
        clearInterval(scrollIntervalRef.current)
      }
    }
  }, [autoScroll, isPaused, collapsed])

  // 格式化时间
  const formatTime = (timeStr: string) => {
    if (!timeStr) return ''
    const date = new Date(timeStr)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)
    
    if (minutes < 60) return `${minutes}分钟前`
    if (hours < 24) return `${hours}小时前`
    if (days < 7) return `${days}天前`
    
    return date.toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' })
  }

  if (collapsed) {
    return (
      <div className={`stock-news collapsed ${isDark ? 'dark' : ''}`}>
        <div className="news-header">
          <div className="news-title">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M2 2h12v2H2V2zm0 4h12v2H2V6zm0 4h8v2H2v-2z"/>
            </svg>
            <span>资讯速递</span>
            {stockName && <span className="news-stock-name">· {stockName}</span>}
          </div>
          <button 
            className="news-toggle-btn"
            onClick={() => setCollapsed(false)}
            title="展开"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 11L3 6h10l-5 5z"/>
            </svg>
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className={`stock-news ${isDark ? 'dark' : ''}`}>
      <div className="news-header">
        <div className="news-title">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M2 2h12v2H2V2zm0 4h12v2H2V6zm0 4h8v2H2v-2z"/>
          </svg>
          <span>资讯速递</span>
          {stockName && <span className="news-stock-name">· {stockName}</span>}
        </div>
        <div className="news-controls">
          <button
            className={`news-control-btn ${autoScroll ? 'active' : ''}`}
            onClick={() => setAutoScroll(!autoScroll)}
            title={autoScroll ? '停止滚动' : '自动滚动'}
          >
            {autoScroll ? (
              <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                <path d="M6 4h4v8H6V4z"/>
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                <path d="M5 3l6 5-6 5V3z"/>
              </svg>
            )}
          </button>
          <button 
            className="news-toggle-btn"
            onClick={() => setCollapsed(true)}
            title="折叠"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 5l5 5H3l5-5z"/>
            </svg>
          </button>
        </div>
      </div>

      <div 
        className="news-content"
        ref={scrollContainerRef}
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
      >
        {loading ? (
          <div className="news-loading">加载中...</div>
        ) : error ? (
          <div className="news-error">{error}</div>
        ) : news.length === 0 ? (
          <div className="news-empty">暂无新闻</div>
        ) : (
          <div className="news-list">
            {news.map((item, index) => (
              <a
                key={index}
                className="news-item"
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                <div className="news-item-title">{item.title}</div>
                <div className="news-item-content">{item.content}</div>
                <div className="news-item-meta">
                  <span className="news-item-source">{item.source}</span>
                  <span className="news-item-time">{formatTime(item.publishTime)}</span>
                </div>
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
