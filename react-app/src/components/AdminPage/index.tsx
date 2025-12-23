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
  }, [loadUsers, loadAIConfig])
  
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
            💡 日报会在每天北京时间 6:00 自动生成，也可以手动触发生成/重新生成
          </p>
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
