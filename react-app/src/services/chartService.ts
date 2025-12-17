/**
 * 图表数据服务 - 基于东方财富接口
 */

// 分时数据点类型
export interface IntradayPoint {
  time: string
  open: number
  price: number
  high: number
  low: number
  volume: number
  amount: number
  avgPrice: number
}

// 分时数据
export interface IntradayData {
  code: string
  name: string
  preClose: number
  trends: IntradayPoint[]
}

// K线数据点
export interface KlinePoint {
  time: string
  open: number
  close: number
  high: number
  low: number
  volume: number
  amount: number
  pctChg: number
  turnover?: number // 换手率
}

// K线数据
export interface KlineData {
  code: string
  name: string
  klines: KlinePoint[]
}

// 格式化后的图表数据
export interface ChartData {
  priceData: { time: string; value: number; avgPrice: number }[]
  volumeData: { time: string; value: number; color: string }[]
  preClose: number
  priceRange: { min: number; max: number }
  lastPrice: number
  lastAvgPrice: number
}

/**
 * 获取市场代码
 */
function getMarketCode(code: string): string {
  const symbol = code.replace(/^(sh|sz)/, '')
  return symbol.startsWith('6') ? '1' : '0'
}

/**
 * 提取纯数字代码
 */
function getSymbol(code: string): string {
  return code.replace(/^(sh|sz)/, '')
}


/**
 * 获取分时数据 - 东方财富接口
 */
export async function fetchIntradayData(code: string): Promise<IntradayData> {
  const symbol = getSymbol(code)
  const marketCode = getMarketCode(code)
  
  const url = 'https://push2.eastmoney.com/api/qt/stock/trends2/get'
  const params = new URLSearchParams({
    fields1: 'f1,f2,f3,f4,f5,f6,f7,f8,f9,f10,f11,f12,f13',
    fields2: 'f51,f52,f53,f54,f55,f56,f57,f58',
    ut: '7eea3edcaed734bea9cbfc24409ed989',
    ndays: '1',
    iscr: '0',
    secid: `${marketCode}.${symbol}`,
  })

  const response = await fetch(`${url}?${params}`)
  const data = await response.json()
  
  if (!data.data || !data.data.trends || data.data.trends.length === 0) {
    // 非开盘时间可能没有分时数据，返回空数据而不是抛出错误
    return {
      code,
      name: data.data?.name || '',
      preClose: data.data?.preClose || 0,
      trends: []
    }
  }

  const preClose = data.data.preClose
  const name = data.data.name
  
  const trends: IntradayPoint[] = data.data.trends.map((item: string) => {
    const parts = item.split(',')
    // 安全解析数值，处理非交易时间可能返回的 null/undefined/"-" 等异常值
    const safeParseFloat = (val: string): number => {
      const num = parseFloat(val)
      return isNaN(num) ? 0 : num
    }
    const safeParseInt = (val: string): number => {
      const num = parseInt(val)
      return isNaN(num) ? 0 : num
    }
    
    return {
      time: parts[0],
      open: safeParseFloat(parts[1]),
      price: safeParseFloat(parts[2]),
      high: safeParseFloat(parts[3]),
      low: safeParseFloat(parts[4]),
      volume: safeParseInt(parts[5]),
      amount: safeParseFloat(parts[6]),
      avgPrice: safeParseFloat(parts[7])
    }
  })

  return { code, name, preClose, trends }
}

/**
 * 格式化分时数据为图表格式
 */
export function formatChartData(data: IntradayData): ChartData {
  const { preClose, trends } = data
  
  const priceData = trends.map(t => ({
    time: t.time.split(' ')[1],
    value: t.price,
    avgPrice: t.avgPrice
  }))

  const volumeData = trends.map((t, i) => ({
    time: t.time.split(' ')[1],
    value: t.volume,
    color: i > 0 && t.price >= trends[i-1].price 
      ? 'rgba(239, 68, 68, 0.5)' 
      : 'rgba(16, 185, 129, 0.5)'
  }))

  // 过滤掉无效数值（NaN、null、undefined）
  const prices = trends.map(t => t.price).filter(p => typeof p === 'number' && !isNaN(p))
  const avgPrices = trends.map(t => t.avgPrice).filter(p => typeof p === 'number' && !isNaN(p))
  const allPrices = [...prices, ...avgPrices, preClose].filter(p => typeof p === 'number' && !isNaN(p))
  
  // 如果没有有效价格数据，使用昨收价作为默认值
  const minPrice = allPrices.length > 0 ? Math.min(...allPrices) : preClose
  const maxPrice = allPrices.length > 0 ? Math.max(...allPrices) : preClose
  
  const maxDiff = Math.max(maxPrice - preClose, preClose - minPrice)
  const priceRange = {
    min: preClose - maxDiff * 1.1,
    max: preClose + maxDiff * 1.1
  }

  return {
    priceData,
    volumeData,
    preClose,
    priceRange,
    lastPrice: prices[prices.length - 1],
    lastAvgPrice: avgPrices[avgPrices.length - 1]
  }
}


