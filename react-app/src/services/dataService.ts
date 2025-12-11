import type { StockData, SearchResult, IntradayData, QuoteSource } from '@/types'
import { fetchQuotesFromSource } from './quoteService'

// 安全的浮点数解析
export function safeFloat(value: string, fallback = 0): number {
  const parsed = parseFloat(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

// 标准化股票代码
export function normalizeCode(code: string): string {
  code = code.trim().toLowerCase()
  if (code.includes('.')) {
    const [num, market] = code.split('.')
    return market.toLowerCase() + num
  }
  if (code.startsWith('sh') || code.startsWith('sz')) return code
  if (code.startsWith('6') || code === '000300') return 'sh' + code
  return 'sz' + code
}

// 声明全局变量类型
declare global {
  interface Window {
    [key: string]: string | undefined
    suggestdata?: string
  }
}

// 获取股票行情 - 支持多数据源
export async function fetchQuotes(
  codes: string[], 
  source: QuoteSource = 'eastmoney'
): Promise<Record<string, StockData>> {
  const quoteData = await fetchQuotesFromSource(codes, source)
  
  // 转换为StockData格式
  const stockData: Record<string, StockData> = {}
  Object.entries(quoteData).forEach(([code, data]) => {
    stockData[code] = {
      name: data.name,
      price: data.price,
      preClose: data.preClose,
      open: data.open,
      vol: data.volume,
      high: data.high,
      low: data.low,
      amt: data.amount,
      turnover: data.turnover,
      pe: data.pe,
      pb: data.pb
    }
  })
  
  return stockData
}

// 搜索股票 (JSONP)
export function searchStock(keyword: string): Promise<SearchResult[]> {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = `https://suggest3.sinajs.cn/suggest/type=11,12,13,14,15,21,22,23,24,25&key=${encodeURIComponent(keyword)}&name=suggestdata`
    
    script.onload = () => {
      const dataStr = window.suggestdata
      try { delete window.suggestdata } catch { window.suggestdata = undefined }
      script.remove()
      
      if (!dataStr || dataStr === '') {
        resolve([])
        return
      }
      
      const items = dataStr.split(';').slice(0, 8).map(item => {
        const parts = item.split(',')
        if (parts.length >= 5) {
          let code = parts[3]
          const name = parts[4]
          if (!code || !name) return null
          if (code.startsWith('of')) {
            const num = code.slice(2)
            code = num.startsWith('1') ? 'sz' + num : 'sh' + num
          }
          if (code.startsWith('sh') || code.startsWith('sz')) {
            return { code, name }
          }
        }
        return null
      }).filter((item): item is SearchResult => item !== null)
      
      resolve(items)
    }
    
    script.onerror = () => {
      script.remove()
      reject(new Error('Search failed'))
    }
    
    document.head.appendChild(script)
  })
}

// 获取分时数据 - 东方财富接口
export async function fetchIntradayData(code: string): Promise<IntradayData> {
  const symbol = code.replace(/^(sh|sz)/, '')
  const marketCode = symbol.startsWith('6') ? '1' : '0'
  
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
  
  if (!data.data || !data.data.trends) {
    throw new Error('无分时数据')
  }

  const preClose = data.data.preClose
  const name = data.data.name
  
  const trends = data.data.trends.map((item: string) => {
    const parts = item.split(',')
    return {
      time: parts[0],
      open: parseFloat(parts[1]),
      price: parseFloat(parts[2]),
      high: parseFloat(parts[3]),
      low: parseFloat(parts[4]),
      volume: parseInt(parts[5]),
      amount: parseFloat(parts[6]),
      avgPrice: parseFloat(parts[7])
    }
  })

  return { code, name, preClose, trends }
}
