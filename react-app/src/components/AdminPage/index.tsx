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
}

interface AdminPageProps {
  token: string | null
}

const SYNC_API = 'https://market-api.newestgpt.com'

export function AdminPage({ token }: AdminPageProps) {
  const [users, setUsers] = useState<UserInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editingUser, setEditingUser] = useState<string | null>(null)
  const [editQuota, setEditQuota] = useState<number>(3)
  const [searchTerm, setSearchTerm] = useState('')

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

  useEffect(() => {
    loadUsers()
  }, [loadUsers])

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
                <th>注册时间</th>
                <th>AI 配额</th>
                <th>今日已用</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="table-loading">加载中...</td></tr>
              ) : filteredUsers.length === 0 ? (
                <tr><td colSpan={5} className="table-empty">暂无用户</td></tr>
              ) : (
                filteredUsers.map(user => (
                  <tr key={user.username}>
                    <td className="user-name-cell">
                      <span className="user-avatar">{user.username.charAt(0).toUpperCase()}</span>
                      <span>{user.username}</span>
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
