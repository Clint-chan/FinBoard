/**
 * AdminPage - 管理员页面
 * 独立的管理员界面，用于管理用户和 AI 配额
 */
import { useState, useEffect, useCallback } from 'react'
import './AdminPage.css'

interface UserInfo {
  username: string
  createdAt: number
  aiQuota: number
  aiUsedToday: number
  registerIp?: string
}

interface DailyReportInfo {
  report_date: string
  news_count: number
  created_at: string
}

interface SystemConfig {
  wechat: {
    appId: string
    appSecret: string
    hasSecret: boolean
    autoPublish: boolean
    createDraft: boolean
    token: string
    hasToken: boolean
    replyPrompt: string
    replyModel: string  // 微信回复专用模型
  }
  schedule: {
    reportHour: number
    emailEnabled: boolean
    wechatCheckHour: number
  }
}

const SYNC_API = 'https://market-api.newestgpt.com'

// 获取存储的 token
function getStoredToken(): string | null {
  try {
    const auth = localStorage.getItem('market_board_auth')
    if (auth) {
      const parsed = JSON.parse(auth)
      return parsed.token || null
    }
  } catch {
    // ignore
  }
  return null
}

interface AIConfig {
  apiUrl: string
  apiKey: string
  model: string
}

export function AdminPage() {
  const token = getStoredToken()
  const [users, setUsers] = useState<UserInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editingUser, setEditingUser] = useState<string | null>(null)
  const [editQuota, setEditQuota] = useState<number>(3)
  const [searchTerm, setSearchTerm] = useState('')
  
  // AI 配置
  const [aiConfig, setAiConfig] = useState<AIConfig>({
    apiUrl: '',
    apiKey: '',
    model: ''
  })
  const [aiConfigLoading, setAiConfigLoading] = useState(false)
  const [aiConfigSaving, setAiConfigSaving] = useState(false)
  
  // 日报管理
  const [dailyReports, setDailyReports] = useState<DailyReportInfo[]>([])
  const [dailyLoading, setDailyLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  
  // 测试邮件
  const [testEmail, setTestEmail] = useState('')
  const [sendingTestEmail, setSendingTestEmail] = useState(false)
  
  // 微信公众号
  const [wechatConfig, setWechatConfig] = useState<{ configured: boolean; hasAppId: boolean; hasSecret: boolean } | null>(null)
  const [testingWechat, setTestingWechat] = useState(false)
  
  // 系统配置
  const [systemConfig, setSystemConfig] = useState<SystemConfig>({
    wechat: { appId: '', appSecret: '', hasSecret: false, autoPublish: false, createDraft: true, token: '', hasToken: false, replyPrompt: '', replyModel: '' },
    schedule: { reportHour: 7, emailEnabled: true, wechatCheckHour: 9 }
  })
  const [systemConfigLoading, setSystemConfigLoading] = useState(false)
  const [systemConfigSaving, setSystemConfigSaving] = useState(false)
  const [wechatSecretInput, setWechatSecretInput] = useState('')
  const [wechatTokenInput, setWechatTokenInput] = useState('')

  // 复盘管理状态
  const [reviewsLoading, setReviewsLoading] = useState(false)
  const [reviews, setReviews] = useState<Array<{id: string, date: string, created_at: string}>>([])
  const [backfilling, setBackfilling] = useState(false)
  const [backfillDays, setBackfillDays] = useState(30)

  // 加载用户列表
  const loadUsers = useCallback(async () => {
    if (!token) return
    setLoading(true)
    setError('')
    
    try {
      const res = await fetch(`${SYNC_API}/api/admin/users`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || '加载失败')
      }
      
      const data = await res.json()
      setUsers(data.users || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载用户列表失败')
    } finally {
      setLoading(false)
    }
  }, [token])

  // 加载 AI 配置
  const loadAIConfig = useCallback(async () => {
    if (!token) return
    setAiConfigLoading(true)
    
    try {
      const res = await fetch(`${SYNC_API}/api/ai/config`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      
      if (res.ok) {
        const data = await res.json()
        setAiConfig({
          apiUrl: data.apiUrl || '',
          apiKey: data.apiKey || '',
          model: data.model || ''
        })
      }
    } catch (err) {
      console.error('Failed to load AI config:', err)
    } finally {
      setAiConfigLoading(false)
    }
  }, [token])

  useEffect(() => {
    loadUsers()
    loadAIConfig()
    loadDailyReports()
    loadWechatConfig()
    loadSystemConfig()
    loadReviews()
  }, [loadUsers, loadAIConfig])
  
  // 加载微信公众号配置状态
  const loadWechatConfig = async () => {
    if (!token) return
    try {
      const res = await fetch(`${SYNC_API}/api/admin/wechat-config`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (res.ok) {
        const data = await res.json()
        setWechatConfig(data)
      }
    } catch (err) {
      console.error('Failed to load wechat config:', err)
    }
  }
  
  // 加载系统配置
  const loadSystemConfig = async () => {
    if (!token) return
    setSystemConfigLoading(true)
    try {
      const res = await fetch(`${SYNC_API}/api/admin/system-config`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (res.ok) {
        const data = await res.json()
        setSystemConfig(data)
      }
    } catch (err) {
      console.error('Failed to load system config:', err)
    } finally {
      setSystemConfigLoading(false)
    }
  }
  
  // 保存系统配置
  const saveSystemConfig = async () => {
    if (!token) return
    setSystemConfigSaving(true)
    setError('')
    
    try {
      const configs: Record<string, string | boolean | number> = {
        wechat_appid: systemConfig.wechat.appId,
        wechat_auto_publish: systemConfig.wechat.autoPublish,
        wechat_create_draft: systemConfig.wechat.createDraft,
        wechat_reply_prompt: systemConfig.wechat.replyPrompt,
        wechat_reply_model: systemConfig.wechat.replyModel,
        schedule_report_hour: systemConfig.schedule.reportHour,
        schedule_email_enabled: systemConfig.schedule.emailEnabled,
        schedule_wechat_check_hour: systemConfig.schedule.wechatCheckHour,
      }
      
      // 只有输入了新密钥才更新
      if (wechatSecretInput) {
        configs.wechat_secret = wechatSecretInput
      }
      if (wechatTokenInput) {
        configs.wechat_token = wechatTokenInput
      }
      
      const res = await fetch(`${SYNC_API}/api/admin/system-config/batch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ configs })
      })
      
      const data = await res.json()
      if (data.success) {
        alert(`配置已保存！${data.message}`)
        setWechatSecretInput('')
        setWechatTokenInput('')
        loadSystemConfig()
        loadWechatConfig()
      } else {
        throw new Error(data.error || '保存失败')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存系统配置失败')
    } finally {
      setSystemConfigSaving(false)
    }
  }
  
  // 加载日报列表
  const loadDailyReports = async () => {
    setDailyLoading(true)
    try {
      const res = await fetch(`${SYNC_API}/api/daily/list?limit=10`)
      if (res.ok) {
        const data = await res.json()
        setDailyReports(data.reports || [])
      }
    } catch (err) {
      console.error('Failed to load daily reports:', err)
    } finally {
      setDailyLoading(false)
    }
  }
  
  // 生成日报
  const generateDailyReport = async () => {
    if (!token || generating) return
    setGenerating(true)
    setError('')
    
    try {
      const res = await fetch(`${SYNC_API}/api/daily/generate`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      })
      
      const data = await res.json()
      if (data.success) {
        alert(`日报生成成功！日期: ${data.date}, 新闻数: ${data.newsCount}`)
        loadDailyReports()
      } else {
        throw new Error(data.error || '生成失败')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '生成日报失败')
    } finally {
      setGenerating(false)
    }
  }
  
  // 发送测试邮件
  const sendTestDailyEmail = async () => {
    if (!token || sendingTestEmail || !testEmail) return
    setSendingTestEmail(true)
    setError('')
    
    try {
      const res = await fetch(`${SYNC_API}/api/admin/test-daily-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ email: testEmail })
      })
      
      const data = await res.json()
      if (data.success) {
        alert(`测试邮件已发送到 ${testEmail}，日报日期: ${data.date}`)
        setTestEmail('')
      } else {
        throw new Error(data.error || '发送失败')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '发送测试邮件失败')
    } finally {
      setSendingTestEmail(false)
    }
  }
  
  // 测试微信公众号发布
  const testWechatPublish = async (autoPublish: boolean = false) => {
    if (!token || testingWechat) return
    setTestingWechat(true)
    setError('')
    
    try {
      const res = await fetch(`${SYNC_API}/api/admin/test-wechat-mp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ autoPublish })
      })
      
      const data = await res.json()
      if (data.success) {
        const msg = autoPublish 
          ? `文章已发布！日期: ${data.date}, 发布ID: ${data.publishId}`
          : `草稿已创建！日期: ${data.date}, 草稿ID: ${data.draftMediaId}\n请在公众号后台查看并发布`
        alert(msg)
      } else {
        throw new Error(data.error || '发布失败')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '测试微信发布失败')
    } finally {
      setTestingWechat(false)
    }
  }

  // 更新用户配额
  const updateUserQuota = async (username: string, quota: number) => {
    if (!token) return
    
    try {
      const res = await fetch(`${SYNC_API}/api/admin/user/quota`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ username, quota })
      })
      
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || '更新失败')
      }
      
      await loadUsers()
      setEditingUser(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : '更新配额失败')
    }
  }

  // 保存 AI 配置
  const saveAIConfig = async () => {
    if (!token) return
    setAiConfigSaving(true)
    setError('')
    
    try {
      const res = await fetch(`${SYNC_API}/api/ai/config`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(aiConfig)
      })
      
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || '保存失败')
      }
      
      alert('AI 配置已保存')
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存 AI 配置失败')
    } finally {
      setAiConfigSaving(false)
    }
  }

  // 过滤用户
  const filteredUsers = users.filter(u => 
    u.username.toLowerCase().includes(searchTerm.toLowerCase())
  )

  // 加载复盘列表
  const loadReviews = useCallback(async () => {
    setReviewsLoading(true)
    try {
      const res = await fetch('https://news.newestgpt.com/reviews?limit=30')
      if (res.ok) {
        const data = await res.json()
        setReviews(data.reviews || [])
      }
    } catch (err) {
      console.error('Failed to load reviews:', err)
    } finally {
      setReviewsLoading(false)
    }
  }, [])

  // 手动获取今日复盘
  const fetchTodayReview = async () => {
    if (!token) return
    setError('')
    
    try {
      const res = await fetch('https://news.newestgpt.com/review/fetch', {
        method: 'POST'
      })
      
      const data = await res.json()
      if (data.success && data.stored) {
        alert(`复盘数据已获取并存储！\nID: ${data.newsId}\n日期: ${data.date}`)
        loadReviews()
      } else {
        throw new Error(data.error || data.storeError || '获取失败')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '获取复盘失败')
    }
  }

  // 批量补全历史数据
  const backfillReviews = async () => {
    if (!token || backfilling) return
    setBackfilling(true)
    setError('')
    
    try {
      const res = await fetch('https://news.newestgpt.com/review/backfill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ days: backfillDays })
      })
      
      const data = await res.json()
      if (data.success) {
        alert(`补全完成！\n成功: ${data.successCount} 条\n失败: ${data.failedCount} 条\n跳过: ${data.skippedCount} 条`)
        loadReviews()
      } else {
        throw new Error(data.error || '补全失败')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '批量补全失败')
    } finally {
      setBackfilling(false)
    }
  }

  // 统计数据
  const totalUsers = users.length
  const activeToday = users.filter(u => u.aiUsedToday > 0).length
  const totalUsedToday = users.reduce((sum, u) => sum + u.aiUsedToday, 0)

  return (
    <div className="admin-page">
      <header className="page-header">
        <h1>管理员控制台</h1>
        <p>管理用户和 AI 配额</p>
      </header>

      {/* 统计卡片 */}
      <div className="admin-stats">
        <div className="stat-card">
          <div className="stat-value">{totalUsers}</div>
          <div className="stat-label">总用户数</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{activeToday}</div>
          <div className="stat-label">今日活跃</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{totalUsedToday}</div>
          <div className="stat-label">今日 AI 调用</div>
        </div>
      </div>

      {/* AI 配置 */}
      <div className="admin-section">
        <div className="section-header">
          <h2>AI 配置</h2>
        </div>
        
        {aiConfigLoading ? (
          <div className="admin-loading">加载中...</div>
        ) : (
          <div className="ai-config-form">
            <div className="form-group">
              <label>API 地址</label>
              <input
                type="text"
                value={aiConfig.apiUrl}
                onChange={e => setAiConfig(prev => ({ ...prev, apiUrl: e.target.value }))}
                placeholder="https://api.newestgpt.com/v1/chat/completions"
              />
            </div>
            <div className="form-group">
              <label>API Key</label>
              <input
                type="password"
                value={aiConfig.apiKey}
                onChange={e => setAiConfig(prev => ({ ...prev, apiKey: e.target.value }))}
                placeholder="输入 API Key"
              />
            </div>
            <div className="form-group">
              <label>模型名称</label>
              <input
                type="text"
                value={aiConfig.model}
                onChange={e => setAiConfig(prev => ({ ...prev, model: e.target.value }))}
                placeholder="gemini-3-pro-preview-thinking"
              />
            </div>
            <button 
              className="save-config-btn"
              onClick={saveAIConfig}
              disabled={aiConfigSaving}
            >
              {aiConfigSaving ? '保存中...' : '保存配置'}
            </button>
          </div>
        )}
      </div>

      {/* 系统配置 */}
      <div className="admin-section">
        <div className="section-header">
          <h2>系统配置</h2>
          <button 
            className="refresh-btn"
            onClick={loadSystemConfig}
            disabled={systemConfigLoading}
          >
            {systemConfigLoading ? '加载中...' : '刷新'}
          </button>
        </div>
        
        {systemConfigLoading ? (
          <div className="admin-loading">加载中...</div>
        ) : (
          <div className="system-config-form">
            {/* 微信公众号配置 */}
            <div className="config-section">
              <div className="config-section-title">📱 微信公众号</div>
              <div className="form-row">
                <div className="form-group">
                  <label>AppID</label>
                  <input
                    type="text"
                    value={systemConfig.wechat.appId}
                    onChange={e => setSystemConfig(prev => ({
                      ...prev,
                      wechat: { ...prev.wechat, appId: e.target.value }
                    }))}
                    placeholder="wx..."
                  />
                </div>
                <div className="form-group">
                  <label>AppSecret {systemConfig.wechat.hasSecret && <span className="secret-hint">（已配置）</span>}</label>
                  <input
                    type="password"
                    value={wechatSecretInput}
                    onChange={e => setWechatSecretInput(e.target.value)}
                    placeholder={systemConfig.wechat.hasSecret ? '留空保持不变' : '输入 AppSecret'}
                  />
                </div>
              </div>
              <div className="form-row">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={systemConfig.wechat.createDraft}
                    onChange={e => setSystemConfig(prev => ({
                      ...prev,
                      wechat: { ...prev.wechat, createDraft: e.target.checked }
                    }))}
                  />
                  <span>自动创建草稿</span>
                </label>
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={systemConfig.wechat.autoPublish}
                    onChange={e => setSystemConfig(prev => ({
                      ...prev,
                      wechat: { ...prev.wechat, autoPublish: e.target.checked }
                    }))}
                  />
                  <span>自动发布（需认证公众号）</span>
                </label>
              </div>
              <p className="config-hint">
                💡 未认证公众号只能创建草稿，需要手动在公众号后台发布
              </p>
            </div>
            
            {/* 消息接口配置 */}
            <div className="config-section">
              <div className="config-section-title">💬 消息接口（AI 自动回复）</div>
              <div className="form-row">
                <div className="form-group">
                  <label>Token {systemConfig.wechat.hasToken && <span className="secret-hint">（已配置）</span>}</label>
                  <input
                    type="text"
                    value={wechatTokenInput}
                    onChange={e => setWechatTokenInput(e.target.value)}
                    placeholder={systemConfig.wechat.hasToken ? '留空保持不变' : '自定义 Token（3-32位英文或数字）'}
                  />
                </div>
                <div className="form-group">
                  <label>回复模型</label>
                  <input
                    type="text"
                    value={systemConfig.wechat.replyModel}
                    onChange={e => setSystemConfig(prev => ({
                      ...prev,
                      wechat: { ...prev.wechat, replyModel: e.target.value }
                    }))}
                    placeholder="留空使用 AI 配置中的模型，建议用快速模型如 gpt-4o-mini"
                  />
                </div>
              </div>
              <div className="form-group">
                <label>AI 回复提示词</label>
                <textarea
                  className="prompt-textarea"
                  value={systemConfig.wechat.replyPrompt}
                  onChange={e => setSystemConfig(prev => ({
                    ...prev,
                    wechat: { ...prev.wechat, replyPrompt: e.target.value }
                  }))}
                  placeholder="自定义 AI 回复的系统提示词，留空使用默认提示词"
                  rows={4}
                />
              </div>
              <div className="config-hint">
                <p>📋 微信公众号后台配置：</p>
                <p>• URL: <code>https://market-api.newestgpt.com/api/wechat</code></p>
                <p>• Token: 填写上方配置的 Token</p>
                <p>• 消息加解密方式: 选择「明文模式」</p>
                <p>⚠️ 微信要求 5 秒内响应，建议使用快速模型（如 gpt-4o-mini）</p>
              </div>
            </div>
            
            {/* 定时任务配置 */}
            <div className="config-section">
              <div className="config-section-title">⏰ 定时任务</div>
              <div className="form-row">
                <div className="form-group small">
                  <label>日报生成时间</label>
                  <div className="time-input">
                    <input
                      type="number"
                      min={0}
                      max={23}
                      value={systemConfig.schedule.reportHour}
                      onChange={e => setSystemConfig(prev => ({
                        ...prev,
                        schedule: { ...prev.schedule, reportHour: parseInt(e.target.value) || 7 }
                      }))}
                    />
                    <span>:00 (北京时间)</span>
                  </div>
                </div>
                <div className="form-group small">
                  <label>微信检查发布时间</label>
                  <div className="time-input">
                    <input
                      type="number"
                      min={0}
                      max={23}
                      value={systemConfig.schedule.wechatCheckHour}
                      onChange={e => setSystemConfig(prev => ({
                        ...prev,
                        schedule: { ...prev.schedule, wechatCheckHour: parseInt(e.target.value) || 9 }
                      }))}
                    />
                    <span>:00 (北京时间)</span>
                  </div>
                </div>
              </div>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={systemConfig.schedule.emailEnabled}
                  onChange={e => setSystemConfig(prev => ({
                    ...prev,
                    schedule: { ...prev.schedule, emailEnabled: e.target.checked }
                  }))}
                />
                <span>启用邮件推送</span>
              </label>
              <p className="config-hint">
                ⚠️ 定时任务时间修改需要重新部署 Worker 才能生效
              </p>
            </div>
            
            <button 
              className="save-config-btn"
              onClick={saveSystemConfig}
              disabled={systemConfigSaving}
            >
              {systemConfigSaving ? '保存中...' : '保存系统配置'}
            </button>
          </div>
        )}
      </div>

      {/* 日报管理 */}
      <div className="admin-section">
        <div className="section-header">
          <h2>日报管理</h2>
          <div className="section-actions">
            <button 
              className="refresh-btn"
              onClick={loadDailyReports}
              disabled={dailyLoading}
            >
              {dailyLoading ? '加载中...' : '刷新'}
            </button>
            <button 
              className="generate-btn"
              onClick={generateDailyReport}
              disabled={generating}
            >
              {generating ? '生成中...' : '生成今日日报'}
            </button>
          </div>
        </div>
        
        <div className="daily-info">
          <p className="daily-hint">
            💡 日报会在每天北京时间 7:00 自动生成，也可以手动触发生成/重新生成
          </p>
        </div>
        
        <div className="test-email-section">
          <div className="test-email-title">📧 测试日报邮件</div>
          <div className="test-email-form">
            <input
              type="email"
              className="test-email-input"
              placeholder="输入测试邮箱地址"
              value={testEmail}
              onChange={e => setTestEmail(e.target.value)}
            />
            <button 
              className="test-email-btn"
              onClick={sendTestDailyEmail}
              disabled={sendingTestEmail || !testEmail}
            >
              {sendingTestEmail ? '发送中...' : '发送测试'}
            </button>
          </div>
          <p className="test-email-hint">将最新日报发送到指定邮箱进行测试</p>
        </div>
        
        <div className="test-email-section">
          <div className="test-email-title">📱 微信公众号发布</div>
          {wechatConfig ? (
            wechatConfig.configured ? (
              <div className="wechat-actions">
                <div className="wechat-status success">✓ 已配置</div>
                <div className="test-email-form">
                  <button 
                    className="test-email-btn"
                    onClick={() => testWechatPublish(false)}
                    disabled={testingWechat}
                  >
                    {testingWechat ? '处理中...' : '创建草稿'}
                  </button>
                  <button 
                    className="test-email-btn primary"
                    onClick={() => testWechatPublish(true)}
                    disabled={testingWechat}
                  >
                    {testingWechat ? '处理中...' : '直接发布'}
                  </button>
                </div>
                <p className="test-email-hint">创建草稿后可在公众号后台预览，直接发布会立即群发</p>
              </div>
            ) : (
              <div className="wechat-status warning">
                ⚠️ 未配置 - 请设置 WECHAT_MP_APPID 和 WECHAT_MP_SECRET
              </div>
            )
          ) : (
            <div className="wechat-status">加载中...</div>
          )}
        </div>
        
        <div className="daily-list">
          {dailyLoading ? (
            <div className="admin-loading">加载中...</div>
          ) : dailyReports.length === 0 ? (
            <div className="table-empty">暂无日报记录</div>
          ) : (
            <table className="user-table">
              <thead>
                <tr>
                  <th>日期</th>
                  <th>新闻数量</th>
                  <th>生成时间</th>
                </tr>
              </thead>
              <tbody>
                {dailyReports.map(report => (
                  <tr key={report.report_date}>
                    <td>
                      <span className="date-badge">{report.report_date}</span>
                    </td>
                    <td>{report.news_count} 条</td>
                    <td>{new Date(report.created_at).toLocaleString('zh-CN')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* 复盘管理 */}
      <div className="admin-section">
        <div className="section-header">
          <h2>A股复盘管理</h2>
          <div className="section-actions">
            <button 
              className="refresh-btn" 
              onClick={loadReviews} 
              disabled={reviewsLoading}
            >
              {reviewsLoading ? '加载中...' : '刷新'}
            </button>
          </div>
        </div>

        <div className="daily-actions">
          <button 
            className="generate-btn"
            onClick={fetchTodayReview}
            disabled={!token}
          >
            📥 获取今日复盘
          </button>
          
          <div className="backfill-group">
            <input
              type="number"
              className="backfill-input"
              value={backfillDays}
              onChange={e => setBackfillDays(parseInt(e.target.value) || 30)}
              min="1"
              max="90"
              disabled={backfilling}
            />
            <button 
              className="generate-btn"
              onClick={backfillReviews}
              disabled={!token || backfilling}
            >
              {backfilling ? '补全中...' : '📦 批量补全历史'}
            </button>
          </div>
          
          <a 
            href="https://news.newestgpt.com/review" 
            target="_blank" 
            rel="noopener noreferrer"
            className="preview-link"
          >
            👁️ 预览复盘数据
          </a>
        </div>

        <div className="daily-list">
          {reviewsLoading ? (
            <div className="admin-loading">加载中...</div>
          ) : reviews.length === 0 ? (
            <div className="table-empty">暂无复盘记录</div>
          ) : (
            <table className="user-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>日期</th>
                  <th>生成时间</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {reviews.map(review => (
                  <tr key={review.id}>
                    <td>
                      <span className="code-badge">{review.id}</span>
                    </td>
                    <td>
                      <span className="date-badge">{review.date}</span>
                    </td>
                    <td>{new Date(review.created_at).toLocaleString('zh-CN')}</td>
                    <td>
                      <a 
                        href={`https://news.newestgpt.com/review?id=${review.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="view-link"
                      >
                        查看
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* 用户管理 */}
      <div className="admin-section">
        <div className="section-header">
          <h2>用户管理</h2>
          <div className="section-actions">
            <input
              type="text"
              className="search-input"
              placeholder="搜索用户..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
            <button className="refresh-btn" onClick={loadUsers} disabled={loading}>
              {loading ? '加载中...' : '刷新'}
            </button>
          </div>
        </div>

        {error && <div className="admin-error">{error}</div>}

        <div className="user-table-wrapper">
          <table className="user-table">
            <thead>
              <tr>
                <th>用户名</th>
                <th>注册 IP</th>
                <th>注册时间</th>
                <th>AI 配额</th>
                <th>今日已用</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="table-loading">加载中...</td></tr>
              ) : filteredUsers.length === 0 ? (
                <tr><td colSpan={6} className="table-empty">暂无用户</td></tr>
              ) : (
                filteredUsers.map(user => (
                  <tr key={user.username}>
                    <td className="user-name-cell">
                      <span className="user-avatar">{user.username.charAt(0).toUpperCase()}</span>
                      <span>{user.username}</span>
                    </td>
                    <td>
                      <span className="ip-badge" title={user.registerIp || '未知'}>
                        {user.registerIp || '未知'}
                      </span>
                    </td>
                    <td>{new Date(user.createdAt).toLocaleDateString()}</td>
                    <td>
                      {editingUser === user.username ? (
                        <input
                          type="number"
                          className="quota-input"
                          min={0}
                          max={100}
                          value={editQuota}
                          onChange={e => setEditQuota(parseInt(e.target.value) || 0)}
                          autoFocus
                        />
                      ) : (
                        <span className="quota-badge">{user.aiQuota} 次/天</span>
                      )}
                    </td>
                    <td>
                      <span className={`usage-badge ${user.aiUsedToday >= user.aiQuota ? 'exhausted' : ''}`}>
                        {user.aiUsedToday} / {user.aiQuota}
                      </span>
                    </td>
                    <td>
                      {editingUser === user.username ? (
                        <div className="action-btns">
                          <button 
                            className="btn-save"
                            onClick={() => updateUserQuota(user.username, editQuota)}
                          >
                            保存
                          </button>
                          <button 
                            className="btn-cancel"
                            onClick={() => setEditingUser(null)}
                          >
                            取消
                          </button>
                        </div>
                      ) : (
                        <button 
                          className="btn-edit"
                          onClick={() => {
                            setEditingUser(user.username)
                            setEditQuota(user.aiQuota)
                          }}
                        >
                          编辑配额
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

export default AdminPage
