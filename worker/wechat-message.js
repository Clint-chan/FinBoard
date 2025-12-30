/**
 * 微信公众号消息接口模块
 * 处理用户私信、自动回复等功能
 */

import { getWechatConfig } from './wechat-mp.js'

/**
 * 验证微信服务器签名
 * @param {string} signature - 微信加密签名
 * @param {string} timestamp - 时间戳
 * @param {string} nonce - 随机数
 * @param {string} token - 公众号配置的 Token
 */
export function verifySignature(signature, timestamp, nonce, token) {
  const arr = [token, timestamp, nonce].sort()
  const str = arr.join('')
  
  // SHA1 哈希
  const encoder = new TextEncoder()
  const data = encoder.encode(str)
  
  return crypto.subtle.digest('SHA-1', data).then(hash => {
    const hashArray = Array.from(new Uint8Array(hash))
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
    return hashHex === signature
  })
}

/**
 * 解析微信 XML 消息
 */
export function parseWechatXML(xml) {
  const result = {}
  
  // 简单的 XML 解析（不依赖外部库）
  const tagRegex = /<(\w+)><!\[CDATA\[(.*?)\]\]><\/\1>|<(\w+)>(.*?)<\/\3>/g
  let match
  
  while ((match = tagRegex.exec(xml)) !== null) {
    const key = match[1] || match[3]
    const value = match[2] || match[4]
    result[key] = value
  }
  
  return result
}

/**
 * 构建微信 XML 回复消息
 */
export function buildReplyXML(toUser, fromUser, content) {
  const timestamp = Math.floor(Date.now() / 1000)
  return `<xml>
<ToUserName><![CDATA[${toUser}]]></ToUserName>
<FromUserName><![CDATA[${fromUser}]]></FromUserName>
<CreateTime>${timestamp}</CreateTime>
<MsgType><![CDATA[text]]></MsgType>
<Content><![CDATA[${content}]]></Content>
</xml>`
}

/**
 * 调用 AI 生成回复
 */
async function callAI(message, env) {
  // 获取 AI 配置
  let aiConfig = null
  let replyPrompt = null
  
  if (env.DB) {
    try {
      // AI 配置存储在 ai_config key 下，是一个 JSON 对象
      const aiConfigRow = await env.DB.prepare(
        'SELECT config_value FROM system_configs WHERE config_key = ?'
      ).bind('ai_config').first()
      
      if (aiConfigRow) {
        try {
          aiConfig = JSON.parse(aiConfigRow.config_value)
        } catch {
          console.error('解析 AI 配置失败')
        }
      }
      
      const promptRow = await env.DB.prepare(
        'SELECT config_value FROM system_configs WHERE config_key = ?'
      ).bind('wechat_reply_prompt').first()
      
      if (promptRow) {
        replyPrompt = promptRow.config_value.replace(/^"|"$/g, '')
      }
    } catch (e) {
      console.error('读取 AI 配置失败:', e)
    }
  }
  
  // 使用环境变量兜底
  const apiUrl = aiConfig?.apiUrl || env.AI_API_URL || 'https://api.openai.com/v1/chat/completions'
  const apiKey = aiConfig?.apiKey || env.AI_API_KEY
  const model = aiConfig?.model || env.AI_MODEL || 'gpt-4o-mini'
  
  // 默认提示词
  const defaultPrompt = `你是 Fintell 智能投资助手，专注于 A 股市场分析。
请用简洁专业的语言回答用户问题。
注意：
1. 回复要简短，适合微信阅读（不超过 500 字）
2. 如果涉及具体投资建议，请提醒用户"投资有风险，入市需谨慎"
3. 可以推荐用户访问 board.newestgpt.com 查看更详细的分析`
  
  const systemPrompt = replyPrompt || defaultPrompt
  
  if (!apiKey) {
    return '抱歉，AI 服务暂未配置，请联系管理员。'
  }
  
  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: 'system',
            content: systemPrompt
          },
          {
            role: 'user',
            content: message
          }
        ],
        max_tokens: 800,
        temperature: 0.7
      })
    })
    
    if (!response.ok) {
      console.error('AI API 错误:', await response.text())
      return '抱歉，AI 服务暂时不可用，请稍后再试。'
    }
    
    const data = await response.json()
    
    // 兼容思考模型和普通模型
    // 思考模型可能返回 thinking/reasoning 字段，我们只取最终回复
    const choice = data.choices?.[0]
    if (!choice) {
      return '抱歉，无法生成回复。'
    }
    
    // 优先取 message.content，忽略 thinking/reasoning
    let content = choice.message?.content
    
    // 有些模型把思考过程放在 content 开头，用 <think> 标签包裹
    if (content && content.includes('<think>')) {
      // 移除 <think>...</think> 部分
      content = content.replace(/<think>[\s\S]*?<\/think>/g, '').trim()
    }
    
    // 有些模型用 <reasoning>...</reasoning>
    if (content && content.includes('<reasoning>')) {
      content = content.replace(/<reasoning>[\s\S]*?<\/reasoning>/g, '').trim()
    }
    
    return content || '抱歉，无法生成回复。'
  } catch (e) {
    console.error('调用 AI 失败:', e)
    return '抱歉，服务出现异常，请稍后再试。'
  }
}

