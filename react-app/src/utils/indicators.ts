/**
 * 技术指标计算工具
 */

// MACD 指标结果
export interface MACDResult {
  dif: number[]
  dea: number[]
  macd: number[]
}

// RSI 指标结果
export interface RSIResult {
  rsi6: number[]
  rsi12: number[]
  rsi24: number[]
}

// BOLL 指标结果
export interface BOLLResult {
  mid: number[]
  upper: number[]
  lower: number[]
}

/**
 * 计算 EMA (指数移动平均)
 */
export function calcEMA(data: number[], period: number): number[] {
  const k = 2 / (period + 1)
  const ema: number[] = [data[0]]
  
  for (let i = 1; i < data.length; i++) {
    ema.push(data[i] * k + ema[i - 1] * (1 - k))
  }
  
  return ema
}

/**
 * 计算 MACD 指标
 * @param closes - 收盘价数组
 * @param fast - 快线周期 (默认12)
 * @param slow - 慢线周期 (默认26)
 * @param signal - 信号线周期 (默认9)
 */
export function calcMACD(
  closes: number[], 
  fast = 12, 
  slow = 26, 
  signal = 9
): MACDResult {
  const emaFast = calcEMA(closes, fast)
  const emaSlow = calcEMA(closes, slow)
  
  const dif = emaFast.map((v, i) => v - emaSlow[i])
  const dea = calcEMA(dif, signal)
  const macd = dif.map((v, i) => (v - dea[i]) * 2)
  
  return { dif, dea, macd }
}

/**
 * 计算 RSI 指标 (Wilder's Smoothing Method)
 * @param closes - 收盘价数组
 * @param period - 周期 (默认6)
 */
export function calcRSI(closes: number[], period = 6): number[] {
  const n = closes.length
  const rsi = new Array(n).fill(50)
  
  if (n < 2) return rsi
  
  // 计算涨跌幅
  const changes: number[] = []
  for (let i = 1; i < n; i++) {
    changes.push(closes[i] - closes[i - 1])
  }
  
  // 第一个周期用 SMA 初始化
  let avgGain = 0, avgLoss = 0
  for (let i = 0; i < Math.min(period, changes.length); i++) {
    if (changes[i] > 0) avgGain += changes[i]
    else avgLoss -= changes[i]
  }
  avgGain /= period
  avgLoss /= period
  
  // 计算第一个 RSI
  if (period < changes.length) {
    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss
    rsi[period] = avgLoss === 0 ? (avgGain === 0 ? 50 : 100) : 100 - 100 / (1 + rs)
  }
  
  // 后续用 Wilder's Smoothing
  for (let i = period + 1; i < n; i++) {
    const change = changes[i - 1]
    const gain = change > 0 ? change : 0
    const loss = change < 0 ? -change : 0
    
    avgGain = (avgGain * (period - 1) + gain) / period
    avgLoss = (avgLoss * (period - 1) + loss) / period
    
    if (avgLoss === 0) {
      rsi[i] = avgGain === 0 ? 50 : 100
    } else {
      rsi[i] = 100 - 100 / (1 + avgGain / avgLoss)
    }
  }
  
  // 填充前面的值
  for (let i = 1; i <= Math.min(period, n - 1); i++) {
    let g = 0, l = 0
    for (let j = 0; j < i; j++) {
      if (changes[j] > 0) g += changes[j]
      else l -= changes[j]
    }
    g /= i
    l /= i
    rsi[i] = l === 0 ? (g === 0 ? 50 : 100) : 100 - 100 / (1 + g / l)
  }
  
  return rsi
}

/**
 * 计算多周期 RSI 指标
 */
export function calcMultiRSI(closes: number[]): RSIResult {
  return {
    rsi6: calcRSI(closes, 6),
    rsi12: calcRSI(closes, 12),
    rsi24: calcRSI(closes, 24)
  }
}

/**
 * 计算布林带 BOLL
 * @param closes - 收盘价数组
 * @param period - 周期 (默认20)
 * @param multiplier - 标准差倍数 (默认2)
 */
export function calcBOLL(
  closes: number[], 
  period = 20, 
  multiplier = 2
): BOLLResult {
  const mid: number[] = []
  const upper: number[] = []
  const lower: number[] = []
  
  for (let i = 0; i < closes.length; i++) {
    if (i < period - 1) {
      mid.push(closes[i])
      upper.push(closes[i])
      lower.push(closes[i])
      continue
    }
    
    const slice = closes.slice(i - period + 1, i + 1)
    const ma = slice.reduce((a, b) => a + b, 0) / period
    const std = Math.sqrt(
      slice.reduce((sum, v) => sum + Math.pow(v - ma, 2), 0) / period
    )
    
    mid.push(ma)
    upper.push(ma + multiplier * std)
    lower.push(ma - multiplier * std)
  }
  
  return { mid, upper, lower }
}

/**
 * 计算 SMA (简单移动平均)
 */
export function calcSMA(data: number[], period: number): number[] {
  const sma: number[] = []
  
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      sma.push(data[i])
    } else {
      const slice = data.slice(i - period + 1, i + 1)
      sma.push(slice.reduce((a, b) => a + b, 0) / period)
    }
  }
  
  return sma
}
