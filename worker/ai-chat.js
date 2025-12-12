/**
 * AI Chat API - 调用大模型进行股票分析
 * 支持流式响应
 */

// 默认配置（可通过 KV 存储覆盖）
const DEFAULT_CONFIG = {
  apiUrl: 'http://frp3.ccszxc.site:14266/v1/chat/completions',
  apiKey: 'zxc123',
  model: 'gemini-3-pro-preview-thinking'
}

// CORS 头
function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  }
}

/**
 * 构建日内做T分析的系统提示词
 */
function buildIntradayTradingPrompt() {
  return `你是一位专业的A股短线交易分析师，专注于"日内做T"策略。

你的核心能力：
- 多周期K线分析（日线定方向，60分钟看波段，15分钟找进出点）
- 量价配合判断（放量上涨、缩量回调、放量下跌）
- 技术指标应用（KDJ/RSI超买超卖，MACD背离，均线支撑压力）
- 给出具体的买卖点位、止损止盈和仓位建议`
}

/**
 * 从东方财富获取实时行情数据
 * 接口: stock_zh_a_spot_em
 */
async function fetchRealtimeData(symbol) {
  const url = 'https://82.push2.eastmoney.com/api/qt/clist/get'
  const params = new URLSearchParams({
    pn: '1',
    pz: '5000',
    po: '1',
    np: '1',
    ut: 'bd1d9ddb04089700cf9c27f6f7426281',
    fltt: '2',
    invt: '2',
    fid: 'f3',
    fs: 'm:0 t:6,m:0 t:80,m:1 t:2,m:1 t:23,m:0 t:81 s:2048',
    fields: 'f1,f2,f3,f4,f5,f6,f7,f8,f9,f10,f12,f13,f14,f15,f16,f17,f18,f20,f21,f23,f24,f25,f22,f11'
  })

  const response = await fetch(`${url}?${params}`)
  const data = await response.json()
  
  if (!data.data || !data.data.diff) {
    throw new Error('获取实时行情失败')
  }

  const stock = data.data.diff.find(item => item.f12 === symbol)
  if (!stock) {
    throw new Error(`未找到股票 ${symbol}`)
  }

  return {
    code: stock.f12,
    name: stock.f14,
    price: stock.f2,
    change_pct: stock.f3,
    change_amount: stock.f4,
    volume: stock.f5,
    amount: stock.f6,
    amplitude: stock.f7,
    turnover_rate: stock.f8,
    pe: stock.f9,
    high: stock.f15,
    low: stock.f16,
    open: stock.f17,
    pre_close: stock.f18,
    volume_ratio: stock.f10
  }
}

/**
 * 从东方财富获取K线数据
 * 接口: stock_zh_a_hist
 */
async function fetchKlineData(symbol, period = 'daily', limit = 30) {
  const marketCode = symbol.startsWith('6') ? 1 : 0
  const periodMap = { 'daily': '101', '15': '15', '30': '30', '60': '60' }
  
  const url = 'https://push2his.eastmoney.com/api/qt/stock/kline/get'
  const params = new URLSearchParams({
    fields1: 'f1,f2,f3,f4,f5,f6',
    fields2: 'f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61',
    ut: '7eea3edcaed734bea9cbfc24409ed989',
    klt: periodMap[period] || '101',
    fqt: '1',
    secid: `${marketCode}.${symbol}`,
    beg: '0',
    end: '20500101',
    lmt: limit.toString()
  })

  const response = await fetch(`${url}?${params}`)
  const data = await response.json()
  
  if (!data.data || !data.data.klines) {
    throw new Error('获取K线数据失败')
  }

  return data.data.klines.map(line => {
    const [date, open, close, high, low, volume, amount] = line.split(',')
    return {
      date,
      open: parseFloat(open),
      close: parseFloat(close),
      high: parseFloat(high),
      low: parseFloat(low),
      volume: parseFloat(volume),
      amount: parseFloat(amount)
    }
  })
}

/**
 * 计算技术指标
 */
