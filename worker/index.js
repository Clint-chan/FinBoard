// Cloudflare Worker - Market Board 配置同步 API (带登录功能)

// 管理员账号列表
const ADMIN_USERS = ['cdg']

// 默认 AI 配额（每日）
const DEFAULT_AI_QUOTA = 3

export default {
  async fetch(request, env) {
    // CORS 处理
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders() });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    try {
      // POST /api/register - 注册
      if (path === '/api/register' && request.method === 'POST') {
        const { username, password } = await request.json();
        
        if (!username || !password) {
          return jsonResponse({ error: '用户名和密码不能为空' }, 400);
        }
        if (username.length < 3 || username.length > 20) {
          return jsonResponse({ error: '用户名长度 3-20 字符' }, 400);
        }
        if (password.length < 6) {
          return jsonResponse({ error: '密码至少 6 位' }, 400);
        }

        // 检查用户名是否已存在
        const existing = await env.CONFIG_KV.get(`user:${username}`);
        if (existing) {
          return jsonResponse({ error: '用户名已存在' }, 400);
        }

        // 哈希密码
        const passwordHash = await hashPassword(password);
        
        // 保存用户（包含 AI 配额信息）
        await env.CONFIG_KV.put(`user:${username}`, JSON.stringify({
          passwordHash,
          createdAt: Date.now(),
          aiQuota: DEFAULT_AI_QUOTA, // 每日 AI 配额
          aiUsedToday: 0,
          aiUsedDate: getTodayStr()
        }));

        return jsonResponse({ success: true, message: '注册成功' });
      }

      // POST /api/login - 登录
      if (path === '/api/login' && request.method === 'POST') {
        const { username, password } = await request.json();
        
        if (!username || !password) {
          return jsonResponse({ error: '用户名和密码不能为空' }, 400);
        }

        const userData = await env.CONFIG_KV.get(`user:${username}`, 'json');
        if (!userData) {
          return jsonResponse({ error: '用户名或密码错误' }, 401);
        }

        // 验证密码
        const valid = await verifyPassword(password, userData.passwordHash);
        if (!valid) {
          return jsonResponse({ error: '用户名或密码错误' }, 401);
        }

        // 生成 token
        const token = await generateToken(username);
        
        return jsonResponse({ success: true, token, username });
      }

      // GET /api/config - 获取配置 (需要 token)
      if (path === '/api/config' && request.method === 'GET') {
        const username = await verifyToken(request, env);
        if (!username) {
          return jsonResponse({ error: '未登录' }, 401);
        }

        const config = await env.CONFIG_KV.get(`config:${username}`, 'json');
        return jsonResponse({ config: config || null });
      }

      // POST /api/config - 保存配置 (需要 token)
      if (path === '/api/config' && request.method === 'POST') {
        const username = await verifyToken(request, env);
        if (!username) {
          return jsonResponse({ error: '未登录' }, 401);
        }

        const { config } = await request.json();
        if (!config) {
          return jsonResponse({ error: '配置不能为空' }, 400);
        }

        await env.CONFIG_KV.put(`config:${username}`, JSON.stringify(config));
        return jsonResponse({ success: true });
      }

      // GET /api/stock/comments/:code - 获取股吧评论（代理百度接口）
      if (path.startsWith('/api/stock/comments/') && request.method === 'GET') {
        const code = path.split('/').pop();
        if (!code) {
          return jsonResponse({ error: '股票代码不能为空' }, 400);
        }

        try {
          // 调用百度股市通接口
          const baiduUrl = `https://finance.pae.baidu.com/api/stockwidget?code=${code}&market=ab&type=stock&widgetType=talks&finClientType=pc`;
          const baiduResponse = await fetch(baiduUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
              'Referer': 'https://finance.baidu.com/'
            }
          });

          if (!baiduResponse.ok) {
            return jsonResponse({ error: '获取数据失败' }, 500);
          }

          const data = await baiduResponse.json();
          
          if (data.ResultCode !== '0' || !data.Result?.content?.list) {
            return jsonResponse({ comments: [] });
          }

          // 格式化数据
          const comments = data.Result.content.list.map(item => {
            // 提取文本内容
            let content = '';
            if (item.content?.items) {
              content = item.content.items
                .filter(i => i.type === 'text')
                .map(i => i.data)
                .join('');
            }

            return {
              id: item.comment_id || item.reply_id || '',
              content: content.trim(),
              author: {
                name: item.author?.name || '匿名用户',
                avatar: item.author?.image?.src || ''
              },
              source: item.provider || '股吧',
              createTime: item.create_show_time || item.publish_time || '',
              likeCount: parseInt(item.like_count || '0'),
              replyCount: parseInt(item.reply_count || '0'),
              url: item.loc || item.third_url || item.real_loc || ''
            };
          }).filter(c => c.content.length > 0);

          return jsonResponse({ comments });
        } catch (err) {
          console.error('Failed to fetch comments:', err);
          return jsonResponse({ error: '获取评论失败', comments: [] }, 500);
        }
      }

      // POST /api/ai/chat - AI 聊天
      if (path === '/api/ai/chat' && request.method === 'POST') {
        return handleAIChat(request, env);
      }

      // GET/POST /api/ai/config - AI 配置
      if (path === '/api/ai/config') {
        return handleAIConfig(request, env);
      }

      // GET /api/user/quota - 获取用户 AI 配额
      if (path === '/api/user/quota' && request.method === 'GET') {
        const username = await verifyToken(request, env);
        if (!username) {
          return jsonResponse({ error: '未登录' }, 401);
        }

        const userData = await env.CONFIG_KV.get(`user:${username}`, 'json');
        if (!userData) {
          return jsonResponse({ error: '用户不存在' }, 404);
        }

        // 检查是否需要重置每日配额
        const today = getTodayStr();
        let aiUsedToday = userData.aiUsedToday || 0;
        if (userData.aiUsedDate !== today) {
          aiUsedToday = 0;
        }

        const quota = userData.aiQuota || DEFAULT_AI_QUOTA;
        const isAdmin = ADMIN_USERS.includes(username);

        return jsonResponse({
          quota,
          used: aiUsedToday,
          remaining: Math.max(0, quota - aiUsedToday),
          isAdmin
        });
      }

      // GET /api/admin/users - 管理员获取用户列表
      if (path === '/api/admin/users' && request.method === 'GET') {
        const username = await verifyToken(request, env);
        if (!username) {
          return jsonResponse({ error: '未登录' }, 401);
        }

        // 检查是否是管理员
        if (!ADMIN_USERS.includes(username)) {
          return jsonResponse({ error: '无权限' }, 403);
        }

        // 获取所有用户（通过 list 前缀）
        const userList = await env.CONFIG_KV.list({ prefix: 'user:' });
        const users = [];
        const today = getTodayStr();

        for (const key of userList.keys) {
          const userData = await env.CONFIG_KV.get(key.name, 'json');
          if (userData) {
            const uname = key.name.replace('user:', '');
            let aiUsedToday = userData.aiUsedToday || 0;
            if (userData.aiUsedDate !== today) {
              aiUsedToday = 0;
            }
            users.push({
              username: uname,
              createdAt: userData.createdAt,
              aiQuota: userData.aiQuota || DEFAULT_AI_QUOTA,
              aiUsedToday
            });
          }
        }

        return jsonResponse({ users });
      }

      // POST /api/admin/user/quota - 管理员设置用户配额
      if (path === '/api/admin/user/quota' && request.method === 'POST') {
        const adminUsername = await verifyToken(request, env);
        if (!adminUsername) {
          return jsonResponse({ error: '未登录' }, 401);
        }

        // 检查是否是管理员
        if (!ADMIN_USERS.includes(adminUsername)) {
          return jsonResponse({ error: '无权限' }, 403);
        }

        const { username, quota } = await request.json();
        if (!username || typeof quota !== 'number') {
          return jsonResponse({ error: '参数错误' }, 400);
        }

        const userData = await env.CONFIG_KV.get(`user:${username}`, 'json');
        if (!userData) {
          return jsonResponse({ error: '用户不存在' }, 404);
        }

        // 更新配额
        userData.aiQuota = quota;
        await env.CONFIG_KV.put(`user:${username}`, JSON.stringify(userData));

        return jsonResponse({ success: true });
      }

      // DELETE /api/alerts/:code - 删除预警（通过配置接口实现）
      // 注：实际删除通过 POST /api/config 更新配置实现

      // GET /api/stock/data/:code - 获取股票数据（供前端 AI 使用）
      if (path.startsWith('/api/stock/data/') && request.method === 'GET') {
        const code = path.split('/').pop();
        if (!code) {
          return jsonResponse({ error: '股票代码不能为空' }, 400);
        }
        try {
          // 清理股票代码（移除 sh/sz 前缀）
          const cleanCode = code.replace(/^(sh|sz)/i, '');
          const dataContext = await collectStockData(cleanCode);
          return jsonResponse({ code: cleanCode, context: dataContext });
        } catch (error) {
          console.error('股票数据采集错误:', error);
          return jsonResponse({ error: error.message, code }, 500);
        }
      }

      return jsonResponse({ error: 'Not found' }, 404);
    } catch (err) {
      return jsonResponse({ error: err.message }, 500);
    }
  }
};

