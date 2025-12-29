// Cloudflare Worker - Market Board 配置同步 API (带登录功能)
// 支持 KV（配置存储）和 D1（用户管理、AI 统计）

// 验证码有效期（5分钟）
const CODE_EXPIRE_SECONDS = 300

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

// ============ 邮件发送函数 ============

/**
 * 生成6位数字验证码
 */
function generateVerifyCode() {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

/**
 * 通过 Brevo API 发送验证码邮件
 * @param {string} email - 收件人邮箱
 * @param {string} code - 验证码
 * @param {object} env - 环境变量
 */
async function sendVerifyCodeEmail(email, code, env) {
  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'accept': 'application/json',
      'api-key': env.BREVO_API_KEY,
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      sender: { name: env.BREVO_SENDER_NAME, email: env.BREVO_SENDER_EMAIL },
      to: [{ email: email }],
      subject: 'Fintell 注册验证码',
      htmlContent: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #333;">欢迎注册 Fintell</h2>
          <p style="color: #666; font-size: 16px;">您的验证码是：</p>
          <div style="background: #f5f5f5; padding: 20px; text-align: center; margin: 20px 0; border-radius: 8px;">
            <span style="font-size: 32px; font-weight: bold; color: #1890ff; letter-spacing: 8px;">${code}</span>
          </div>
          <p style="color: #999; font-size: 14px;">验证码有效期 5 分钟，请尽快完成注册。</p>
          <p style="color: #999; font-size: 14px;">如果这不是您的操作，请忽略此邮件。</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
          <p style="color: #ccc; font-size: 12px;">Fintell - 智能股票监控平台</p>
        </div>
      `
    })
  })

  if (!response.ok) {
    const error = await response.text()
    console.error('Brevo API error:', error)
    throw new Error('邮件发送失败')
  }

  return true
}

/**
 * 发送找回密码验证码邮件
 */
async function sendResetPasswordEmail(email, code, env) {
  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'accept': 'application/json',
      'api-key': env.BREVO_API_KEY,
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      sender: { name: env.BREVO_SENDER_NAME, email: env.BREVO_SENDER_EMAIL },
      to: [{ email: email }],
      subject: 'Fintell 密码重置验证码',
      htmlContent: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #333;">重置密码</h2>
          <p style="color: #666; font-size: 16px;">您正在重置 Fintell 账号密码，验证码是：</p>
          <div style="background: #f5f5f5; padding: 20px; text-align: center; margin: 20px 0; border-radius: 8px;">
            <span style="font-size: 32px; font-weight: bold; color: #f59e0b; letter-spacing: 8px;">${code}</span>
          </div>
          <p style="color: #999; font-size: 14px;">验证码有效期 5 分钟。</p>
          <p style="color: #ef4444; font-size: 14px;">如果这不是您的操作，请立即检查账号安全。</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
          <p style="color: #ccc; font-size: 12px;">Fintell - 智能股票监控平台</p>
        </div>
      `
    })
  })

  if (!response.ok) {
    const error = await response.text()
    console.error('Brevo API error:', error)
    throw new Error('邮件发送失败')
  }

  return true
}

/**
 * 发送换绑邮箱验证码
 */
async function sendChangeEmailCode(email, code, env) {
  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'accept': 'application/json',
      'api-key': env.BREVO_API_KEY,
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      sender: { name: env.BREVO_SENDER_NAME, email: env.BREVO_SENDER_EMAIL },
      to: [{ email: email }],
      subject: 'Fintell 邮箱换绑验证码',
      htmlContent: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #333;">换绑邮箱</h2>
          <p style="color: #666; font-size: 16px;">您正在将此邮箱绑定到 Fintell 账号，验证码是：</p>
          <div style="background: #f5f5f5; padding: 20px; text-align: center; margin: 20px 0; border-radius: 8px;">
            <span style="font-size: 32px; font-weight: bold; color: #10b981; letter-spacing: 8px;">${code}</span>
          </div>
          <p style="color: #999; font-size: 14px;">验证码有效期 5 分钟。</p>
          <p style="color: #999; font-size: 14px;">如果这不是您的操作，请忽略此邮件。</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
          <p style="color: #ccc; font-size: 12px;">Fintell - 智能股票监控平台</p>
        </div>
      `
    })
  })

  if (!response.ok) {
    const error = await response.text()
    console.error('Brevo API error:', error)
    throw new Error('邮件发送失败')
  }

  return true
}

/**
 * 发送绑定邮箱验证码（针对老用户首次绑定）
 */
async function sendBindEmailCode(email, code, env) {
  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'accept': 'application/json',
      'api-key': env.BREVO_API_KEY,
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      sender: { name: env.BREVO_SENDER_NAME, email: env.BREVO_SENDER_EMAIL },
      to: [{ email: email }],
      subject: 'Fintell 邮箱绑定验证码',
      htmlContent: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #333;">绑定邮箱</h2>
          <p style="color: #666; font-size: 16px;">您正在绑定此邮箱到 Fintell 账号，验证码是：</p>
          <div style="background: #f5f5f5; padding: 20px; text-align: center; margin: 20px 0; border-radius: 8px;">
            <span style="font-size: 32px; font-weight: bold; color: #6366f1; letter-spacing: 8px;">${code}</span>
          </div>
          <p style="color: #999; font-size: 14px;">验证码有效期 5 分钟。</p>
          <p style="color: #999; font-size: 14px;">绑定后可用于登录和找回密码。</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
          <p style="color: #ccc; font-size: 12px;">Fintell - 智能股票监控平台</p>
        </div>
      `
    })
  })

  if (!response.ok) {
    const error = await response.text()
    console.error('Brevo API error:', error)
    throw new Error('邮件发送失败')
  }

  return true
}

/**
 * 生成日报截图 URL（每天只需调用一次）
 * @param {string} date - 日报日期
 * @param {object} env - 环境变量
 * @returns {string|null} 截图 URL 或 null
 */
function generateDailyReportScreenshotUrl(date, env) {
  if (!env.SCREENSHOT_API_KEY) return null
  
  const siteUrl = env.SITE_URL || 'https://board.newestgpt.com'
  const pageUrl = `${siteUrl}/?page=daily&date=${date}&screenshot=1`
  
  const screenshotUrl = new URL('https://api.screenshotone.com/take')
  screenshotUrl.searchParams.set('access_key', env.SCREENSHOT_API_KEY)
  screenshotUrl.searchParams.set('url', pageUrl)
  screenshotUrl.searchParams.set('format', 'png')
  screenshotUrl.searchParams.set('viewport_width', '1280')
  screenshotUrl.searchParams.set('viewport_height', '1600')
  screenshotUrl.searchParams.set('full_page', 'true')
  screenshotUrl.searchParams.set('delay', '3')
  screenshotUrl.searchParams.set('block_ads', 'true')
  screenshotUrl.searchParams.set('device_scale_factor', '3')  // 3倍分辨率，最高清晰度
  // 启用缓存：相同 URL 在 TTL 内不会重复截图
  screenshotUrl.searchParams.set('cache', 'true')
  screenshotUrl.searchParams.set('cache_ttl', '86400')  // 缓存24小时
  
  return screenshotUrl.toString()
}

/**
 * 生成 Market Tone 封面图 URL（用于公众号封面）
 * @param {string} date - 日报日期
 * @param {object} env - 环境变量
 * @returns {string|null} 截图 URL 或 null
 */
