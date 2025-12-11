/**
 * 股票详细信息服务 - 基于东方财富接口
 */

export interface StockDetailInfo {
  // 基本信息
  code: string
  name: string
  price: number
  preClose: number
  
  // 市场数据
  totalShares?: number      // 总股本（万股）
  floatShares?: number      // 流通股（万股）
  totalMarketCap?: number   // 总市值（亿元）
  floatMarketCap?: number   // 流通市值（亿元）
  
  // 行业与上市信息
  industry?: string         // 所属行业
  listDate?: string         // 上市时间
  
  // 估值指标
  pe?: number              // 市盈率（动态）
  pb?: number              // 市净率
  ps?: number              // 市销率
  
  // 财务指标
  roe?: number             // 净资产收益率
  eps?: number             // 每股收益
  bvps?: number            // 每股净资产
  
  // 交易数据
  turnoverRate?: number    // 换手率
  amplitude?: number       // 振幅
  volume?: number          // 成交量
  amount?: number          // 成交额
}

/**
 * 获取股票详细信息 - 东方财富接口
 */
export async function fetchStockDetailInfo(code: string): Promise<StockDetailInfo> {
  const symbol = code.replace(/^(sh|sz)/, '')
  const marketCode = symbol.startsWith('6') ? '1' : '0'
  
  const url = 'https://push2.eastmoney.com/api/qt/stock/get'
  const params = new URLSearchParams({
    ut: '7eea3edcaed734bea9cbfc24409ed989',
    invt: '2',
    fltt: '2',
    // 扩展字段：包含股本、市值、行业、上市时间等
    fields: 'f43,f44,f45,f46,f47,f48,f57,f58,f60,f84,f85,f116,f117,f127,f162,f167,f168,f169,f170,f189',
    secid: `${marketCode}.${symbol}`,
  })

  const response = await fetch(`${url}?${params}`)
  const data = await response.json()
  
  if (!data.data) {
    throw new Error('无法获取股票信息')
  }

  const d = data.data
  
  // 计算振幅
  const high = (d.f44 || 0) / 100
  const low = (d.f45 || 0) / 100
  const preClose = (d.f60 || 0) / 100
  const amplitude = preClose > 0 ? ((high - low) / preClose) * 100 : 0
  
  // 格式化上市时间
  const listDateStr = d.f189 ? String(d.f189) : ''
  const listDate = listDateStr.length === 8 
    ? `${listDateStr.slice(0, 4)}-${listDateStr.slice(4, 6)}-${listDateStr.slice(6, 8)}`
    : undefined

  return {
    code,
    name: d.f58 || '--',
    price: (d.f43 || 0) / 100,
    preClose: preClose,
    
    // 市场数据（股本单位：股，需转换为万股；市值单位：元，需转换为亿元）
    totalShares: d.f84 ? d.f84 / 10000 : undefined,
    floatShares: d.f85 ? d.f85 / 10000 : undefined,
    totalMarketCap: d.f116 ? d.f116 / 100000000 : undefined,
    floatMarketCap: d.f117 ? d.f117 / 100000000 : undefined,
    
    // 行业与上市信息
    industry: d.f127 || undefined,
    listDate: listDate,
    
    // 估值指标
    pe: d.f162 || undefined,
    pb: d.f167 || undefined,
    ps: undefined, // 东方财富接口暂不提供市销率
    
    // 财务指标（这些需要从其他接口获取，暂时留空）
    roe: undefined,
    eps: undefined,
    bvps: undefined,
    
    // 交易数据
    turnoverRate: d.f168 ? d.f168 / 100 : undefined,
    amplitude: amplitude > 0 ? amplitude : undefined,
    volume: d.f47 || undefined,
    amount: d.f48 || undefined,
  }
}

// 缓存机制
const infoCache = new Map<string, { data: StockDetailInfo; time: number }>()
const CACHE_DURATION = 60000 // 1分钟缓存

/**
 * 获取股票详细信息（带缓存）
 */
export async function fetchStockDetailInfoCached(code: string): Promise<StockDetailInfo> {
  const cached = infoCache.get(code)
  if (cached && Date.now() - cached.time < CACHE_DURATION) {
    return cached.data
  }
  
  const data = await fetchStockDetailInfo(code)
  infoCache.set(code, { data, time: Date.now() })
  return data
}
