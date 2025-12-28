/**
 * 微信公众号 API 模块 - 完整版
 * 按照网站日报截图的完整内容和顺序排版
 */

const ACCESS_TOKEN_KEY = 'wechat_mp_access_token'

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
 * 格式：A股投资早报｜12.28｜低开震荡
 */
function buildArticleTitle(reportContent, date) {
  const prediction = reportContent.prediction || {}
  const tone = prediction.tone || '震荡整理'
  const formattedDate = date.replace(/-/g, '.').substring(5)
  return `A股投资早报｜${formattedDate}｜${tone}`
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

// SVG 图标（Base64 内联，微信公众号兼容）
const ICONS = {
  clipboard: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/></svg>`,
  shield: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>`,
  lightning: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>`,
  trendUp: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/></svg>`,
  trendDown: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6"/></svg>`
}

/**
 * 构建完整公众号文章 HTML
 */
function buildArticleContent(reportContent, date, coverImageUrl) {
  const formattedDate = date.replace(/-/g, '.')
  const prediction = reportContent.prediction || {}
  const sectors = reportContent.sectors || {}
  const intelligence = reportContent.intelligence || []
  const actionable = reportContent.actionable || {}

  // 分类颜色映射
  const categoryColors = {
    tech: { bg: 'rgba(59, 130, 246, 0.08)', border: '#3b82f6', text: '#3b82f6' },
    fin: { bg: 'rgba(16, 185, 129, 0.08)', border: '#10b981', text: '#10b981' },
    geo: { bg: 'rgba(245, 158, 11, 0.08)', border: '#f59e0b', text: '#f59e0b' },
    soc: { bg: 'rgba(99, 102, 241, 0.08)', border: '#6366f1', text: '#6366f1' },
    other: { bg: 'rgba(107, 114, 128, 0.08)', border: '#6b7280', text: '#6b7280' }
  }

  // 标签颜色（红涨绿跌）
  const tagColors = {
    bullish: { bg: '#fef2f2', color: '#dc2626', border: '#fecaca' },
    bearish: { bg: '#ecfdf5', color: '#059669', border: '#a7f3d0' },
    neutral: { bg: '#f1f5f9', color: '#475569', border: '#e2e8f0' }
  }

  let html = `
<section style="max-width: 100%; margin: 0 auto; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif; color: #1a1a1a; line-height: 1.75; font-size: 15px; background: #ffffff;">

<!-- 题头图 -->
${coverImageUrl ? `
<section style="margin: 0 0 20px;">
  <img src="${coverImageUrl}" style="width: 100%; display: block; border-radius: 0;" />
</section>
` : ''}

<!-- 顶部日期 -->
<section style="text-align: center; padding: 8px 0 24px; color: #9ca3af; font-size: 13px; letter-spacing: 1px;">${formattedDate} · A股投资早报</section>

<!-- ========== 情报矩阵 ========== -->
<section style="margin: 0 16px 28px;">
  <section style="display: flex; align-items: center; gap: 10px; margin-bottom: 18px;">
    <section style="width: 4px; height: 22px; background: linear-gradient(180deg, #3b82f6 0%, #6366f1 100%); border-radius: 2px;"></section>
    <section style="font-size: 14px; font-weight: 700; color: #374151;">情报矩阵</section>
    <section style="font-size: 11px; color: #9ca3af; letter-spacing: 0.5px;">Intelligence Matrix</section>
  </section>
  
  ${intelligence.map(cat => {
    const colors = categoryColors[cat.color] || categoryColors.other
    return `
  <section style="margin-bottom: 16px; background: #fafafa; border-radius: 8px; overflow: hidden; border-top: 3px solid ${colors.border};">
    <section style="padding: 10px 14px; background: ${colors.bg}; font-size: 12px; font-weight: 700; color: ${colors.text};">${cat.category}</section>
    ${(cat.items || []).map(item => {
      const tag = tagColors[item.tag] || tagColors.neutral
      return `
    <section style="padding: 12px 14px; border-bottom: 1px solid #f0f0f0;">
      <section style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 6px;">
        <span style="font-size: 14px; font-weight: 600; color: #1a1a1a; flex: 1;">${item.title}</span>
        <span style="margin-left: 8px; background: ${tag.bg}; color: ${tag.color}; font-size: 10px; padding: 2px 6px; border-radius: 3px; font-weight: 600; border: 1px solid ${tag.border}; white-space: nowrap;">${item.tagText}</span>
      </section>
      <section style="font-size: 13px; color: #64748b; line-height: 1.7;">${item.summary}</section>
    </section>
      `
    }).join('')}
  </section>
    `
  }).join('')}
</section>
`

  // 大盘研判
  html += buildPredictionSection(prediction)
  
  // 板块分析
  html += buildSectorSection(sectors)
  
  // 今日策略
  html += buildActionableSection(actionable)
  
  // 页脚
  html += buildFooter()

  return html
}

/**
 * 构建大盘核心研判部分
 */
function buildPredictionSection(prediction) {
  return `
<!-- ========== 大盘核心研判 ========== -->
<section style="margin: 0 16px 28px;">
  <section style="display: flex; align-items: center; gap: 10px; margin-bottom: 18px;">
    <section style="width: 4px; height: 22px; background: linear-gradient(180deg, #7c3aed 0%, #5b21b6 100%); border-radius: 2px;"></section>
    <section style="font-size: 14px; font-weight: 700; color: #374151;">大盘核心研判</section>
    <section style="font-size: 11px; color: #9ca3af; letter-spacing: 0.5px;">Core Prediction</section>
  </section>
  
  <!-- 预测卡片 -->
  <section style="background: #fafafa; border-radius: 10px; overflow: hidden; border: 1px solid #e5e7eb;">
    <!-- Market Tone 头部 -->
    <section style="padding: 14px 16px; border-bottom: 1px solid #e5e7eb;">
      <section style="display: inline-block; padding: 3px 10px; background: #f3f0ff; color: #7c3aed; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; border-radius: 4px; margin-bottom: 10px; border: 1px solid #e9e3ff;">Market Tone</section>
      <section style="font-size: 24px; font-weight: 800; color: #1a1a1a; margin-bottom: 6px;">${prediction.tone || '震荡整理'}</section>
      <section style="font-size: 14px; font-weight: 600; color: #374151;">${prediction.subtitle || ''}</section>
    </section>
    
    <!-- 核心逻辑 -->
    <section style="padding: 14px 16px; border-bottom: 1px solid #e5e7eb;">
      <section style="font-size: 14px; line-height: 1.85; color: #374151; text-indent: 0; margin: 0; padding: 0;">
        ${(prediction.summary || '')
          .trim()
          .replace(/^[\s\u3000]+/, '')
          .replace(/<span[^>]*class="[^"]*text-bear-text[^"]*"[^>]*>/g, '<span style="color:#059669;font-weight:600;">')
          .replace(/<span[^>]*class="[^"]*text-bull-text[^"]*"[^>]*>/g, '<span style="color:#dc2626;font-weight:600;">')
          .replace(/class="[^"]*"/g, '')
          .replace(/class='[^']*'/g, '')}
      </section>
    </section>
    
    <!-- 资金与情绪面 -->
    <section style="padding: 14px 16px; border-bottom: 1px solid #e5e7eb;">
      <section style="font-size: 13px; font-weight: 700; color: #374151; margin-bottom: 12px;">资金与情绪面</section>
      <section style="display: flex; gap: 12px;">
        <section style="flex: 1; background: #ffffff; border-radius: 8px; padding: 12px; border: 1px solid #e2e8f0;">
          <section style="font-size: 12px; font-weight: 700; color: #1a1a1a; margin-bottom: 6px;">北向资金/外资</section>
          <section style="font-size: 13px; color: #64748b; line-height: 1.6;">${prediction.northbound || '--'}</section>
        </section>
        <section style="flex: 1; background: #ffffff; border-radius: 8px; padding: 12px; border: 1px solid #e2e8f0;">
          <section style="font-size: 12px; font-weight: 700; color: #1a1a1a; margin-bottom: 6px;">成交量预期</section>
          <section style="font-size: 13px; color: #64748b; line-height: 1.6;">${prediction.volume || '--'}</section>
        </section>
      </section>
    </section>
    
    <!-- 全天剧本推演（时间轴 - 使用表格布局） -->
    ${prediction.scenarios?.length > 0 ? `
    <section style="padding: 14px 16px;">
      <section style="font-size: 13px; font-weight: 700; color: #374151; margin-bottom: 16px;">A股全天剧本推演</section>
      ${prediction.scenarios.map((s, idx) => `
      <section style="display: flex; margin-bottom: ${idx === prediction.scenarios.length - 1 ? '0' : '0'};">
        <!-- 左侧时间轴 -->
        <section style="width: 24px; display: flex; flex-direction: column; align-items: center; flex-shrink: 0;">
          <!-- 圆点 -->
          <section style="width: 10px; height: 10px; border-radius: 50%; background: ${s.active ? '#7c3aed' : '#e2e8f0'}; border: 2px solid ${s.active ? '#7c3aed' : '#d1d5db'}; flex-shrink: 0;"></section>
          <!-- 连接线 -->
          ${idx !== prediction.scenarios.length - 1 ? `<section style="width: 2px; flex: 1; min-height: 40px; background: linear-gradient(180deg, ${s.active ? '#c4b5fd' : '#e2e8f0'} 0%, #e2e8f0 100%);"></section>` : ''}
        </section>
        <!-- 右侧内容 -->
        <section style="flex: 1; padding-left: 12px; padding-bottom: ${idx === prediction.scenarios.length - 1 ? '0' : '16px'};">
          <section style="font-size: 14px; font-weight: 700; color: ${s.active ? '#7c3aed' : '#1a1a1a'}; margin-bottom: 4px; line-height: 1.2;">${s.title}</section>
          <section style="font-size: 13px; color: #64748b; line-height: 1.6;">${s.desc || ''}</section>
        </section>
      </section>
      `).join('')}
    </section>
    ` : ''}
  </section>
</section>
`
}

/**
 * 构建板块分析部分
 */
function buildSectorSection(sectors) {
  // 更精美的 SVG 图标 - 火箭上升和降落伞下降
  const bullishIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/></svg>`
  const bearishIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="5" r="3"/><path d="M12 22V8"/><path d="m5 12 7-4 7 4"/><path d="m5 12v4a7 7 0 0 0 7 6 7 7 0 0 0 7-6v-4"/></svg>`
  
  return `
<!-- ========== 板块分析 ========== -->
<section style="margin: 0 16px 24px;">
  <section style="display: flex; align-items: center; gap: 10px; margin-bottom: 14px;">
    <section style="width: 4px; height: 20px; background: linear-gradient(180deg, #f59e0b 0%, #d97706 100%); border-radius: 2px;"></section>
    <section style="font-size: 14px; font-weight: 700; color: #374151;">板块分析</section>
    <section style="font-size: 10px; color: #9ca3af; letter-spacing: 0.5px;">Sector Analysis</section>
  </section>
  
  <!-- 上下布局 -->
  <!-- 利好板块 -->
  ${sectors.bullish?.length > 0 ? `
  <section style="background: #ffffff; border-radius: 10px; overflow: hidden; box-shadow: 0 1px 2px rgba(0,0,0,0.04); margin-bottom: 12px;">
    <!-- 头部 -->
    <section style="padding: 10px 14px; background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); display: flex; align-items: center; gap: 8px;">
      <section style="width: 28px; height: 28px; background: rgba(255,255,255,0.2); border-radius: 6px; display: flex; align-items: center; justify-content: center;">
        ${bullishIcon}
      </section>
      <section style="flex: 1;">
        <section style="font-size: 13px; font-weight: 700; color: #ffffff;">利好板块</section>
      </section>
      <section style="font-size: 9px; color: rgba(255,255,255,0.95); background: rgba(255,255,255,0.2); padding: 2px 8px; border-radius: 10px;">看涨</section>
    </section>
    <!-- 内容 -->
    <section style="padding: 12px;">
      ${sectors.bullish.map((s, idx) => `
      <section style="padding: 10px 12px; margin-bottom: ${idx === sectors.bullish.length - 1 ? '0' : '8px'}; background: #fafafa; border-radius: 6px; border-left: 3px solid #fca5a5;">
        <section style="display: flex; align-items: center; gap: 6px; margin-bottom: 6px;">
          <span style="font-size: 13px; font-weight: 700; color: #1a1a1a;">${s.name}</span>
          ${s.tagText ? `<span style="font-size: 9px; color: #dc2626; background: #fef2f2; padding: 1px 6px; border-radius: 8px; border: 1px solid #fecaca;">${s.tagText}</span>` : ''}
        </section>
        <section style="font-size: 12px; color: #64748b; line-height: 1.7;">${s.reason || ''}</section>
        ${s.focus ? `
        <section style="margin-top: 8px; padding: 6px 10px; background: #fff5f5; border-radius: 4px; display: flex; align-items: center; gap: 6px;">
          <section style="font-size: 10px; color: #9ca3af;">关注</section>
          <section style="font-size: 11px; color: #dc2626; font-weight: 600;">${s.focus.replace('关注：', '').replace('关注:', '')}</section>
        </section>
        ` : ''}
      </section>
      `).join('')}
    </section>
  </section>
  ` : ''}
  
  <!-- 承压板块 -->
  ${sectors.bearish?.length > 0 ? `
  <section style="background: #ffffff; border-radius: 10px; overflow: hidden; box-shadow: 0 1px 2px rgba(0,0,0,0.04);">
    <!-- 头部 -->
    <section style="padding: 10px 14px; background: linear-gradient(135deg, #10b981 0%, #059669 100%); display: flex; align-items: center; gap: 8px;">
      <section style="width: 28px; height: 28px; background: rgba(255,255,255,0.2); border-radius: 6px; display: flex; align-items: center; justify-content: center;">
        ${bearishIcon}
      </section>
      <section style="flex: 1;">
        <section style="font-size: 13px; font-weight: 700; color: #ffffff;">承压板块</section>
      </section>
      <section style="font-size: 9px; color: rgba(255,255,255,0.95); background: rgba(255,255,255,0.2); padding: 2px 8px; border-radius: 10px;">看跌</section>
    </section>
    <!-- 内容 -->
    <section style="padding: 12px;">
      ${sectors.bearish.map((s, idx) => `
      <section style="padding: 10px 12px; margin-bottom: ${idx === sectors.bearish.length - 1 ? '0' : '8px'}; background: #fafafa; border-radius: 6px; border-left: 3px solid #6ee7b7;">
        <section style="display: flex; align-items: center; gap: 6px; margin-bottom: 6px;">
          <span style="font-size: 13px; font-weight: 700; color: #1a1a1a;">${s.name}</span>
          ${s.tagText ? `<span style="font-size: 9px; color: #059669; background: #ecfdf5; padding: 1px 6px; border-radius: 8px; border: 1px solid #a7f3d0;">${s.tagText}</span>` : ''}
        </section>
        <section style="font-size: 12px; color: #64748b; line-height: 1.7;">${s.reason || ''}</section>
        ${s.focus ? `
        <section style="margin-top: 8px; padding: 6px 10px; background: #f0fdf4; border-radius: 4px; display: flex; align-items: center; gap: 6px;">
          <section style="font-size: 10px; color: #9ca3af;">关注</section>
          <section style="font-size: 11px; color: #059669; font-weight: 600;">${s.focus.replace('关注：', '').replace('关注:', '')}</section>
        </section>
        ` : ''}
      </section>
      `).join('')}
    </section>
  </section>
  ` : ''}
</section>
`
}


/**
 * 构建今日策略部分
 */
function buildActionableSection(actionable) {
  if (!actionable.focus && !actionable.avoid) return ''
  
  return `
<!-- ========== 今日策略 ========== -->
<section style="margin: 0 16px 28px;">
  <section style="background: linear-gradient(to right, rgba(124, 58, 237, 0.05), rgba(124, 58, 237, 0.02)); border: 1px solid rgba(124, 58, 237, 0.2); border-radius: 10px; padding: 14px 16px;">
    <section style="display: flex; align-items: center; gap: 10px; margin-bottom: 14px;">
      <section style="padding: 6px; background: rgba(124, 58, 237, 0.1); border-radius: 6px; color: #7c3aed; display: flex; align-items: center; justify-content: center;">
        ${ICONS.clipboard}
      </section>
      <section>
        <section style="font-size: 10px; font-weight: 700; color: #5b21b6; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 2px;">Actionable Summary</section>
        <section style="font-size: 14px; font-weight: 700; color: #1a1a1a;">今日交易策略关键词</section>
      </section>
    </section>
    <!-- 上下布局 -->
    ${actionable.avoid ? `
    <section style="background: #ffffff; border: 1px solid #e5e7eb; border-radius: 6px; padding: 12px 14px; margin-bottom: 10px;">
      <section style="display: flex; align-items: center; gap: 6px; margin-bottom: 8px; color: #64748b;">
        ${ICONS.shield}
        <span style="font-size: 12px; font-weight: 700;">防守避雷</span>
      </section>
      <section style="font-size: 13px; font-weight: 500; color: #64748b; line-height: 1.6;">${actionable.avoid}</section>
    </section>
    ` : ''}
    ${actionable.focus ? `
    <section style="background: rgba(124, 58, 237, 0.05); border: 1px solid rgba(124, 58, 237, 0.25); border-radius: 6px; padding: 12px 14px;">
      <section style="display: flex; align-items: center; gap: 6px; margin-bottom: 8px; color: #5b21b6;">
        ${ICONS.lightning}
        <span style="font-size: 12px; font-weight: 700;">重点关注</span>
      </section>
      <section style="font-size: 13px; font-weight: 700; color: #7c3aed; line-height: 1.6;">${actionable.focus}</section>
    </section>
    ` : ''}
  </section>
</section>
`
}

/**
 * 构建页脚
 */
function buildFooter() {
  return `
<!-- 页脚 -->
<section style="margin: 28px 16px 0; padding: 20px 0; border-top: 1px solid #e5e7eb; text-align: center;">
  <section style="width: 36px; height: 36px; background: linear-gradient(135deg, #7c3aed 0%, #5b21b6 100%); border-radius: 8px; margin: 0 auto 10px; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 8px rgba(124, 58, 237, 0.25);">
    <span style="color: white; font-size: 18px; font-weight: 700;">F</span>
  </section>
  <section style="font-size: 15px; font-weight: 600; color: #7c3aed; margin-bottom: 4px;">Fintell</section>
  <section style="font-size: 12px; color: #9ca3af; margin-bottom: 6px;">您的私人投资助理</section>
  <section style="font-size: 11px; color: #b0b0b0;">board.newestgpt.com</section>
</section>

</section>`
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
 * 检查今天是否已有发布内容
 * 通过获取已发布列表，检查最新一条是否是今天
 */
export async function checkTodayPublished(accessToken) {
  const response = await fetch(
    `https://api.weixin.qq.com/cgi-bin/freepublish/batchget?access_token=${accessToken}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ offset: 0, count: 1, no_content: 1 })
    }
  )
  
  const data = await response.json()
  if (data.errcode) {
    console.error('获取发布列表失败:', data.errcode, data.errmsg)
    return false // 出错时默认未发布，允许自动发布
  }
  
  if (!data.item || data.item.length === 0) {
    return false
  }
  
  // 检查最新发布的时间是否是今天（北京时间）
  const latestItem = data.item[0]
  const publishTime = latestItem.update_time * 1000 // 转为毫秒
  const publishDate = new Date(publishTime + 8 * 60 * 60 * 1000) // 转北京时间
  const today = new Date(Date.now() + 8 * 60 * 60 * 1000)
  
  const isSameDay = publishDate.toISOString().split('T')[0] === today.toISOString().split('T')[0]
  console.log(`最新发布时间: ${publishDate.toISOString()}, 今天: ${today.toISOString().split('T')[0]}, 是否同一天: ${isSameDay}`)
  
  return isSameDay
}

/**
 * 获取今天的草稿并发布
 */
export async function publishDraft(accessToken, date, env) {
  // 获取草稿列表
  const response = await fetch(
    `https://api.weixin.qq.com/cgi-bin/draft/batchget?access_token=${accessToken}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ offset: 0, count: 5, no_content: 1 })
    }
  )
  
  const data = await response.json()
  if (data.errcode) {
    throw new Error(`获取草稿列表失败: ${data.errcode} ${data.errmsg}`)
  }
  
  if (!data.item || data.item.length === 0) {
    return { success: false, reason: '没有草稿' }
  }
  
  // 查找今天的草稿（标题包含今天日期）
  const formattedDate = date.replace(/-/g, '.').substring(5) // 12.28
  let targetDraft = null
  
  for (const draft of data.item) {
    // 草稿的 content.news_item[0].title 包含日期
    if (draft.content?.news_item?.[0]?.title?.includes(formattedDate)) {
      targetDraft = draft
      break
    }
  }
  
  if (!targetDraft) {
    // 如果找不到今天的草稿，发布最新的草稿
    console.log('未找到今天日期的草稿，发布最新草稿')
    targetDraft = data.item[0]
  }
  
  // 发布草稿
  const publishId = await publishArticle(accessToken, targetDraft.media_id)
  console.log('草稿发布成功:', publishId)
  
  return {
    success: true,
    action: 'published',
    publishId,
    draftMediaId: targetDraft.media_id,
    title: targetDraft.content?.news_item?.[0]?.title
  }
}

/**
 * 发布日报到微信公众号
 */
export async function publishToWechatMP(reportContent, date, env, coverImageUrl = null, reportImageUrl = null, autoPublish = true) {
  console.log('开始发布日报到微信公众号...')
  
  if (!env.WECHAT_MP_APPID || !env.WECHAT_MP_SECRET) {
    return { success: false, reason: '未配置微信公众号' }
  }
  
  try {
    const accessToken = await getAccessToken(env)
    console.log('获取 access_token 成功')
    
    // 上传封面图
    let thumbMediaId = null
    let contentCoverUrl = null
    if (coverImageUrl) {
      try {
        console.log('上传封面图...')
        const coverResult = await uploadPermanentImage(accessToken, coverImageUrl)
        thumbMediaId = coverResult.media_id
        contentCoverUrl = coverResult.url
        console.log('封面图上传成功')
      } catch (e) {
        console.warn('封面图上传失败:', e.message)
      }
    }
    
    // 构建文章
    const article = {
      title: buildArticleTitle(reportContent, date),
      author: 'Fintell',
      digest: buildArticleDigest(reportContent),
      content: buildArticleContent(reportContent, date, contentCoverUrl),
      content_source_url: `https://board.newestgpt.com/?page=daily&date=${date}`,
      need_open_comment: 1,
      only_fans_can_comment: 0,
      // 原创声明
      // 0: 非原创, 1: 原创
      // 注意：需要公众号已开通原创功能
      // is_original: 1,  // 暂时注释，需要确认公众号是否有原创权限
      // 文章类型声明
      // 投资观点声明：article_type = 1, article_type_info = "investment"
      // 注意：这些字段可能需要特定权限
    }
    
    // 如果有封面图
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
