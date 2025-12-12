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
  const initializedRef = useRef(false) // 防止 Strict Mode 重复请求

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

    setStatus(prev => prev === 'loading' ? 'loading' : prev)
    
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
  }, [codes, source]) // 移除 stockData 依赖，避免循环触发

  // 初始加载 - 使用 ref 防止 Strict Mode 重复请求
  useEffect(() => {
    if (initializedRef.current) return
    initializedRef.current = true
    refresh(true)
  }, [])

  // 定时刷新 - 使用用户配置的间隔
  useEffect(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
    }
    
    timerRef.current = window.setInterval(() => {
      refresh(true)
    }, interval * 1000)

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
      }
    }
  }, [interval, refresh])

  return { stockData, status, lastUpdate, refresh: () => refresh(true) }
}