// 密码哈希
async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + 'market_board_salt_2024');
  const hash = await crypto.subtle.digest('SHA-256', data);
  return btoa(String.fromCharCode(...new Uint8Array(hash)));
}

// 验证密码
async function verifyPassword(password, hash) {
  const newHash = await hashPassword(password);
  return newHash === hash;
}

// 生成 token (简单实现，用 username + 时间戳 + 签名)
async function generateToken(username) {
  const payload = { username, exp: Date.now() + 30 * 24 * 60 * 60 * 1000 }; // 30天过期
  const data = JSON.stringify(payload);
  const encoder = new TextEncoder();
  const signature = await crypto.subtle.digest('SHA-256', encoder.encode(data + 'token_secret_2024'));
  const sig = btoa(String.fromCharCode(...new Uint8Array(signature))).slice(0, 16);
  return btoa(data) + '.' + sig;
}

// 验证 token
async function verifyToken(request, env) {
  const auth = request.headers.get('Authorization');
  if (!auth || !auth.startsWith('Bearer ')) return null;
  
  const token = auth.slice(7);
  const [payloadB64, sig] = token.split('.');
  if (!payloadB64 || !sig) return null;
  
  try {
    const data = atob(payloadB64);
    const payload = JSON.parse(data);
    
    // 检查过期
    if (payload.exp < Date.now()) return null;
    
    // 验证签名
    const encoder = new TextEncoder();
    const expectedSig = await crypto.subtle.digest('SHA-256', encoder.encode(data + 'token_secret_2024'));
    const expectedSigStr = btoa(String.fromCharCode(...new Uint8Array(expectedSig))).slice(0, 16);
    
    if (sig !== expectedSigStr) return null;
    
    return payload.username;
  } catch {
    return null;
  }
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  };
}