function generateCoverScreenshotUrl(date, env) {
  if (!env.SCREENSHOT_API_KEY) return null
  
  const siteUrl = env.SITE_URL || 'https://board.newestgpt.com'
  // 添加 v=4 强制刷新缓存（封面图字体优化）
  const pageUrl = `${siteUrl}/?page=daily&date=${date}&cover=1&v=4`
  
  const screenshotUrl = new URL('https://api.screenshotone.com/take')
  screenshotUrl.searchParams.set('access_key', env.SCREENSHOT_API_KEY)
  screenshotUrl.searchParams.set('url', pageUrl)
  screenshotUrl.searchParams.set('format', 'png')
  screenshotUrl.searchParams.set('viewport_width', '900')
  screenshotUrl.searchParams.set('viewport_height', '500')
  screenshotUrl.searchParams.set('full_page', 'false')
  screenshotUrl.searchParams.set('delay', '3')  // 增加延迟确保页面加载完成
  screenshotUrl.searchParams.set('block_ads', 'true')
  screenshotUrl.searchParams.set('device_scale_factor', '2')
  screenshotUrl.searchParams.set('cache', 'true')
  screenshotUrl.searchParams.set('cache_ttl', '86400')
  
  return screenshotUrl.toString()
}

/**
 * 发送日报订阅邮件
 * @param {string} email - 收件人邮箱
 * @param {string} date - 日报日期
 * @param {object} reportContent - 日报内容
 * @param {object} env - 环境变量
 * @param {string|null} cachedImageUrl - 预生成的截图 URL（避免重复调用 API）
 */
async function sendDailyReportEmail(email, date, reportContent, env, cachedImageUrl = null) {
  const formattedDate = date.replace(/-/g, '.')
  const siteUrl = env.SITE_URL || 'https://board.newestgpt.com'
  
  // 使用传入的缓存图片 URL，避免每封邮件都生成新的截图
  const imageUrl = cachedImageUrl
  
  // 构建邮件 HTML
  const htmlContent = imageUrl 
    ? buildImageEmailHtml(formattedDate, imageUrl, siteUrl)
    : buildTextEmailHtml(formattedDate, reportContent, siteUrl)
  
  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'accept': 'application/json',
      'api-key': env.BREVO_API_KEY,
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      sender: { name: env.BREVO_SENDER_NAME, email: env.BREVO_SENDER_EMAIL },
      to: [{ email: email }],
      subject: `Fintell 每日早报 ${formattedDate}`,
      htmlContent
    })
  })

  if (!response.ok) {
    const error = await response.text()
    console.error('发送日报邮件失败:', error)
    throw new Error('邮件发送失败')
  }

  return true
}

// 带图片的邮件模板
function buildImageEmailHtml(formattedDate, imageUrl, siteUrl) {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:20px;background:#f1f5f9;font-family:sans-serif;">
<div style="max-width:800px;margin:0 auto;">
<img src="${imageUrl}" alt="Fintell 每日早报 ${formattedDate}" style="width:100%;height:auto;border-radius:16px;box-shadow:0 4px 24px rgba(0,0,0,0.1);">
<div style="text-align:center;margin-top:20px;padding:16px;">
<p style="color:#64748b;font-size:13px;margin:0 0 8px;">查看完整日报请访问 <a href="${siteUrl}" style="color:#7c3aed;">Fintell</a></p>
<p style="color:#94a3b8;font-size:11px;margin:0;">如需取消订阅，请在设置中关闭日报推送</p>
</div></div></body></html>`
}

// 纯文本邮件模板（备用）
function buildTextEmailHtml(formattedDate, reportContent, siteUrl) {
  const prediction = reportContent.prediction || {}
  const sectors = reportContent.sectors || {}
  const actionable = reportContent.actionable || {}
  
  const buildSectorList = (items, isBullish) => {
    if (!items?.length) return '<p style="color:#999;">暂无数据</p>'
    return items.slice(0, 3).map(s => `
      <div style="margin-bottom:12px;padding:12px;background:${isBullish ? '#f0fdf4' : '#fef2f2'};border-radius:8px;">
        <div style="font-weight:600;color:${isBullish ? '#16a34a' : '#dc2626'};margin-bottom:4px;">${s.name}</div>
        <div style="font-size:13px;color:#666;">${s.reason || ''}</div>
      </div>`).join('')
  }
  
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:20px;background:#f1f5f9;font-family:sans-serif;">
<div style="max-width:600px;margin:0 auto;background:white;border-radius:16px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,0.05);">
<div style="background:linear-gradient(135deg,#7c3aed 0%,#6366f1 100%);padding:24px;text-align:center;">
<div style="width:48px;height:48px;background:rgba(255,255,255,0.2);border-radius:12px;display:inline-block;line-height:48px;margin-bottom:12px;">
<span style="color:white;font-size:24px;font-weight:bold;">F</span></div>
<h1 style="color:white;margin:0;font-size:24px;">Fintell 每日早报</h1>
<p style="color:rgba(255,255,255,0.8);margin:8px 0 0;font-size:14px;">${formattedDate}</p>
</div>
<div style="padding:24px;">
<div style="background:#faf5ff;border-radius:12px;padding:16px;margin-bottom:20px;border:1px solid #e9d5ff;">
<div style="font-size:12px;font-weight:bold;color:#7c3aed;margin-bottom:8px;">📊 大盘研判</div>
<div style="font-size:20px;font-weight:bold;color:#1e1b4b;margin-bottom:4px;">${prediction.tone || ''}</div>
<div style="font-size:14px;color:#6b7280;">${prediction.subtitle || ''}</div>
</div>
<div style="margin-bottom:20px;">
<div style="font-size:14px;font-weight:bold;color:#16a34a;margin-bottom:12px;">📈 利好板块</div>
${buildSectorList(sectors.bullish, true)}
</div>
<div style="margin-bottom:20px;">
<div style="font-size:14px;font-weight:bold;color:#dc2626;margin-bottom:12px;">📉 承压板块</div>
${buildSectorList(sectors.bearish, false)}
</div>
<div style="background:#fefce8;border-radius:12px;padding:16px;border:1px solid #fde047;">
<div style="font-size:12px;font-weight:bold;color:#854d0e;margin-bottom:8px;">🎯 交易策略</div>
<div style="display:flex;gap:12px;">
<div style="flex:1;background:#fffbeb;border-radius:8px;padding:10px;">
<div style="font-size:10px;color:#d97706;margin-bottom:4px;">防守避雷</div>
<div style="font-size:13px;color:#1f2937;">${actionable.avoid || '-'}</div>
</div>
<div style="flex:1;background:#ecfdf5;border-radius:8px;padding:10px;">
<div style="font-size:10px;color:#059669;margin-bottom:4px;">进攻布局</div>
<div style="font-size:13px;color:#1f2937;">${actionable.focus || '-'}</div>
</div></div></div></div>
<div style="padding:16px 24px;background:#f9fafb;text-align:center;border-top:1px solid #e5e7eb;">
<p style="color:#9ca3af;font-size:12px;margin:0;">查看完整日报请访问 <a href="${siteUrl}" style="color:#7c3aed;">Fintell</a></p>
<p style="color:#d1d5db;font-size:11px;margin:8px 0 0;">如需取消订阅，请在设置中关闭日报推送</p>
</div></div></body></html>`
}

// ============ D1 数据库操作 ============

// 缓存标记，避免重复初始化
let dbInitialized = false
let dbInitError = null

/**
 * 初始化数据库表（如果不存在）
 */
