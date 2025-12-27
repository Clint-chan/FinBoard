/**
 * MobileProfile - 移动端"我的"页面
 * 未登录显示登录界面，已登录显示用户信息和设置
 */
import { useState, useCallback, useEffect } from 'react'
import { 
  cloudLogin, 
  cloudRegister, 
  sendVerifyCode,
  getUserInfo,
  sendBindEmailCode,
  bindEmail,
  sendChangeEmailCode,
  changeEmail
} from '@/services/cloudService'
import './MobileProfile.css'

type QuoteSource = 'eastmoney' | 'tencent' | 'sina'

interface MobileProfileProps {
  isLoggedIn: boolean
  username?: string
  nickname?: string
  onLoginSuccess: (token: string, username: string, nickname?: string) => void
  onLogout: () => void
  onSync?: () => void
  syncing?: boolean
  // 设置相关
  config: {
    interval: number
    pctThreshold: number
    refreshOnlyInMarketHours: boolean
    quoteSource: QuoteSource
    theme: 'light' | 'dark' | 'auto'
    strategyCheckInterval?: number
  }
  onConfigChange: (updates: {
    interval?: number
    pctThreshold?: number
    refreshOnlyInMarketHours?: boolean
    quoteSource?: QuoteSource
    theme?: 'light' | 'dark' | 'auto'
    strategyCheckInterval?: number
  }) => void
}

type AuthMode = 'login' | 'register'