// 获取今天的日期字符串 YYYY-MM-DD
function getTodayStr() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders()
    }
  });
}

// ============ AI Chat 功能 ============

const AI_DEFAULT_CONFIG = {
  apiUrl: 'https://api.newestgpt.com/v1/chat/completions',
  apiKey: 'zxc123',
  model: 'gemini-3-pro-preview-thinking'
}

/**
 * 构建系统提示词（根据模式路由）
 */
function buildSystemPrompt(mode, stockData) {
  const stockInfo = stockData ? `当前分析标的：${stockData.name || ''}(${stockData.code})` : ''
  
  if (mode === 'intraday') {
    return `你是专业的A股短线交易分析师，专注日内做T策略。

## 你的核心能力
- 多周期K线分析（日线定方向，60分钟看波段，15分钟找进出点）
- 量价配合判断（放量上涨、缩量回调、放量下跌的含义）
- 技术指标应用（KDJ/RSI超买超卖，MACD背离，均线支撑压力）
- 给出具体的买卖点位、止损止盈和仓位建议

## 回复要求
1. 先进行技术分析，给出核心研判
2. 给出具体的操作策略和点位
3. 在回复的最后，必须输出结构化的交易信号数据

## 结构化输出格式
在你的分析回复结束后，必须添加以下格式的交易信号（用于前端渲染交易卡片）：

<trading_signals>
{
  "code": "股票代码",
  "name": "股票名称", 
  "signals": [
    {"type": "buy", "price": 低吸价格, "label": "低吸点", "action": "below", "reason": "简短理由"},
    {"type": "sell", "price": 高抛价格, "label": "高抛点", "action": "above", "reason": "简短理由"},
    {"type": "stop", "price": 止损价格, "label": "止损点", "action": "below", "reason": "简短理由"}
  ]
}
</trading_signals>

注意：
- type: "buy"=低吸, "sell"=高抛, "stop"=止损
- action: "above"=突破时触发, "below"=跌破时触发
- price: 必须是数字，精确到小数点后两位
- reason: 简短说明，不超过20字
- 必须包含至少一个 buy 和一个 stop 信号

${stockInfo}`
  }
  
  if (mode === 'trend') {
    return `你是专业的A股中期趋势分析师，专注波段操作策略。
基于周线、日线趋势，结合成交量和技术指标，给出中期趋势判断和波段操作建议。
${stockInfo}`
  }
  
  if (mode === 'fundamental') {
    return `你是专业的A股基本面分析师。
基于财务数据、行业地位、估值水平，给出基本面分析和投资价值判断。
${stockInfo}`
  }
  
  return ''
}

