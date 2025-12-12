/**
 * 多数据源行情服务
 * 支持：东方财富、腾讯、新浪
 */

export type QuoteSource = 'eastmoney' | 'tencent' | 'sina'

export interface QuoteData {
  name: string
  price: number
  preClose: number
  open: number
  high: number
  low: number
  volume: number
  amount: number
  pctChg: number
  turnover?: number // 换手率
  pe?: number // 市盈率
  pb?: number // 市净率
  marketCap?: number // 总市值
}

/**
 * 获取市场代码
 * 优先使用 sh/sz 前缀判断，避免 ETF 等特殊代码判断错误
 */
function getMarketCode(code: string): string {
  if (code.startsWith('sh')) return '1'
  if (code.startsWith('sz')) return '0'
  // 回退：根据数字判断
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
 * 东方财富实时行情接口
 * 使用 ulist.np 批量接口，一次请求获取所有股票数据
 */
async function fetchFromEastmoney(codes: string[]): Promise<Record<string, QuoteData>> {
  if (codes.length === 0) return {}

  const result: Record<string, QuoteData> = {}
  
  // 构建 secids 参数，所有股票一次请求
  const secids = codes.map(code => `${getMarketCode(code)}.${getSymbol(code)}`).join(',')
  const url = 'https://push2.eastmoney.com/api/qt/ulist.np/get'
  const params = new URLSearchParams({
    fltt: '2',
    invt: '2',
    // f2 最新价(元) f18 昨收(元) f17 今开 f15 最高 f16 最低 f5 成交量(手) f6 成交额 f3 涨跌幅(%) f8 换手率(%) f9 市盈率 f10 市净率 f14 名称 f12 代码 f13 市场 0=sz 1=sh
    fields: 'f12,f14,f2,f3,f5,f6,f8,f9,f10,f15,f16,f17,f18,f13',
    secids
  })

  try {
    const response = await fetch(`${url}?${params}`)
    const data = await response.json()
    const list = data?.data?.diff || []
    list.forEach((item: any) => {
      const prefix = item.f13 === 1 ? 'sh' : 'sz'
      const code = `${prefix}${item.f12}`
      result[code] = {
        name: item.f14 || '--',
        price: item.f2 || 0,
        preClose: item.f18 || 0,
        open: item.f17 || 0,
        high: item.f15 || 0,
        low: item.f16 || 0,
        volume: item.f5 || 0,
        amount: item.f6 || 0,
        pctChg: item.f3 || 0,
        turnover: item.f8 || undefined,
        pe: item.f9 || undefined,
        pb: item.f10 || undefined,
        marketCap: undefined
      }
    })
  } catch (err) {
    console.error('东方财富批量行情失败:', err)
  }

  return result
}

/**
 * 腾讯实时行情接口（JSONP）
 */
function fetchFromTencent(codes: string[]): Promise<Record<string, QuoteData>> {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = `https://qt.gtimg.cn/q=${codes.join(',')}&_t=${Date.now()}`
    
    const result: Record<string, QuoteData> = {}
    
    script.onload = () => {
      try {
        codes.forEach(code => {
          const varName = `v_${code}`
          const dataStr = (window as any)[varName]
          if (dataStr) {
            const p = dataStr.split('~')
            result[code] = {
              name: p[1] || '--',
              price: parseFloat(p[3]) || 0,
              preClose: parseFloat(p[4]) || 0,
              open: parseFloat(p[5]) || 0,
              high: parseFloat(p[33]) || 0,
              low: parseFloat(p[34]) || 0,
              volume: (parseFloat(p[6]) || 0) * 100,
              amount: (parseFloat(p[37]) || 0) * 10000,
              pctChg: parseFloat(p[32]) || 0,
              turnover: parseFloat(p[38]), // 换手率
              pe: parseFloat(p[39]), // 市盈率
              pb: parseFloat(p[46]) // 市净率
            }
            delete (window as any)[varName]
          }
        })
        script.remove()
        resolve(result)
      } catch (err) {
        script.remove()
        reject(err)
      }
    }
    
    script.onerror = () => {
      script.remove()
      reject(new Error('Failed to load stock quotes from Tencent'))
    }
    
    document.head.appendChild(script)
  })
}

/**
 * 新浪实时行情接口（JSONP）
 */
function fetchFromSina(codes: string[]): Promise<Record<string, QuoteData>> {
  return new Promise((resolve, reject) => {
    // 转换代码格式：sh600054 -> s_sh600054
    const sinaCodes = codes.map(c => `s_${c}`)
    
    const script = document.createElement('script')
    script.src = `https://hq.sinajs.cn/list=${sinaCodes.join(',')}&_t=${Date.now()}`
    
    const result: Record<string, QuoteData> = {}
    
    script.onload = () => {
      try {
        codes.forEach((code) => {
          const varName = `hq_str_s_${code}`
          const dataStr = (window as any)[varName]
          if (dataStr) {
            const p = dataStr.split(',')
            result[code] = {
              name: p[0] || '--',
              price: parseFloat(p[1]) || 0,
              preClose: parseFloat(p[2]) || 0,
              open: parseFloat(p[3]) || 0,
              high: parseFloat(p[4]) || 0,
              low: parseFloat(p[5]) || 0,
              volume: (parseFloat(p[6]) || 0) * 100,
              amount: parseFloat(p[7]) || 0,
              pctChg: parseFloat(p[1]) && parseFloat(p[2]) 
                ? ((parseFloat(p[1]) - parseFloat(p[2])) / parseFloat(p[2]) * 100)
                : 0
            }
            delete (window as any)[varName]
          }
        })
        script.remove()
        resolve(result)
      } catch (err) {
        script.remove()
        reject(err)
      }
    }
    
    script.onerror = () => {
      script.remove()
      reject(new Error('Failed to load stock quotes from Sina'))
    }
    
    document.head.appendChild(script)
  })
}

/**
 * 统一的行情获取接口
 */
export async function fetchQuotesFromSource(
  codes: string[], 
  source: QuoteSource = 'eastmoney'
): Promise<Record<string, QuoteData>> {
  switch (source) {
    case 'eastmoney':
      return fetchFromEastmoney(codes)
    case 'tencent':
      return fetchFromTencent(codes)
    case 'sina':
      return fetchFromSina(codes)
    default:
      return fetchFromEastmoney(codes)
  }
}
