// Cloudflare Worker - Market Board 配置同步 API (带登录功能)
// 支持 KV（配置存储）和 D1（用户管理、AI 统计）

// ============ 价格格式化辅助函数 ============

/**
 * 判断是否为 ETF（上海51开头，深圳15/16开头）
 */
function isETF(symbol) {
  if (symbol.startsWith('51')) return true  // 上海 ETF
  if (symbol.startsWith('15') || symbol.startsWith('16')) return true  // 深圳 ETF
  return false
}

/**
 * 格式化价格（ETF 3位小数，其他2位）
 */
function fmtPrice(price, symbol) {
  if (price == null || isNaN(price)) return '--'
  const digits = isETF(symbol) ? 3 : 2
  return price.toFixed(digits)
}

// 管理员账号列表
const ADMIN_USERS = ['cdg']

// 默认 AI 配额（每日）
const DEFAULT_AI_QUOTA = 3

// ============ D1 数据库操作 ============

/**
 * 初始化数据库表（如果不存在）
 */
async function initDB(db) {
  // 分开执行，避免 db.exec 多语句问题
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      ai_quota INTEGER DEFAULT 3,
      register_ip TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `).run()

  await db.prepare(`
    CREATE TABLE IF NOT EXISTS ai_usage (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      mode TEXT NOT NULL,
      stock_code TEXT,
      stock_name TEXT,
      used_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `).run()

  await db.prepare(`
    CREATE TABLE IF NOT EXISTS daily_reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      report_date TEXT UNIQUE NOT NULL,
      content TEXT NOT NULL,
      news_count INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `).run()

  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_ai_usage_user_date ON ai_usage(user_id, used_at)`).run()
  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_users_register_ip ON users(register_ip)`).run()
  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_daily_reports_date ON daily_reports(report_date DESC)`).run()
}

/**
 * 从 D1 获取用户
 */
async function getUserFromDB(db, username) {
  const result = await db.prepare('SELECT * FROM users WHERE username = ?').bind(username).first()
  return result
}

/**
 * 创建用户到 D1
 */
async function createUserInDB(db, username, passwordHash, registerIp) {
  const result = await db.prepare(
    'INSERT INTO users (username, password_hash, ai_quota, register_ip) VALUES (?, ?, ?, ?)'
  ).bind(username, passwordHash, DEFAULT_AI_QUOTA, registerIp).run()
  return result.meta.last_row_id
}

/**
 * 检查 IP 是否已注册过
 */
async function checkIPRegistered(db, ip) {
  const result = await db.prepare(
    'SELECT COUNT(*) as count FROM users WHERE register_ip = ?'
  ).bind(ip).first()
  return (result?.count || 0) > 0
}

/**
 * 获取用户今日 AI 使用次数（北京时间）
 */
async function getTodayUsageFromDB(db, userId) {
  const beijingDate = getBeijingDateStr();
  const result = await db.prepare(`
    SELECT COUNT(*) as count FROM ai_usage 
    WHERE user_id = ? AND date(used_at, '+8 hours') = ?
  `).bind(userId, beijingDate).first()
  return result?.count || 0
}

/**
 * 记录 AI 使用
 */
async function recordAIUsage(db, userId, mode, stockCode, stockName) {
  await db.prepare(
    'INSERT INTO ai_usage (user_id, mode, stock_code, stock_name) VALUES (?, ?, ?, ?)'
  ).bind(userId, mode, stockCode || null, stockName || null).run()
}

/**
 * 获取所有用户（管理员用，北京时间统计）
 */
async function getAllUsersFromDB(db) {
  const beijingDate = getBeijingDateStr();
  const users = await db.prepare(`
    SELECT 
      u.id,
      u.username,
      u.ai_quota,
      u.register_ip,
      u.created_at,
      (SELECT COUNT(*) FROM ai_usage WHERE user_id = u.id AND date(used_at, '+8 hours') = ?) as ai_used_today
    FROM users u
    ORDER BY u.created_at DESC
  `).bind(beijingDate).all()
  return users.results || []
}

/**
 * 更新用户配额
 */
async function updateUserQuotaInDB(db, username, quota) {
  await db.prepare('UPDATE users SET ai_quota = ?, updated_at = CURRENT_TIMESTAMP WHERE username = ?')
    .bind(quota, username).run()
}