async function fetchRealtimeData(symbol) {
  // 使用单股票查询接口
  const marketCode = symbol.startsWith('6') ? 1 : 0
  const url = 'https://push2.eastmoney.com/api/qt/stock/get'
  const params = new URLSearchParams({
    ut: 'fa5fd1943c7b386f172d6893dbfba10b',
    invt: '2',
    fltt: '2',
    fields: 'f43,f57,f58,f169,f170,f46,f44,f51,f168,f47,f164,f163,f116,f60,f45,f52,f50,f48,f167,f117,f71,f161,f49,f530,f135,f136,f137,f138,f139,f141,f142,f144,f145,f147,f148,f140,f143,f146,f149,f55,f62,f162,f92,f173,f104,f105,f84,f85,f183,f184,f185,f186,f187,f188,f189,f190,f191,f192,f107,f111,f86,f177,f78,f110,f262,f263,f264,f267,f268,f250,f251,f252,f253,f254,f255,f256,f257,f258,f266,f269,f270,f271,f273,f274,f275,f127,f199,f128,f198,f259,f260,f261,f171,f277,f278,f279,f288,f152,f250,f251,f252,f253,f254,f255,f256,f257,f258',
    secid: `${marketCode}.${symbol}`
  })

  const response = await fetch(`${url}?${params}`)
  const data = await response.json()
  
  if (!data.data) throw new Error(`未找到股票 ${symbol}`)
  
  const stock = data.data
  return {
    name: stock.f58, 
    price: stock.f43, 
    change_pct: stock.f170, 
    change_amount: stock.f169,
    high: stock.f44, 
    low: stock.f45, 
    open: stock.f46, 
    pre_close: stock.f60,
    amplitude: stock.f171, 
    turnover_rate: stock.f168, 
    volume_ratio: stock.f50
  }
}

async function fetchKlineData(symbol, limit = 30) {
  const marketCode = symbol.startsWith('6') ? 1 : 0
  const url = 'https://push2his.eastmoney.com/api/qt/stock/kline/get'
  const params = new URLSearchParams({
    fields1: 'f1,f2,f3,f4,f5,f6',
    fields2: 'f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61',
    ut: '7eea3edcaed734bea9cbfc24409ed989',
    klt: '101', fqt: '1',
    secid: `${marketCode}.${symbol}`,
    beg: '0', end: '20500101', lmt: limit.toString()
  })

  const response = await fetch(`${url}?${params}`)
  const data = await response.json()
  if (!data.data?.klines) throw new Error('获取K线失败')

  return data.data.klines.map(line => {
    const [date, open, close, high, low, volume] = line.split(',')
    return { date, open: parseFloat(open), close: parseFloat(close), 
             high: parseFloat(high), low: parseFloat(low), volume: parseFloat(volume) }
  })
}