async function initDB(db) {
  if (dbInitialized) return
  if (dbInitError) {
    console.log('跳过初始化，之前有错误:', dbInitError)
    return // 之前初始化失败过，不再重试
  }
  
  try {
    // 创建 daily_reports 表
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS daily_reports (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        report_date TEXT UNIQUE NOT NULL,
        content TEXT NOT NULL,
        news_count INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `).run()
    
    // 创建 daily_news 表（与 worker-news 共享）
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS daily_news (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        summary TEXT,
        published_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `).run()
    
    // 创建验证码表（替代 KV 存储）
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS verify_codes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code_key TEXT UNIQUE NOT NULL,
        code TEXT NOT NULL,
        expires_at DATETIME NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `).run()
    
    // 尝试添加 daily_subscribe 字段到 users 表（如果不存在）
    try {
      await db.prepare(`ALTER TABLE users ADD COLUMN daily_subscribe INTEGER DEFAULT 0`).run()
      console.log('已添加 daily_subscribe 字段')
    } catch (e) {
      // 字段可能已存在，忽略
    }
    
    // 尝试添加 nickname 字段到 users 表（如果不存在）
    try {
      await db.prepare(`ALTER TABLE users ADD COLUMN nickname TEXT`).run()
      console.log('已添加 nickname 字段')
    } catch (e) {
      // 字段可能已存在，忽略
    }
    
    // 尝试创建索引（如果已存在会忽略）
    try {
      await db.prepare(`CREATE INDEX IF NOT EXISTS idx_daily_reports_date ON daily_reports(report_date DESC)`).run()
      await db.prepare(`CREATE INDEX IF NOT EXISTS idx_news_published ON daily_news(published_at DESC)`).run()
      await db.prepare(`CREATE INDEX IF NOT EXISTS idx_verify_codes_key ON verify_codes(code_key)`).run()
      await db.prepare(`CREATE INDEX IF NOT EXISTS idx_verify_codes_expires ON verify_codes(expires_at)`).run()
    } catch (e) {
      // 索引可能已存在，忽略
    }
    
    dbInitialized = true
    console.log('数据库初始化成功')
  } catch (e) {
    console.error('initDB error:', e)
    dbInitError = e.message
    // 不抛出错误，让后续查询自己处理
  }
}

/**
 * 从 D1 获取用户
 */
async function getUserFromDB(db, username) {
  const result = await db.prepare('SELECT * FROM users WHERE username = ?').bind(username).first()
  return result
}

/**
 * 存储验证码到 D1（替代 KV）
 * @param {D1Database} db - D1 数据库
 * @param {string} codeKey - 验证码 key
 * @param {string} code - 验证码
 * @param {number} ttlSeconds - 过期时间（秒）
 */
async function saveVerifyCode(db, codeKey, code, ttlSeconds = 300) {
  const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString()
  await db.prepare(`
    INSERT OR REPLACE INTO verify_codes (code_key, code, expires_at)
    VALUES (?, ?, ?)
  `).bind(codeKey, code, expiresAt).run()
}

/**
 * 从 D1 获取验证码
 * @param {D1Database} db - D1 数据库
 * @param {string} codeKey - 验证码 key
 * @returns {string|null} 验证码或 null（已过期或不存在）
 */
async function getVerifyCode(db, codeKey) {
  const result = await db.prepare(`
    SELECT code FROM verify_codes 
    WHERE code_key = ? AND expires_at > datetime('now')
  `).bind(codeKey).first()
  return result ? result.code : null
}

/**
 * 删除验证码
 * @param {D1Database} db - D1 数据库
 * @param {string} codeKey - 验证码 key
 */
async function deleteVerifyCode(db, codeKey) {
  await db.prepare('DELETE FROM verify_codes WHERE code_key = ?').bind(codeKey).run()
}

/**
 * 清理过期验证码（可选，定期调用）
 */
async function cleanExpiredCodes(db) {
  await db.prepare("DELETE FROM verify_codes WHERE expires_at <= datetime('now')").run()
}

/**
 * 通过邮箱获取用户
 */
async function getUserByEmailFromDB(db, email) {
  const result = await db.prepare('SELECT * FROM users WHERE email = ?').bind(email).first()
  return result
}

/**
 * 创建用户到 D1（邮箱注册，email 同时作为 username）
 */
async function createUserInDB(db, email, passwordHash, registerIp, nickname = null) {
  const result = await db.prepare(
    'INSERT INTO users (username, email, password_hash, ai_quota, register_ip, nickname) VALUES (?, ?, ?, ?, ?, ?)'
  ).bind(email, email, passwordHash, DEFAULT_AI_QUOTA, registerIp, nickname).run()
  return result.meta.last_row_id
}

/**
 * 更新用户昵称
 */
async function updateNicknameInDB(db, email, nickname) {
  await db.prepare('UPDATE users SET nickname = ?, updated_at = CURRENT_TIMESTAMP WHERE email = ?')
    .bind(nickname, email).run()
}

/**
 * 更新用户密码
 */
async function updatePasswordInDB(db, email, passwordHash) {
  await db.prepare('UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE email = ?')
    .bind(passwordHash, email).run()
}

/**
 * 更新用户邮箱
 */
async function updateEmailInDB(db, oldEmail, newEmail) {
  await db.prepare('UPDATE users SET email = ?, username = ?, updated_at = CURRENT_TIMESTAMP WHERE email = ?')
    .bind(newEmail, newEmail, oldEmail).run()
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
      // POST /api/send-code - 发送注册验证码
      if (path === '/api/send-code' && request.method === 'POST') {
        const { email } = await request.json();
        
        if (!email) {
          return jsonResponse({ error: '邮箱不能为空' }, 400);
        }
        
        // 简单的邮箱格式验证
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
          return jsonResponse({ error: '邮箱格式不正确' }, 400);
        }
        
        // 检查是否频繁发送（使用 D1）
        if (env.DB) {
          await initDB(env.DB);
          const rateLimitKey = `code_rate:${email}`;
          const lastSent = await getVerifyCode(env.DB, rateLimitKey);
          if (lastSent) {
            return jsonResponse({ error: '发送太频繁，请稍后再试' }, 429);
          }
        }
        
        // 生成验证码
        const code = generateVerifyCode();

        // 发送邮件
        try {
          await sendVerifyCodeEmail(email, code, env);
        } catch (e) {
          console.error('Send email error:', e);
          return jsonResponse({ error: '邮件发送失败，请稍后重试', detail: e.message }, 500);
        }

        // 存储验证码到 D1（5分钟过期）
        try {
          if (env.DB) {
            const codeKey = `verify_code:${email}`;
            await saveVerifyCode(env.DB, codeKey, code, CODE_EXPIRE_SECONDS);
            // 设置发送频率限制（1分钟）
            const rateLimitKey = `code_rate:${email}`;
            await saveVerifyCode(env.DB, rateLimitKey, '1', 60);
          }
        } catch (dbError) {
          console.error('D1 save code error:', dbError);
          // 写入失败不影响用户体验，验证码已发送
        }

        return jsonResponse({ success: true, message: '验证码已发送' });
      }

      // POST /api/register - 注册（需要验证码）
      if (path === '/api/register' && request.method === 'POST') {
        const { email, password, code, nickname } = await request.json();
        
        if (!email || !password || !code) {
          return jsonResponse({ error: '邮箱、密码和验证码不能为空' }, 400);
        }
        
        // 邮箱格式验证
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
          return jsonResponse({ error: '邮箱格式不正确' }, 400);
        }
        
        if (password.length < 6) {
          return jsonResponse({ error: '密码至少 6 位' }, 400);
        }
        
        // 昵称长度验证（可选）
        if (nickname && nickname.length > 20) {
          return jsonResponse({ error: '昵称不能超过 20 个字符' }, 400);
        }
        
        // 验证验证码（使用 D1）
        let storedCode = null;
        const codeKey = `verify_code:${email}`;
        if (env.DB) {
          await initDB(env.DB);
          storedCode = await getVerifyCode(env.DB, codeKey);
        }
        if (!storedCode) {
          return jsonResponse({ error: '验证码已过期，请重新获取' }, 400);
        }
        if (storedCode !== code) {
          return jsonResponse({ error: '验证码错误' }, 400);
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
            
            // 检查邮箱是否已注册（用 email 作为 username）
            const existing = await getUserFromDB(env.DB, email);
            if (existing) {
              return jsonResponse({ error: '该邮箱已注册' }, 400);
            }
            
            // 检查 IP 是否已注册过
            const ipRegistered = await checkIPRegistered(env.DB, clientIP);
            if (ipRegistered) {
              return jsonResponse({ error: '该 IP 已注册过账号' }, 400);
            }
            
            await createUserInDB(env.DB, email, passwordHash, clientIP, nickname || null);
            
            // 注册成功后删除验证码
            await deleteVerifyCode(env.DB, codeKey);
            
            return jsonResponse({ success: true, message: '注册成功' });
          } catch (e) {
            console.error('D1 register error:', e);
            // 回退到 KV
          }
        }

        // KV 回退
        const existing = await env.CONFIG_KV.get(`user:${email}`);
        if (existing) {
          return jsonResponse({ error: '该邮箱已注册' }, 400);
        }
        
        // KV 中也检查 IP（简单实现）
        const ipKey = `ip:${clientIP}`;
        const ipExists = await env.CONFIG_KV.get(ipKey);
        if (ipExists) {
          return jsonResponse({ error: '该 IP 已注册过账号' }, 400);
        }
        
        await env.CONFIG_KV.put(`user:${email}`, JSON.stringify({
          passwordHash,
          registerIp: clientIP,
          createdAt: Date.now(),
          aiQuota: DEFAULT_AI_QUOTA,
          aiUsedToday: 0,
          aiUsedDate: getTodayStr()
        }));
        
        // 记录 IP
        await env.CONFIG_KV.put(ipKey, email);
        
        // 注册成功后删除验证码（D1）
        if (env.DB) {
          await deleteVerifyCode(env.DB, codeKey);
        }

        return jsonResponse({ success: true, message: '注册成功' });
      }

      // POST /api/login - 登录（优先 D1，回退 KV，自动迁移）
      if (path === '/api/login' && request.method === 'POST') {
        const { username, password } = await request.json();
        
        if (!username || !password) {
          return jsonResponse({ error: '用户名和密码不能为空' }, 400);
        }

        let userData = null;
        let fromD1 = false;
        let kvData = null; // 保存 KV 原始数据用于迁移
        let nickname = null;

        // 优先从 D1 查询
        if (env.DB) {
          try {
            const dbUser = await getUserFromDB(env.DB, username);
            if (dbUser) {
              fromD1 = true;
              userData = { passwordHash: dbUser.password_hash };
              nickname = dbUser.nickname;
            }
          } catch (e) {
            console.error('D1 login error:', e);
          }
        }

        // 回退到 KV
        if (!userData) {
          kvData = await env.CONFIG_KV.get(`user:${username}`, 'json');
          userData = kvData;
          if (kvData) {
            nickname = kvData.nickname || null;
          }
        }

        if (!userData) {
          return jsonResponse({ error: '用户名或密码错误' }, 401);
        }

        // 验证密码
        const valid = await verifyPassword(password, userData.passwordHash);
        if (!valid) {
          return jsonResponse({ error: '用户名或密码错误' }, 401);
        }

        // 如果用户在 KV 但不在 D1，自动迁移到 D1
        if (!fromD1 && kvData && env.DB) {
          try {
            await initDB(env.DB);
            await env.DB.prepare(`
              INSERT INTO users (username, password_hash, ai_quota, register_ip, created_at, nickname)
              VALUES (?, ?, ?, ?, datetime(?, 'unixepoch'), ?)
            `).bind(
              username,
              kvData.passwordHash,
              kvData.aiQuota || DEFAULT_AI_QUOTA,
              kvData.registerIp || '',
              Math.floor((kvData.createdAt || Date.now()) / 1000),
              kvData.nickname || null
            ).run();
            console.log(`[Auto-migrate] 用户 ${username} 已从 KV 迁移到 D1`);
          } catch (e) {
            // 迁移失败不影响登录，只记录日志
            console.error(`[Auto-migrate] 用户 ${username} 迁移失败:`, e.message);
          }
        }

        // 生成 token
        const token = await generateToken(username);
        
        return jsonResponse({ success: true, token, username, nickname });
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

      // POST /api/change-nickname - 修改昵称 (需要 token)
      if (path === '/api/change-nickname' && request.method === 'POST') {
        const username = await verifyToken(request, env);
        if (!username) {
          return jsonResponse({ error: '未登录' }, 401);
        }

        const { nickname } = await request.json();
        
        if (nickname === undefined) {
          return jsonResponse({ error: '昵称不能为空' }, 400);
        }

        // 昵称可以为空字符串（清除昵称），但不能超过20字符
        if (nickname && nickname.length > 20) {
          return jsonResponse({ error: '昵称不能超过 20 个字符' }, 400);
        }

        // 更新昵称
        if (env.DB) {
          try {
            await initDB(env.DB);
            await updateNicknameInDB(env.DB, username, nickname || null);
            return jsonResponse({ success: true, message: '昵称修改成功', nickname: nickname || null });
          } catch (e) {
            console.error('D1 update nickname error:', e);
            return jsonResponse({ error: '修改昵称失败' }, 500);
          }
        }

        // KV 回退
        const userData = await env.CONFIG_KV.get(`user:${username}`, 'json');
        if (userData) {
          userData.nickname = nickname || null;
          await env.CONFIG_KV.put(`user:${username}`, JSON.stringify(userData));
          return jsonResponse({ success: true, message: '昵称修改成功', nickname: nickname || null });
        }

        return jsonResponse({ error: '用户不存在' }, 404);
      }

      // POST /api/reset-password/send-code - 找回密码：发送验证码
      if (path === '/api/reset-password/send-code' && request.method === 'POST') {
        const { email } = await request.json();

        if (!email) {
          return jsonResponse({ error: '邮箱不能为空' }, 400);
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
          return jsonResponse({ error: '邮箱格式不正确' }, 400);
        }

        // 检查邮箱是否存在
        if (env.DB) {
          const user = await getUserByEmailFromDB(env.DB, email);
          if (!user) {
            return jsonResponse({ error: '该邮箱未注册' }, 400);
          }
        }

        // 检查发送频率（使用 D1）
        if (env.DB) {
          await initDB(env.DB);
          const rateLimitKey = `reset_rate:${email}`;
          const lastSent = await getVerifyCode(env.DB, rateLimitKey);
          if (lastSent) {
            return jsonResponse({ error: '发送太频繁，请稍后再试' }, 429);
          }
        }

        // 生成验证码
        const code = generateVerifyCode();

        // 发送邮件
        try {
          await sendResetPasswordEmail(email, code, env);
        } catch (e) {
          console.error('Send reset email error:', e);
          return jsonResponse({ error: '邮件发送失败，请稍后重试' }, 500);
        }

        // 存储验证码到 D1（5分钟过期）
        if (env.DB) {
          const codeKey = `reset_code:${email}`;
          await saveVerifyCode(env.DB, codeKey, code, CODE_EXPIRE_SECONDS);
          // 设置发送频率限制（1分钟）
          const rateLimitKey = `reset_rate:${email}`;
          await saveVerifyCode(env.DB, rateLimitKey, '1', 60);
        }

        return jsonResponse({ success: true, message: '验证码已发送' });
      }

      // POST /api/reset-password - 找回密码：重置密码
      if (path === '/api/reset-password' && request.method === 'POST') {
        const { email, code, newPassword } = await request.json();

        if (!email || !code || !newPassword) {
          return jsonResponse({ error: '邮箱、验证码和新密码不能为空' }, 400);
        }

        if (newPassword.length < 6) {
          return jsonResponse({ error: '新密码至少 6 位' }, 400);
        }

        // 验证验证码（使用 D1）
        const codeKey = `reset_code:${email}`;
        let storedCode = null;
        if (env.DB) {
          await initDB(env.DB);
          storedCode = await getVerifyCode(env.DB, codeKey);
        }
        if (!storedCode) {
          return jsonResponse({ error: '验证码已过期，请重新获取' }, 400);
        }
        if (storedCode !== code) {
          return jsonResponse({ error: '验证码错误' }, 400);
        }

        // 更新密码
        const newPasswordHash = await hashPassword(newPassword);

        if (env.DB) {
          try {
            await updatePasswordInDB(env.DB, email, newPasswordHash);
            // 删除验证码
            await deleteVerifyCode(env.DB, codeKey);
            return jsonResponse({ success: true, message: '密码重置成功' });
          } catch (e) {
            console.error('Reset password error:', e);
            return jsonResponse({ error: '重置密码失败' }, 500);
          }
        }

        return jsonResponse({ error: '服务暂不可用' }, 500);
      }

      // POST /api/change-email/send-code - 换绑邮箱：发送验证码到新邮箱
      if (path === '/api/change-email/send-code' && request.method === 'POST') {
        const username = await verifyToken(request, env);
        if (!username) {
          return jsonResponse({ error: '未登录' }, 401);
        }

        const { newEmail } = await request.json();

        if (!newEmail) {
          return jsonResponse({ error: '新邮箱不能为空' }, 400);
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(newEmail)) {
          return jsonResponse({ error: '邮箱格式不正确' }, 400);
        }

        // 检查新邮箱是否已被使用
        if (env.DB) {
          await initDB(env.DB);
          const existingUser = await getUserByEmailFromDB(env.DB, newEmail);
          if (existingUser) {
            return jsonResponse({ error: '该邮箱已被其他账号使用' }, 400);
          }
        }

        // 检查发送频率（使用 D1）
        if (env.DB) {
          const rateLimitKey = `change_email_rate:${username}`;
          const lastSent = await getVerifyCode(env.DB, rateLimitKey);
          if (lastSent) {
            return jsonResponse({ error: '发送太频繁，请稍后再试' }, 429);
          }
        }

        // 生成验证码
        const code = generateVerifyCode();

        // 发送邮件
        try {
          await sendChangeEmailCode(newEmail, code, env);
        } catch (e) {
          console.error('Send change email code error:', e);
          return jsonResponse({ error: '邮件发送失败，请稍后重试' }, 500);
        }

        // 存储验证码到 D1（5分钟过期），key 包含用户名防止冲突
        if (env.DB) {
          const codeKey = `change_email_code:${username}:${newEmail}`;
          await saveVerifyCode(env.DB, codeKey, code, CODE_EXPIRE_SECONDS);
          // 设置发送频率限制（1分钟）
          const rateLimitKey = `change_email_rate:${username}`;
          await saveVerifyCode(env.DB, rateLimitKey, '1', 60);
        }

        return jsonResponse({ success: true, message: '验证码已发送到新邮箱' });
      }

      // POST /api/change-email - 换绑邮箱：确认换绑
      if (path === '/api/change-email' && request.method === 'POST') {
        const username = await verifyToken(request, env);
        if (!username) {
          return jsonResponse({ error: '未登录' }, 401);
        }

        const { newEmail, code } = await request.json();

        if (!newEmail || !code) {
          return jsonResponse({ error: '新邮箱和验证码不能为空' }, 400);
        }

        // 验证验证码（使用 D1）
        const codeKey = `change_email_code:${username}:${newEmail}`;
        let storedCode = null;
        if (env.DB) {
          await initDB(env.DB);
          storedCode = await getVerifyCode(env.DB, codeKey);
        }
        if (!storedCode) {
          return jsonResponse({ error: '验证码已过期，请重新获取' }, 400);
        }
        if (storedCode !== code) {
          return jsonResponse({ error: '验证码错误' }, 400);
        }

        // 获取当前用户邮箱
        if (env.DB) {
          try {
            const user = await getUserFromDB(env.DB, username);
            if (!user) {
              return jsonResponse({ error: '用户不存在' }, 404);
            }

            // 更新邮箱
            await updateEmailInDB(env.DB, user.email || username, newEmail);

            // 删除验证码
            await deleteVerifyCode(env.DB, codeKey);

            // 生成新 token（因为 username 变了）
            const newToken = await generateToken(newEmail);

            return jsonResponse({ 
              success: true, 
              message: '邮箱换绑成功',
              token: newToken,
              username: newEmail
            });
          } catch (e) {
            console.error('Change email error:', e);
            return jsonResponse({ error: '换绑邮箱失败' }, 500);
          }
        }

        return jsonResponse({ error: '服务暂不可用' }, 500);
      }

      // GET /api/user/info - 获取当前用户信息
      if (path === '/api/user/info' && request.method === 'GET') {
        const username = await verifyToken(request, env);
        if (!username) {
          return jsonResponse({ error: '未登录' }, 401);
        }

        if (env.DB) {
          try {
            const user = await getUserFromDB(env.DB, username);
            if (user) {
              return jsonResponse({
                username: user.username,
                email: user.email,
                aiQuota: user.ai_quota,
                nickname: user.nickname || null,
                createdAt: user.created_at
              });
            }
          } catch (e) {
            console.error('Get user info error:', e);
          }
        }

        return jsonResponse({ username, email: username, nickname: null });
      }

      // POST /api/bind-email/send-code - 绑定邮箱：发送验证码（针对没有邮箱的老用户）
      if (path === '/api/bind-email/send-code' && request.method === 'POST') {
        const username = await verifyToken(request, env);
        if (!username) {
          return jsonResponse({ error: '未登录' }, 401);
        }

        const { email } = await request.json();

        if (!email) {
          return jsonResponse({ error: '邮箱不能为空' }, 400);
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
          return jsonResponse({ error: '邮箱格式不正确' }, 400);
        }

        // 检查邮箱是否已被使用
        if (env.DB) {
          await initDB(env.DB);
          const existingUser = await getUserByEmailFromDB(env.DB, email);
          if (existingUser && existingUser.username !== username) {
            return jsonResponse({ error: '该邮箱已被其他账号使用' }, 400);
          }
        }

        // 检查发送频率（使用 D1）
        if (env.DB) {
          const rateLimitKey = `bind_email_rate:${username}`;
          const lastSent = await getVerifyCode(env.DB, rateLimitKey);
          if (lastSent) {
            return jsonResponse({ error: '发送太频繁，请稍后再试' }, 429);
          }
        }

        // 生成验证码
        const code = generateVerifyCode();

        // 发送邮件
        try {
          await sendBindEmailCode(email, code, env);
        } catch (e) {
          console.error('Send bind email code error:', e);
          return jsonResponse({ error: '邮件发送失败，请稍后重试' }, 500);
        }

        // 存储验证码到 D1
        if (env.DB) {
          const codeKey = `bind_email_code:${username}:${email}`;
          await saveVerifyCode(env.DB, codeKey, code, CODE_EXPIRE_SECONDS);
          // 设置发送频率限制
          const rateLimitKey = `bind_email_rate:${username}`;
          await saveVerifyCode(env.DB, rateLimitKey, '1', 60);
        }

        return jsonResponse({ success: true, message: '验证码已发送' });
      }

      // POST /api/bind-email - 绑定邮箱：确认绑定
      if (path === '/api/bind-email' && request.method === 'POST') {
        const username = await verifyToken(request, env);
        if (!username) {
          return jsonResponse({ error: '未登录' }, 401);
        }

        const { email, code } = await request.json();

        if (!email || !code) {
          return jsonResponse({ error: '邮箱和验证码不能为空' }, 400);
        }

        // 验证验证码（使用 D1）
        const codeKey = `bind_email_code:${username}:${email}`;
        let storedCode = null;
        if (env.DB) {
          await initDB(env.DB);
          storedCode = await getVerifyCode(env.DB, codeKey);
        }
        if (!storedCode) {
          return jsonResponse({ error: '验证码已过期，请重新获取' }, 400);
        }
        if (storedCode !== code) {
          return jsonResponse({ error: '验证码错误' }, 400);
        }

        if (env.DB) {
          try {
            // 绑定邮箱（只更新 email 字段，不改 username）
            await env.DB.prepare('UPDATE users SET email = ?, updated_at = CURRENT_TIMESTAMP WHERE username = ?')
              .bind(email, username).run();

            // 删除验证码
            await deleteVerifyCode(env.DB, codeKey);

            return jsonResponse({ success: true, message: '邮箱绑定成功', email });
          } catch (e) {
            console.error('Bind email error:', e);
            return jsonResponse({ error: '绑定邮箱失败' }, 500);
          }
        }

        return jsonResponse({ error: '服务暂不可用' }, 500);
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

      // GET /api/admin/users - 管理员获取用户列表（合并 D1 和 KV）
      if (path === '/api/admin/users' && request.method === 'GET') {
        const username = await verifyToken(request, env);
        if (!username) {
          return jsonResponse({ error: '未登录' }, 401);
        }

        // 检查是否是管理员
        if (!ADMIN_USERS.includes(username)) {
          return jsonResponse({ error: '无权限' }, 403);
        }

        const allUsers = [];
        const usernames = new Set(); // 用于去重
        const today = getTodayStr();

        // 从 D1 查询
        if (env.DB) {
          try {
            await initDB(env.DB);
            const dbUsers = await getAllUsersFromDB(env.DB);
            for (const u of dbUsers) {
              usernames.add(u.username);
              allUsers.push({
                username: u.username,
                createdAt: new Date(u.created_at).getTime(),
                registerIp: u.register_ip || '',
                aiQuota: u.ai_quota || DEFAULT_AI_QUOTA,
                aiUsedToday: u.ai_used_today || 0,
                source: 'd1'
              });
            }
          } catch (e) {
            console.error('D1 admin users error:', e);
          }
        }

        // 从 KV 查询（补充 D1 中没有的用户）
        try {
          const userList = await env.CONFIG_KV.list({ prefix: 'user:' });
          for (const key of userList.keys) {
            const uname = key.name.replace('user:', '');
            // 跳过已在 D1 中的用户
            if (usernames.has(uname)) continue;
            
            const userData = await env.CONFIG_KV.get(key.name, 'json');
            if (userData) {
              let aiUsedToday = userData.aiUsedToday || 0;
              if (userData.aiUsedDate !== today) {
                aiUsedToday = 0;
              }
              allUsers.push({
                username: uname,
                createdAt: userData.createdAt,
                registerIp: userData.registerIp || '',
                aiQuota: userData.aiQuota || DEFAULT_AI_QUOTA,
                aiUsedToday,
                source: 'kv'
              });
            }
          }
        } catch (e) {
          console.error('KV admin users error:', e);
        }

        // 按创建时间倒序排列
        allUsers.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

        return jsonResponse({ users: allUsers });
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

      // POST /api/admin/migrate-users - 管理员迁移 KV 用户到 D1
      if (path === '/api/admin/migrate-users' && request.method === 'POST') {
        const adminUsername = await verifyToken(request, env);
        if (!adminUsername) {
          return jsonResponse({ error: '未登录' }, 401);
        }

        if (!ADMIN_USERS.includes(adminUsername)) {
          return jsonResponse({ error: '无权限' }, 403);
        }

        if (!env.DB) {
          return jsonResponse({ error: 'D1 数据库未配置' }, 500);
        }

        try {
          await initDB(env.DB);
          
          // 获取 KV 中所有用户
          const userList = await env.CONFIG_KV.list({ prefix: 'user:' });
          const results = { migrated: [], skipped: [], failed: [] };

          for (const key of userList.keys) {
            const username = key.name.replace('user:', '');
            
            try {
              // 检查 D1 中是否已存在
              const existingUser = await getUserFromDB(env.DB, username);
              if (existingUser) {
                results.skipped.push({ username, reason: '已存在于 D1' });
                continue;
              }

              // 获取 KV 用户数据
              const kvData = await env.CONFIG_KV.get(key.name, 'json');
              if (!kvData || !kvData.passwordHash) {
                results.skipped.push({ username, reason: '数据不完整' });
                continue;
              }

              // 插入到 D1
              await env.DB.prepare(`
                INSERT INTO users (username, password_hash, ai_quota, register_ip, created_at)
                VALUES (?, ?, ?, ?, datetime(?, 'unixepoch'))
              `).bind(
                username,
                kvData.passwordHash,
                kvData.aiQuota || DEFAULT_AI_QUOTA,
                kvData.registerIp || '',
                Math.floor((kvData.createdAt || Date.now()) / 1000)
              ).run();

              results.migrated.push({ username, quota: kvData.aiQuota || DEFAULT_AI_QUOTA });
              
              // 可选：迁移成功后删除 KV 中的用户数据（保留配置）
              // await env.CONFIG_KV.delete(key.name);
              
            } catch (e) {
              results.failed.push({ username, error: e.message });
            }
          }

          return jsonResponse({
            success: true,
            summary: {
              total: userList.keys.length,
              migrated: results.migrated.length,
              skipped: results.skipped.length,
              failed: results.failed.length
            },
            details: results
          });
        } catch (e) {
          console.error('Migration error:', e);
          return jsonResponse({ error: '迁移失败: ' + e.message }, 500);
        }
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

      // ============ Daily Subscribe API ============
      
      // GET /api/daily/subscribe - 获取订阅状态
      if (path === '/api/daily/subscribe' && request.method === 'GET') {
        const username = await verifyToken(request, env);
        if (!username) {
          return jsonResponse({ error: '未登录' }, 401);
        }

        if (env.DB) {
          try {
            const user = await getUserFromDB(env.DB, username);
            if (user) {
              return jsonResponse({ 
                subscribed: user.daily_subscribe === 1,
                email: user.email
              });
            }
          } catch (e) {
            console.error('Get subscribe status error:', e);
          }
        }

        return jsonResponse({ subscribed: false, email: null });
      }

      // POST /api/daily/subscribe - 订阅/取消订阅日报
      if (path === '/api/daily/subscribe' && request.method === 'POST') {
        const username = await verifyToken(request, env);
        if (!username) {
          return jsonResponse({ error: '未登录' }, 401);
        }

        const { subscribe } = await request.json();
        
        if (typeof subscribe !== 'boolean') {
          return jsonResponse({ error: '参数错误' }, 400);
        }

        if (!env.DB) {
          return jsonResponse({ error: '服务暂不可用' }, 500);
        }

        try {
          const user = await getUserFromDB(env.DB, username);
          if (!user) {
            return jsonResponse({ error: '用户不存在' }, 404);
          }

          // 订阅需要绑定邮箱
          if (subscribe && !user.email) {
            return jsonResponse({ error: '请先绑定邮箱' }, 400);
          }

          await env.DB.prepare('UPDATE users SET daily_subscribe = ?, updated_at = CURRENT_TIMESTAMP WHERE username = ?')
            .bind(subscribe ? 1 : 0, username).run();

          return jsonResponse({ 
            success: true, 
            subscribed: subscribe,
            message: subscribe ? '订阅成功，每日早报将发送到您的邮箱' : '已取消订阅'
          });
        } catch (e) {
          console.error('Update subscribe error:', e);
          return jsonResponse({ error: '操作失败' }, 500);
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
          console.log('查询日报:', date);
          
          const result = await env.DB.prepare(`
            SELECT report_date, content, news_count, created_at 
            FROM daily_reports 
            WHERE report_date = ?
          `).bind(date).first();
          
          console.log('查询结果:', result ? '找到' : '未找到');
          
          if (!result) {
            return jsonResponse({ error: '日报不存在', date }, 404);
          }
          
          // 安全解析 JSON
          let content;
          try {
            content = JSON.parse(result.content);
          } catch (parseErr) {
            console.error('日报内容解析失败:', parseErr);
            return jsonResponse({ error: '日报内容格式错误' }, 500);
          }
          
          return jsonResponse({
            date: result.report_date,
            content,
            newsCount: result.news_count,
            createdAt: result.created_at
          });
        } catch (e) {
          console.error('获取日报失败:', e);
          return jsonResponse({ error: e.message, stack: e.stack?.substring(0, 200) }, 500);
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
      
      // POST /api/admin/test-daily-email - 测试发送日报邮件（管理员）
      if (path === '/api/admin/test-daily-email' && request.method === 'POST') {
        const username = await verifyToken(request, env);
        if (!username || !ADMIN_USERS.includes(username)) {
          return jsonResponse({ error: '无权限' }, 403);
        }
        
        const { email } = await request.json();
        if (!email) {
          return jsonResponse({ error: '邮箱不能为空' }, 400);
        }
        
        // 邮箱格式验证
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
          return jsonResponse({ error: '邮箱格式不正确' }, 400);
        }
        
        try {
          if (!env.DB) {
            return jsonResponse({ error: '数据库未配置' }, 500);
          }
          
          await initDB(env.DB);
          
          // 获取最新日报
          const result = await env.DB.prepare(`
            SELECT report_date, content FROM daily_reports 
            ORDER BY report_date DESC LIMIT 1
          `).first();
          
          if (!result) {
            return jsonResponse({ error: '暂无日报，请先生成日报' }, 404);
          }
          
          const reportContent = JSON.parse(result.content);
          
          // 生成截图 URL
          const screenshotUrl = generateDailyReportScreenshotUrl(result.report_date, env);
          console.log('测试邮件截图 URL:', screenshotUrl ? '已生成' : '未生成（缺少 SCREENSHOT_API_KEY）');
          
          // 发送测试邮件
          await sendDailyReportEmail(email, result.report_date, reportContent, env, screenshotUrl);
          
          return jsonResponse({ 
            success: true, 
            message: `测试邮件已发送到 ${email}`,
            date: result.report_date,
            hasImage: !!screenshotUrl
          });
        } catch (e) {
          console.error('发送测试邮件失败:', e);
          return jsonResponse({ error: e.message }, 500);
        }
      }

      // POST /api/admin/test-wechat-mp - 测试发布到微信公众号（管理员）
      if (path === '/api/admin/test-wechat-mp' && request.method === 'POST') {
        const username = await verifyToken(request, env);
        if (!username || !ADMIN_USERS.includes(username)) {
          return jsonResponse({ error: '无权限' }, 403);
        }
        
        const { autoPublish = false } = await request.json().catch(() => ({}));
        
        try {
          // 检查微信配置
          const { checkWechatMPConfig, publishToWechatMP } = await import('./wechat-mp.js');
          const wechatConfig = checkWechatMPConfig(env);
          
          if (!wechatConfig.configured) {
            return jsonResponse({ 
              error: '微信公众号未配置',
              config: wechatConfig,
              hint: '请配置 WECHAT_MP_APPID 和 WECHAT_MP_SECRET'
            }, 400);
          }
          
          if (!env.DB) {
            return jsonResponse({ error: '数据库未配置' }, 500);
          }
          
          await initDB(env.DB);
          
          // 获取最新日报
          const result = await env.DB.prepare(`
            SELECT report_date, content FROM daily_reports 
            ORDER BY report_date DESC LIMIT 1
          `).first();
          
          if (!result) {
            return jsonResponse({ error: '暂无日报，请先生成日报' }, 404);
          }
          
          const reportContent = JSON.parse(result.content);
          
          // 封面图：Market Tone 卡片截图
          const coverImageUrl = generateCoverScreenshotUrl(result.report_date, env);
          // 日报截图（放在文章底部）
          const reportImageUrl = generateDailyReportScreenshotUrl(result.report_date, env);
          console.log('微信测试封面图:', coverImageUrl ? '已生成' : '未生成');
          console.log('微信测试日报截图:', reportImageUrl ? '已生成' : '未生成');
          
          // 发布到微信公众号
          const wechatResult = await publishToWechatMP(
            reportContent, 
            result.report_date, 
            env, 
            coverImageUrl,
            reportImageUrl,
            autoPublish
          );
          
          return jsonResponse({ 
            success: wechatResult.success,
            date: result.report_date,
            hasCoverImage: !!coverImageUrl,
            hasReportImage: !!reportImageUrl,
            autoPublish,
            ...wechatResult
          });
        } catch (e) {
          console.error('测试微信公众号发布失败:', e);
          return jsonResponse({ error: e.message }, 500);
        }
      }

      // GET /api/admin/wechat-config - 获取微信公众号配置状态（管理员）
      if (path === '/api/admin/wechat-config' && request.method === 'GET') {
        const username = await verifyToken(request, env);
        if (!username || !ADMIN_USERS.includes(username)) {
          return jsonResponse({ error: '无权限' }, 403);
        }
        
        const { checkWechatMPConfig } = await import('./wechat-mp.js');
        const config = checkWechatMPConfig(env);
        
        return jsonResponse({
          ...config,
          hint: config.configured 
            ? '微信公众号已配置，可以发布文章' 
            : '请配置 WECHAT_MP_APPID 和 WECHAT_MP_SECRET'
        });
      }

      return jsonResponse({ error: 'Not found' }, 404);
    } catch (err) {
      return jsonResponse({ error: err.message }, 500);
    }
  },
  
  // 定时任务
  // - 6:00 (UTC 22:00): 生成日报 + 邮件 + 微信草稿
  // - 7:30 (UTC 23:30): 检查微信是否已发布，未发布则自动发布
  async scheduled(event, env, ctx) {
    console.log('Cron triggered:', event.cron, new Date().toISOString());
    
    if (event.cron === '0 22 * * *') {
      // 6:00 - 生成日报，微信只创建草稿不发布
      ctx.waitUntil(generateDailyReport(env, true, false)); // isScheduled=true, autoPublishWechat=false
    } else if (event.cron === '30 23 * * *') {
      // 7:30 - 检查并发布微信
      ctx.waitUntil(checkAndPublishWechat(env));
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

// 上海指数代码列表（000开头的上海指数）
const SH_INDEX_CODES = [
  '000001', '000002', '000003', '000010', '000016', '000017',
  '000300', '000688', '000905', '000852'
]

/**
 * 获取市场代码（上海=1，深圳=0）
 */
function getMarketCode(symbol) {
  if (symbol.startsWith('6')) return 1
  if (SH_INDEX_CODES.includes(symbol)) return 1
  return 0
}

async function fetchRealtimeData(symbol) {
  // 使用单股票查询接口
  const marketCode = getMarketCode(symbol)
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
  const marketCode = getMarketCode(symbol)
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
  const marketCode = getMarketCode(symbol)
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
  const marketCode = getMarketCode(symbol)
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
 * @param {boolean} isScheduled - 是否是定时任务触发（6点自动生成，邮件7点推送）
 * @param {boolean} autoPublishWechat - 是否自动发布微信（false=只创建草稿）
 * 
 * 手动触发：读取过去24小时的新闻
 * 定时触发：读取昨天6点到今天6点的新闻
 */
async function generateDailyReport(env, isScheduled = false, autoPublishWechat = true) {
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
    // 今天北京6点 = UTC 22:00（前一天）
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
  
  // 处理 thinking 模型的输出格式
  let content = llmData.choices?.[0]?.message?.content;
  
  // 如果有 thinking 字段，忽略它，只取 content
  if (llmData.choices?.[0]?.message?.thinking) {
    console.log('检测到 thinking 模型输出，忽略 thinking 部分');
  }
  
  if (!content) {
    throw new Error('LLM 返回内容为空');
  }
  
  // 解析 JSON - 加强提取逻辑
  let reportJson;
  try {
    // 1. 先尝试提取 ```json ... ``` 代码块
    let jsonStr = null;
    const codeBlockMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
    if (codeBlockMatch) {
      jsonStr = codeBlockMatch[1].trim();
    }
    
    // 2. 如果没有代码块，尝试找到第一个 { 和最后一个 } 之间的内容
    if (!jsonStr) {
      const firstBrace = content.indexOf('{');
      const lastBrace = content.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        jsonStr = content.substring(firstBrace, lastBrace + 1);
      }
    }
    
    // 3. 清理可能的干扰字符
    if (jsonStr) {
      // 移除可能的 BOM 或其他不可见字符
      jsonStr = jsonStr.replace(/^\uFEFF/, '').trim();
    }
    
    if (!jsonStr) {
      throw new Error('未找到有效的 JSON 内容');
    }
    
    reportJson = JSON.parse(jsonStr);
  } catch (e) {
    console.error('JSON 解析失败:', e.message);
    console.error('原始内容前500字符:', content.substring(0, 500));
    throw new Error(`日报 JSON 解析失败: ${e.message}`);
  }
  
  // 存入数据库
  await env.DB.prepare(`
    INSERT OR REPLACE INTO daily_reports (report_date, content, news_count)
    VALUES (?, ?, ?)
  `).bind(today, JSON.stringify(reportJson), newsList.length).run();
  
  console.log(`日报生成成功: ${today}`);
  
  // 发送日报邮件给订阅用户
  try {
    const subscribers = await env.DB.prepare(`
      SELECT email FROM users 
      WHERE daily_subscribe = 1 AND email IS NOT NULL AND email != ''
    `).all();
    
    const subscriberList = subscribers.results || [];
    console.log(`找到 ${subscriberList.length} 个订阅用户`);
    
    // 预先生成截图 URL（只调用一次，所有邮件共用）
    let screenshotUrl = null;
    if (subscriberList.length > 0) {
      screenshotUrl = generateDailyReportScreenshotUrl(today, env);
      if (screenshotUrl) {
        console.log('日报截图 URL 已生成（将被所有邮件共用）');
      } else {
        console.log('未生成截图 URL，SCREENSHOT_API_KEY 是否配置:', !!env.SCREENSHOT_API_KEY);
      }
    }
    
    let sentCount = 0;
    let failCount = 0;
    
    for (const sub of subscriberList) {
      try {
        await sendDailyReportEmail(sub.email, today, reportJson, env, screenshotUrl);
        sentCount++;
        console.log(`日报邮件已发送: ${sub.email}`);
      } catch (e) {
        failCount++;
        console.error(`发送日报邮件失败 (${sub.email}):`, e.message);
      }
    }
    
    console.log(`日报邮件发送完成: 成功 ${sentCount}, 失败 ${failCount}`);
  } catch (e) {
    console.error('获取订阅用户失败:', e);
  }
  
  // 发布到微信公众号（根据 autoPublishWechat 决定是否直接发布）
  let wechatResult = null;
  try {
    const { publishToWechatMP, checkWechatMPConfig } = await import('./wechat-mp.js');
    const wechatConfig = checkWechatMPConfig(env);
    
    if (wechatConfig.configured) {
      // 封面图：Market Tone 卡片截图
      const coverImageUrl = generateCoverScreenshotUrl(today, env);
      // 日报截图（放在文章底部）
      const reportImageUrl = generateDailyReportScreenshotUrl(today, env);
      wechatResult = await publishToWechatMP(reportJson, today, env, coverImageUrl, reportImageUrl, autoPublishWechat);
      console.log('微信公众号结果:', wechatResult);
    } else {
      console.log('微信公众号未配置，跳过发布');
    }
  } catch (e) {
    console.error('发布到微信公众号失败:', e);
    wechatResult = { success: false, error: e.message };
  }
  
  return { success: true, date: today, newsCount: newsList.length, wechat: wechatResult };
}

/**
 * 检查今日微信是否已发布，未发布则自动发布
 * 在 7:30 触发，给用户 1.5 小时手动审核和发布的时间
 */
async function checkAndPublishWechat(env) {
  console.log('检查微信公众号发布状态...');
  
  const { checkWechatMPConfig, getAccessToken, checkTodayPublished, publishDraft } = await import('./wechat-mp.js');
  const wechatConfig = checkWechatMPConfig(env);
  
  if (!wechatConfig.configured) {
    console.log('微信公众号未配置，跳过检查');
    return { success: false, reason: '未配置' };
  }
  
  try {
    const accessToken = await getAccessToken(env);
    
    // 检查今天是否已发布
    const isPublished = await checkTodayPublished(accessToken);
    
    if (isPublished) {
      console.log('今日已有发布内容，跳过自动发布');
      return { success: true, action: 'skipped', reason: '今日已发布' };
    }
    
    // 获取今天的草稿并发布
    const now = new Date();
    const beijingNow = new Date(now.getTime() + 8 * 60 * 60 * 1000);
    const today = beijingNow.toISOString().split('T')[0];
    
    const result = await publishDraft(accessToken, today, env);
    console.log('自动发布结果:', result);
    
    return result;
  } catch (e) {
    console.error('检查/发布失败:', e);
    return { success: false, error: e.message };
  }
}

/**
 * 构建日报生成的系统提示词
 */
function buildDailyReportPrompt() {
  return `你是顶级投行的首席A股策略分析师，拥有20年市场研究经验，曾任职于高盛、中金。你的早报被机构投资者视为每日必读，以精准的市场嗅觉、深度的逻辑推演和独到的板块洞察著称。

## 核心任务
从海量新闻中筛选出对A股最具影响力的信息，生成结构化早报 JSON。

## 输出格式
\`\`\`json
{
  "date": "2025.12.05",
  "intelligence": [
    {
      "category": "分类名称",
      "color": "tech/fin/geo/soc",
      "items": [
        { "title": "简短标题", "tag": "bullish/bearish/neutral", "tagText": "标签", "summary": "简要点评，包含事件背景和影响分析" }
      ]
    }
  ],
  "prediction": {
    "tone": "四字定调",
    "subtitle": "一句话副标题",
    "summary": "2-3句核心逻辑",
    "northbound": "北向资金判断",
    "volume": "成交量预期",
    "scenarios": [
      { "title": "开盘：xxx", "desc": "描述", "active": true/false },
      { "title": "盘中：xxx", "desc": "描述", "active": true/false },
      { "title": "收盘：xxx", "desc": "描述", "active": false }
    ]
  },
  "sectors": {
    "bullish": [{ "name": "板块名", "tag": "bullish", "tagText": "标签", "reason": "深度分析逻辑", "focus": "关注：xxx" }],
    "bearish": [{ "name": "板块名", "tag": "bearish", "tagText": "标签", "reason": "深度分析逻辑", "focus": "避雷：xxx" }]
  },
  "actionable": { "avoid": "关键词 · 关键词", "focus": "关键词 · 关键词" }
}
\`\`\`

## 关键要求

### 情报矩阵 intelligence
- 自由划分 4 个最相关的分类（如科技、金融、地缘、消费、能源、医药等）
- color 对应：tech(蓝)、fin(绿)、geo(橙)、soc(紫)
- **每个分类精选 3 条最重要的情报**，优先选择对市场影响最大的新闻
- tag 和 tagText 自由发挥，准确表达利好/利空/中性及程度
- **title 字段格式要求（极其重要！）**：
  - 必须简短精炼概括核心事件
  - ✅ 正确示例："火箭回收失败"、"影子银行风暴"、"中美司法交锋"、"中日关系紧张"
  - ❌ 错误示例："英伟达H200获批对华销售，阿里或成前沿市场"（太长，像新闻标题）
- **summary 字段格式要求**：
  - 必须详实，包含完整上下文和影响分析
  - 示例1："英伟达H200受审；国产GPU“伊露维塔”亮相+闻泰保供，催化自主可控。"
  - 示例2：“长征12A实验失败，打击商业航天情绪。但“青州号”飞船亮相。”

### 大盘研判 prediction
- northbound 和 volume：自由分析，简练而有深度，点明核心判断
- HTML高亮关键词：利空用 <span class="text-bear-text font-bold">xxx</span>，利好用 <span class="text-bull-text font-bold">xxx</span>
- scenarios 的 active 表示大概率发生

### 板块分析 sectors（重点！）
- bullish 和 bearish 各 3 个板块
- **reason 字段要求深度分析**：
  - 不要只写一句话，要有 2-3 句完整的逻辑链条
  - 包含：新闻事件 → 影响传导 → 板块受益/受损逻辑 → 持续性判断
  - 例如："英伟达H200获批对华出口，打破此前市场对算力封锁的悲观预期。国内AI算力需求持续高涨，叠加国产GPU厂商加速追赶，软硬件生态有望同步受益。短期情绪驱动明显，但需关注后续政策变化。"

## 输出要求
- 只输出 JSON，不要任何解释
- **禁止引用新闻编号**：不要在文本中出现 (News X)、(新闻X) 等来源标注，直接陈述事实即可`;
}