export default {
  async fetch(request, env) {
    // CORS 处理
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders() });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    try {
      // POST /api/register - 注册（优先 D1，回退 KV）
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

        // 获取客户端 IP
        const clientIP = request.headers.get('CF-Connecting-IP') || 
                        request.headers.get('X-Forwarded-For')?.split(',')[0] || 
                        'unknown';

        const passwordHash = await hashPassword(password);

        // 优先使用 D1
        if (env.DB) {
          try {
            await initDB(env.DB);
            
            // 检查用户名是否存在
            const existing = await getUserFromDB(env.DB, username);
            if (existing) {
              return jsonResponse({ error: '用户名已存在' }, 400);
            }
            
            // 检查 IP 是否已注册过
            const ipRegistered = await checkIPRegistered(env.DB, clientIP);
            if (ipRegistered) {
              return jsonResponse({ error: '该 IP 已注册过账号' }, 400);
            }
            
            await createUserInDB(env.DB, username, passwordHash, clientIP);
            return jsonResponse({ success: true, message: '注册成功' });
          } catch (e) {
            console.error('D1 register error:', e);
            // 回退到 KV
          }
        }

        // KV 回退
        const existing = await env.CONFIG_KV.get(`user:${username}`);
        if (existing) {
          return jsonResponse({ error: '用户名已存在' }, 400);
        }
        
        // KV 中也检查 IP（简单实现）
        const ipKey = `ip:${clientIP}`;
        const ipExists = await env.CONFIG_KV.get(ipKey);
        if (ipExists) {
          return jsonResponse({ error: '该 IP 已注册过账号' }, 400);
        }
        
        await env.CONFIG_KV.put(`user:${username}`, JSON.stringify({
          passwordHash,
          registerIp: clientIP,
          createdAt: Date.now(),
          aiQuota: DEFAULT_AI_QUOTA,
          aiUsedToday: 0,
          aiUsedDate: getTodayStr()
        }));
        
        // 记录 IP
        await env.CONFIG_KV.put(ipKey, username);

        return jsonResponse({ success: true, message: '注册成功' });
      }

      // POST /api/login - 登录（优先 D1，回退 KV）
      if (path === '/api/login' && request.method === 'POST') {
        const { username, password } = await request.json();
        
        if (!username || !password) {
          return jsonResponse({ error: '用户名和密码不能为空' }, 400);
        }

        let userData = null;
        let fromD1 = false;

        // 优先从 D1 查询
        if (env.DB) {
          try {
            userData = await getUserFromDB(env.DB, username);
            if (userData) {
              fromD1 = true;
              userData = { passwordHash: userData.password_hash };
            }
          } catch (e) {
            console.error('D1 login error:', e);
          }
        }

        // 回退到 KV
        if (!userData) {
          userData = await env.CONFIG_KV.get(`user:${username}`, 'json');
        }

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

      // POST /api/change-password - 修改密码 (需要 token)
      if (path === '/api/change-password' && request.method === 'POST') {
        const username = await verifyToken(request, env);
        if (!username) {
          return jsonResponse({ error: '未登录' }, 401);
        }

        const { oldPassword, newPassword } = await request.json();
        
        if (!oldPassword || !newPassword) {
          return jsonResponse({ error: '旧密码和新密码不能为空' }, 400);
        }

        if (newPassword.length < 6) {
          return jsonResponse({ error: '新密码至少 6 位' }, 400);
        }

        let userData = null;
        let fromD1 = false;

        // 优先从 D1 查询
        if (env.DB) {
          try {
            userData = await getUserFromDB(env.DB, username);
            if (userData) {
              fromD1 = true;
            }
          } catch (e) {
            console.error('D1 change password error:', e);
          }
        }

        // 回退到 KV
        if (!userData) {
          userData = await env.CONFIG_KV.get(`user:${username}`, 'json');
        }

        if (!userData) {
          return jsonResponse({ error: '用户不存在' }, 404);
        }

        // 验证旧密码
        const passwordHash = fromD1 ? userData.password_hash : userData.passwordHash;
        const valid = await verifyPassword(oldPassword, passwordHash);
        if (!valid) {
          return jsonResponse({ error: '旧密码错误' }, 401);
        }

        // 生成新密码哈希
        const newPasswordHash = await hashPassword(newPassword);

        // 更新密码
        if (fromD1 && env.DB) {
          try {
            await env.DB.prepare('UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE username = ?')
              .bind(newPasswordHash, username)
              .run();
          } catch (e) {
            console.error('D1 update password error:', e);
            return jsonResponse({ error: '修改密码失败' }, 500);
          }
        } else {
          // 更新 KV
          userData.passwordHash = newPasswordHash;
          await env.CONFIG_KV.put(`user:${username}`, JSON.stringify(userData));
        }

        return jsonResponse({ success: true, message: '密码修改成功' });
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

      // GET /api/user/quota - 获取用户 AI 配额（优先 D1）
      if (path === '/api/user/quota' && request.method === 'GET') {
        const username = await verifyToken(request, env);
        if (!username) {
          return jsonResponse({ error: '未登录' }, 401);
        }

        const isAdmin = ADMIN_USERS.includes(username);
        let quota = DEFAULT_AI_QUOTA;
        let aiUsedToday = 0;

        // 优先从 D1 查询
        if (env.DB) {
          try {
            const user = await getUserFromDB(env.DB, username);
            if (user) {
              quota = user.ai_quota || DEFAULT_AI_QUOTA;
              aiUsedToday = await getTodayUsageFromDB(env.DB, user.id);
              return jsonResponse({
                quota,
                used: aiUsedToday,
                remaining: Math.max(0, quota - aiUsedToday),
                isAdmin
              });
            }
          } catch (e) {
            console.error('D1 quota error:', e);
          }
        }

        // 回退到 KV
        const userData = await env.CONFIG_KV.get(`user:${username}`, 'json');
        if (!userData) {
          return jsonResponse({ error: '用户不存在' }, 404);
        }

        const today = getTodayStr();
        aiUsedToday = userData.aiUsedToday || 0;
        if (userData.aiUsedDate !== today) {
          aiUsedToday = 0;
        }
        quota = userData.aiQuota || DEFAULT_AI_QUOTA;

        return jsonResponse({
          quota,
          used: aiUsedToday,
          remaining: Math.max(0, quota - aiUsedToday)
        });
      }

      // GET /api/admin/users - 管理员获取用户列表（优先 D1）
      if (path === '/api/admin/users' && request.method === 'GET') {
        const username = await verifyToken(request, env);
        if (!username) {
          return jsonResponse({ error: '未登录' }, 401);
        }

        // 检查是否是管理员
        if (!ADMIN_USERS.includes(username)) {
          return jsonResponse({ error: '无权限' }, 403);
        }

        // 优先从 D1 查询
        if (env.DB) {
          try {
            await initDB(env.DB);
            const dbUsers = await getAllUsersFromDB(env.DB);
            const users = dbUsers.map(u => ({
              username: u.username,
              createdAt: new Date(u.created_at).getTime(),
              aiQuota: u.ai_quota || DEFAULT_AI_QUOTA,
              aiUsedToday: u.ai_used_today || 0
            }));
            return jsonResponse({ users, source: 'd1' });
          } catch (e) {
            console.error('D1 admin users error:', e);
          }
        }

        // 回退到 KV
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

      // POST /api/admin/user/quota - 管理员设置用户配额（优先 D1）
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

        // 优先更新 D1
        if (env.DB) {
          try {
            const user = await getUserFromDB(env.DB, username);
            if (user) {
              await updateUserQuotaInDB(env.DB, username, quota);
              return jsonResponse({ success: true, source: 'd1' });
            }
          } catch (e) {
            console.error('D1 update quota error:', e);
          }
        }

        // 回退到 KV
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

      // ============ Daily Report API ============
      
      // GET /api/daily/list - 获取日报列表
      if (path === '/api/daily/list' && request.method === 'GET') {
        if (!env.DB) {
          return jsonResponse({ error: '数据库未配置' }, 500);
        }
        try {
          await initDB(env.DB);
          const limit = parseInt(url.searchParams.get('limit') || '30');
          const result = await env.DB.prepare(`
            SELECT report_date, news_count, created_at 
            FROM daily_reports 
            ORDER BY report_date DESC 
            LIMIT ?
          `).bind(limit).all();
          return jsonResponse({ reports: result.results || [] });
        } catch (e) {
          return jsonResponse({ error: e.message }, 500);
        }
      }
      
      // GET /api/daily/:date - 获取指定日期的日报
      if (path.startsWith('/api/daily/') && request.method === 'GET') {
        const date = path.split('/').pop();
        if (!date || date === 'list' || date === 'generate') {
          return jsonResponse({ error: '日期格式错误' }, 400);
        }
        if (!env.DB) {
          return jsonResponse({ error: '数据库未配置' }, 500);
        }
        try {
          await initDB(env.DB);
          const result = await env.DB.prepare(`
            SELECT report_date, content, news_count, created_at 
            FROM daily_reports 
            WHERE report_date = ?
          `).bind(date).first();
          
          if (!result) {
            return jsonResponse({ error: '日报不存在' }, 404);
          }
          
          return jsonResponse({
            date: result.report_date,
            content: JSON.parse(result.content),
            newsCount: result.news_count,
            createdAt: result.created_at
          });
        } catch (e) {
          return jsonResponse({ error: e.message }, 500);
        }
      }
      
      // POST /api/daily/generate - 手动生成日报（管理员）
      if (path === '/api/daily/generate' && request.method === 'POST') {
        const username = await verifyToken(request, env);
        if (!username || !ADMIN_USERS.includes(username)) {
          return jsonResponse({ error: '无权限' }, 403);
        }
        
        try {
          const result = await generateDailyReport(env);
          return jsonResponse(result);
        } catch (e) {
          console.error('生成日报失败:', e);
          return jsonResponse({ error: e.message }, 500);
        }
      }

      return jsonResponse({ error: 'Not found' }, 404);
    } catch (err) {
      return jsonResponse({ error: err.message }, 500);
    }
  },
  
  // 定时任务 - 每日北京时间6点生成日报
  async scheduled(event, env, ctx) {
    console.log('Daily report cron triggered:', event.cron, new Date().toISOString());
    ctx.waitUntil(generateDailyReport(env, true)); // isScheduled = true
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

// 获取北京时间今天的日期字符串 YYYY-MM-DD
function getTodayStr() {
  // 使用北京时间 (UTC+8)
  const now = new Date();
  const beijingTime = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  return beijingTime.toISOString().split('T')[0];
}

// 获取北京时间今天的日期（用于 D1 SQL 查询）
function getBeijingDateStr() {
  const now = new Date();
  const beijingTime = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  return beijingTime.toISOString().split('T')[0];
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
  let stockInfo = ''
  let timeInfo = ''
  
  if (stockData) {
    stockInfo = `当前分析标的：${stockData.name || ''}(${stockData.code})`
    
    // 解析时间戳并判断交易状态
    if (stockData.timestamp) {
      try {
        const dataTime = new Date(stockData.timestamp)
        const day = dataTime.getDay()
        const hours = dataTime.getHours()
        const minutes = dataTime.getMinutes()
        const time = hours * 60 + minutes
        
        // 格式化时间显示
        const timeStr = dataTime.toLocaleString('zh-CN', { 
          timeZone: 'Asia/Shanghai',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false
        })
        
        // 判断是否在交易时段
        const isWeekend = day === 0 || day === 6
        const morningStart = 9 * 60 + 30  // 9:30
        const morningEnd = 11 * 60 + 30   // 11:30
        const afternoonStart = 13 * 60     // 13:00
        const afternoonEnd = 15 * 60       // 15:00
        
        const isTrading = !isWeekend && (
          (time >= morningStart && time <= morningEnd) ||
          (time >= afternoonStart && time <= afternoonEnd)
        )
        
        timeInfo = `\n数据时间：${timeStr}\n交易状态：${isTrading ? '交易时段（盘中）' : '非交易时段（盘后/盘前）'}`
      } catch (e) {
        // 时间解析失败，忽略
      }
    }
  }
  
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

${stockInfo}${timeInfo}`
  }
  
  if (mode === 'trend') {
    return `你是专业的A股中期趋势分析师，专注波段操作策略。
基于周线、日线趋势，结合成交量和技术指标，给出中期趋势判断和波段操作建议。
${stockInfo}${timeInfo}`
  }
  
  if (mode === 'fundamental') {
    return `你是专业的A股基本面分析师。
基于财务数据、行业地位、估值水平，给出基本面分析和投资价值判断。
${stockInfo}${timeInfo}`
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

async function fetchKlineData(symbol, period = '101', limit = 30) {
  const marketCode = symbol.startsWith('6') ? 1 : 0
  const url = 'https://push2his.eastmoney.com/api/qt/stock/kline/get'
  const params = new URLSearchParams({
    fields1: 'f1,f2,f3,f4,f5,f6',
    fields2: 'f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61',
    ut: '7eea3edcaed734bea9cbfc24409ed989',
    klt: period, // 支持多周期：'15'=15分钟, '60'=60分钟, '101'=日K
    fqt: '1',
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

// 获取分时数据
async function fetchIntradayData(symbol) {
  const marketCode = symbol.startsWith('6') ? 1 : 0
  const url = 'https://push2.eastmoney.com/api/qt/stock/trends2/get'
  const params = new URLSearchParams({
    fields1: 'f1,f2,f3,f4,f5,f6,f7,f8,f9,f10,f11,f12,f13',
    fields2: 'f51,f52,f53,f54,f55,f56,f57,f58',
    ut: '7eea3edcaed734bea9cbfc24409ed989',
    ndays: '1',
    iscr: '0',
    secid: `${marketCode}.${symbol}`
  })

  const response = await fetch(`${url}?${params}`)
  const data = await response.json()
  if (!data.data?.trends) throw new Error('获取分时数据失败')

  const preClose = data.data.preClose
  const trends = data.data.trends.map(item => {
    const [time, open, close, high, low, volume, amount, avgPrice] = item.split(',')
    return {
      time,
      price: parseFloat(close),
      volume: parseInt(volume),
      avgPrice: parseFloat(avgPrice)
    }
  })

  return { preClose, trends }
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

// 获取资金流向数据
async function fetchFundFlowData(symbol) {
  const marketCode = symbol.startsWith('6') ? 1 : 0
  const url = 'https://push2his.eastmoney.com/api/qt/stock/fflow/daykline/get'
  const params = new URLSearchParams({
    lmt: '5',  // 最近5天
    klt: '101',
    secid: `${marketCode}.${symbol}`,
    fields1: 'f1,f2,f3,f7',
    fields2: 'f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61,f62,f63,f64,f65',
    ut: 'b2884a393a59ad64002292a3e90d46a5',
    _: Date.now()
  })

  const response = await fetch(`${url}?${params}`)
  const data = await response.json()
  if (!data.data?.klines) return null

  const latest = data.data.klines[data.data.klines.length - 1].split(',')
  return {
    date: latest[0],
    mainNetInflow: parseFloat(latest[1]),      // 主力净流入
    mainNetInflowPct: parseFloat(latest[6]),   // 主力净流入占比
    superLargeInflow: parseFloat(latest[5]),   // 超大单净流入
    largeInflow: parseFloat(latest[4]),        // 大单净流入
    mediumInflow: parseFloat(latest[3]),       // 中单净流入
    smallInflow: parseFloat(latest[2])         // 小单净流入
  }
}

async function collectStockData(symbol) {
  // 并行获取所有数据
  const [rt, dailyKlines, klines60, klines15, intraday, fundFlow] = await Promise.all([
    fetchRealtimeData(symbol),
    fetchKlineData(symbol, '101', 30),  // 日K线 30根
    fetchKlineData(symbol, '60', 10),   // 60分钟K线 10根
    fetchKlineData(symbol, '15', 20),   // 15分钟K线 20根
    fetchIntradayData(symbol).catch(() => null), // 分时数据（可能失败）
    fetchFundFlowData(symbol).catch(() => null)  // 资金流向
  ])
  
  // 计算各周期技术指标
  const indDaily = calculateIndicators(dailyKlines)
  const ind60 = calculateIndicators(klines60)
  const ind15 = calculateIndicators(klines15)
  
  const price = rt.price
  const recent3Daily = dailyKlines.slice(-3)
  const recent3_60min = klines60.slice(-3)
  const recent3_15min = klines15.slice(-3)
  
  // 使用 fmtPrice 格式化价格（ETF 3位小数，其他2位）
  const fp = (p) => fmtPrice(p, symbol)
  
  let text = `## 1. 当前状态
股票名称: ${rt.name}
股票代码: ${symbol}
当前价格: ${fp(price)}
涨跌幅: ${rt.change_pct.toFixed(2)}%
涨跌额: ${fp(rt.change_amount)}
今日最高: ${fp(rt.high)}
今日最低: ${fp(rt.low)}
今日开盘: ${fp(rt.open)}
昨日收盘: ${fp(rt.pre_close)}
振幅: ${rt.amplitude.toFixed(2)}%
换手率: ${rt.turnover_rate.toFixed(2)}%
量比: ${rt.volume_ratio.toFixed(2)}

## 2. 日K线数据（最近30根）
日期,开盘,收盘,最高,最低,成交量
`
  dailyKlines.forEach(k => {
    text += `${k.date},${k.open},${k.close},${k.high},${k.low},${k.volume}\n`
  })
  
  text += `
## 3. 60分钟K线数据（最近10根）
时间,开盘,收盘,最高,最低,成交量
`
  klines60.forEach(k => {
    text += `${k.date},${k.open},${k.close},${k.high},${k.low},${k.volume}\n`
  })
  
  text += `
## 4. 15分钟K线数据（最近20根）
时间,开盘,收盘,最高,最低,成交量
`
  klines15.forEach(k => {
    text += `${k.date},${k.open},${k.close},${k.high},${k.low},${k.volume}\n`
  })
  
  // 分时数据分析
  let sectionNum = 5
  if (intraday && intraday.trends.length > 0) {
    const trends = intraday.trends
    const latest = trends[trends.length - 1]
    const morning = trends.filter(t => t.time <= '11:30')
    const afternoon = trends.filter(t => t.time > '13:00')
    
    const morningHigh = morning.length > 0 ? Math.max(...morning.map(t => t.price)) : 0
    const morningLow = morning.length > 0 ? Math.min(...morning.map(t => t.price)) : 0
    const afternoonHigh = afternoon.length > 0 ? Math.max(...afternoon.map(t => t.price)) : 0
    const afternoonLow = afternoon.length > 0 ? Math.min(...afternoon.map(t => t.price)) : 0
    
    text += `
## ${sectionNum}. 分时走势
昨收: ${fp(intraday.preClose)}
当前均价: ${fp(latest.avgPrice)}
上午高点: ${fp(morningHigh)}
上午低点: ${fp(morningLow)}
下午高点: ${fp(afternoonHigh)}
下午低点: ${fp(afternoonLow)}
当前价格: ${fp(price)}
`
    sectionNum++
  }
  
  // 资金流向分析
  if (fundFlow) {
    text += `
## ${sectionNum}. 资金流向（今日）
主力净流入: ${(fundFlow.mainNetInflow / 10000).toFixed(2)}万
主力净流入占比: ${fundFlow.mainNetInflowPct.toFixed(2)}%
超大单净流入: ${(fundFlow.superLargeInflow / 10000).toFixed(2)}万
大单净流入: ${(fundFlow.largeInflow / 10000).toFixed(2)}万
中单净流入: ${(fundFlow.mediumInflow / 10000).toFixed(2)}万
小单净流入: ${(fundFlow.smallInflow / 10000).toFixed(2)}万
`
    sectionNum++
  }
  
  // 成交量分析
  const recent5Daily = dailyKlines.slice(-5)
  const avgVol = recent5Daily.reduce((sum, k) => sum + k.volume, 0) / 5
  const todayVolRatio = recent3Daily[2].volume / avgVol
  text += `
## ${sectionNum}. 成交量分析
今日成交量: ${(recent3Daily[2].volume / 10000).toFixed(0)}万手
5日均量: ${(avgVol / 10000).toFixed(0)}万手
量比: ${todayVolRatio.toFixed(2)}
`
  sectionNum++
  
  // 波动率分析（ATR）
  const atr = recent3Daily.map(k => k.high - k.low).reduce((a, b) => a + b) / 3
  const atrPct = atr / price * 100
  text += `
## ${sectionNum}. 波动率(ATR)
近3日ATR: ${fp(atr)}
ATR百分比: ${atrPct.toFixed(2)}%
`
  sectionNum++
  
  text += `
## ${sectionNum}. 技术指标 - 日K线
MA5: ${fp(indDaily.ma.ma5)}
MA10: ${fp(indDaily.ma.ma10)}
MA20: ${fp(indDaily.ma.ma20)}
MACD_DIF: ${indDaily.macd.dif.toFixed(4)}
MACD_DEA: ${indDaily.macd.dea.toFixed(4)}
MACD: ${indDaily.macd.macd.toFixed(4)}
RSI6: ${indDaily.rsi.rsi6.toFixed(2)}
RSI12: ${indDaily.rsi.rsi12.toFixed(2)}

## ${sectionNum + 1}. 技术指标 - 60分钟K线
MA5: ${fp(ind60.ma.ma5)}
MA10: ${fp(ind60.ma.ma10)}
MACD_DIF: ${ind60.macd.dif.toFixed(4)}
MACD_DEA: ${ind60.macd.dea.toFixed(4)}
MACD: ${ind60.macd.macd.toFixed(4)}
RSI6: ${ind60.rsi.rsi6.toFixed(2)}
RSI12: ${ind60.rsi.rsi12.toFixed(2)}

## ${sectionNum + 2}. 技术指标 - 15分钟K线
MA5: ${fp(ind15.ma.ma5)}
MA10: ${fp(ind15.ma.ma10)}
MACD_DIF: ${ind15.macd.dif.toFixed(4)}
MACD_DEA: ${ind15.macd.dea.toFixed(4)}
MACD: ${ind15.macd.macd.toFixed(4)}
RSI6: ${ind15.rsi.rsi6.toFixed(2)}
RSI12: ${ind15.rsi.rsi12.toFixed(2)}
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
    console.log('AI Chat - token received:', token ? 'yes' : 'no')
    
    if (token) {
      // 手动解析 token
      const [payloadB64, sig] = token.split('.');
      if (payloadB64 && sig) {
        try {
          const data = atob(payloadB64);
          const payload = JSON.parse(data);
          console.log('Token payload:', payload.username, 'exp:', new Date(payload.exp).toISOString())
          if (payload.exp >= Date.now()) {
            const encoder = new TextEncoder();
            const expectedSig = await crypto.subtle.digest('SHA-256', encoder.encode(data + 'token_secret_2024'));
            const expectedSigStr = btoa(String.fromCharCode(...new Uint8Array(expectedSig))).slice(0, 16);
            if (sig === expectedSigStr) {
              username = payload.username;
              console.log('Token verified, username:', username)
            } else {
              console.log('Token signature mismatch')
            }
          } else {
            console.log('Token expired')
          }
        } catch (e) {
          console.log('Token parse error:', e.message)
        }
      }
    }
    
    // 如果有用户，检查配额（但不扣除，等 AI 成功后再扣除）
    let userInfo = null; // 保存用户信息，用于后续扣除配额
    
    if (username) {
      let quotaChecked = false;
      
      // 优先使用 D1
      if (env.DB) {
        try {
          const user = await getUserFromDB(env.DB, username);
          if (user) {
            const quota = user.ai_quota || DEFAULT_AI_QUOTA;
            const aiUsedToday = await getTodayUsageFromDB(env.DB, user.id);
            console.log('D1 Quota check:', aiUsedToday, '/', quota, 'isAdmin:', ADMIN_USERS.includes(username))
            
            // 管理员不受配额限制
            if (!ADMIN_USERS.includes(username) && aiUsedToday >= quota) {
              return jsonResponse({ 
                error: '今日 AI 使用次数已用完',
                quota,
                used: aiUsedToday
              }, 429);
            }
            
            // 保存用户信息，等 AI 成功后再扣除
            userInfo = { type: 'd1', user, mode, stockData };
            console.log('D1 Quota check passed, will record after AI success')
            quotaChecked = true;
          }
        } catch (e) {
          console.error('D1 quota check error:', e);
        }
      }
      
      // 回退到 KV
      if (!quotaChecked && env.CONFIG_KV) {
        const userData = await env.CONFIG_KV.get(`user:${username}`, 'json');
        console.log('KV User data:', userData ? 'found' : 'not found')
        
        if (userData) {
          const today = getTodayStr();
          let aiUsedToday = userData.aiUsedToday || 0;
          
          if (userData.aiUsedDate !== today) {
            console.log('New day, resetting quota')
            aiUsedToday = 0;
          }
          
          const quota = userData.aiQuota || DEFAULT_AI_QUOTA;
          console.log('KV Quota check:', aiUsedToday, '/', quota)
          
          if (!ADMIN_USERS.includes(username) && aiUsedToday >= quota) {
            return jsonResponse({ 
              error: '今日 AI 使用次数已用完',
              quota,
              used: aiUsedToday
            }, 429);
          }
          
          // 保存用户信息，等 AI 成功后再扣除
          userInfo = { type: 'kv', username, userData, today };
          console.log('KV Quota check passed, will update after AI success')
        }
      }
    } else {
      // 未登录用户不允许使用 AI
      console.log('No username, AI access denied')
      return jsonResponse({ 
        error: '请先登录后使用 AI 功能',
        needLogin: true
      }, 401)
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

    // AI 调用成功，现在扣除配额
    if (userInfo) {
      if (userInfo.type === 'd1' && env.DB) {
        try {
          await recordAIUsage(env.DB, userInfo.user.id, userInfo.mode, userInfo.stockData?.code, userInfo.stockData?.name);
          console.log('D1 Usage recorded after AI success')
        } catch (e) {
          console.error('Failed to record D1 usage:', e);
        }
      } else if (userInfo.type === 'kv' && env.CONFIG_KV) {
        try {
          const { username, userData, today } = userInfo;
          userData.aiUsedToday = (userData.aiUsedToday || 0) + 1;
          userData.aiUsedDate = today;
          if (!userData.aiQuota) {
            userData.aiQuota = DEFAULT_AI_QUOTA;
          }
          await env.CONFIG_KV.put(`user:${username}`, JSON.stringify(userData));
          console.log('KV Quota updated after AI success:', userData.aiUsedToday)
        } catch (e) {
          console.error('Failed to update KV quota:', e);
        }
      }
    }

    // 直接转发流式响应
    const { readable, writable } = new TransformStream()
    const writer = writable.getWriter()
    const reader = llmRes.body.getReader()
    const decoder = new TextDecoder()
    
    ;(async () => {
      try {
        let buffer = '' // 添加缓冲区处理不完整的行
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          const chunk = decoder.decode(value, { stream: true })
          buffer += chunk
          
          // 按行分割，保留最后一个不完整的行
          const lines = buffer.split('\n')
          buffer = lines.pop() || '' // 保留最后一个可能不完整的行
          
          lines.filter(l => l.trim()).forEach(line => {
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
              } catch (e) {
                console.error('Parse chunk error:', e, 'line:', line)
              }
            }
          })
        }
        
        // 处理缓冲区中剩余的内容
        if (buffer.trim()) {
          const line = buffer.trim()
          if (line.startsWith('data: ')) {
            const data = line.slice(6)
            if (data !== '[DONE]') {
              try {
                const json = JSON.parse(data)
                const content = json.choices?.[0]?.delta?.content
                if (content) {
                  writer.write(new TextEncoder().encode(`data: ${JSON.stringify({ content })}\n\n`))
                }
              } catch (e) {
                console.error('Parse buffer error:', e)
              }
            }
          }
        }
        
        writer.write(new TextEncoder().encode('data: [DONE]\n\n'))
      } catch (error) {
        console.error('Stream processing error:', error)
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
    
    // 检查是否是后端服务超时或连接错误
    if (error.message.includes('代理服务器错误') || error.message.includes('后端服务响应超时')) {
      return jsonResponse({ 
        error: 'AI 服务暂时不可用，请稍后重试',
        hint: '后端服务可能正在维护或网络连接异常'
      }, 503)
    }
    
    // 通用错误处理 - 不暴露敏感信息
    const sanitizedError = error.message
      .replace(/"backend":"[^"]+"/g, '"backend":"[HIDDEN]"')
      .replace(/http:\/\/[^\s"'}]+/gi, '[API_ENDPOINT]')
      .replace(/https:\/\/[^\s"'}]+/gi, '[API_ENDPOINT]')
      .replace(/gemini-[^\s"'}]+/gi, '[MODEL]')
      .replace(/gpt-[^\s"'}]+/gi, '[MODEL]')
    
    return jsonResponse({ 
      error: 'AI 服务调用失败',
      details: sanitizedError
    }, 500)
  }
}

async function handleAIConfig(request, env) {
  if (request.method === 'GET') {
    // 验证管理员权限
    const username = await verifyToken(request, env);
    const isAdmin = username && ADMIN_USERS.includes(username);
    
    let config = AI_DEFAULT_CONFIG
    if (env.CONFIG_KV) {
      const saved = await env.CONFIG_KV.get('ai_config', 'json')
      if (saved) config = { ...AI_DEFAULT_CONFIG, ...saved }
    }
    
    // 管理员返回完整配置，普通用户只返回模型信息
    if (isAdmin) {
      return jsonResponse({ 
        apiUrl: config.apiUrl,
        apiKey: config.apiKey,
        model: config.model
      })
    } else {
      return jsonResponse({ 
        model: config.model,
        hasApiKey: !!config.apiKey,
        status: 'configured'
      })
    }
  }

  if (request.method === 'POST') {
    // 管理员更新配置（需要验证权限）
    const username = await verifyToken(request, env);
    if (!username) {
      return jsonResponse({ error: '未登录' }, 401);
    }
    
    if (!ADMIN_USERS.includes(username)) {
      return jsonResponse({ error: '无权限' }, 403);
    }
    
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

// ============ Daily Report 生成功能 ============

/**
 * 生成每日早报
 * @param {Object} env - Worker 环境
 * @param {boolean} isScheduled - 是否是定时任务触发（6点自动）
 * 
 * 手动触发：读取过去24小时的新闻
 * 定时触发：读取昨天6点到今天6点的新闻
 */
async function generateDailyReport(env, isScheduled = false) {
  if (!env.DB) {
    throw new Error('数据库未配置');
  }
  
  console.log(`开始生成日报... (${isScheduled ? '定时任务' : '手动触发'})`);
  
  const now = new Date();
  const beijingNow = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  const today = beijingNow.toISOString().split('T')[0];
  
  let startTime, endTime;
  
  if (isScheduled) {
    // 定时任务（6点触发）：昨天6点到今天6点
    // 今天6点 UTC = 今天北京6点 - 8小时 = 昨天 22:00 UTC
    endTime = new Date(Date.UTC(
      beijingNow.getUTCFullYear(),
      beijingNow.getUTCMonth(),
      beijingNow.getUTCDate() - 1, // 昨天
      22, 0, 0 // UTC 22:00 = 北京 6:00
    ));
    // 如果当前已经过了6点，endTime 应该是今天
    if (beijingNow.getUTCHours() >= 22 || (beijingNow.getUTCHours() < 6)) {
      endTime = new Date(Date.UTC(
        beijingNow.getUTCFullYear(),
        beijingNow.getUTCMonth(),
        beijingNow.getUTCDate(),
        22, 0, 0
      ));
    }
    startTime = new Date(endTime.getTime() - 24 * 60 * 60 * 1000);
  } else {
    // 手动触发：过去24小时
    endTime = now;
    startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  }
  
  console.log(`时间范围: ${startTime.toISOString()} ~ ${endTime.toISOString()}`);
  
  // 从 daily_news 表读取新闻
  await initDB(env.DB);
  const newsResult = await env.DB.prepare(`
    SELECT title, summary FROM daily_news 
    WHERE published_at >= ? AND published_at < ?
    ORDER BY published_at DESC
  `).bind(startTime.toISOString(), endTime.toISOString()).all();
  
  const newsList = newsResult.results || [];
  console.log(`获取到 ${newsList.length} 条新闻`);
  
  if (newsList.length === 0) {
    return { success: false, error: '没有新闻数据' };
  }
  
  // 构建精简的新闻输入
  const newsInput = newsList.map((n, i) => `${i + 1}. ${n.title}`).join('\n');
  
  // 获取 AI 配置
  let config = AI_DEFAULT_CONFIG;
  if (env.CONFIG_KV) {
    const saved = await env.CONFIG_KV.get('ai_config', 'json');
    if (saved) config = { ...AI_DEFAULT_CONFIG, ...saved };
  }
  
  // 构建提示词
  const systemPrompt = buildDailyReportPrompt();
  const userPrompt = `今天是 ${today}，以下是过去24小时的中国相关新闻标题：\n\n${newsInput}\n\n请根据以上新闻生成今日早报。`;
  
  // 调用 LLM
  console.log('调用 LLM 生成日报...');
  const llmResponse = await fetch(config.apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`
    },
    body: JSON.stringify({
      model: config.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.7,
      max_tokens: 4000
    })
  });
  
  if (!llmResponse.ok) {
    const errText = await llmResponse.text();
    throw new Error(`LLM 调用失败: ${llmResponse.status} ${errText}`);
  }
  
  const llmData = await llmResponse.json();
  const content = llmData.choices?.[0]?.message?.content;
  
  if (!content) {
    throw new Error('LLM 返回内容为空');
  }
  
  // 解析 JSON
  let reportJson;
  try {
    // 尝试提取 JSON 块
    const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/) || content.match(/\{[\s\S]*\}/);
    const jsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : content;
    reportJson = JSON.parse(jsonStr);
  } catch (e) {
    console.error('JSON 解析失败:', content);
    throw new Error('日报 JSON 解析失败');
  }
  
  // 存入数据库
  await env.DB.prepare(`
    INSERT OR REPLACE INTO daily_reports (report_date, content, news_count)
    VALUES (?, ?, ?)
  `).bind(today, JSON.stringify(reportJson), newsList.length).run();
  
  console.log(`日报生成成功: ${today}`);
  return { success: true, date: today, newsCount: newsList.length };
}

/**
 * 构建日报生成的系统提示词
 */
function buildDailyReportPrompt() {
  return `你是一位专业的A股市场分析师，负责生成每日早报。

## 任务
根据提供的新闻标题，生成结构化的每日早报 JSON。

## 输出格式
严格按照以下 JSON 结构输出，不要添加任何其他内容：

\`\`\`json
{
  "date": "2025.12.05",
  "intelligence": [
    {
      "category": "科技与航天",
      "color": "tech",
      "items": [
        {
          "title": "火箭回收失败",
          "tag": "bearish",
          "tagText": "利空",
          "summary": "长征12A实验失败，打击商业航天情绪。"
        }
      ]
    }
  ],
  "prediction": {
    "tone": "震荡偏弱",
    "subtitle": "情绪防御为主，结构性分化明显",
    "summary": "由于宏观层面存在...",
    "northbound": "受美对英伟达审查及地缘摩擦影响，外资情绪偏向<span class=\\"text-bear-text font-bold\\">谨慎流出</span>。",
    "volume": "缺乏重磅利好且年底资金紧，预计<span class=\\"font-bold\\">难以有效放大</span>，呈"缩量博弈"特征。",
    "scenarios": [
      { "title": "开盘：低开", "desc": "受GDP预测和美科技限制影响，指数大概率低开。", "active": true },
      { "title": "盘中：分化抵抗", "desc": "地产、自动驾驶领跌；资金抱团黄金/国产算力。", "active": true },
      { "title": "收盘：小阴线/十字星", "desc": "除非国家队强力护盘，否则防御属性明显。", "active": false }
    ]
  },
  "sectors": {
    "bullish": [
      {
        "name": "黄金与贵金属",
        "tag": "bullish",
        "tagText": "强利好",
        "reason": "新闻显示中国单月从俄罗斯购入10亿美元黄金，叠加地缘紧张与经济预期不佳，避险属性放大。",
        "focus": "关注：黄金股、贵金属回收"
      }
    ],
    "bearish": [
      {
        "name": "房地产及产业链",
        "tag": "bearish",
        "tagText": "利空",
        "reason": "万科危机+GDP预期低+2026年才稳市场（远水不解近渴），情绪低迷。",
        "focus": "避雷：开发商、建材"
      }
    ]
  },
  "actionable": {
    "avoid": "地产 · 智驾",
    "focus": "芯片 · 乳业"
  }
}
\`\`\`

## 字段说明

### intelligence（情报矩阵）
- 根据新闻内容自由划分 3-5 个分类（如科技、金融、地缘、社会等）
- color 可选值：tech(蓝)、fin(绿)、geo(橙)、soc(紫)、other(灰)
- 每个分类 2-4 条情报
- tag 可选值：
  - bullish（红色标签）：利好、替代、避险、出海、政策利好、强利好、局部利好
  - bearish（绿色标签）：利空、打击、高压、情绪打击、监管/制裁
  - neutral（灰色标签）：低迷、摩擦、热议、风险、观望

### prediction（大盘研判）
- tone：一句话定调，如"震荡偏弱"、"谨慎乐观"
- northbound 和 volume 字段支持 HTML 标签高亮关键词：
  - 利空关键词用 <span class="text-bear-text font-bold">关键词</span>
  - 利好关键词用 <span class="text-bull-text font-bold">关键词</span>
  - 中性强调用 <span class="font-bold">关键词</span>
- scenarios：3 步剧本推演，active=true 表示高亮

### sectors（板块分析）
- bullish：2-4 个利好板块
- bearish：2-4 个利空板块
- focus 字段：利好板块用"关注：xxx"，利空板块用"避雷：xxx"

### actionable（交易策略）
- avoid：需要规避的板块关键词，用 · 分隔
- focus：值得关注的板块关键词，用 · 分隔

## 注意事项
1. 只输出 JSON，不要有任何解释文字
2. 所有分析必须基于提供的新闻，不要编造
3. 保持客观专业，语言简洁有力
4. 标签文字要简短（2-4字）`;
}
