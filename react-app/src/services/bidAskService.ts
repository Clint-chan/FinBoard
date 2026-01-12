/**
 * 内外盘数据服务 - 用于测试和展示
 */

export interface BidAskData {
  // 全天累计
  dailyOuterVol: number    // 外盘（手）
  dailyInnerVol: number    // 内盘（手）
  dailyOuterRatio: number  // 外盘占比 (0-100)
  // 瞬时（最近30笔）
  instantBuyVol: number    // 买盘（手）
  instantSellVol: number   // 卖盘（手）
  instantBuyRatio: number  // 买盘占比 (0-100)
  // 其他
  price: number
  pctChg: number
  name: string
}

/**
 * 获取股票的内外盘数据（全天累计 + 瞬时）
 */
export async function fetchBidAskData(code: string): Promise<BidAskData | null> {
  try {
    const market = code.startsWith('sh') ? 1 : 0
    const symbol = code.slice(2)

    // 并行请求两个接口
    const [dailyRes, tickRes] = await Promise.all([
      // 全天累计内外盘
      fetch(`https://push2.eastmoney.com/api/qt/stock/get?fltt=2&invt=2&fields=f43,f49,f161,f170,f58&secid=${market}.${symbol}`),
      // 最近30笔逐笔成交
      fetch(`https://push2.eastmoney.com/api/qt/stock/details/get?fields1=f1,f2,f3,f4&fields2=f51,f52,f53,f54,f55&pos=-30&secid=${market}.${symbol}`)
    ])

    const dailyData = await dailyRes.json()
    const tickData = await tickRes.json()

    if (dailyData.rc !== 0 || !dailyData.data) {
      return null
    }

    // 解析全天累计数据
    const dailyOuterVol = dailyData.data.f49 || 0
    const dailyInnerVol = dailyData.data.f161 || 0
    const dailyTotal = dailyOuterVol + dailyInnerVol
    const dailyOuterRatio = dailyTotal > 0 ? Math.round(dailyOuterVol / dailyTotal * 10000) / 100 : 0

    // 解析瞬时数据
    let instantBuyVol = 0
    let instantSellVol = 0

    if (tickData.rc === 0 && tickData.data?.details) {
      for (const detail of tickData.data.details) {
        const parts = detail.split(',')
        const vol = parseInt(parts[2]) || 0
        const direction = parts[4]
        if (direction === '2') {
          instantBuyVol += vol
        } else if (direction === '1') {
          instantSellVol += vol
        }
      }
    }

    const instantTotal = instantBuyVol + instantSellVol
    const instantBuyRatio = instantTotal > 0 ? Math.round(instantBuyVol / instantTotal * 10000) / 100 : 0

    return {
      dailyOuterVol,
      dailyInnerVol,
      dailyOuterRatio,
      instantBuyVol,
      instantSellVol,
      instantBuyRatio,
      price: dailyData.data.f43 || 0,
      pctChg: dailyData.data.f170 || 0,
      name: dailyData.data.f58 || ''
    }
  } catch (err) {
    console.error('获取内外盘数据失败:', err)
    return null
  }
}
