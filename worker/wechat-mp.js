/**
 * 微信公众号 API 模块
 * 用于自动发布日报文章到认证服务号
 * 
 * 需要配置的环境变量（Secrets）：
 * - WECHAT_MP_APPID: 公众号 AppID
 * - WECHAT_MP_SECRET: 公众号 AppSecret
 * 
 * API 文档：https://developers.weixin.qq.com/doc/offiaccount/Getting_Started/Overview.html
 */

// Access Token 缓存 Key
const ACCESS_TOKEN_KEY = 'wechat_mp_access_token'

/**
 * 获取 Access Token（带缓存）
 * Token 有效期 2 小时，提前 10 分钟刷新
 */
export async function getAccessToken(env) {
  if (!env.WECHAT_MP_APPID || !env.WECHAT_MP_SECRET) {
    throw new Error('微信公众号配置缺失：WECHAT_MP_APPID 或 WECHAT_MP_SECRET')
  }

  // 尝试从 KV 读取缓存的 token
  if (env.CONFIG_KV) {
    const cached = await env.CONFIG_KV.get(ACCESS_TOKEN_KEY, 'json')
    if (cached && cached.expires_at > Date.now() + 600000) { // 提前10分钟刷新
      return cached.access_token
    }
  }

  // 请求新的 token
  const url = `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${env.WECHAT_MP_APPID}&secret=${env.WECHAT_MP_SECRET}`
  
  const response = await fetch(url)
  const data = await response.json()

  if (data.errcode) {
    throw new Error(`获取 access_token 失败: ${data.errcode} ${data.errmsg}`)
  }

  const tokenData = {
    access_token: data.access_token,
    expires_at: Date.now() + data.expires_in * 1000
  }

  // 缓存到 KV
  if (env.CONFIG_KV) {
    await env.CONFIG_KV.put(ACCESS_TOKEN_KEY, JSON.stringify(tokenData), {
      expirationTtl: data.expires_in
    })
  }

  return data.access_token
}

/**
 * 上传永久图片素材（用于文章封面和正文图片）
 * @param {string} imageUrl - 图片 URL
 * @returns {object} { media_id, url }
 */
async function uploadPermanentImage(accessToken, imageUrl) {
  // 先下载图片
  const imageResponse = await fetch(imageUrl)
  if (!imageResponse.ok) {
    throw new Error('下载图片失败: ' + imageResponse.status)
  }
  
  const imageBuffer = await imageResponse.arrayBuffer()
  
  // 构建 multipart/form-data
  const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2)
  const filename = 'daily_report.png'
  
  const header = `--${boundary}\r\nContent-Disposition: form-data; name="media"; filename="${filename}"\r\nContent-Type: image/png\r\n\r\n`
  const footer = `\r\n--${boundary}--\r\n`
  
  const headerBytes = new TextEncoder().encode(header)
  const footerBytes = new TextEncoder().encode(footer)
  const imageBytes = new Uint8Array(imageBuffer)
  
  const body = new Uint8Array(headerBytes.length + imageBytes.length + footerBytes.length)
  body.set(headerBytes, 0)
  body.set(imageBytes, headerBytes.length)
  body.set(footerBytes, headerBytes.length + imageBytes.length)
  
  const url = `https://api.weixin.qq.com/cgi-bin/material/add_material?access_token=${accessToken}&type=image`
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': `multipart/form-data; boundary=${boundary}`
    },
    body: body
  })
  
  const data = await response.json()
  
  if (data.errcode) {
    throw new Error(`上传永久图片失败: ${data.errcode} ${data.errmsg}`)
  }
  
  return { media_id: data.media_id, url: data.url }
}

/**
 * 构建文章 HTML 内容（以图片为主）
 */
function buildArticleContent(reportContent, date, imageUrl) {
  const prediction = reportContent.prediction || {}
  
  // 微信公众号文章：以图片为主，配合简短文字
  let html = `
<section style="text-align: center; padding: 20px 0;">
  <img src="${imageUrl}" style="max-width: 100%; border-radius: 8px;" />
</section>

<section style="padding: 16px; background: #f8f9fa; border-radius: 8px; margin: 16px 0;">
  <p style="font-size: 15px; color: #333; line-height: 1.8; margin: 0;">
    ${prediction.summary || '每日A股市场分析与投资建议'}
  </p>
</section>

<section style="text-align: center; color: #999; font-size: 13px; margin-top: 24px;">
  <p>📊 完整日报请访问 Fintell</p>
  <p>board.newestgpt.com</p>
</section>
`
  return html
}

/**
 * 构建纯文字文章内容（备用方案，无截图时使用）
 */