/**
 * 处理微信消息
 */
export async function handleWechatMessage(message, env) {
  const { MsgType, Content, FromUserName, ToUserName } = message
  
  // 只处理文本消息
  if (MsgType !== 'text') {
    return buildReplyXML(
      FromUserName, 
      ToUserName, 
      '目前只支持文字消息哦～\n\n发送任意股票相关问题，我会用 AI 为你解答！\n\n也可以访问 board.newestgpt.com 查看每日投资早报 📊'
    )
  }
  
  const userMessage = Content?.trim()
  
  // 关键词回复
  if (!userMessage || userMessage === '帮助' || userMessage === '?') {
    return buildReplyXML(
      FromUserName,
      ToUserName,
      `欢迎使用 Fintell 智能投资助手！🎉

你可以：
📊 发送股票问题，AI 为你解答
📰 回复「早报」查看今日投资早报
🔗 回复「网站」获取网站链接

投资有风险，入市需谨慎。`
    )
  }
  
  if (userMessage === '早报' || userMessage === '日报') {
    // 获取最新日报链接
    const today = new Date()
    const beijingTime = new Date(today.getTime() + 8 * 60 * 60 * 1000)
    const dateStr = beijingTime.toISOString().split('T')[0]
    
    return buildReplyXML(
      FromUserName,
      ToUserName,
      `📰 今日投资早报\n\n点击查看完整内容：\nhttps://board.newestgpt.com/?page=daily&date=${dateStr}\n\n每日 7:00 更新，助你把握市场脉搏！`
    )
  }
  
  if (userMessage === '网站' || userMessage === '链接') {
    return buildReplyXML(
      FromUserName,
      ToUserName,
      `🌐 Fintell 智能投资平台\n\nhttps://board.newestgpt.com\n\n功能：\n• 每日投资早报\n• AI 股票分析\n• 自选股监控\n• 策略中心`
    )
  }
  
  // 调用 AI 回复
  const aiReply = await callAI(userMessage, env)
  
  return buildReplyXML(FromUserName, ToUserName, aiReply)
}

/**
 * 获取微信消息 Token（从数据库或环境变量）
 */
export async function getWechatToken(env) {
  if (env.DB) {
    try {
      const row = await env.DB.prepare(
        'SELECT config_value FROM system_configs WHERE config_key = ?'
      ).bind('wechat_token').first()
      
      if (row) {
        return row.config_value.replace(/"/g, '')
      }
    } catch (e) {
      console.error('读取微信 Token 失败:', e)
    }
  }
  
  return env.WECHAT_TOKEN || ''
}