function calculateIndicators(klines) {
  const closes = klines.map(k => k.close)
  
  // 计算均线
  const ma5 = closes.length >= 5 ? closes.slice(-5).reduce((a, b) => a + b) / 5 : 0
  const ma10 = closes.length >= 10 ? closes.slice(-10).reduce((a, b) => a + b) / 10 : 0
  const ma20 = closes.length >= 20 ? closes.slice(-20).reduce((a, b) => a + b) / 20 : 0
  
  // 计算MACD
  let ema12 = closes[0]
  let ema26 = closes[0]
  const dif = []
  
  closes.forEach(close => {
    ema12 = (close * 2 + ema12 * 11) / 13
    ema26 = (close * 2 + ema26 * 25) / 27
    dif.push(ema12 - ema26)
  })
  
  let dea = dif[0]
  const deaArr = []
  const macd = []
  
  dif.forEach(d => {
    dea = (d * 2 + dea * 8) / 10
    deaArr.push(dea)
    macd.push((d - dea) * 2)
  })
  
  // 计算RSI
  function calcRSI(period) {
    if (closes.length < period + 1) return 50
    
    let gains = 0, losses = 0
    for (let i = closes.length - period; i < closes.length; i++) {
      const change = closes[i] - closes[i - 1]
      if (change > 0) gains += change
      else losses += Math.abs(change)
    }
    
    const avgGain = gains / period
    const avgLoss = losses / period
    
    if (avgLoss === 0) return 100
    const rs = avgGain / avgLoss
    return 100 - (100 / (1 + rs))
  }
  
  return {
    ma: { ma5, ma10, ma20 },
    macd: {
      dif: dif[dif.length - 1],
      dea: deaArr[deaArr.length - 1],
      macd: macd[macd.length - 1],
      prevMacd: macd[macd.length - 2] || 0
    },
    rsi: {
      rsi6: calcRSI(6),
      rsi12: calcRSI(12)
    }
  }
}

/**
 * 采集并格式化股票数据为分析文本
 */
async function collectAndFormatStockData(symbol) {
  try {
    // 1. 获取实时行情
    const realtime = await fetchRealtimeData(symbol)
    
    // 2. 获取K线数据
    const klines = await fetchKlineData(symbol, 'daily', 30)
    
    // 3. 计算技术指标
    const indicators = calculateIndicators(klines)
    
    // 4. 格式化为文本
    const price = realtime.price
    const pct = realtime.change_pct
    const isUp = pct >= 0
    
    let text = `## 1. 当前状态
股票名称：${realtime.name}
现价：${price} 元
涨跌幅：${isUp ? '+' : ''}${pct.toFixed(2)}%
涨跌额：${isUp ? '+' : ''}${realtime.change_amount.toFixed(2)} 元
今日高点：${realtime.high} 元
今日低点：${realtime.low} 元
当前位置：${price === realtime.high ? '日内高点' : price === realtime.low ? '日内低点' : '中间位置'}
振幅：${realtime.amplitude.toFixed(2)}%
换手率：${realtime.turnover_rate.toFixed(2)}%
量比：${realtime.volume_ratio.toFixed(2)}

## 2. 短周期趋势（最近3根K线）
`
    
    const recent3 = klines.slice(-3)
    recent3.forEach((k, i) => {
      const kPct = ((k.close - k.open) / k.open * 100).toFixed(2)
      const trend = k.close > k.open ? '上涨' : '下跌'
      let volInfo = ''
      if (i > 0) {
        const volChange = ((k.volume - recent3[i-1].volume) / recent3[i-1].volume * 100).toFixed(0)
        const volStatus = volChange > 0 ? '放量' : '缩量'
        volInfo = `, ${volStatus} ${Math.abs(volChange)}%`
      }
      text += `${k.date}: ${trend} ${kPct}%${volInfo}\n`
    })
    
    const { ma, macd: macdData, rsi } = indicators
    
    text += `
## 3. 均线位置
MA5: ${ma.ma5.toFixed(2)} 元 ${price > ma.ma5 ? '(站上)' : '(跌破)'}
MA10: ${ma.ma10.toFixed(2)} 元 ${price > ma.ma10 ? '(站上)' : '(跌破)'}
MA20: ${ma.ma20.toFixed(2)} 元 ${price > ma.ma20 ? '(站上)' : '(跌破)'}
上方压力：${Math.max(ma.ma5, ma.ma10, ma.ma20).toFixed(2)} 元
下方支撑：${Math.min(ma.ma5, ma.ma10, ma.ma20).toFixed(2)} 元

## 4. MACD 指标
当前状态：${macdData.macd > 0 ? '红柱' : '绿柱'}${macdData.macd > macdData.prevMacd ? '变长' : '变短'}
DIF: ${macdData.dif.toFixed(4)}, DEA: ${macdData.dea.toFixed(4)}
`
    
    if (macdData.dif > macdData.dea && macdData.prevMacd <= 0) {
      text += '⚠️ 刚刚形成金叉\n'
    } else if (macdData.dif < macdData.dea && macdData.prevMacd >= 0) {
      text += '⚠️ 刚刚形成死叉\n'
    }
    
    text += `
## 5. 情绪指标
RSI(6): ${rsi.rsi6.toFixed(2)}${rsi.rsi6 > 80 ? ' ⚠️ 超买' : rsi.rsi6 < 20 ? ' ⚠️ 超卖' : ''}
RSI(12): ${rsi.rsi12.toFixed(2)}${rsi.rsi12 > 80 ? ' ⚠️ 超买' : rsi.rsi12 < 20 ? ' ⚠️ 超卖' : ''}

## 6. 关键点位（近3日）
前高：${Math.max(...recent3.map(k => k.high)).toFixed(2)} 元
前低：${Math.min(...recent3.map(k => k.low)).toFixed(2)} 元
`
    
    return text
    
  } catch (error) {
    console.error('数据采集失败:', error)
    return `数据采集失败: ${error.message}`
  }
}

