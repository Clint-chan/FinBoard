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
  const chunkSize = 30

  // 批量接口：ulist.np 支持 secids 逗号分隔
  const fetchChunk = async (chunk: string[]) => {
    const secids = chunk.map(code => `${getMarketCode(code)}.${getSymbol(code)}`).join(',')
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
  }

  // 分片批量请求
  for (let i = 0; i < codes.length; i += chunkSize) {
    const slice = codes.slice(i, i + chunkSize)
    await fetchChunk(slice)
  }

  // 如果批量接口缺数据，回退单个拉取，保证完整性
  const missing = codes.filter(code => !result[code])
  if (missing.length) {
    const singleUrl = 'https://push2.eastmoney.com/api/qt/stock/get'
    const promises = missing.map(async (code) => {
      const symbol = getSymbol(code)
      const marketCode = getMarketCode(code)
      const params = new URLSearchParams({
        ut: '7eea3edcaed734bea9cbfc24409ed989',
        invt: '2',
        fltt: '2',
        fields: 'f43,f44,f45,f46,f47,f48,f57,f58,f60,f107,f116,f117,f162,f167,f168,f169,f170,f171',
        secid: `${marketCode}.${symbol}`,
      })

      try {
        const response = await fetch(`${singleUrl}?${params}`)
        const data = await response.json()
        if (data.data) {
          const d = data.data
          result[code] = {
            name: d.f58 || '--',
            price: d.f43 || 0,
            preClose: d.f60 || 0,
            open: d.f46 || 0,
            high: d.f44 || 0,
            low: d.f45 || 0,
            volume: d.f47 || 0,
            amount: d.f48 || 0,
            pctChg: (d.f170 || 0) / 100,
            turnover: d.f168 ? d.f168 / 100 : undefined,
            pe: d.f162 || undefined,
            pb: d.f167 || undefined,
            marketCap: d.f116
          }
        }
      } catch (err) {
        console.error(`获取${code}行情失败:`, err)
      }
    })
    await Promise.all(promises)
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
