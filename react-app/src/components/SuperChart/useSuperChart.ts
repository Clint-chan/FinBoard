/**
 * SuperChart 核心逻辑 Hook
 */
import { useState, useCallback, useEffect } from 'react'
import { 
  fetchIntradayData, 
  formatChartData, 
  fetchKlineData,
  type ChartData,
  type KlineData
} from '@/services/chartService'
import { calcMACD, calcMultiRSI, calcBOLL } from '@/utils/indicators'
import { 
  type ChartPeriod, 
  type SubIndicator, 
  type ProcessedKlineData,
  PERIODS 
} from './types'

interface UseSuperChartOptions {
  code: string
  defaultTab?: ChartPeriod
  defaultSubIndicators?: SubIndicator[]
  showBoll?: boolean
  klineCount?: number
  initialName?: string // 初始名称，避免加载时显示 '--'
}

export function useSuperChart(options: UseSuperChartOptions) {
  const {
    code,
    defaultTab = 'intraday',
    defaultSubIndicators = ['vol'],
    showBoll: initialShowBoll = false,
    klineCount: initialKlineCount = 50,
    initialName = ''
  } = options

  // 状态 - 使用函数初始化确保每次挂载都使用最新的 default 值
  const [currentTab, setCurrentTab] = useState<ChartPeriod>(() => defaultTab)
  const [subIndicators, setSubIndicators] = useState<SubIndicator[]>(() => [...defaultSubIndicators])
  const [showBoll, setShowBoll] = useState(() => initialShowBoll)
  const [klineCount, setKlineCount] = useState(initialKlineCount)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 数据
  const [intradayData, setIntradayData] = useState<ChartData | null>(null)
  const [klineRawData, setKlineRawData] = useState<KlineData | null>(null)
  const [processedData, setProcessedData] = useState<ProcessedKlineData | null>(null)
  const [stockName, setStockName] = useState<string>(initialName)
  
  // 动态加载状态
  const [totalLoadedCount, setTotalLoadedCount] = useState(120) // 已加载的总数据量
  const [isLoadingMore, setIsLoadingMore] = useState(false) // 是否正在加载更多

  // 十字光标
  const [crosshair, setCrosshair] = useState<{ x: number; y: number } | null>(null)

  // 加载分时数据 - 对照原版：切换周期时不显示 loading
  const loadIntradayData = useCallback(async (showLoading = false) => {
    if (showLoading) setLoading(true)
    setError(null)
    try {
      const rawData = await fetchIntradayData(code)
      const formatted = formatChartData(rawData)
      setIntradayData({ ...formatted, name: rawData.name } as ChartData & { name: string })
      setStockName(rawData.name)
    } catch (err) {
      console.error('加载分时数据失败:', err)
      // 只在showLoading时才设置错误，避免静默刷新时显示错误
      if (showLoading) {
        setError((err as Error).message || '加载失败')
      }
    } finally {
      if (showLoading) setLoading(false)
    }
  }, [code])

  // 加载 K 线数据 - 对照原版：切换周期时不显示 loading
  const loadKlineData = useCallback(async (showLoading = false, limit?: number) => {
    const periodConfig = PERIODS[currentTab]
    if (!periodConfig.period) return

    if (showLoading) setLoading(true)
    setError(null)
    try {
      const loadLimit = limit || totalLoadedCount
      const rawData = await fetchKlineData(code, periodConfig.period, loadLimit)
      setKlineRawData(rawData)
      setStockName(rawData.name)
      // 更新实际加载的数据量
      if (limit) {
        setTotalLoadedCount(limit)
      }
    } catch (err) {
      console.error('加载K线数据失败:', err)
      // 只在showLoading时才设置错误，避免静默刷新时显示错误
      if (showLoading) {
        setError((err as Error).message || '加载失败')
      }
    } finally {
      if (showLoading) setLoading(false)
    }
  }, [code, currentTab, totalLoadedCount])
  
  // 加载更多历史数据
  const loadMoreKlineData = useCallback(async () => {
    if (isLoadingMore || totalLoadedCount >= 500) return // 最多加载500条
    
    setIsLoadingMore(true)
    const newLimit = Math.min(totalLoadedCount + 120, 500) // 每次增加120条
    await loadKlineData(false, newLimit)
    setIsLoadingMore(false)
  }, [isLoadingMore, totalLoadedCount, loadKlineData])

  // 处理 K 线数据（计算指标）
  useEffect(() => {
    if (!klineRawData) {
      setProcessedData(null)
      return
    }

    const allKlines = klineRawData.klines
    const klines = allKlines.slice(-klineCount)
    const closes = klines.map(k => k.close)
    
    const allCloses = allKlines.map(k => k.close)
    const allMacd = calcMACD(allCloses)
    const allMultiRsi = calcMultiRSI(allCloses)
    const allBoll = calcBOLL(allCloses)
    
    const startIdx = allKlines.length - klineCount

    setProcessedData({
      name: klineRawData.name,
      code: klineRawData.code,
      klines,
      closes,
      macd: {
        dif: allMacd.dif.slice(startIdx),
        dea: allMacd.dea.slice(startIdx),
        macd: allMacd.macd.slice(startIdx)
      },
      rsi: {
        rsi6: allMultiRsi.rsi6.slice(startIdx),
        rsi12: allMultiRsi.rsi12.slice(startIdx),
        rsi24: allMultiRsi.rsi24.slice(startIdx)
      },
      boll: {
        mid: allBoll.mid.slice(startIdx),
        upper: allBoll.upper.slice(startIdx),
        lower: allBoll.lower.slice(startIdx)
      },
      lastPrice: closes[closes.length - 1],
      preClose: klines.length > 1 ? klines[klines.length - 2].close : closes[0],
      priceRange: {
        min: Math.min(...klines.map(k => k.low)),
        max: Math.max(...klines.map(k => k.high))
      }
    })
  }, [klineRawData, klineCount])

  // 加载数据 - 对照原版：只有初始加载时显示 loading
  const loadData = useCallback(async (showLoading = false) => {
    if (currentTab === 'intraday') {
      await loadIntradayData(showLoading)
    } else {
      await loadKlineData(showLoading)
    }
  }, [currentTab, loadIntradayData, loadKlineData])

  // 切换周期
  const switchTab = useCallback((tab: ChartPeriod) => {
    setCurrentTab(tab)
    setCrosshair(null)
  }, [])

  // 切换副图指标
  const toggleSubIndicator = useCallback((indicator: SubIndicator) => {
    setSubIndicators(prev => {
      const idx = prev.indexOf(indicator)
      if (idx >= 0) {
        if (prev.length > 1) {
          return prev.filter(i => i !== indicator)
        }
        return prev
      } else {
        if (prev.length < 3) {
          return [...prev, indicator]
        }
        return prev
      }
    })
  }, [])

  // 滚轮缩放
  const handleWheel = useCallback((deltaY: number) => {
    if (currentTab === 'intraday') return
    const delta = deltaY > 0 ? 5 : -5
    const maxCount = klineRawData ? klineRawData.klines.length : 120
    const newCount = Math.max(20, Math.min(maxCount, klineCount + delta))
    
    setKlineCount(newCount)
    
    // 当缩小到接近全部数据时（距离边界10条以内），自动加载更多
    if (newCount >= maxCount - 10 && !isLoadingMore && totalLoadedCount < 500) {
      loadMoreKlineData()
    }
  }, [currentTab, klineCount, klineRawData, isLoadingMore, totalLoadedCount, loadMoreKlineData])
  
  // 拖动到左边界时加载更多数据
  const handlePanToEdge = useCallback(() => {
    if (currentTab === 'intraday') return
    if (isLoadingMore || totalLoadedCount >= 500) return
    
    // 触发加载更多历史数据
    loadMoreKlineData()
  }, [currentTab, isLoadingMore, totalLoadedCount, loadMoreKlineData])

  // 当 code 变化时，重置数据并重新加载
  useEffect(() => {
    // 重置数据
    setIntradayData(null)
    setKlineRawData(null)
    setProcessedData(null)
    setError(null)
    setTotalLoadedCount(120) // 重置为初始120条
    // 显示 loading 并加载数据
    setLoading(true)
    loadData(true)
  }, [code]) // eslint-disable-line react-hooks/exhaustive-deps

  // 切换周期时加载数据（不显示 loading）
  useEffect(() => {
    // 只有在有数据的情况下切换周期才不显示 loading
    if (intradayData || klineRawData) {
      loadData(false)
    }
  }, [currentTab]) // eslint-disable-line react-hooks/exhaustive-deps

  // 开盘时间自动刷新 - 每1.5秒刷新一次
  useEffect(() => {
    // 判断是否为交易时间
    const isMarketOpen = (): boolean => {
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
      return (time >= morningStart && time <= morningEnd) || (time >= afternoonStart && time <= afternoonEnd)
    }

    if (!isMarketOpen()) return

    const interval = setInterval(() => {
      // 静默刷新，不显示loading
      loadData(false)
    }, 1500)

    return () => clearInterval(interval)
  }, [loadData])

  return {
    // 状态
    currentTab,
    subIndicators,
    showBoll,
    klineCount,
    loading,
    error,
    crosshair,
    stockName,
    
    // 数据
    intradayData,
    processedData,
    isIntraday: currentTab === 'intraday',
    
    // 方法
    switchTab,
    toggleSubIndicator,
    setShowBoll,
    handleWheel,
    setCrosshair,
    loadData,
    handlePanToEdge
  }
}
