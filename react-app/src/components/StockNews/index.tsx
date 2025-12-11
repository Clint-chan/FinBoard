/**
 * StockNews - 个股资讯组件
 * 支持新闻和股吧评论的标签页切换
 */
import { useState, useEffect, useRef } from 'react'
import { fetchStockNewsCached, type StockNews } from '@/services/stockNewsService'
import { fetchStockCommentsCached, type StockComment } from '@/services/stockCommentsService'
import './StockNews.css'

type TabType = 'news' | 'comments'

interface StockNewsProps {
  code: string
  stockName?: string
  isDark?: boolean
}

export function StockNews({ code, isDark }: StockNewsProps) {
  const [activeTab, setActiveTab] = useState<TabType>('news')
  const [news, setNews] = useState<StockNews[]>([])
  const [comments, setComments] = useState<StockComment[]>([])
  const [newsLoading, setNewsLoading] = useState(true)
  const [commentsLoading, setCommentsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [collapsed, setCollapsed] = useState(false)
  const [autoScroll] = useState(true)
  const [isPaused, setIsPaused] = useState(false)
  
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const scrollIntervalRef = useRef<number | null>(null)

  // 获取新闻数据
  useEffect(() => {
    if (!code) return

    const fetchNews = async () => {
      setNewsLoading(true)
      setError(null)

      try {
        const data = await fetchStockNewsCached(code)
        setNews(data)
      } catch (err) {
        setError('加载失败')
        console.error('Failed to fetch stock news:', err)
      } finally {
        setNewsLoading(false)
      }
    }

    fetchNews()
  }, [code])

  // 获取股吧评论数据
  useEffect(() => {
    if (!code || activeTab !== 'comments') return

    const fetchComments = async () => {
      setCommentsLoading(true)
      setError(null)

      try {
        const data = await fetchStockCommentsCached(code)
        setComments(data)
      } catch (err) {
        setError('加载失败')
        console.error('Failed to fetch stock comments:', err)
      } finally {
        setCommentsLoading(false)
      }
    }

    fetchComments()
  }, [code, activeTab])

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

  const loading = activeTab === 'news' ? newsLoading : commentsLoading
  const currentData = activeTab === 'news' ? news : comments

  return (
    <div className={`stock-info-panel ${collapsed ? 'collapsed' : ''} ${isDark ? 'dark' : ''}`}>
      {/* 头部：标题 */}
      <div className="panel-header">
        <div 
          className="panel-title clickable"
          onClick={() => setCollapsed(!collapsed)}
          title={collapsed ? "点击展开" : "点击收缩"}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z"/>
          </svg>
          <span>市场资讯</span>
        </div>
      </div>
      
      {/* 标签页 */}
      <div className="panel-tabs-wrapper">
        <div className="panel-tabs">
          <button
            className={`tab-btn ${activeTab === 'news' ? 'active' : ''}`}
            onClick={() => setActiveTab('news')}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9.5a2 2 0 00-2-2h-2"/>
            </svg>
            <span>资讯</span>
          </button>
          <button
            className={`tab-btn ${activeTab === 'comments' ? 'active' : ''}`}
            onClick={() => setActiveTab('comments')}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
            </svg>
            <span>股吧</span>
          </button>
        </div>
      </div>

      {/* 内容区域 */}
      <div 
        className="panel-content"
        ref={scrollContainerRef}
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
      >
        {loading ? (
          <div className="panel-loading">
            <div className="loading-spinner"></div>
            <span>加载中...</span>
          </div>
        ) : error ? (
          <div className="panel-error">{error}</div>
        ) : currentData.length === 0 ? (
          <div className="panel-empty">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="12" cy="12" r="10"/>
              <path d="M12 6v6l4 2"/>
            </svg>
            <span>暂无数据</span>
          </div>
        ) : (
          <div className="content-list">
            {activeTab === 'news' ? (
              news.map((item, index) => (
                <a
                  key={index}
                  className="list-item news-item"
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <div className="item-icon news-icon">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4z"/>
                    </svg>
                  </div>
                  <div className="item-content">
                    <div className="item-title">{item.title}</div>
                    <div className="item-excerpt">{item.content}</div>
                    <div className="item-meta">
                      <span className="meta-source">{item.source}</span>
                      <span className="meta-dot">·</span>
                      <span className="meta-time">{formatTime(item.publishTime)}</span>
                    </div>
                  </div>
                </a>
              ))
            ) : (
              comments.map((item, index) => (
                  <a
                    key={index}
                    className="list-item comment-item"
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <div className="item-avatar">
                      {item.author.avatar ? (
                        <img src={item.author.avatar} alt={item.author.name} />
                      ) : (
                        <div className="avatar-placeholder">
                          {item.author.name.charAt(0)}
                        </div>
                      )}
                    </div>
                    <div className="item-content">
                      <div className="item-author">{item.author.name}</div>
                      <div className="item-text">{item.content}</div>
                      <div className="item-meta">
                        <span className="meta-source">{item.source}</span>
                        <span className="meta-dot">·</span>
                        <span className="meta-time">{formatTime(item.createTime)}</span>
                        {item.likeCount > 0 && (
                          <>
                            <span className="meta-dot">·</span>
                            <span className="meta-like">
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                              </svg>
                              {item.likeCount}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </a>
                ))
            )}
          </div>
        )}
      </div>
    </div>
  )
}
