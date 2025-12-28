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

/**
 * 构建完整公众号文章 HTML
 * 参考网页端 DailyReport.css 的优雅设计
 * 顺序：题头图 → 情报矩阵 → 大盘研判 → 板块分析 → 今日策略 → 页脚
 */
function buildArticleContent(reportContent, date, coverImageUrl) {
  const formattedDate = date.replace(/-/g, '.')
  const prediction = reportContent.prediction || {}
  const sectors = reportContent.sectors || {}
  const intelligence = reportContent.intelligence || []
  const actionable = reportContent.actionable || {}

  // 分类颜色映射（参考网页端）
  const categoryColors = {
    tech: { bg: 'rgba(59, 130, 246, 0.08)', border: '#3b82f6', text: '#3b82f6' },
    fin: { bg: 'rgba(16, 185, 129, 0.08)', border: '#10b981', text: '#10b981' },
    geo: { bg: 'rgba(245, 158, 11, 0.08)', border: '#f59e0b', text: '#f59e0b' },
    soc: { bg: 'rgba(99, 102, 241, 0.08)', border: '#6366f1', text: '#6366f1' },
    other: { bg: 'rgba(107, 114, 128, 0.08)', border: '#6b7280', text: '#6b7280' }
  }

  // 标签颜色（参考网页端：红涨绿跌）
  const tagColors = {
    bullish: { bg: '#fef2f2', color: '#dc2626', border: '#fecaca' },
    bearish: { bg: '#ecfdf5', color: '#059669', border: '#a7f3d0' },
    neutral: { bg: '#f1f5f9', color: '#475569', border: '#e2e8f0' }
  }

  let html = `
<section style="max-width: 100%; margin: 0 auto; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif; color: #1a1a1a; line-height: 1.75; font-size: 15px; background: #ffffff;">

<!-- 题头图（Market Tone 封面） -->
${coverImageUrl ? `
<section style="margin: 0 0 24px;">
  <img src="${coverImageUrl}" style="width: 100%; display: block;" />
</section>
` : ''}

<!-- 顶部日期 -->
<section style="text-align: center; padding: 8px 0 24px; color: #9ca3af; font-size: 13px; letter-spacing: 1px;">${formattedDate} · A股投资早报</section>

<!-- ========== 情报矩阵 Intelligence Matrix ========== -->
<section style="margin: 0 16px 32px;">
  <section style="display: flex; align-items: center; gap: 10px; margin-bottom: 20px;">
    <section style="width: 4px; height: 24px; background: linear-gradient(180deg, #3b82f6 0%, #6366f1 100%); border-radius: 2px;"></section>
    <section style="font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b;">情报矩阵 Intelligence Matrix</section>
  </section>
  
  ${intelligence.map(cat => {
    const colors = categoryColors[cat.color] || categoryColors.other
    // 显示所有新闻，不限制数量
    return `
  <!-- ${cat.category} -->
  <section style="margin-bottom: 20px; background: #fafafa; border-radius: 8px; overflow: hidden; border-top: 3px solid ${colors.border};">
    <section style="padding: 10px 14px; background: ${colors.bg}; font-size: 11px; font-weight: 700; color: ${colors.text};">${cat.category}</section>
    ${(cat.items || []).map(item => {
      const tag = tagColors[item.tag] || tagColors.neutral
      return `
    <section style="padding: 12px 14px; border-bottom: 1px solid #f0f0f0;">
      <section style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 6px;">
        <span style="font-size: 13px; font-weight: 700; color: #1a1a1a; flex: 1;">${item.title}</span>
        <span style="margin-left: 8px; background: ${tag.bg}; color: ${tag.color}; font-size: 10px; padding: 2px 6px; border-radius: 3px; font-weight: 600; border: 1px solid ${tag.border}; white-space: nowrap;">${item.tagText}</span>
      </section>
      <section style="font-size: 12px; color: #64748b; line-height: 1.6;">${item.summary}</section>
    </section>
      `
    }).join('')}
  </section>
    `
  }).join('')}
</section>
`

  // 继续构建 HTML（大盘研判部分）
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
<!-- ========== 大盘核心研判 Core Prediction ========== -->
<section style="margin: 0 16px 32px;">
  <section style="display: flex; align-items: center; gap: 10px; margin-bottom: 20px;">
    <section style="width: 4px; height: 24px; background: linear-gradient(180deg, #7c3aed 0%, #5b21b6 100%); border-radius: 2px;"></section>
    <section style="font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b;">大盘核心研判 Core Prediction</section>
  </section>
  
  <!-- 预测卡片 -->
  <section style="background: #fafafa; border-radius: 12px; overflow: hidden; border: 1px solid #e5e7eb;">
    <!-- Market Tone 头部 -->
    <section style="padding: 20px; border-bottom: 1px solid #e5e7eb;">
      <section style="display: inline-block; padding: 3px 10px; background: #f3f0ff; color: #7c3aed; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; border-radius: 4px; margin-bottom: 10px; border: 1px solid #e9e3ff;">Market Tone</section>
      <section style="font-size: 26px; font-weight: 800; color: #1a1a1a; margin-bottom: 6px; letter-spacing: -0.02em;">${prediction.tone || '震荡整理'}</section>
      <section style="font-size: 14px; font-weight: 600; color: #374151;">${prediction.subtitle || ''}</section>
    </section>
    
    <!-- 核心逻辑 -->
    <section style="padding: 16px 20px; border-bottom: 1px solid #e5e7eb;">
      <section style="font-size: 14px; line-height: 1.9; color: #374151;">
        ${(prediction.summary || '').replace(/class="[^"]*"/g, 'style="font-weight:600;"').replace(/class='[^']*'/g, 'style="font-weight:600;"')}
      </section>
    </section>
    
    <!-- 资金与情绪面 -->
    <section style="padding: 16px 20px; border-bottom: 1px solid #e5e7eb;">
      <section style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; margin-bottom: 12px; letter-spacing: 0.05em;">资金与情绪面</section>
      <section style="display: flex; gap: 12px;">
        <section style="flex: 1; background: #ffffff; border-radius: 8px; padding: 12px; border: 1px solid #e2e8f0;">
          <section style="font-size: 12px; font-weight: 700; color: #1a1a1a; margin-bottom: 6px;">北向资金/外资</section>
          <section style="font-size: 12px; color: #64748b; line-height: 1.6;">${prediction.northbound || '--'}</section>
        </section>
        <section style="flex: 1; background: #ffffff; border-radius: 8px; padding: 12px; border: 1px solid #e2e8f0;">
          <section style="font-size: 12px; font-weight: 700; color: #1a1a1a; margin-bottom: 6px;">成交量预期</section>
          <section style="font-size: 12px; color: #64748b; line-height: 1.6;">${prediction.volume || '--'}</section>
        </section>
      </section>
    </section>
    
    <!-- 全天剧本推演（时间轴） -->
    ${prediction.scenarios?.length > 0 ? `
    <section style="padding: 16px 20px;">
      <section style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; margin-bottom: 16px; letter-spacing: 0.05em;">A股全天剧本推演</section>
      <section style="padding-left: 8px;">
        ${prediction.scenarios.map((s, idx) => `
        <section style="position: relative; padding-left: 28px; padding-bottom: ${idx === prediction.scenarios.length - 1 ? '0' : '16px'};">
          <!-- 时间轴线 -->
          ${idx !== prediction.scenarios.length - 1 ? `<section style="position: absolute; left: 5px; top: 14px; bottom: 0; width: 2px; background: linear-gradient(to bottom, #e2e8f0, transparent);"></section>` : ''}
          <!-- 时间轴圆点（空心设计） -->
          <section style="position: absolute; left: 0; top: 3px; width: 12px; height: 12px; border-radius: 50%; background: #ffffff; border: 2px solid ${s.active ? '#7c3aed' : '#d1d5db'}; ${s.active ? 'box-shadow: 0 0 8px rgba(124, 58, 237, 0.3);' : ''}"></section>
          <!-- 内容 -->
          <section style="font-size: 13px; font-weight: 700; color: ${s.active ? '#7c3aed' : '#1a1a1a'}; margin-bottom: 4px; line-height: 1.4;">${s.title}</section>
          <section style="font-size: 12px; color: #64748b; line-height: 1.5;">${s.desc || ''}</section>
        </section>
        `).join('')}
      </section>
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
  return `
<!-- ========== 板块分析 Sector Analysis ========== -->
<section style="margin: 0 16px 32px;">
  <section style="display: flex; align-items: center; gap: 10px; margin-bottom: 20px;">
    <section style="width: 4px; height: 24px; background: linear-gradient(180deg, #f59e0b 0%, #d97706 100%); border-radius: 2px;"></section>
    <section style="font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b;">板块分析 Sector Analysis</section>
  </section>
  
  <!-- 看多板块（红色系，淡雅） -->
  ${sectors.bullish?.length > 0 ? `
  <section style="margin-bottom: 20px; background: #fafafa; border-radius: 12px; overflow: hidden; border: 1px solid #e5e7eb; border-top: 4px solid #fca5a5;">
    <section style="padding: 12px 16px; background: rgba(254, 242, 242, 0.5); display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #fde8e8;">
      <section style="font-size: 14px; font-weight: 700; color: #dc2626;">📈 避险与利好板块</section>
      <section style="font-size: 10px; font-weight: 500; padding: 2px 8px; border-radius: 4px; background: #ffffff; color: #dc2626; border: 1px solid #fca5a5;">可能上涨</section>
    </section>
    <section style="padding: 16px;">
      ${sectors.bullish.map((s, idx) => `
      <section style="margin-bottom: ${idx === sectors.bullish.length - 1 ? '0' : '16px'}; padding-bottom: ${idx === sectors.bullish.length - 1 ? '0' : '16px'}; border-bottom: ${idx === sectors.bullish.length - 1 ? 'none' : '1px solid #f0f0f0'};">
        <section style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
          <span style="font-size: 14px; font-weight: 700; color: #1a1a1a;">${s.name}</span>
          <span style="background: #fef2f2; color: #dc2626; font-size: 10px; padding: 2px 6px; border-radius: 3px; font-weight: 600; border: 1px solid #fecaca;">${s.tagText || '利好'}</span>
        </section>
        <section style="font-size: 13px; color: #64748b; line-height: 1.6; margin-bottom: 4px;">${s.reason || ''}</section>
        ${s.focus ? `<section style="font-size: 11px; color: #9ca3af;">${s.focus}</section>` : ''}
      </section>
      `).join('')}
    </section>
  </section>
  ` : ''}
  
  <!-- 看空板块（绿色系，淡雅） -->
  ${sectors.bearish?.length > 0 ? `
  <section style="background: #fafafa; border-radius: 12px; overflow: hidden; border: 1px solid #e5e7eb; border-top: 4px solid #6ee7b7;">
    <section style="padding: 12px 16px; background: rgba(236, 253, 245, 0.5); display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #d1fae5;">
      <section style="font-size: 14px; font-weight: 700; color: #059669;">📉 承压与利空板块</section>
      <section style="font-size: 10px; font-weight: 500; padding: 2px 8px; border-radius: 4px; background: #ffffff; color: #059669; border: 1px solid #6ee7b7;">可能下跌</section>
    </section>
    <section style="padding: 16px;">
      ${sectors.bearish.map((s, idx) => `
      <section style="margin-bottom: ${idx === sectors.bearish.length - 1 ? '0' : '16px'}; padding-bottom: ${idx === sectors.bearish.length - 1 ? '0' : '16px'}; border-bottom: ${idx === sectors.bearish.length - 1 ? 'none' : '1px solid #f0f0f0'};">
        <section style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
          <span style="font-size: 14px; font-weight: 700; color: #1a1a1a;">${s.name}</span>
          <span style="background: #ecfdf5; color: #059669; font-size: 10px; padding: 2px 6px; border-radius: 3px; font-weight: 600; border: 1px solid #a7f3d0;">${s.tagText || '利空'}</span>
        </section>
        <section style="font-size: 13px; color: #64748b; line-height: 1.6; margin-bottom: 4px;">${s.reason || ''}</section>
        ${s.focus ? `<section style="font-size: 11px; color: #9ca3af;">${s.focus}</section>` : ''}
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
<!-- ========== 今日策略 Actionable Summary ========== -->
<section style="margin: 0 16px 32px;">
  <section style="background: linear-gradient(to right, rgba(124, 58, 237, 0.05), transparent); border: 1px solid rgba(124, 58, 237, 0.2); border-radius: 12px; padding: 16px 20px;">
    <section style="display: flex; align-items: center; gap: 10px; margin-bottom: 14px;">
      <section style="padding: 6px; background: rgba(124, 58, 237, 0.1); border-radius: 6px; color: #7c3aed;">📋</section>
      <section>
        <section style="font-size: 10px; font-weight: 700; color: #5b21b6; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 2px;">Actionable Summary</section>
        <section style="font-size: 14px; font-weight: 700; color: #1a1a1a;">今日交易策略关键词</section>
      </section>
    </section>
    <section style="display: flex; gap: 10px;">
      ${actionable.avoid ? `
      <section style="flex: 1; display: flex; align-items: center; background: #ffffff; border: 1px solid #e5e7eb; border-radius: 6px; padding: 10px 12px;">
        <section style="padding-right: 10px; border-right: 1px solid #e5e7eb; font-size: 12px; font-weight: 700; color: #64748b; white-space: nowrap;">🛡️ 防守避雷</section>
        <section style="padding-left: 10px; font-size: 11px; font-weight: 500; color: #9ca3af;">${actionable.avoid}</section>
      </section>
      ` : ''}
      ${actionable.focus ? `
      <section style="flex: 1; display: flex; align-items: center; background: rgba(124, 58, 237, 0.05); border: 1px solid rgba(124, 58, 237, 0.3); border-radius: 6px; padding: 10px 12px;">
        <section style="padding-right: 10px; border-right: 1px solid rgba(124, 58, 237, 0.2); font-size: 12px; font-weight: 700; color: #5b21b6; white-space: nowrap;">⚡ 关注替代</section>
        <section style="padding-left: 10px; font-size: 11px; font-weight: 700; color: #7c3aed;">${actionable.focus}</section>
      </section>
      ` : ''}
    </section>
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
<section style="margin: 32px 16px 0; padding: 24px 0; border-top: 1px solid #e5e7eb; text-align: center;">
  <section style="width: 40px; height: 40px; background: linear-gradient(135deg, #7c3aed 0%, #5b21b6 100%); border-radius: 10px; margin: 0 auto 10px; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 8px rgba(124, 58, 237, 0.3);">
    <span style="color: white; font-size: 20px; font-weight: 700;">F</span>
  </section>
  <section style="font-size: 16px; font-weight: 600; color: #7c3aed; margin-bottom: 4px;">Fintell</section>
  <section style="font-size: 13px; color: #9ca3af; margin-bottom: 8px;">您的私人投资助理</section>
  <section style="font-size: 12px; color: #6b7280;">board.newestgpt.com</section>
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
    let contentCoverUrl = null
    if (coverImageUrl) {
      try {
        console.log('上传封面图...')
        const coverResult = await uploadPermanentImage(accessToken, coverImageUrl)
        thumbMediaId = coverResult.media_id
        contentCoverUrl = coverResult.url  // 用于文章题头图
        console.log('封面图上传成功')
      } catch (e) {
        console.warn('封面图上传失败:', e.message)
      }
    }
    
    // 构建文章（题头图使用封面图）
    const article = {
      title: buildArticleTitle(reportContent, date),
      author: 'Fintell',
      digest: buildArticleDigest(reportContent),
      content: buildArticleContent(reportContent, date, contentCoverUrl),
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
