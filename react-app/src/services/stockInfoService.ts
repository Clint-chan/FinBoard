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
  volumeRatio?: number     // 量比
}

// 上海指数代码列表（000开头的上海指数）
const SH_INDEX_CODES = [
  '000001', '000002', '000003', '000010', '000016', '000017',
  '000300', '000688', '000905', '000852'
]

/**
 * 获取股票详细信息 - 东方财富接口
 */
export async function fetchStockDetailInfo(code: string): Promise<StockDetailInfo> {
  const symbol = code.replace(/^(sh|sz)/, '')
  // 优先使用前缀判断，回退时考虑上海指数
  let marketCode = '0'
  if (code.startsWith('sh')) {
    marketCode = '1'
  } else if (code.startsWith('sz')) {
    marketCode = '0'
  } else if (symbol.startsWith('6') || SH_INDEX_CODES.includes(symbol)) {
    marketCode = '1'
  }
  
  const url = 'https://push2.eastmoney.com/api/qt/stock/get'
  const params = new URLSearchParams({
    ut: '7eea3edcaed734bea9cbfc24409ed989',
    invt: '2',
    fltt: '2',
    // 扩展字段：包含股本、市值、行业、上市时间、量比等
    fields: 'f43,f44,f45,f46,f47,f48,f50,f57,f58,f60,f84,f85,f116,f117,f127,f162,f167,f168,f169,f170,f189',
    secid: `${marketCode}.${symbol}`,
  })

  const response = await fetch(`${url}?${params}`)
  
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`)
  }
  
  const data = await response.json()
  
  if (!data.data) {
    throw new Error('无法获取股票信息')
  }

  const d = data.data
  
  // 安全地转换数值，避免 NaN
  // 注意：fltt=2 参数表示返回的价格已经是"元"为单位，不需要除以100
  const safeNum = (val: any, divisor = 1): number | undefined => {
    const num = Number(val)
    return !isNaN(num) && num !== 0 ? num / divisor : undefined
  }
  
  // 计算振幅 - 价格字段不需要除以100
  const high = safeNum(d.f44)
  const low = safeNum(d.f45)
  const preClose = safeNum(d.f60) || 0
  const amplitude = (high && low && preClose > 0) ? ((high - low) / preClose) * 100 : undefined
  
  // 格式化上市时间
  const listDateStr = d.f189 ? String(d.f189) : ''
  const listDate = listDateStr.length === 8 
    ? `${listDateStr.slice(0, 4)}-${listDateStr.slice(4, 6)}-${listDateStr.slice(6, 8)}`
    : undefined

  return {
    code,
    name: d.f58 || '--',
    price: safeNum(d.f43) || 0, // 价格不需要除以100
    preClose: preClose,
    
    // 市场数据（股本单位：股，需转换为万股；市值单位：元，需转换为亿元）
    totalShares: safeNum(d.f84, 10000),
    floatShares: safeNum(d.f85, 10000),
    totalMarketCap: safeNum(d.f116, 100000000),
    floatMarketCap: safeNum(d.f117, 100000000),
    
    // 行业与上市信息
    industry: d.f127 || undefined,
    listDate: listDate,
    
    // 估值指标
    pe: safeNum(d.f162),
    pb: safeNum(d.f167),
    ps: undefined, // 东方财富接口暂不提供市销率
    
    // 财务指标（这些需要从其他接口获取，暂时留空）
    roe: undefined,
    eps: undefined,
    bvps: undefined,
    
    // 交易数据
    // 换手率：东方财富返回的是百分比值（如 2.35 表示 2.35%），不需要除以 100
    turnoverRate: safeNum(d.f168),
    amplitude: amplitude,
    volume: safeNum(d.f47),
    amount: safeNum(d.f48),
    // 量比：f50 字段
    volumeRatio: safeNum(d.f50),
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