function buildTextArticleContent(reportContent, date) {
  const prediction = reportContent.prediction || {}
  const sectors = reportContent.sectors || {}
  const actionable = reportContent.actionable || {}

  let html = `<section style="padding: 16px;">`
  
  // 大盘预判
  if (prediction.summary) {
    html += `
<h2 style="font-size: 18px; color: #333; border-left: 4px solid #7c3aed; padding-left: 12px; margin: 20px 0 12px;">📊 大盘预判</h2>
<p style="font-size: 15px; color: #333; line-height: 1.8; background: #f8f9fa; padding: 12px; border-radius: 8px;">${prediction.summary}</p>
`
  }

  // 看多板块
  if (sectors.bullish?.length > 0) {
    html += `<h2 style="font-size: 18px; color: #333; border-left: 4px solid #22c55e; padding-left: 12px; margin: 20px 0 12px;">🔥 看多板块</h2>`
    sectors.bullish.slice(0, 3).forEach(s => {
      html += `
<div style="background: #f0fdf4; border-left: 3px solid #22c55e; padding: 12px; margin: 8px 0; border-radius: 4px;">
  <p style="font-weight: bold; color: #16a34a; margin: 0 0 4px;">${s.name}</p>
  <p style="font-size: 14px; color: #333; margin: 0;">${s.reason || ''}</p>
</div>`
    })
  }

  // 看空板块
  if (sectors.bearish?.length > 0) {
    html += `<h2 style="font-size: 18px; color: #333; border-left: 4px solid #ef4444; padding-left: 12px; margin: 20px 0 12px;">⚠️ 风险提示</h2>`
    sectors.bearish.slice(0, 2).forEach(s => {
      html += `
<div style="background: #fef2f2; border-left: 3px solid #ef4444; padding: 12px; margin: 8px 0; border-radius: 4px;">
  <p style="font-weight: bold; color: #dc2626; margin: 0 0 4px;">${s.name}</p>
  <p style="font-size: 14px; color: #333; margin: 0;">${s.reason || ''}</p>
</div>`
    })
  }

  // 操作建议
  if (actionable.focus?.length > 0) {
    html += `<h2 style="font-size: 18px; color: #333; border-left: 4px solid #7c3aed; padding-left: 12px; margin: 20px 0 12px;">💡 操作建议</h2>`
    actionable.focus.slice(0, 3).forEach(item => {
      html += `<p style="font-size: 14px; color: #333; line-height: 1.8;">• ${item}</p>`
    })
  }

  html += `
<section style="text-align: center; color: #999; font-size: 12px; margin-top: 32px; padding-top: 16px; border-top: 1px solid #eee;">
  <p>Fintell 智能投资助手</p>
  <p>每日早报 · 助您把握市场脉搏</p>
</section>
</section>`

  return html
}

/**
 * 新建草稿
 * @returns {string} media_id (草稿 ID)
 */
async function createDraft(accessToken, article) {
  const url = `https://api.weixin.qq.com/cgi-bin/draft/add?access_token=${accessToken}`
  
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      articles: [article]
    })
  })
  
  const data = await response.json()
  
  if (data.errcode) {
    throw new Error(`新建草稿失败: ${data.errcode} ${data.errmsg}`)
  }
  
  return data.media_id
}

/**
 * 发布文章（从草稿发布）
 * @returns {string} publish_id
 */
async function publishArticle(accessToken, mediaId) {
  const url = `https://api.weixin.qq.com/cgi-bin/freepublish/submit?access_token=${accessToken}`
  
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      media_id: mediaId
    })
  })
  
  const data = await response.json()
  
  if (data.errcode) {
    throw new Error(`发布文章失败: ${data.errcode} ${data.errmsg}`)
  }
  
  return data.publish_id
}

/**
 * 发布日报到微信公众号
 * @param {object} reportContent - 日报内容
 * @param {string} date - 日期 YYYY-MM-DD
 * @param {object} env - Worker 环境变量
 * @param {string} screenshotUrl - 日报截图 URL
 * @param {boolean} autoPublish - 是否自动发布（false 则只创建草稿）
 */
export async function publishToWechatMP(reportContent, date, env, screenshotUrl = null, autoPublish = true) {
  console.log('开始发布日报到微信公众号...')
  
  // 检查配置
  if (!env.WECHAT_MP_APPID || !env.WECHAT_MP_SECRET) {
    console.log('微信公众号未配置，跳过发布')
    return { success: false, reason: '未配置微信公众号' }
  }
  
  try {
    // 1. 获取 access_token
    const accessToken = await getAccessToken(env)
    console.log('获取 access_token 成功')
    
    // 2. 上传截图作为封面和正文图片
    let thumbMediaId = null
    let contentImageUrl = null
    
    if (screenshotUrl) {
      try {
        console.log('上传日报截图...')
        const imageResult = await uploadPermanentImage(accessToken, screenshotUrl)
        thumbMediaId = imageResult.media_id
        contentImageUrl = imageResult.url
        console.log('截图上传成功:', thumbMediaId)
      } catch (e) {
        console.warn('截图上传失败:', e.message)
      }
    }
    
    // 3. 构建文章内容
    const formattedDate = date.replace(/-/g, '.')
    const content = contentImageUrl 
      ? buildArticleContent(reportContent, date, contentImageUrl)
      : buildTextArticleContent(reportContent, date)
    
    const article = {
      title: `Fintell 每日早报 ${formattedDate}`,
      author: 'Fintell',
      digest: reportContent.prediction?.summary?.substring(0, 120) || '每日A股市场分析与投资建议',
      content: content,
      content_source_url: `https://board.newestgpt.com/?page=daily&date=${date}`,
      need_open_comment: 1,
      only_fans_can_comment: 0
    }
    
    // 如果有封面图
    if (thumbMediaId) {
      article.thumb_media_id = thumbMediaId
    }
    
    // 4. 新建草稿
    const draftMediaId = await createDraft(accessToken, article)
    console.log('草稿创建成功:', draftMediaId)
    
    // 5. 是否自动发布
    let publishId = null
    if (autoPublish) {
      publishId = await publishArticle(accessToken, draftMediaId)
      console.log('文章发布成功:', publishId)
    }
    
    return {
      success: true,
      draftMediaId,
      publishId,
      autoPublish,
      message: autoPublish ? '日报已发布到微信公众号' : '草稿已创建，请在公众号后台发布'
    }
  } catch (error) {
    console.error('发布到微信公众号失败:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

/**
 * 检查微信公众号配置状态
 */
export function checkWechatMPConfig(env) {
  return {
    configured: !!(env.WECHAT_MP_APPID && env.WECHAT_MP_SECRET),
    hasAppId: !!env.WECHAT_MP_APPID,
    hasSecret: !!env.WECHAT_MP_SECRET
  }
}
