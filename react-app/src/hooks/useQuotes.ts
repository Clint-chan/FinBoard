import { useState, useEffect, useCallback, useRef } from 'react'
import { fetchQuotes, normalizeCode } from '@/services/dataService'
import type { StockData, LoadingStatus, QuoteSource } from '@/types'

// 缓存 key - 仅用于首次加载时快速显示
const CACHE_KEY = 'market_board_quotes_cache'

// 判断是否为交易时间
function isMarketOpen(): boolean {
  const now = new Date()
  const day = now.getDay()
  if (day === 0 || day === 6) return false
  
  const hours = now.getHours()
  const minutes = now.getMinutes()
  const time = hours * 60 + minutes
  
  const morningStart = 9 * 60 + 30
  const morningEnd = 11 * 60 + 30
  const afternoonStart = 13 * 60
  const afternoonEnd = 15 * 60
  
  return (time >= morningStart && time <= morningEnd) ||
         (time >= afternoonStart && time <= afternoonEnd)
}

// 从 localStorage 读取缓存
function loadCache(): Record<string, StockData> | null {
  try {
    const cached = localStorage.getItem(CACHE_KEY)
    if (cached) {
      return JSON.parse(cached)
    }
  } catch (e) {
    console.warn('Failed to load quotes cache:', e)
  }
  return null
}

// 保存缓存到 localStorage
function saveCache(data: Record<string, StockData>) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(data))
  } catch (e) {
    console.warn('Failed to save quotes cache:', e)
  }
}

interface UseQuotesReturn {
  stockData: Record<string, StockData>
  status: LoadingStatus
  lastUpdate: Date | null
  refresh: () => void
}

export function useQuotes(
  codes: string[], 
  interval = 5, 
  source: QuoteSource = 'eastmoney'
): UseQuotesReturn {
  // 初始化时尝试从缓存加载数据，实现"秒开"
  const [stockData, setStockData] = useState<Record<string, StockData>>(() => {
    return loadCache() || {}
  })
  const [status, setStatus] = useState<LoadingStatus>('loading')
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)
  const timerRef = useRef<number | null>(null)

  const refresh = useCallback(async (force = false) => {
    // 非交易时间且非强制刷新时，标记为休市
    if (!force && !isMarketOpen()) {
      setStatus('closed')
      return
    }
    
    if (codes.length === 0) {
      setStatus('success')
      return
    }

    // 只在首次加载时显示 loading 状态，后续刷新不显示
    if (Object.keys(stockData).length === 0) {
      setStatus('loading')
    }
    
    try {
      const normalizedCodes = codes.map(c => normalizeCode(c))
      const data = await fetchQuotes(normalizedCodes, source)
      setStockData(prev => ({ ...prev, ...data }))
      setLastUpdate(new Date())
      setStatus('success')
      // 保存到缓存
      saveCache(data)
    } catch (error) {
      console.error('Failed to fetch quotes:', error)
      setStatus('error')
    }
  }, [codes, source, stockData])

  // 初始加载
  useEffect(() => {
    refresh(true)
  }, []) // 只在组件挂载时执行一次

  // 定时刷新 - 始终请求最新数据
  useEffect(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
    }
    
    // 开盘时间使用1.5秒刷新，否则使用配置的间隔
    const actualInterval = isMarketOpen() ? 1.5 : interval
    
    timerRef.current = window.setInterval(() => {
      // 定时刷新时强制请求新数据
      refresh(true)
    }, actualInterval * 1000)

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
      }
    }
  }, [interval, refresh])

  return { stockData, status, lastUpdate, refresh: () => refresh(true) }
}
