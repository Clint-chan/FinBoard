/**
 * AdminModal - 管理员面板
 * 只有管理员账号（cdg）可以访问
 */
import { useState, useEffect, useCallback } from 'react'
import './Modal.css'

interface UserInfo {
  username: string
  createdAt: number
  aiQuota: number // AI 每日配额
  aiUsedToday: number // 今日已使用次数
}

interface AdminModalProps {
  open: boolean
  onClose: () => void
  token: string | null
}

const SYNC_API = 'https://market-api.newestgpt.com'

export function AdminModal({ open, onClose, token }: AdminModalProps) {
  const [users, setUsers] = useState<UserInfo[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [editingUser, setEditingUser] = useState<string | null>(null)
  const [editQuota, setEditQuota] = useState<number>(3)

  // 加载用户列表
  const loadUsers = useCallback(async () => {
    if (!token) return
    setLoading(true)
    setError('')
    
    try {
      const res = await fetch(`${SYNC_API}/api/admin/users`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
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
    if (open) {
      loadUsers()
    }
  }, [open, loadUsers])

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
      
      // 刷新列表
      await loadUsers()
      setEditingUser(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : '更新配额失败')
    }
  }

  if (!open) return null

  return (
    <div className="modal-backdrop open" onClick={onClose}>
      <div className="modal-content admin-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-title">管理员面板</div>
        
        {error && (
          <div className="auth-error">{error}</div>
        )}
        
        <div className="admin-section">
          <h3>用户管理</h3>
          {loading ? (
            <div className="admin-loading">加载中...</div>
          ) : users.length === 0 ? (
            <div className="admin-empty">暂无用户</div>
          ) : (
            <div className="admin-user-list">
              {users.map(user => (
                <div key={user.username} className="admin-user-item">
                  <div className="admin-user-info">
                    <span className="admin-user-name">{user.username}</span>
                    <span className="admin-user-date">
                      注册于 {new Date(user.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="admin-user-quota">
                    {editingUser === user.username ? (
                      <div className="admin-quota-edit">
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={editQuota}
                          onChange={e => setEditQuota(parseInt(e.target.value) || 0)}
                        />
                        <button 
                          className="admin-btn-save"
                          onClick={() => updateUserQuota(user.username, editQuota)}
                        >
                          保存
                        </button>
                        <button 
                          className="admin-btn-cancel"
                          onClick={() => setEditingUser(null)}
                        >
                          取消
                        </button>
                      </div>
                    ) : (
                      <>
                        <span className="admin-quota-text">
                          AI配额: {user.aiUsedToday}/{user.aiQuota}
                        </span>
                        <button 
                          className="admin-btn-edit"
                          onClick={() => {
                            setEditingUser(user.username)
                            setEditQuota(user.aiQuota)
                          }}
                        >
                          编辑
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        
        <div className="modal-actions">
          <button onClick={onClose}>关闭</button>
        </div>
      </div>
    </div>
  )
}

export default AdminModal