/**
 * 获取K线数据 - 东方财富接口
 * @param period - 周期: '5'/'15'/'30'/'60' (分钟), '101'(日K), '102'(周K), '103'(月K)
 */
export async function fetchKlineData(
  code: string, 
  period = '60', 
  limit = 120
): Promise<KlineData> {
  const symbol = code.replace(/^(sh|sz)/, '')
  const marketCode = symbol.startsWith('6') ? '1' : '0'
  
  const url = 'https://push2his.eastmoney.com/api/qt/stock/kline/get'
  const params = new URLSearchParams({
    fields1: 'f1,f2,f3,f4,f5,f6',
    fields2: 'f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61',
    ut: '7eea3edcaed734bea9cbfc24409ed989',
    klt: period,
    fqt: '1',
    secid: `${marketCode}.${symbol}`,
    beg: '0',
    end: '20500000',
    lmt: limit.toString(),
  })

  const response = await fetch(`${url}?${params}`)
  const data = await response.json()
  
  if (!data.data || !data.data.klines) {
    console.error('K线接口返回数据:', data)
    throw new Error('无K线数据')
  }

  const klines: KlinePoint[] = data.data.klines.map((item: string) => {
    const p = item.split(',')
    return {
      time: p[0],
      open: parseFloat(p[1]),
      close: parseFloat(p[2]),
      high: parseFloat(p[3]),
      low: parseFloat(p[4]),
      volume: parseInt(p[5]),
      amount: parseFloat(p[6]),
      pctChg: parseFloat(p[8]),
      turnover: p[10] ? parseFloat(p[10]) : undefined // 换手率
    }
  })

  return {
    code,
    name: data.data.name,
    klines
  }
}

// Sparkline 数据缓存
const sparklineCache = new Map<string, { data: SparklineData; time: number }>()

export interface SparklineData {
  points: number[]
  preClose: number
  isUp: boolean
}

/**
 * 批量获取 Sparkline 数据
 */
export async function fetchSparklineData(codes: string[]): Promise<Map<string, SparklineData | null>> {
  const results = new Map<string, SparklineData | null>()
  const fetchPromises: Promise<void>[] = []
  
  for (const code of codes) {
    const cached = sparklineCache.get(code)
    if (cached && Date.now() - cached.time < 300000) {
      results.set(code, cached.data)
      continue
    }
    
    fetchPromises.push(
      fetchIntradayData(code)
        .then(data => {
          const trends = data.trends
          const step = Math.max(1, Math.floor(trends.length / 20))
          const points: number[] = []
          
          for (let i = 0; i < trends.length; i += step) {
            points.push(trends[i].price)
          }
          if (points.length > 0 && trends.length > 0) {
            points.push(trends[trends.length - 1].price)
          }
          
          const sparkData: SparklineData = {
            points,
            preClose: data.preClose,
            isUp: points.length > 0 && points[points.length - 1] >= data.preClose
          }
          
          sparklineCache.set(code, { data: sparkData, time: Date.now() })
          results.set(code, sparkData)
        })
        .catch(() => {
          results.set(code, null)
        })
    )
  }
  
  await Promise.all(fetchPromises)
  return results
}

/**
 * 生成 Sparkline SVG 路径
 */
export function generateSparklinePath(points: number[], width = 50, height = 24): string {
  if (!points || points.length < 2) return ''
  
  const min = Math.min(...points)
  const max = Math.max(...points)
  const range = max - min || 1
  const padding = 2
  
  const xStep = (width - padding * 2) / (points.length - 1)
  const yScale = (height - padding * 2) / range
  
  return points.map((p, i) => {
    const x = padding + i * xStep
    const y = padding + (max - p) * yScale
    return `${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')
}