function calculateIndicators(klines) {
  const closes = klines.map(k => k.close)
  const ma5 = closes.slice(-5).reduce((a, b) => a + b) / 5
  const ma10 = closes.slice(-10).reduce((a, b) => a + b) / 10
  const ma20 = closes.slice(-20).reduce((a, b) => a + b) / 20
  
  let ema12 = closes[0], ema26 = closes[0], dif = []
  closes.forEach(c => {
    ema12 = (c * 2 + ema12 * 11) / 13
    ema26 = (c * 2 + ema26 * 25) / 27
    dif.push(ema12 - ema26)
  })
  
  let dea = dif[0], deaArr = [], macd = []
  dif.forEach(d => {
    dea = (d * 2 + dea * 8) / 10
    deaArr.push(dea)
    macd.push((d - dea) * 2)
  })
  
  const calcRSI = (period) => {
    let gains = 0, losses = 0
    for (let i = closes.length - period; i < closes.length; i++) {
      const change = closes[i] - closes[i - 1]
      if (change > 0) gains += change
      else losses += Math.abs(change)
    }
    const rs = gains / losses
    return 100 - (100 / (1 + rs))
  }
  
  return {
    ma: { ma5, ma10, ma20 },
    macd: { dif: dif[dif.length - 1], dea: deaArr[deaArr.length - 1], 
            macd: macd[macd.length - 1], prevMacd: macd[macd.length - 2] || 0 },
    rsi: { rsi6: calcRSI(6), rsi12: calcRSI(12) }
  }
}

async function collectStockData(symbol) {
  const rt = await fetchRealtimeData(symbol)
  const klines = await fetchKlineData(symbol, 30)
  const ind = calculateIndicators(klines)
  const price = rt.price
  const recent3 = klines.slice(-3)
  
  let text = `## 1. 当前状态
股票：${rt.name} (${symbol})
现价：${price} 元，涨跌幅：${rt.change_pct >= 0 ? '+' : ''}${rt.change_pct.toFixed(2)}%
今日高低：${rt.high} / ${rt.low} 元
当前位置：${price === rt.high ? '日内高点' : price === rt.low ? '日内低点' : '中间'}
振幅：${rt.amplitude.toFixed(2)}%，换手率：${rt.turnover_rate.toFixed(2)}%，量比：${rt.volume_ratio.toFixed(2)}

## 2. 最近3根K线
`
  recent3.forEach((k, i) => {
    const trend = k.close > k.open ? '涨' : '跌'
    const pct = ((k.close - k.open) / k.open * 100).toFixed(2)
    let vol = ''
    if (i > 0) {
      const vc = ((k.volume - recent3[i-1].volume) / recent3[i-1].volume * 100).toFixed(0)
      vol = `, ${vc > 0 ? '放量' : '缩量'}${Math.abs(vc)}%`
    }
    text += `${k.date}: ${trend}${pct}%${vol}\n`
  })
  
  text += `
## 3. 均线
MA5: ${ind.ma.ma5.toFixed(2)} ${price > ind.ma.ma5 ? '站上' : '跌破'}
MA10: ${ind.ma.ma10.toFixed(2)} ${price > ind.ma.ma10 ? '站上' : '跌破'}
MA20: ${ind.ma.ma20.toFixed(2)} ${price > ind.ma.ma20 ? '站上' : '跌破'}
压力：${Math.max(ind.ma.ma5, ind.ma.ma10, ind.ma.ma20).toFixed(2)}，支撑：${Math.min(ind.ma.ma5, ind.ma.ma10, ind.ma.ma20).toFixed(2)}

## 4. MACD
${ind.macd.macd > 0 ? '红柱' : '绿柱'}${ind.macd.macd > ind.macd.prevMacd ? '变长' : '变短'}
DIF: ${ind.macd.dif.toFixed(4)}, DEA: ${ind.macd.dea.toFixed(4)}

## 5. RSI
RSI(6): ${ind.rsi.rsi6.toFixed(2)}${ind.rsi.rsi6 > 80 ? ' 超买' : ind.rsi.rsi6 < 20 ? ' 超卖' : ''}
RSI(12): ${ind.rsi.rsi12.toFixed(2)}${ind.rsi.rsi12 > 80 ? ' 超买' : ind.rsi.rsi12 < 20 ? ' 超卖' : ''}

## 6. 关键点位
前高：${Math.max(...recent3.map(k => k.high)).toFixed(2)}，前低：${Math.min(...recent3.map(k => k.low)).toFixed(2)}
`
  return text
}

