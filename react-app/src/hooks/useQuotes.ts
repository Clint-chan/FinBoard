import { useState, useEffect, useCallback, useRef } from 'react'
import { fetchQuotes, normalizeCode } from '@/services/dataService'
import type { StockData, LoadingStatus, QuoteSource } from '@/types'

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
  const [stockData, setStockData] = useState<Record<string, StockData>>({})
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

    setStatus('loading')
    
    try {
      const normalizedCodes = codes.map(c => normalizeCode(c))
      const data = await fetchQuotes(normalizedCodes, source)
      setStockData(prev => ({ ...prev, ...data }))
      setLastUpdate(new Date())
      setStatus('success')
    } catch (error) {
      console.error('Failed to fetch quotes:', error)
      setStatus('error')
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
