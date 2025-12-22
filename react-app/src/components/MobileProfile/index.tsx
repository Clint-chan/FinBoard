/**
 * MobileProfile - 移动端"我的"页面
 * 未登录显示登录界面，已登录显示用户信息和设置
 */
import { useState, useCallback } from 'react'
import { cloudLogin, cloudRegister } from '@/services/cloudService'
import './MobileProfile.css'

type QuoteSource = 'eastmoney' | 'tencent' | 'sina'

interface MobileProfileProps {
  isLoggedIn: boolean
  username?: string
  onLoginSuccess: (token: string, username: string) => void
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
  onLoginSuccess,
  onLogout,
  onSync,
  syncing,
  config,
  onConfigChange
}: MobileProfileProps) {
  const [authMode, setAuthMode] = useState<AuthMode>('login')
  const [formUsername, setFormUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const resetForm = useCallback(() => {
    setFormUsername('')
    setPassword('')
    setConfirmPassword('')
    setError('')
  }, [])

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!formUsername.trim() || !password.trim()) {
      setError('请填写用户名和密码')
      return
    }

    if (authMode === 'register' && password !== confirmPassword) {
      setError('两次密码输入不一致')
      return
    }

    if (password.length < 6) {
      setError('密码长度至少 6 位')
      return
    }

    setLoading(true)

    try {
      const result = authMode === 'login'
        ? await cloudLogin(formUsername.trim(), password)
        : await cloudRegister(formUsername.trim(), password)

      onLoginSuccess(result.token, result.username)
      resetForm()
    } catch (err) {
      setError(err instanceof Error ? err.message : '操作失败')
    } finally {
      setLoading(false)
    }
  }, [authMode, formUsername, password, confirmPassword, onLoginSuccess, resetForm])

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

          {/* 登录表单 */}
          <form className="mp-auth-form" onSubmit={handleSubmit}>
            {error && <div className="mp-error">{error}</div>}

            <div className="mp-input-group">
              <input
                type="text"
                value={formUsername}
                onChange={e => setFormUsername(e.target.value)}
                placeholder="用户名"
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
                autoComplete={authMode === 'login' ? 'current-password' : 'new-password'}
              />
            </div>

            {authMode === 'register' && (
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
              <span>云端同步自选股</span>
            </div>
            <div className="mp-feature">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="11" width="18" height="10" rx="2"></rect>
                <circle cx="12" cy="16" r="1"></circle>
                <path d="M12 11V8a4 4 0 0 0-4-4H6"></path>
              </svg>
              <span>AI 智能分析</span>
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
          {username?.charAt(0).toUpperCase() || 'U'}
        </div>
        <div className="mp-user-info">
          <span className="mp-username">{username}</span>
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

      {/* 设置列表 */}
      <div className="mp-settings">
        <div className="mp-settings-group">
          <h3>行情设置</h3>
          
          <div className="mp-setting-item">
            <div className="mp-setting-label">
              <span>刷新间隔</span>
              <span className="mp-setting-hint">数据自动刷新的时间间隔</span>
            </div>
            <div className="mp-setting-control">
              <input
                type="number"
                value={config.interval}
                min={3}
                onChange={e => onConfigChange({ interval: parseInt(e.target.value) || 5 })}
              />
              <span>秒</span>
            </div>
          </div>

          <div className="mp-setting-item">
            <div className="mp-setting-label">
              <span>涨跌幅预警</span>
              <span className="mp-setting-hint">超过此阈值时触发通知</span>
            </div>
            <div className="mp-setting-control">
              <input
                type="number"
                value={config.pctThreshold}
                min={1}
                onChange={e => onConfigChange({ pctThreshold: parseFloat(e.target.value) || 5 })}
              />
              <span>%</span>
            </div>
          </div>

          <div className="mp-setting-item">
            <div className="mp-setting-label">
              <span>仅交易时间刷新</span>
              <span className="mp-setting-hint">非交易时间不请求数据</span>
            </div>
            <label className="mp-switch">
              <input
                type="checkbox"
                checked={config.refreshOnlyInMarketHours}
                onChange={e => onConfigChange({ refreshOnlyInMarketHours: e.target.checked })}
              />
              <span className="mp-slider"></span>
            </label>
          </div>

          <div className="mp-setting-item">
            <div className="mp-setting-label">
              <span>数据源</span>
              <span className="mp-setting-hint">选择行情数据来源</span>
            </div>
            <select
              value={config.quoteSource}
              onChange={e => onConfigChange({ quoteSource: e.target.value as QuoteSource })}
            >
              <option value="eastmoney">东方财富</option>
              <option value="tencent">腾讯财经</option>
              <option value="sina">新浪财经</option>
            </select>
          </div>

          <div className="mp-setting-item">
            <div className="mp-setting-label">
              <span>策略检查间隔</span>
              <span className="mp-setting-hint">配对监控、AH溢价等策略检查频率</span>
            </div>
            <div className="mp-setting-control">
              <input
                type="number"
                value={config.strategyCheckInterval ?? 30}
                min={10}
                onChange={e => onConfigChange({ strategyCheckInterval: parseInt(e.target.value) || 30 })}
              />
              <span>秒</span>
            </div>
          </div>
        </div>

        {/* 退出登录 */}
        <button className="mp-logout-btn" onClick={onLogout}>
          退出登录
        </button>
      </div>
    </div>
  )
}

export default MobileProfile
