/**
 * AuthModal - 登录/注册弹窗
 */
import { useState, useCallback } from 'react'
import { cloudLogin, cloudRegister } from '@/services/cloudService'
import './Modal.css'

interface AuthModalProps {
  open: boolean
  onClose: () => void
  onSuccess: (token: string, username: string) => void
}

type AuthMode = 'login' | 'register'

export function AuthModal({ open, onClose, onSuccess }: AuthModalProps) {
  const [mode, setMode] = useState<AuthMode>('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const resetForm = useCallback(() => {
    setUsername('')
    setPassword('')
    setConfirmPassword('')
    setError('')
  }, [])

  const handleClose = useCallback(() => {
    resetForm()
    onClose()
  }, [resetForm, onClose])

  const switchMode = useCallback((newMode: AuthMode) => {
    setMode(newMode)
    setError('')
  }, [])

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    // 验证
    if (!username.trim() || !password.trim()) {
      setError('请填写用户名和密码')
      return
    }

    if (mode === 'register' && password !== confirmPassword) {
      setError('两次密码输入不一致')
      return
    }

    if (password.length < 6) {
      setError('密码长度至少 6 位')
      return
    }

    setLoading(true)

    try {
      const result = mode === 'login'
        ? await cloudLogin(username.trim(), password)
        : await cloudRegister(username.trim(), password)

      onSuccess(result.token, result.username)
      handleClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : '操作失败')
    } finally {
      setLoading(false)
    }
  }, [mode, username, password, confirmPassword, onSuccess, handleClose])

  if (!open) return null

  return (
    <div className="modal-backdrop open" onClick={handleClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{mode === 'login' ? '登录' : '注册'}</h3>
          <button className="modal-close" onClick={handleClose}>×</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && (
              <div className="auth-error">{error}</div>
            )}

            <div className="form-group">
              <label>用户名</label>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="请输入用户名"
                autoFocus
                disabled={loading}
              />
            </div>

            <div className="form-group">
              <label>密码</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="请输入密码"
                disabled={loading}
              />
            </div>

            {mode === 'register' && (
              <div className="form-group">
                <label>确认密码</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="请再次输入密码"
                  disabled={loading}
                />
              </div>
            )}
          </div>

          <div className="modal-footer">
            <div className="auth-switch">
              {mode === 'login' ? (
                <span>没有账号？<button type="button" onClick={() => switchMode('register')}>立即注册</button></span>
              ) : (
                <span>已有账号？<button type="button" onClick={() => switchMode('login')}>立即登录</button></span>
              )}
            </div>
            <div className="modal-actions">
              <button type="button" className="btn-secondary" onClick={handleClose} disabled={loading}>
                取消
              </button>
              <button type="submit" className="btn-primary" disabled={loading}>
                {loading ? '处理中...' : (mode === 'login' ? '登录' : '注册')}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}

export default AuthModal
