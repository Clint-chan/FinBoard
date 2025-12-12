import { useState, useEffect, useCallback, useRef } from 'react'
import { fetchQuotes, normalizeCode } from '@/services/dataService'
import type { StockData, LoadingStatus, QuoteSource } from '@/types'

// 缓存 key
const CACHE_KEY = 'market_board_quotes_cache'
const CACHE_DURATION = 30000 // 30秒缓存有效期

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
function loadCache(): { data: Record<string, StockData>; time: number } | null {
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
    localStorage.setItem(CACHE_KEY, JSON.stringify({ data, time: Date.now() }))
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
  // 初始化时尝试从缓存加载数据
  const [stockData, setStockData] = useState<Record<string, StockData>>(() => {
    const cached = loadCache()
    if (cached && Date.now() - cached.time < CACHE_DURATION) {
      return cached.data
    }
    return {}
  })
  const [status, setStatus] = useState<LoadingStatus>('loading')
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)
  const timerRef = useRef<number | null>(null)

  const refresh = useCallback(async (force = false) => {
    if (!force && !isMarketOpen()) {
      setStatus('closed')
      return
    }
    
    if (codes.length === 0) {
      setStatus('success')
      return
    }

    // 如果不是强制刷新，先显示缓存数据，后台更新
    const cached = loadCache()
    if (!force && cached && Date.now() - cached.time < CACHE_DURATION) {
      setStockData(prev => ({ ...prev, ...cached.data }))
      setStatus('success')
      return
    }

    setStatus('loading')
    
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
      // 请求失败时尝试使用缓存数据
      if (cached) {
        setStockData(prev => ({ ...prev, ...cached.data }))
      }
    }
  }, [codes, source])

  // 初始加载
  useEffect(() => {
    refresh(true)
  }, [refresh])

  // 定时刷新
  useEffect(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
    }
    
    // 开盘时间使用1.5秒刷新，否则使用配置的间隔
    const actualInterval = isMarketOpen() ? 1.5 : interval
    
    timerRef.current = window.setInterval(() => {
      refresh()
    }, actualInterval * 1000)

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
      }
    }
  }, [interval, refresh])

  return { stockData, status, lastUpdate, refresh: () => refresh(true) }
}
