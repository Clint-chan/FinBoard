/**
 * 微信公众号 API 模块 - 完整版
 * 按照网站日报截图的完整内容和顺序排版
 */

const ACCESS_TOKEN_KEY = 'wechat_mp_access_token'

/**
 * 生成 Market Tone 封面图 SVG
 * 直接在后端生成，不需要截图服务
 */
function generateCoverSVG(prediction, date) {
  const tone = prediction.tone || '震荡整理'
  const subtitle = prediction.subtitle || '关注结构性机会'
  const formattedDate = date.replace(/-/g, '.')
  
  // 计算文字长度来调整字体大小
  const toneSize = tone.length <= 4 ? 72 : tone.length <= 6 ? 60 : 48
  
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="900" height="500" viewBox="0 0 900 500" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#1e1b4b"/>
      <stop offset="40%" style="stop-color:#312e81"/>
      <stop offset="100%" style="stop-color:#4c1d95"/>
    </linearGradient>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="4" stdDeviation="10" flood-color="#000" flood-opacity="0.3"/>
    </filter>
  </defs>
  
  <!-- 背景 -->
  <rect width="900" height="500" fill="url(#bg)"/>
  
  <!-- 装饰圆 -->
  <circle cx="820" cy="80" r="120" fill="rgba(255,255,255,0.03)"/>
  <circle cx="100" cy="450" r="100" fill="rgba(255,255,255,0.02)"/>
  <circle cx="750" cy="400" r="60" fill="rgba(255,255,255,0.02)"/>
  
  <!-- MARKET TONE 标签 -->
  <text x="450" y="160" text-anchor="middle" fill="rgba(255,255,255,0.5)" font-family="Arial, sans-serif" font-size="14" letter-spacing="4">MARKET TONE</text>
  
  <!-- 主标题 -->
  <text x="450" y="260" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="${toneSize}" font-weight="800" letter-spacing="4" filter="url(#shadow)">${tone}</text>
  
  <!-- 副标题 -->
  <text x="450" y="320" text-anchor="middle" fill="rgba(255,255,255,0.85)" font-family="Arial, sans-serif" font-size="20">${subtitle}</text>
  
  <!-- 日期 -->
  <text x="450" y="400" text-anchor="middle" fill="rgba(255,255,255,0.4)" font-family="Arial, sans-serif" font-size="16" letter-spacing="2">${formattedDate}</text>
  
  <!-- 底部品牌 -->
  <text x="450" y="460" text-anchor="middle" fill="rgba(255,255,255,0.3)" font-family="Arial, sans-serif" font-size="12" letter-spacing="1">Fintell · A股投资早报</text>
</svg>`
}

/**
 * 将 SVG 转换为 PNG（通过 Cloudflare 的 resvg）
 * 注意：Cloudflare Workers 原生不支持 SVG 转 PNG
 * 但微信支持直接上传 SVG 作为图片素材（会自动转换）
 */
function svgToBuffer(svg) {
  return new TextEncoder().encode(svg)
}

/**
 * 获取 Access Token（带缓存）
 */
export async function getAccessToken(env) {
  if (!env.WECHAT_MP_APPID || !env.WECHAT_MP_SECRET) {
    throw new Error('微信公众号配置缺失')
  }

  if (env.CONFIG_KV) {
    const cached = await env.CONFIG_KV.get(ACCESS_TOKEN_KEY, 'json')
    if (cached && cached.expires_at > Date.now() + 600000) {
      return cached.access_token
    }
  }

  const url = `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${env.WECHAT_MP_APPID}&secret=${env.WECHAT_MP_SECRET}`
  const response = await fetch(url)
  const data = await response.json()

  if (data.errcode) {
    throw new Error(`获取 access_token 失败: ${data.errcode} ${data.errmsg}`)
  }

  if (env.CONFIG_KV) {
    await env.CONFIG_KV.put(ACCESS_TOKEN_KEY, JSON.stringify({
      access_token: data.access_token,
      expires_at: Date.now() + data.expires_in * 1000
    }), { expirationTtl: data.expires_in })
  }

  return data.access_token
}

/**
 * 上传 SVG 作为永久图片素材
 * 微信会自动将 SVG 转换为 PNG
 */
async function uploadSVGAsImage(accessToken, svgContent) {
  const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2)
  
  // SVG 文件内容
  const svgBytes = new TextEncoder().encode(svgContent)
  
  const header = `--${boundary}\r\nContent-Disposition: form-data; name="media"; filename="cover.svg"\r\nContent-Type: image/svg+xml\r\n\r\n`
  const footer = `\r\n--${boundary}--\r\n`
  
  const headerBytes = new TextEncoder().encode(header)
  const footerBytes = new TextEncoder().encode(footer)
  
  const body = new Uint8Array(headerBytes.length + svgBytes.length + footerBytes.length)
  body.set(headerBytes, 0)
  body.set(svgBytes, headerBytes.length)
  body.set(footerBytes, headerBytes.length + svgBytes.length)
  
  const response = await fetch(
    `https://api.weixin.qq.com/cgi-bin/material/add_material?access_token=${accessToken}&type=image`,
    {
      method: 'POST',
      headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` },
      body: body
    }
  )
  
  const data = await response.json()
  if (data.errcode) throw new Error(`上传 SVG 失败: ${data.errcode} ${data.errmsg}`)
  
  return { media_id: data.media_id, url: data.url }
}

/**
 * 上传永久图片素材
 */
async function uploadPermanentImage(accessToken, imageUrl) {
  const imageResponse = await fetch(imageUrl)
  if (!imageResponse.ok) throw new Error('下载图片失败')
  
  const imageBuffer = await imageResponse.arrayBuffer()
  const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2)
  
  const header = `--${boundary}\r\nContent-Disposition: form-data; name="media"; filename="cover.png"\r\nContent-Type: image/png\r\n\r\n`
  const footer = `\r\n--${boundary}--\r\n`
  
  const headerBytes = new TextEncoder().encode(header)
  const footerBytes = new TextEncoder().encode(footer)
  const imageBytes = new Uint8Array(imageBuffer)
  
  const body = new Uint8Array(headerBytes.length + imageBytes.length + footerBytes.length)
  body.set(headerBytes, 0)
  body.set(imageBytes, headerBytes.length)
  body.set(footerBytes, headerBytes.length + imageBytes.length)
  
  const response = await fetch(
    `https://api.weixin.qq.com/cgi-bin/material/add_material?access_token=${accessToken}&type=image`,
    {
      method: 'POST',
      headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` },
      body: body
    }
  )
  
  const data = await response.json()
  if (data.errcode) throw new Error(`上传图片失败: ${data.errcode} ${data.errmsg}`)
  
  return { media_id: data.media_id, url: data.url }
}

/**
 * 生成文章标题
 */
function buildArticleTitle(reportContent, date) {
  const prediction = reportContent.prediction || {}
  const tone = prediction.tone || '震荡整理'
  const subtitle = prediction.subtitle || '关注结构性机会'
  const formattedDate = date.replace(/-/g, '.').substring(5)
  return `A股投资早报｜${formattedDate}｜${tone} · ${subtitle}`
}

/**
 * 生成文章摘要
 */
function buildArticleDigest(reportContent) {
  const prediction = reportContent.prediction || {}
  return (prediction.summary || '每日A股市场分析与投资建议')
    .replace(/<[^>]+>/g, '')
    .substring(0, 120)
}

/**
 * 构建完整公众号文章 HTML
 * 顺序：情报矩阵 → 大盘研判 → 板块分析 → 今日策略 → 截图 → 页脚
 */
function buildArticleContent(reportContent, date, coverImageUrl) {
  const formattedDate = date.replace(/-/g, '.')
  const prediction = reportContent.prediction || {}
  const sectors = reportContent.sectors || {}
  const intelligence = reportContent.intelligence || []
  const actionable = reportContent.actionable || {}

  // 分类颜色映射
  const categoryColors = {
    tech: { bg: '#eff6ff', border: '#3b82f6', text: '#1d4ed8' },
    fin: { bg: '#f0fdf4', border: '#22c55e', text: '#15803d' },
    geo: { bg: '#fff7ed', border: '#f97316', text: '#c2410c' },
    soc: { bg: '#faf5ff', border: '#a855f7', text: '#7e22ce' },
    other: { bg: '#f9fafb', border: '#6b7280', text: '#374151' }
  }

  // 标签颜色
  const tagColors = {
    bullish: { bg: '#dcfce7', color: '#15803d' },
    bearish: { bg: '#fee2e2', color: '#b91c1c' },
    neutral: { bg: '#f3f4f6', color: '#4b5563' }
  }

  let html = `
<section style="max-width: 100%; margin: 0 auto; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif; color: #1a1a1a; line-height: 1.75; font-size: 15px;">

<!-- 顶部日期 -->
<section style="text-align: center; padding: 16px 0 20px; color: #9ca3af; font-size: 13px;">${formattedDate} · A股投资早报</section>

<!-- ========== 情报矩阵 Intelligence Matrix ========== -->
<section style="margin: 0 16px 28px;">
  <section style="font-size: 17px; font-weight: 700; color: #1a1a1a; margin-bottom: 20px; padding-bottom: 10px; border-bottom: 2px solid #1a1a1a;">情报矩阵 Intelligence Matrix</section>
  
  ${intelligence.map(cat => {
    const colors = categoryColors[cat.color] || categoryColors.other
    return `
  <!-- ${cat.category} -->
  <section style="margin-bottom: 20px;">
    <section style="display: inline-block; background: ${colors.bg}; color: ${colors.text}; font-size: 13px; font-weight: 600; padding: 4px 12px; border-radius: 4px; margin-bottom: 12px; border-left: 3px solid ${colors.border};">${cat.category}</section>
    
    ${(cat.items || []).map(item => {
      const tag = tagColors[item.tag] || tagColors.neutral
      return `
    <section style="margin-bottom: 14px; padding-left: 12px; border-left: 2px solid #e5e7eb;">
      <section style="display: flex; align-items: center; margin-bottom: 4px;">
        <span style="font-size: 15px; font-weight: 600; color: #1a1a1a;">${item.title}</span>
        <span style="margin-left: 8px; background: ${tag.bg}; color: ${tag.color}; font-size: 11px; padding: 1px 6px; border-radius: 3px;">${item.tagText}</span>
      </section>
      <section style="font-size: 14px; color: #4b5563; line-height: 1.7;">${item.summary}</section>
    </section>
      `
    }).join('')}
  </section>
    `
  }).join('')}
</section>

<!-- 分割线 -->
<section style="margin: 0 16px 28px; border-top: 1px dashed #d1d5db;"></section>

<!-- ========== 大盘核心研判 Core Prediction ========== -->
<section style="margin: 0 16px 28px;">
  <section style="font-size: 17px; font-weight: 700; color: #1a1a1a; margin-bottom: 20px; padding-bottom: 10px; border-bottom: 2px solid #1a1a1a;">大盘核心研判 Core Prediction</section>
  
  <!-- Market Tone 卡片 -->
  <section style="background: linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #4c1d95 100%); border-radius: 12px; padding: 24px 20px; margin-bottom: 20px; position: relative; overflow: hidden;">
    <section style="position: absolute; top: -20px; right: -20px; width: 80px; height: 80px; background: rgba(255,255,255,0.05); border-radius: 50%;"></section>
    <section style="position: relative; z-index: 1;">
      <section style="color: rgba(255,255,255,0.5); font-size: 11px; letter-spacing: 2px; margin-bottom: 10px;">MARKET TONE</section>
      <section style="color: white; font-size: 28px; font-weight: 700; margin-bottom: 6px; letter-spacing: 1px;">${prediction.tone || '震荡整理'}</section>
      <section style="color: rgba(255,255,255,0.8); font-size: 14px;">${prediction.subtitle || ''}</section>
    </section>
  </section>
  
  <!-- 核心逻辑 -->
  <section style="background: #f8fafc; border-radius: 8px; padding: 16px; margin-bottom: 20px; border-left: 3px solid #6366f1;">
    <section style="font-size: 14px; line-height: 1.85; color: #374151;">
      ${(prediction.summary || '').replace(/class="[^"]*"/g, 'style="font-weight:600;"').replace(/class='[^']*'/g, 'style="font-weight:600;"')}
    </section>
  </section>
  
  <!-- 资金与情绪面 -->
  <section style="margin-bottom: 20px;">
    <section style="font-size: 14px; font-weight: 600; color: #374151; margin-bottom: 12px;">资金与情绪面</section>
    <section style="display: flex; gap: 12px;">
      <section style="flex: 1; background: #fafafa; border-radius: 8px; padding: 14px;">
        <section style="font-size: 12px; color: #6b7280; margin-bottom: 6px;">北向资金/外资</section>
        <section style="font-size: 13px; color: #374151; line-height: 1.7;">${prediction.northbound || '--'}</section>
      </section>
      <section style="flex: 1; background: #fafafa; border-radius: 8px; padding: 14px;">
        <section style="font-size: 12px; color: #6b7280; margin-bottom: 6px;">成交量预期</section>
        <section style="font-size: 13px; color: #374151; line-height: 1.7;">${prediction.volume || '--'}</section>
      </section>
    </section>
  </section>
  
  <!-- 全天剧本推演 -->
  ${prediction.scenarios?.length > 0 ? `
  <section>
    <section style="font-size: 14px; font-weight: 600; color: #374151; margin-bottom: 12px;">A股全天剧本推演</section>
    ${prediction.scenarios.map((s, i) => `
    <section style="display: flex; align-items: flex-start; margin-bottom: 12px;">
      <section style="width: 8px; height: 8px; border-radius: 50%; background: ${s.active ? '#10b981' : '#d1d5db'}; margin-top: 6px; margin-right: 12px; flex-shrink: 0;"></section>
      <section style="flex: 1;">
        <section style="font-size: 14px; font-weight: 500; color: ${s.active ? '#059669' : '#374151'};">${s.title}</section>
        <section style="font-size: 13px; color: #6b7280; margin-top: 2px;">${s.desc || ''}</section>
      </section>
    </section>
    `).join('')}
  </section>
  ` : ''}
</section>

<!-- 分割线 -->
<section style="margin: 0 16px 28px; border-top: 1px dashed #d1d5db;"></section>

<!-- ========== 板块分析 Sector Analysis ========== -->
<section style="margin: 0 16px 28px;">
  <section style="font-size: 17px; font-weight: 700; color: #1a1a1a; margin-bottom: 20px; padding-bottom: 10px; border-bottom: 2px solid #1a1a1a;">板块分析 Sector Analysis</section>
  
  <!-- 看多板块 -->
  ${sectors.bullish?.length > 0 ? `
  <section style="margin-bottom: 24px;">
    <section style="font-size: 15px; font-weight: 600; color: #059669; margin-bottom: 14px;">看多板块</section>
    ${sectors.bullish.map(s => `
    <section style="margin-bottom: 16px; padding: 16px; background: #f0fdf4; border-radius: 8px; border-left: 3px solid #22c55e;">
      <section style="display: flex; align-items: center; margin-bottom: 8px;">
        <span style="font-size: 15px; font-weight: 600; color: #15803d;">${s.name}</span>
        <span style="margin-left: 8px; background: #dcfce7; color: #15803d; font-size: 11px; padding: 2px 8px; border-radius: 3px;">${s.tagText || '利好'}</span>
      </section>
      <section style="font-size: 14px; color: #374151; line-height: 1.8; margin-bottom: 8px;">${s.reason || ''}</section>
      ${s.focus ? `<section style="font-size: 13px; color: #047857;">${s.focus}</section>` : ''}
    </section>
    `).join('')}
  </section>
  ` : ''}
  
  <!-- 看空板块 -->
  ${sectors.bearish?.length > 0 ? `
  <section>
    <section style="font-size: 15px; font-weight: 600; color: #dc2626; margin-bottom: 14px;">风险提示</section>
    ${sectors.bearish.map(s => `
    <section style="margin-bottom: 16px; padding: 16px; background: #fef2f2; border-radius: 8px; border-left: 3px solid #ef4444;">
      <section style="display: flex; align-items: center; margin-bottom: 8px;">
        <span style="font-size: 15px; font-weight: 600; color: #b91c1c;">${s.name}</span>
        <span style="margin-left: 8px; background: #fee2e2; color: #b91c1c; font-size: 11px; padding: 2px 8px; border-radius: 3px;">${s.tagText || '利空'}</span>
      </section>
      <section style="font-size: 14px; color: #374151; line-height: 1.8; margin-bottom: 8px;">${s.reason || ''}</section>
      ${s.focus ? `<section style="font-size: 13px; color: #991b1b;">${s.focus}</section>` : ''}
    </section>
    `).join('')}
  </section>
  ` : ''}
</section>

<!-- 分割线 -->
<section style="margin: 0 16px 28px; border-top: 1px dashed #d1d5db;"></section>

<!-- ========== 今日策略 ========== -->
${(actionable.focus || actionable.avoid) ? `
<section style="margin: 0 16px 28px;">
  <section style="font-size: 17px; font-weight: 700; color: #1a1a1a; margin-bottom: 20px; padding-bottom: 10px; border-bottom: 2px solid #1a1a1a;">今日策略</section>
  
  <section style="display: flex; gap: 12px;">
    ${actionable.focus ? `
    <section style="flex: 1; background: #f0fdf4; border-radius: 8px; padding: 16px; border: 1px solid #bbf7d0;">
      <section style="font-size: 12px; color: #6b7280; margin-bottom: 8px;">重点关注</section>
      <section style="font-size: 15px; font-weight: 600; color: #15803d;">${actionable.focus}</section>
    </section>
    ` : ''}
    ${actionable.avoid ? `
    <section style="flex: 1; background: #fef2f2; border-radius: 8px; padding: 16px; border: 1px solid #fecaca;">
      <section style="font-size: 12px; color: #6b7280; margin-bottom: 8px;">注意规避</section>
      <section style="font-size: 15px; font-weight: 600; color: #b91c1c;">${actionable.avoid}</section>
    </section>
    ` : ''}
  </section>
</section>
` : ''}

<!-- 日报截图 -->
${coverImageUrl ? `
<section style="margin: 0 16px 28px;">
  <section style="font-size: 13px; color: #9ca3af; margin-bottom: 10px; text-align: center;">${formattedDate}</section>
  <img src="${coverImageUrl}" style="width: 100%; border-radius: 8px;" />
</section>
` : ''}

<!-- 页脚 -->
<section style="margin: 32px 16px 0; padding: 24px 0; border-top: 1px solid #e5e7eb; text-align: center;">
  <section style="width: 40px; height: 40px; background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); border-radius: 10px; margin: 0 auto 10px; display: flex; align-items: center; justify-content: center;">
    <span style="color: white; font-size: 20px; font-weight: 700;">F</span>
  </section>
  <section style="font-size: 16px; font-weight: 600; color: #6366f1; margin-bottom: 4px;">Fintell</section>
  <section style="font-size: 13px; color: #9ca3af; margin-bottom: 8px;">您的私人投资助理</section>
  <section style="font-size: 12px; color: #6b7280;">board.newestgpt.com</section>
</section>

</section>`

  return html
}

/**
 * 新建草稿
 */
async function createDraft(accessToken, article) {
  const response = await fetch(
    `https://api.weixin.qq.com/cgi-bin/draft/add?access_token=${accessToken}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ articles: [article] })
    }
  )
  
  const data = await response.json()
  if (data.errcode) throw new Error(`新建草稿失败: ${data.errcode} ${data.errmsg}`)
  
  return data.media_id
}

/**
 * 发布文章
 */
async function publishArticle(accessToken, mediaId) {
  const response = await fetch(
    `https://api.weixin.qq.com/cgi-bin/freepublish/submit?access_token=${accessToken}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ media_id: mediaId })
    }
  )
  
  const data = await response.json()
  if (data.errcode) throw new Error(`发布文章失败: ${data.errcode} ${data.errmsg}`)
  
  return data.publish_id
}

/**
 * 发布日报到微信公众号
 * @param {object} reportContent - 日报内容
 * @param {string} date - 日期
 * @param {object} env - 环境变量
 * @param {string} coverImageUrl - 封面图 URL（截图服务生成的 Market Tone 卡片）
 * @param {string} reportImageUrl - 完整日报截图 URL（放在文章底部）
 * @param {boolean} autoPublish - 是否自动发布
 */
export async function publishToWechatMP(reportContent, date, env, coverImageUrl = null, reportImageUrl = null, autoPublish = true) {
  console.log('开始发布日报到微信公众号...')
  
  if (!env.WECHAT_MP_APPID || !env.WECHAT_MP_SECRET) {
    return { success: false, reason: '未配置微信公众号' }
  }
  
  try {
    const accessToken = await getAccessToken(env)
    console.log('获取 access_token 成功')
    
    // 上传封面图（Market Tone 卡片截图）
    let thumbMediaId = null
    if (coverImageUrl) {
      try {
        console.log('上传封面图...')
        const coverResult = await uploadPermanentImage(accessToken, coverImageUrl)
        thumbMediaId = coverResult.media_id
        console.log('封面图上传成功')
      } catch (e) {
        console.warn('封面图上传失败:', e.message)
      }
    }
    
    // 上传日报截图（放在文章底部）
    let contentImageUrl = null
    if (reportImageUrl) {
      try {
        console.log('上传日报截图...')
        const reportResult = await uploadPermanentImage(accessToken, reportImageUrl)
        contentImageUrl = reportResult.url
        console.log('日报截图上传成功')
      } catch (e) {
        console.warn('日报截图上传失败:', e.message)
      }
    }
    
    // 构建文章
    const article = {
      title: buildArticleTitle(reportContent, date),
      author: 'Fintell',
      digest: buildArticleDigest(reportContent),
      content: buildArticleContent(reportContent, date, contentImageUrl),
      content_source_url: `https://board.newestgpt.com/?page=daily&date=${date}`,
      need_open_comment: 1,
      only_fans_can_comment: 0
    }
    
    // 封面图
    if (thumbMediaId) {
      article.thumb_media_id = thumbMediaId
    }
    
    // 创建草稿
    const draftMediaId = await createDraft(accessToken, article)
    console.log('草稿创建成功:', draftMediaId)
    
    // 发布
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
      title: article.title,
      message: autoPublish ? '日报已发布到微信公众号' : '草稿已创建'
    }
  } catch (error) {
    console.error('发布失败:', error)
    return { success: false, error: error.message }
  }
}

/**
 * 检查配置状态
 */
export function checkWechatMPConfig(env) {
  return {
    configured: !!(env.WECHAT_MP_APPID && env.WECHAT_MP_SECRET),
    hasAppId: !!env.WECHAT_MP_APPID,
    hasSecret: !!env.WECHAT_MP_SECRET
  }
}