/**
 * 调用大模型 API（流式）
 */
async function callLLMStream(messages, config) {
  const response = await fetch(config.apiUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: config.model,
      messages: messages,
      stream: true
    })
  })

  if (!response.ok) {
    throw new Error(`LLM API error: ${response.status}`)
  }

  return response.body
}

/**
 * 处理聊天请求
 */
async function handleChatRequest(request, env) {
  try {
    const { messages, stockData, mode = 'intraday' } = await request.json()

    // 获取配置（优先从 KV 读取）
    let config = DEFAULT_CONFIG
    if (env.CONFIG_KV) {
      const savedConfig = await env.CONFIG_KV.get('ai_config', 'json')
      if (savedConfig) {
        config = { ...DEFAULT_CONFIG, ...savedConfig }
      }
    }

    // 构建系统提示词
    let systemPrompt = ''
    if (mode === 'intraday') {
      systemPrompt = buildIntradayTradingPrompt()
    }

    // 采集股票数据
    let dataContext = ''
    if (stockData && stockData.code) {
      dataContext = await collectAndFormatStockData(stockData.code)
    }

    // 构建完整的消息列表
    const fullMessages = [
      { role: 'system', content: systemPrompt },
      ...messages.map((msg, idx) => {
        // 如果是第一条用户消息，附加股票数据
        if (msg.role === 'user' && dataContext && idx === 0) {
          return {
            role: 'user',
            content: `${dataContext}\n\n用户问题：${msg.content}`
          }
        }
        return msg
      })
    ]

    // 调用大模型（流式）
    const stream = await callLLMStream(fullMessages, config)

    // 创建 TransformStream 来处理 SSE 格式
    const { readable, writable } = new TransformStream()
    
    // 异步处理流
    ;(async () => {
      const writer = writable.getWriter()
      const reader = stream.getReader()
      const decoder = new TextDecoder()

      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          const chunk = decoder.decode(value, { stream: true })
          const lines = chunk.split('\n').filter(line => line.trim())

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6)
              if (data === '[DONE]') continue

              try {
                const json = JSON.parse(data)
                const content = json.choices?.[0]?.delta?.content
                if (content) {
                  // 转发给前端
                  await writer.write(new TextEncoder().encode(`data: ${JSON.stringify({ content })}\n\n`))
                }
              } catch (e) {
                console.error('Parse error:', e)
              }
            }
          }
        }

        await writer.write(new TextEncoder().encode('data: [DONE]\n\n'))
      } catch (error) {
        console.error('Stream error:', error)
        await writer.write(new TextEncoder().encode(`data: ${JSON.stringify({ error: error.message })}\n\n`))
      } finally {
        await writer.close()
      }
    })()

    return new Response(readable, {
      headers: {
        ...corsHeaders(),
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      }
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: {
        ...corsHeaders(),
        'Content-Type': 'application/json'
      }
    })
  }
}

/**
 * 获取/更新 AI 配置
 */
async function handleConfigRequest(request, env) {
  if (request.method === 'GET') {
    // 获取配置（不返回 apiKey）
    let config = DEFAULT_CONFIG
    if (env.CONFIG_KV) {
      const savedConfig = await env.CONFIG_KV.get('ai_config', 'json')
      if (savedConfig) {
        config = { ...DEFAULT_CONFIG, ...savedConfig }
      }
    }
    
    return new Response(JSON.stringify({
      apiUrl: config.apiUrl,
      model: config.model,
      hasApiKey: !!config.apiKey
    }), {
      headers: {
        ...corsHeaders(),
        'Content-Type': 'application/json'
      }
    })
  }

  if (request.method === 'POST') {
    // 更新配置（需要管理员权限）
    const { apiUrl, apiKey, model } = await request.json()
    
    if (!env.CONFIG_KV) {
      return new Response(JSON.stringify({ error: 'KV storage not configured' }), {
        status: 500,
        headers: {
          ...corsHeaders(),
          'Content-Type': 'application/json'
        }
      })
    }

    const newConfig = {
      apiUrl: apiUrl || DEFAULT_CONFIG.apiUrl,
      apiKey: apiKey || DEFAULT_CONFIG.apiKey,
      model: model || DEFAULT_CONFIG.model
    }

    await env.CONFIG_KV.put('ai_config', JSON.stringify(newConfig))

    return new Response(JSON.stringify({ success: true }), {
      headers: {
        ...corsHeaders(),
        'Content-Type': 'application/json'
      }
    })
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url)

    // CORS 预检
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders() })
    }

    // 路由
    if (url.pathname === '/api/ai/chat') {
      return handleChatRequest(request, env)
    }

    if (url.pathname === '/api/ai/config') {
      return handleConfigRequest(request, env)
    }

    return new Response('Not Found', { status: 404 })
  }
}
