/**
 * AuthModal - 登录/注册/找回密码弹窗
 */
import { useState, useCallback } from 'react'
import { cloudLogin, cloudRegister, sendVerifyCode, sendResetPasswordCode, resetPassword } from '@/services/cloudService'
import './Modal.css'

interface AuthModalProps {
  open: boolean
  onClose: () => void
  onSuccess: (token: string, username: string, nickname?: string | null) => void
}

type AuthMode = 'login' | 'register' | 'reset'

export function AuthModal({ open, onClose, onSuccess }: AuthModalProps) {
  const [mode, setMode] = useState<AuthMode>('login')
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [nickname, setNickname] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [verifyCode, setVerifyCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [sendingCode, setSendingCode] = useState(false)
  const [countdown, setCountdown] = useState(0)
  const [error, setError] = useState('')
  const [resetSuccess, setResetSuccess] = useState(false)

  const resetForm = useCallback(() => {
    setUsername('')
    setEmail('')
    setNickname('')
    setPassword('')
    setConfirmPassword('')
    setVerifyCode('')
    setError('')
    setResetSuccess(false)
  }, [])

  const handleClose = useCallback(() => {
    resetForm()
    setMode('login')
    onClose()
  }, [resetForm, onClose])

  const switchMode = useCallback((newMode: AuthMode) => {
    setMode(newMode)
    setError('')
    setResetSuccess(false)
  }, [])

  // 发送验证码
  const handleSendCode = useCallback(async () => {
    if (!email.trim()) {
      setError('请先输入邮箱')
      return
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email.trim())) {
      setError('邮箱格式不正确')
      return
    }

    setSendingCode(true)
    setError('')

    try {
      if (mode === 'register') {
        await sendVerifyCode(email.trim())
      } else if (mode === 'reset') {
        await sendResetPasswordCode(email.trim())
      }
      // 开始倒计时
      setCountdown(60)
      const timer = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            clearInterval(timer)
            return 0
          }
          return prev - 1
        })
      }, 1000)
    } catch (err) {
      setError(err instanceof Error ? err.message : '发送验证码失败')
    } finally {
      setSendingCode(false)
    }
  }, [email, mode])

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (mode === 'login') {
      // 登录验证
      if (!username.trim() || !password.trim()) {
        setError('请填写用户名和密码')
        return
      }
    } else if (mode === 'register') {
      // 注册验证
      if (!email.trim() || !password.trim() || !verifyCode.trim()) {
        setError('请填写邮箱、密码和验证码')
        return
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(email.trim())) {
        setError('邮箱格式不正确')
        return
      }

      if (nickname && nickname.length > 20) {
        setError('昵称不能超过 20 个字符')
        return
      }

      if (password !== confirmPassword) {
        setError('两次密码输入不一致')
        return
      }

      if (password.length < 6) {
        setError('密码长度至少 6 位')
        return
      }
    } else if (mode === 'reset') {
      // 找回密码验证
      if (!email.trim() || !verifyCode.trim() || !password.trim()) {
        setError('请填写邮箱、验证码和新密码')
        return
      }

      if (password !== confirmPassword) {
        setError('两次密码输入不一致')
        return
      }

      if (password.length < 6) {
        setError('新密码长度至少 6 位')
        return
      }
    }

    setLoading(true)

    try {
      if (mode === 'login') {
        const result = await cloudLogin(username.trim(), password)
        onSuccess(result.token, result.username, result.nickname)
        handleClose()
      } else if (mode === 'register') {
        const result = await cloudRegister(email.trim(), password, verifyCode.trim(), nickname.trim() || undefined)
        onSuccess(result.token, result.username, result.nickname)
        handleClose()
      } else if (mode === 'reset') {
        await resetPassword(email.trim(), verifyCode.trim(), password)
        setResetSuccess(true)
        // 3秒后自动切换到登录
        setTimeout(() => {
          switchMode('login')
          setUsername(email)
          setEmail('')
          setPassword('')
          setConfirmPassword('')
          setVerifyCode('')
        }, 2000)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '操作失败')
    } finally {
      setLoading(false)
    }
  }, [mode, username, email, password, confirmPassword, verifyCode, onSuccess, handleClose, switchMode])

  if (!open) return null

  return (
    <div className="modal-backdrop open" onClick={handleClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{mode === 'login' ? '登录' : mode === 'register' ? '注册' : '找回密码'}</h3>
          <button className="modal-close" onClick={handleClose}>×</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && <div className="auth-error">{error}</div>}
            {resetSuccess && <div className="auth-success">密码重置成功，即将跳转登录...</div>}

            {mode === 'login' ? (
              // 登录表单
              <>
                <div className="form-group">
                  <label>用户名/邮箱</label>
                  <input
                    type="text"
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    placeholder="请输入用户名或邮箱"
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
              </>
            ) : mode === 'register' ? (
              // 注册表单
              <>
                <div className="form-group">
                  <label>邮箱</label>
                  <div className="input-with-btn">
                    <input
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="请输入邮箱"
                      autoFocus
                      disabled={loading}
                    />
                    <button
                      type="button"
                      className="send-code-btn"
                      onClick={handleSendCode}
                      disabled={sendingCode || countdown > 0 || loading}
                    >
                      {countdown > 0 ? `${countdown}s` : (sendingCode ? '发送中' : '获取验证码')}
                    </button>
                  </div>
                </div>

                <div className="form-group">
                  <label>验证码</label>
                  <input
                    type="text"
                    value={verifyCode}
                    onChange={e => setVerifyCode(e.target.value)}
                    placeholder="请输入邮箱验证码"
                    maxLength={6}
                    disabled={loading}
                  />
                </div>

                <div className="form-group">
                  <label>昵称 <span className="optional-hint">（选填）</span></label>
                  <input
                    type="text"
                    value={nickname}
                    onChange={e => setNickname(e.target.value)}
                    placeholder="给自己取个名字吧"
                    maxLength={20}
                    disabled={loading}
                  />
                </div>

                <div className="form-group">
                  <label>密码</label>
                  <input
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="请输入密码（至少6位）"
                    disabled={loading}
                  />
                </div>

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
              </>
            ) : (
              // 找回密码表单
              <>
                <div className="form-group">
                  <label>邮箱</label>
                  <div className="input-with-btn">
                    <input
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="请输入注册邮箱"
                      autoFocus
                      disabled={loading || resetSuccess}
                    />
                    <button
                      type="button"
                      className="send-code-btn"
                      onClick={handleSendCode}
                      disabled={sendingCode || countdown > 0 || loading || resetSuccess}
                    >
                      {countdown > 0 ? `${countdown}s` : (sendingCode ? '发送中' : '获取验证码')}
                    </button>
                  </div>
                </div>

                <div className="form-group">
                  <label>验证码</label>
                  <input
                    type="text"
                    value={verifyCode}
                    onChange={e => setVerifyCode(e.target.value)}
                    placeholder="请输入邮箱验证码"
                    maxLength={6}
                    disabled={loading || resetSuccess}
                  />
                </div>

                <div className="form-group">
                  <label>新密码</label>
                  <input
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="请输入新密码（至少6位）"
                    disabled={loading || resetSuccess}
                  />
                </div>

                <div className="form-group">
                  <label>确认新密码</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    placeholder="请再次输入新密码"
                    disabled={loading || resetSuccess}
                  />
                </div>
              </>
            )}
          </div>

          <div className="modal-footer auth-footer">
            <div className="auth-switch">
              {mode === 'login' ? (
                <>
                  <span>没有账号？<button type="button" onClick={() => switchMode('register')}>注册</button></span>
                  <span className="auth-divider">|</span>
                  <button type="button" className="forgot-btn" onClick={() => switchMode('reset')}>忘记密码</button>
                </>
              ) : mode === 'register' ? (
                <span>已有账号？<button type="button" onClick={() => switchMode('login')}>登录</button></span>
              ) : (
                <span>想起密码了？<button type="button" onClick={() => switchMode('login')}>返回登录</button></span>
              )}
            </div>
            <div className="modal-actions">
              <button type="button" className="btn-secondary" onClick={handleClose} disabled={loading}>
                取消
              </button>
              <button type="submit" className="btn-primary" disabled={loading || resetSuccess}>
                {loading ? '处理中...' : (mode === 'login' ? '登录' : mode === 'register' ? '注册' : '重置密码')}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}

export default AuthModal
