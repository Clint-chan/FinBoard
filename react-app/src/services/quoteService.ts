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
 * 东方财富实时行情接口
 */
async function fetchFromEastmoney(codes: string[]): Promise<Record<string, QuoteData>> {
  const result: Record<string, QuoteData> = {}
  
  // 东方财富需要逐个获取
  const promises = codes.map(async (code) => {
    const symbol = getSymbol(code)
    const marketCode = getMarketCode(code)
    
    const url = 'https://push2.eastmoney.com/api/qt/stock/get'
    const params = new URLSearchParams({
      ut: '7eea3edcaed734bea9cbfc24409ed989',
      invt: '2',
      fltt: '2',
      fields: 'f43,f44,f45,f46,f47,f48,f49,f50,f51,f52,f57,f58,f60,f107,f116,f117,f162,f167,f168,f169,f170,f171',
      secid: `${marketCode}.${symbol}`,
    })

    try {
      const response = await fetch(`${url}?${params}`)
      const data = await response.json()
      
      if (data.data) {
        const d = data.data
        // 注意：fltt=2 参数表示返回的价格已经是"元"为单位，不需要除以100
        // 只有涨跌幅(f170)和换手率(f168)需要除以100
        result[code] = {
          name: d.f58 || '--',
          price: d.f43 || 0, // f43: 最新价（元）
          preClose: d.f60 || 0, // f60: 昨收（元）
          open: d.f46 || 0, // f46: 今开（元）
          high: d.f44 || 0, // f44: 最高（元）
          low: d.f45 || 0, // f45: 最低（元）
          volume: d.f47 || 0, // f47: 成交量（手）
          amount: d.f48 || 0, // f48: 成交额
          pctChg: (d.f170 || 0) / 100, // f170: 涨跌幅（需除以100）
          turnover: d.f168 ? d.f168 / 100 : undefined, // f168: 换手率（需除以100）
          pe: d.f162 || undefined, // f162: 市盈率（动态）
          pb: d.f167 || undefined, // f167: 市净率
          marketCap: d.f116 // f116: 总市值
        }
      } else {
        console.error(`东方财富接口返回数据异常 ${code}:`, data)
      }
    } catch (err) {
      console.error(`获取${code}行情失败:`, err)
    }
  })
  
  await Promise.all(promises)
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