export function MobileProfile({
  isLoggedIn,
  username,
  nickname,
  onLoginSuccess,
  onLogout,
  onSync,
  syncing,
  config,
  onConfigChange
}: MobileProfileProps) {
  const [authMode, setAuthMode] = useState<AuthMode>('login')
  const [formUsername, setFormUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [verifyCode, setVerifyCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [sendingCode, setSendingCode] = useState(false)
  const [countdown, setCountdown] = useState(0)
  const [error, setError] = useState('')

  // 账号中心状态
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [showEmailModal, setShowEmailModal] = useState(false)
  const [emailModalMode, setEmailModalMode] = useState<'bind' | 'change'>('bind')
  const [newEmail, setNewEmail] = useState('')
  const [emailCode, setEmailCode] = useState('')
  const [emailLoading, setEmailLoading] = useState(false)
  const [emailSendingCode, setEmailSendingCode] = useState(false)
  const [emailCountdown, setEmailCountdown] = useState(0)
  const [emailError, setEmailError] = useState('')
  const [emailSuccess, setEmailSuccess] = useState('')

  // 获取用户信息
  useEffect(() => {
    if (isLoggedIn) {
      const token = localStorage.getItem('cloud_token')
      if (token) {
        getUserInfo(token)
          .then(info => setUserEmail(info.email))
          .catch(() => setUserEmail(null))
      }
    }
  }, [isLoggedIn])

  const resetForm = useCallback(() => {
    setFormUsername('')
    setEmail('')
    setPassword('')
    setConfirmPassword('')
    setVerifyCode('')
    setError('')
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
      await sendVerifyCode(email.trim())
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
  }, [email])

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (authMode === 'login') {
      // 登录验证
      if (!formUsername.trim() || !password.trim()) {
        setError('请填写用户名和密码')
        return
      }
    } else {
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

      if (password !== confirmPassword) {
        setError('两次密码输入不一致')
        return
      }
    }

    if (password.length < 6) {
      setError('密码长度至少 6 位')
      return
    }

    setLoading(true)

    try {
      const result = authMode === 'login'
        ? await cloudLogin(formUsername.trim(), password)
        : await cloudRegister(email.trim(), password, verifyCode.trim())

      onLoginSuccess(result.token, result.username)
      resetForm()
    } catch (err) {
      setError(err instanceof Error ? err.message : '操作失败')
    } finally {
      setLoading(false)
    }
  }, [authMode, formUsername, email, password, confirmPassword, verifyCode, onLoginSuccess, resetForm])

  // 邮箱绑定/换绑相关
  const openEmailModal = (mode: 'bind' | 'change') => {
    setEmailModalMode(mode)
    setNewEmail('')
    setEmailCode('')
    setEmailError('')
    setEmailSuccess('')
    setShowEmailModal(true)
  }

  const handleSendEmailCode = useCallback(async () => {
    if (!newEmail.trim()) {
      setEmailError('请先输入邮箱')
      return
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(newEmail.trim())) {
      setEmailError('邮箱格式不正确')
      return
    }

    const token = localStorage.getItem('cloud_token')
    if (!token) {
      setEmailError('请先登录')
      return
    }

    setEmailSendingCode(true)
    setEmailError('')

    try {
      if (emailModalMode === 'bind') {
        await sendBindEmailCode(token, newEmail.trim())
      } else {
        await sendChangeEmailCode(token, newEmail.trim())
      }
      // 开始倒计时
      setEmailCountdown(60)
      const timer = setInterval(() => {
        setEmailCountdown(prev => {
          if (prev <= 1) {
            clearInterval(timer)
            return 0
          }
          return prev - 1
        })
      }, 1000)
    } catch (err) {
      setEmailError(err instanceof Error ? err.message : '发送验证码失败')
    } finally {
      setEmailSendingCode(false)
    }
  }, [newEmail, emailModalMode])

  const handleEmailSubmit = useCallback(async () => {
    if (!newEmail.trim() || !emailCode.trim()) {
      setEmailError('请填写邮箱和验证码')
      return
    }

    const token = localStorage.getItem('cloud_token')
    if (!token) {
      setEmailError('请先登录')
      return
    }

    setEmailLoading(true)
    setEmailError('')

    try {
      if (emailModalMode === 'bind') {
        const result = await bindEmail(token, newEmail.trim(), emailCode.trim())
        setUserEmail(result.email)
        setEmailSuccess('邮箱绑定成功')
      } else {
        const result = await changeEmail(token, newEmail.trim(), emailCode.trim())
        // 换绑成功，更新 token 和用户名
        localStorage.setItem('cloud_token', result.token)
        setUserEmail(newEmail.trim())
        onLoginSuccess(result.token, result.username)
        setEmailSuccess('邮箱换绑成功')
      }
      // 2秒后关闭弹窗
      setTimeout(() => {
        setShowEmailModal(false)
      }, 1500)
    } catch (err) {
      setEmailError(err instanceof Error ? err.message : '操作失败')
    } finally {
      setEmailLoading(false)
    }
  }, [newEmail, emailCode, emailModalMode, onLoginSuccess])

  // 未登录 - 显示登录界面
  if (!isLoggedIn) {
    return (
      <div className="mobile-profile">
        <div className="mp-auth-container">
          {/* Logo 和标题 */}
          <div className="mp-auth-header">
            <div className="mp-logo">
              <span>F</span>
            </div>
            <h1>Fintell</h1>
            <p>智能投资助手</p>
          </div>

          {/* 登录/注册表单 */}
          <form className="mp-auth-form" onSubmit={handleSubmit}>
            {error && <div className="mp-error">{error}</div>}

            {authMode === 'login' ? (
              // 登录表单
              <>
                <div className="mp-input-group">
                  <input
                    type="text"
                    value={formUsername}
                    onChange={e => setFormUsername(e.target.value)}
                    placeholder="用户名/邮箱"
                    disabled={loading}
                    autoComplete="username"
                  />
                </div>

                <div className="mp-input-group">
                  <input
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="密码"
                    disabled={loading}
                    autoComplete="current-password"
                  />
                </div>
              </>
            ) : (
              // 注册表单
              <>
                <div className="mp-input-group mp-input-with-btn">
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="邮箱"
                    disabled={loading}
                    autoComplete="email"
                  />
                  <button
                    type="button"
                    className="mp-send-code-btn"
                    onClick={handleSendCode}
                    disabled={sendingCode || countdown > 0 || loading}
                  >
                    {countdown > 0 ? `${countdown}s` : (sendingCode ? '发送中' : '获取验证码')}
                  </button>
                </div>

                <div className="mp-input-group">
                  <input
                    type="text"
                    value={verifyCode}
                    onChange={e => setVerifyCode(e.target.value)}
                    placeholder="验证码"
                    maxLength={6}
                    disabled={loading}
                    autoComplete="one-time-code"
                  />
                </div>

                <div className="mp-input-group">
                  <input
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="密码（至少6位）"
                    disabled={loading}
                    autoComplete="new-password"
                  />
                </div>

                <div className="mp-input-group">
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    placeholder="确认密码"
                    disabled={loading}
                    autoComplete="new-password"
                  />
                </div>
              </>
            )}

            <button type="submit" className="mp-submit-btn" disabled={loading}>
              {loading ? '处理中...' : (authMode === 'login' ? '登录' : '注册')}
            </button>

            <div className="mp-auth-switch">
              {authMode === 'login' ? (
                <span>
                  没有账号？
                  <button type="button" onClick={() => { setAuthMode('register'); setError('') }}>
                    立即注册
                  </button>
                </span>
              ) : (
                <span>
                  已有账号？
                  <button type="button" onClick={() => { setAuthMode('login'); setError('') }}>
                    立即登录
                  </button>
                </span>
              )}
            </div>
          </form>

          {/* 功能说明 */}
          <div className="mp-features">
            <div className="mp-feature">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2L2 7l10 5 10-5-10-5z"></path>
                <path d="M2 17l10 5 10-5"></path>
                <path d="M2 12l10 5 10-5"></path>
              </svg>
              <span>多设备数据同步</span>
            </div>
            <div className="mp-feature">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
              </svg>
              <span>价格预警通知</span>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // 已登录 - 显示用户信息和设置
  return (
    <div className="mobile-profile">
      <div className="mp-user-section">
        <div className="mp-avatar">
          {(nickname || username)?.charAt(0).toUpperCase() || 'U'}
        </div>
        <div className="mp-user-info">
          <span className="mp-username">{nickname || username}</span>
          <span className="mp-status">已登录</span>
        </div>
        {onSync && (
          <button className="mp-sync-btn" onClick={onSync} disabled={syncing}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={syncing ? 'spinning' : ''}>
              <path d="M21 12a9 9 0 0 1-9 9m0 0a9 9 0 0 1-9-9m9 9V3m0 0L8 8m4-5l4 5"></path>
            </svg>
            {syncing ? '同步中' : '同步'}
          </button>
        )}
      </div>

      {/* 账号中心 */}
      <div className="mp-settings">
        <h3 className="mp-section-title">账号中心</h3>
        
        <div className="mp-setting-item">
          <span className="mp-setting-label">绑定邮箱</span>
          <div className="mp-setting-value">
            {userEmail ? (
              <>
                <span className="mp-email-text">{userEmail}</span>
                <button className="mp-change-btn" onClick={() => openEmailModal('change')}>换绑</button>
              </>
            ) : (
              <button className="mp-bind-btn" onClick={() => openEmailModal('bind')}>去绑定</button>
            )}
          </div>
        </div>
      </div>

      {/* 设置区域 */}
      <div className="mp-settings">
        <h3 className="mp-section-title">设置</h3>

        {/* 刷新间隔 */}
        <div className="mp-setting-item">
          <span className="mp-setting-label">刷新间隔</span>
          <select
            className="mp-setting-select"
            value={config.interval}
            onChange={e => onConfigChange({ interval: Number(e.target.value) })}
          >
            <option value={3}>3秒</option>
            <option value={5}>5秒</option>
            <option value={10}>10秒</option>
            <option value={30}>30秒</option>
            <option value={60}>60秒</option>
          </select>
        </div>

        {/* 仅交易时间刷新 */}
        <div className="mp-setting-item">
          <span className="mp-setting-label">仅交易时间刷新</span>
          <label className="mp-switch">
            <input
              type="checkbox"
              checked={config.refreshOnlyInMarketHours}
              onChange={e => onConfigChange({ refreshOnlyInMarketHours: e.target.checked })}
            />
            <span className="mp-switch-slider"></span>
          </label>
        </div>

        {/* 主题 */}
        <div className="mp-setting-item">
          <span className="mp-setting-label">主题</span>
          <select
            className="mp-setting-select"
            value={config.theme}
            onChange={e => onConfigChange({ theme: e.target.value as 'light' | 'dark' | 'auto' })}
          >
            <option value="auto">跟随系统</option>
            <option value="light">浅色</option>
            <option value="dark">深色</option>
          </select>
        </div>

        {/* 数据源 */}
        <div className="mp-setting-item">
          <span className="mp-setting-label">数据源</span>
          <select
            className="mp-setting-select"
            value={config.quoteSource}
            onChange={e => onConfigChange({ quoteSource: e.target.value as QuoteSource })}
          >
            <option value="eastmoney">东方财富</option>
            <option value="tencent">腾讯财经</option>
            <option value="sina">新浪财经</option>
          </select>
        </div>

        {/* 策略检查间隔 */}
        <div className="mp-setting-item">
          <span className="mp-setting-label">策略检查间隔</span>
          <select
            className="mp-setting-select"
            value={config.strategyCheckInterval || 30}
            onChange={e => onConfigChange({ strategyCheckInterval: Number(e.target.value) })}
          >
            <option value={10}>10秒</option>
            <option value={30}>30秒</option>
            <option value={60}>60秒</option>
            <option value={120}>2分钟</option>
          </select>
        </div>
      </div>

      {/* 退出登录 */}
      <div className="mp-logout-section">
        <button className="mp-logout-btn" onClick={onLogout}>
          退出登录
        </button>
      </div>

      {/* 邮箱绑定/换绑弹窗 */}
      {showEmailModal && (
        <div className="mp-modal-backdrop" onClick={() => setShowEmailModal(false)}>
          <div className="mp-modal" onClick={e => e.stopPropagation()}>
            <div className="mp-modal-header">
              <h3>{emailModalMode === 'bind' ? '绑定邮箱' : '换绑邮箱'}</h3>
              <button className="mp-modal-close" onClick={() => setShowEmailModal(false)}>×</button>
            </div>
            <div className="mp-modal-body">
              {emailError && <div className="mp-error">{emailError}</div>}
              {emailSuccess && <div className="mp-success">{emailSuccess}</div>}
              
              <div className="mp-input-group mp-input-with-btn">
                <input
                  type="email"
                  value={newEmail}
                  onChange={e => setNewEmail(e.target.value)}
                  placeholder={emailModalMode === 'bind' ? '请输入邮箱' : '请输入新邮箱'}
                  disabled={emailLoading || !!emailSuccess}
                />
                <button
                  type="button"
                  className="mp-send-code-btn"
                  onClick={handleSendEmailCode}
                  disabled={emailSendingCode || emailCountdown > 0 || emailLoading || !!emailSuccess}
                >
                  {emailCountdown > 0 ? `${emailCountdown}s` : (emailSendingCode ? '发送中' : '获取验证码')}
                </button>
              </div>

              <div className="mp-input-group">
                <input
                  type="text"
                  value={emailCode}
                  onChange={e => setEmailCode(e.target.value)}
                  placeholder="请输入验证码"
                  maxLength={6}
                  disabled={emailLoading || !!emailSuccess}
                />
              </div>
            </div>
            <div className="mp-modal-footer">
              <button 
                className="mp-modal-btn mp-modal-btn-primary" 
                onClick={handleEmailSubmit}
                disabled={emailLoading || !!emailSuccess}
              >
                {emailLoading ? '处理中...' : '确认'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default MobileProfile