async function handleAIChat(request, env) {
  // 在 try 外部定义 config，确保 catch 块可以访问
  let config = AI_DEFAULT_CONFIG
  
  try {
    const { messages, stockData, mode = 'intraday', token } = await request.json()
    
    // 验证用户并检查配额
    let username = null
    if (token) {
      // 手动解析 token
      const [payloadB64, sig] = token.split('.');
      if (payloadB64 && sig) {
        try {
          const data = atob(payloadB64);
          const payload = JSON.parse(data);
          if (payload.exp >= Date.now()) {
            const encoder = new TextEncoder();
            const expectedSig = await crypto.subtle.digest('SHA-256', encoder.encode(data + 'token_secret_2024'));
            const expectedSigStr = btoa(String.fromCharCode(...new Uint8Array(expectedSig))).slice(0, 16);
            if (sig === expectedSigStr) {
              username = payload.username;
            }
          }
        } catch (e) {}
      }
    }
    
    // 如果有用户，检查配额
    if (username && env.CONFIG_KV) {
      const userData = await env.CONFIG_KV.get(`user:${username}`, 'json');
      if (userData) {
        const today = getTodayStr();
        let aiUsedToday = userData.aiUsedToday || 0;
        
        // 如果是新的一天，重置计数
        if (userData.aiUsedDate !== today) {
          aiUsedToday = 0;
        }
        
        const quota = userData.aiQuota || DEFAULT_AI_QUOTA;
        
        // 管理员不受配额限制
        if (!ADMIN_USERS.includes(username) && aiUsedToday >= quota) {
          return jsonResponse({ 
            error: '今日 AI 使用次数已用完',
            quota,
            used: aiUsedToday
          }, 429);
        }
        
        // 扣减配额
        userData.aiUsedToday = aiUsedToday + 1;
        userData.aiUsedDate = today;
        await env.CONFIG_KV.put(`user:${username}`, JSON.stringify(userData));
      }
    }
    
    // 获取配置
    if (env.CONFIG_KV) {
      const saved = await env.CONFIG_KV.get('ai_config', 'json')
      if (saved) config = { ...AI_DEFAULT_CONFIG, ...saved }
    }

    // 构建系统提示词（根据模式路由）
    const systemPrompt = buildSystemPrompt(mode, stockData)

    // 采集股票数据
    let dataContext = ''
    if (stockData?.code) {
      try {
        const cleanCode = stockData.code.replace(/^(sh|sz)/i, '')
        console.log('采集股票数据:', cleanCode)
        dataContext = await collectStockData(cleanCode)
        console.log('数据采集成功，长度:', dataContext.length)
      } catch (error) {
        console.error('数据采集失败:', error)
        dataContext = `数据采集失败: ${error.message}`
      }
    }

    // 构建完整消息
    const fullMessages = [
      { role: 'system', content: systemPrompt }
    ]
    
    // 找到第一条用户消息的索引
    let firstUserMsgIndex = -1
    let hasAddedData = false
    
    messages.forEach((msg, idx) => {
      if (msg.role === 'user' && firstUserMsgIndex === -1) {
        firstUserMsgIndex = idx
      }
      
      if (msg.role === 'assistant') {
        // assistant 消息保持不变
        fullMessages.push({ role: 'assistant', content: msg.content })
      } else if (msg.role === 'user') {
        // 如果是第一条用户消息且有股票数据，附加数据
        if (idx === firstUserMsgIndex && dataContext && !hasAddedData) {
          fullMessages.push({
            role: 'user',
            content: `${dataContext}\n\n用户问题：${msg.content}`
          })
          hasAddedData = true
        } else {
          // 其他用户消息保持不变
          fullMessages.push({ role: 'user', content: msg.content })
        }
      }
    })
    
    console.log('构建的消息数量:', fullMessages.length)
    console.log('是否附加了股票数据:', hasAddedData)

    // 调用大模型 API
    const llmRes = await fetch(config.apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: config.model,
        messages: fullMessages,
        stream: true
      })
    })

    if (!llmRes.ok) {
      const errorText = await llmRes.text()
      throw new Error(`LLM API error: ${llmRes.status} - ${errorText}`)
    }

    // 直接转发流式响应
    const { readable, writable } = new TransformStream()
    const writer = writable.getWriter()
    const reader = llmRes.body.getReader()
    const decoder = new TextDecoder()
    
    ;(async () => {
      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          const chunk = decoder.decode(value, { stream: true })
          chunk.split('\n').filter(l => l.trim()).forEach(line => {
            if (line.startsWith('data: ')) {
              const data = line.slice(6)
              if (data === '[DONE]') return
              try {
                const json = JSON.parse(data)
                const content = json.choices?.[0]?.delta?.content
                if (content) {
                  // 直接转发内容，不做任何处理
                  writer.write(new TextEncoder().encode(`data: ${JSON.stringify({ content })}\n\n`))
                }
              } catch (e) {}
            }
          })
        }
        writer.write(new TextEncoder().encode('data: [DONE]\n\n'))
      } catch (error) {
        writer.write(new TextEncoder().encode(`data: ${JSON.stringify({ error: error.message })}\n\n`))
      } finally {
        writer.close()
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
    console.error('AI Chat Error:', error)
    
    // 如果是 405 错误，可能是 Worker 无法访问 HTTP 端点
    if (error.message.includes('405')) {
      return jsonResponse({ 
        error: '大模型 API 访问失败 (405)。可能原因：1) Worker 无法访问 HTTP 端点，需要使用 HTTPS；2) API 端点配置错误。',
        details: error.message,
        suggestion: '请检查 AI 配置中的 API URL 是否支持 HTTPS，或联系管理员配置 Worker 网络权限。'
      }, 500)
    }
    
    return jsonResponse({ 
      error: error.message, 
      stack: error.stack,
      config: {
        apiUrl: config.apiUrl,
        model: config.model
      }
    }, 500)
  }
}

async function handleAIConfig(request, env) {
  if (request.method === 'GET') {
    // 只返回模型信息，不泄露 API 地址和密钥
    let config = AI_DEFAULT_CONFIG
    if (env.CONFIG_KV) {
      const saved = await env.CONFIG_KV.get('ai_config', 'json')
      if (saved) config = { ...AI_DEFAULT_CONFIG, ...saved }
    }
    return jsonResponse({ 
      model: config.model,
      hasApiKey: !!config.apiKey,
      status: 'configured'
    })
  }

  if (request.method === 'POST') {
    // 管理员更新配置（需要验证权限）
    const { apiUrl, apiKey, model } = await request.json()
    if (!env.CONFIG_KV) return jsonResponse({ error: 'KV not configured' }, 500)
    
    await env.CONFIG_KV.put('ai_config', JSON.stringify({
      apiUrl: apiUrl || AI_DEFAULT_CONFIG.apiUrl,
      apiKey: apiKey || AI_DEFAULT_CONFIG.apiKey,
      model: model || AI_DEFAULT_CONFIG.model
    }))
    
    return jsonResponse({ success: true })
  }

  return jsonResponse({ error: 'Method not allowed' }, 405)
}
