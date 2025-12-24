/**
 * SettingsModal - 用户设置中心弹窗
 * 左侧导航 + 右侧内容的布局
 * 分类：个人资料、账号安全、消息通知、偏好设置
 */
import { useState, useCallback, useEffect, useRef } from 'react'
import {
  getUserInfo,
  sendBindEmailCode,
  bindEmail,
  sendChangeEmailCode,
  changeEmail,
  cloudChangePassword
} from '@/services/cloudService'
import './SettingsModal.css'

type QuoteSource = 'eastmoney' | 'tencent' | 'sina'
type NavTab = 'profile' | 'security' | 'notification' | 'preferences'

interface SettingsModalProps {
  open: boolean
  onClose: () => void
  // 用户信息
  isLoggedIn: boolean
  username?: string
  avatar?: string
  token?: string | null
  // 配置
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
  onLogout: () => void
  onAvatarChange?: (avatar: string) => void
  onLoginSuccess?: (token: string, username: string) => void
}

// 导航图标
const NavIcons = {
  profile: (
    <svg viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
      <circle cx="12" cy="7" r="4"></circle>
    </svg>
  ),
  security: (
    <svg viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
      <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
    </svg>
  ),
  notification: (
    <svg viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
      <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
    </svg>
  ),
  preferences: (
    <svg viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3"></circle>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
    </svg>
  ),
  logout: (
    <svg viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
      <polyline points="16 17 21 12 16 7"></polyline>
      <line x1="21" y1="12" x2="9" y2="12"></line>
    </svg>
  )
}

export function SettingsModal({
  open,
  onClose,
  isLoggedIn,
  username,
  avatar,
  token,
  config,
  onConfigChange,
  onLogout,
  onAvatarChange,
  onLoginSuccess
}: SettingsModalProps) {
  const [activeTab, setActiveTab] = useState<NavTab>('profile')
  const fileInputRef = useRef<HTMLInputElement>(null)

  // 用户邮箱
  const [userEmail, setUserEmail] = useState<string | null>(null)

  // 邮箱绑定/换绑状态
  const [emailMode, setEmailMode] = useState<'bind' | 'change' | null>(null)
  const [newEmail, setNewEmail] = useState('')
  const [emailCode, setEmailCode] = useState('')
  const [emailLoading, setEmailLoading] = useState(false)
  const [emailSendingCode, setEmailSendingCode] = useState(false)
  const [emailCountdown, setEmailCountdown] = useState(0)
  const [emailError, setEmailError] = useState('')
  const [emailSuccess, setEmailSuccess] = useState('')

  // 修改密码状态
  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordLoading, setPasswordLoading] = useState(false)
  const [passwordError, setPasswordError] = useState('')
  const [passwordSuccess, setPasswordSuccess] = useState('')

  // 获取用户邮箱
  useEffect(() => {
    if (open && isLoggedIn) {
      // 优先使用 props 传入的 token，否则从 localStorage 获取
      const currentToken = token || localStorage.getItem('cloud_token')
      if (currentToken) {
        getUserInfo(currentToken)
          .then(info => setUserEmail(info.email))
          .catch(() => setUserEmail(null))
      }
    }
  }, [open, isLoggedIn, token])

  // 重置表单
  const resetEmailForm = useCallback(() => {
    setEmailMode(null)
    setNewEmail('')
    setEmailCode('')
    setEmailError('')
    setEmailSuccess('')
  }, [])

  const resetPasswordForm = useCallback(() => {
    setOldPassword('')
    setNewPassword('')
    setConfirmPassword('')
    setPasswordError('')
    setPasswordSuccess('')
  }, [])

  // 发送邮箱验证码
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

    // 优先使用 props 传入的 token，否则从 localStorage 获取
    const currentToken = token || localStorage.getItem('cloud_token')
    if (!currentToken) {
      setEmailError('请先登录')
      return
    }

    setEmailSendingCode(true)
    setEmailError('')

    try {
      if (emailMode === 'bind') {
        await sendBindEmailCode(currentToken, newEmail.trim())
      } else {
        await sendChangeEmailCode(currentToken, newEmail.trim())
      }
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
  }, [newEmail, emailMode, token])

  // 确认绑定/换绑邮箱
  const handleEmailSubmit = useCallback(async () => {
    if (!newEmail.trim() || !emailCode.trim()) {
      setEmailError('请填写邮箱和验证码')
      return
    }

    // 优先使用 props 传入的 token，否则从 localStorage 获取
    const currentToken = token || localStorage.getItem('cloud_token')
    if (!currentToken) {
      setEmailError('请先登录')
      return
    }

    setEmailLoading(true)
    setEmailError('')

    try {
      if (emailMode === 'bind') {
        const result = await bindEmail(currentToken, newEmail.trim(), emailCode.trim())
        setUserEmail(result.email)
        setEmailSuccess('邮箱绑定成功')
      } else {
        const result = await changeEmail(currentToken, newEmail.trim(), emailCode.trim())
        localStorage.setItem('cloud_token', result.token)
        setUserEmail(newEmail.trim())
        onLoginSuccess?.(result.token, result.username)
        setEmailSuccess('邮箱换绑成功')
      }
      setTimeout(() => {
        resetEmailForm()
      }, 1500)
    } catch (err) {
      setEmailError(err instanceof Error ? err.message : '操作失败')
    } finally {
      setEmailLoading(false)
    }
  }, [newEmail, emailCode, emailMode, token, onLoginSuccess, resetEmailForm])

  // 修改密码
  const handlePasswordChange = useCallback(async () => {
    if (!oldPassword.trim()) {
      setPasswordError('请输入当前密码')
      return
    }
    if (!newPassword.trim()) {
      setPasswordError('请输入新密码')
      return
    }
    if (newPassword.length < 6) {
      setPasswordError('新密码长度至少6位')
      return
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('两次密码输入不一致')
      return
    }

    // 优先使用 props 传入的 token，否则从 localStorage 获取
    const currentToken = token || localStorage.getItem('cloud_token')
    if (!currentToken) {
      setPasswordError('请先登录')
      return
    }

    setPasswordLoading(true)
    setPasswordError('')

    try {
      await cloudChangePassword(currentToken, oldPassword, newPassword)
      setPasswordSuccess('密码修改成功')
      setTimeout(() => {
        resetPasswordForm()
      }, 1500)
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : '修改密码失败')
    } finally {
      setPasswordLoading(false)
    }
  }, [oldPassword, newPassword, confirmPassword, token, resetPasswordForm])

  // 头像上传
  const handleAvatarClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > 2 * 1024 * 1024) {
      alert('图片大小不能超过 2MB')
      return
    }

    const reader = new FileReader()
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string
      onAvatarChange?.(dataUrl)
    }
    reader.readAsDataURL(file)
  }

  // 处理退出登录
  const handleLogout = () => {
    onClose()
    onLogout()
  }

  if (!open) return null

  // 渲染个人资料页
  const renderProfileTab = () => (
    <>
      <div className="settings-section-header">
        <h2 className="settings-section-title">个人资料</h2>
        <p className="settings-section-desc">管理您的个人信息及账号绑定状态</p>
      </div>

      <div className="settings-form-section">
        <div className="settings-form-section-title">基本信息</div>

        <div className="settings-avatar-wrapper">
          <div className="settings-avatar-preview">
            {avatar && (avatar.startsWith('data:') || avatar.startsWith('http')) ? (
              <img src={avatar} alt="头像" />
            ) : (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                <circle cx="12" cy="7" r="4"></circle>
              </svg>
            )}
          </div>
          <div className="settings-avatar-actions">
            <h4>{username || '未登录'}</h4>
            <p>支持 JPG, PNG 格式，最大 2MB</p>
            <button className="settings-btn-upload" onClick={handleAvatarClick}>
              更换头像
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png"
              style={{ display: 'none' }}
              onChange={handleFileChange}
            />
          </div>
        </div>

        <div className="settings-form-group">
          <label className="settings-form-label">用户名</label>
          <input
            type="text"
            className="settings-form-input"
            value={username || ''}
            disabled
          />
          <div className="settings-form-hint">用户名由系统分配，暂不支持修改</div>
        </div>
      </div>

      <div className="settings-form-section">
        <div className="settings-form-section-title">账号绑定</div>
        <div className="settings-form-group">
          <label className="settings-form-label">邮箱绑定</label>

          {emailMode ? (
            // 绑定/换绑表单
            <div>
              {emailError && <div className="settings-message error">{emailError}</div>}
              {emailSuccess && <div className="settings-message success">{emailSuccess}</div>}

              <div className="settings-code-input-wrapper" style={{ marginBottom: 12 }}>
                <input
                  type="email"
                  className="settings-form-input"
                  value={newEmail}
                  onChange={e => setNewEmail(e.target.value)}
                  placeholder={emailMode === 'bind' ? '请输入邮箱' : '请输入新邮箱'}
                  disabled={emailLoading || !!emailSuccess}
                />
                <button
                  className="settings-send-code-btn"
                  onClick={handleSendEmailCode}
                  disabled={emailSendingCode || emailCountdown > 0 || emailLoading || !!emailSuccess}
                >
                  {emailCountdown > 0 ? `${emailCountdown}s` : (emailSendingCode ? '发送中' : '获取验证码')}
                </button>
              </div>

              <input
                type="text"
                className="settings-form-input"
                value={emailCode}
                onChange={e => setEmailCode(e.target.value)}
                placeholder="请输入验证码"
                maxLength={6}
                disabled={emailLoading || !!emailSuccess}
                style={{ marginBottom: 12 }}
              />

              <div style={{ display: 'flex', gap: 12 }}>
                <button
                  className="settings-btn-primary"
                  onClick={handleEmailSubmit}
                  disabled={emailLoading || !!emailSuccess}
                >
                  {emailLoading ? '处理中...' : '确认'}
                </button>
                <button
                  className="settings-btn-outline"
                  onClick={resetEmailForm}
                  disabled={emailLoading}
                >
                  取消
                </button>
              </div>
            </div>
          ) : (
            // 绑定状态显示
            <div className="settings-binding-status">
              <div className="settings-binding-info">
                <div className="settings-binding-title">
                  {userEmail || '未绑定邮箱'}
                </div>
                <div className="settings-binding-desc">
                  {userEmail ? '已绑定，可用于登录和找回密码' : '绑定后可用于登录和找回密码'}
                </div>
              </div>
              <button
                className="settings-btn-outline"
                onClick={() => setEmailMode(userEmail ? 'change' : 'bind')}
              >
                {userEmail ? '换绑' : '立即绑定'}
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  )

  // 渲染账号安全页
  const renderSecurityTab = () => (
    <>
      <div className="settings-section-header">
        <h2 className="settings-section-title">账号安全</h2>
        <p className="settings-section-desc">管理您的登录密码和安全设置</p>
      </div>

      <div className="settings-form-section">
        <div className="settings-form-section-title">修改密码</div>

        {passwordError && <div className="settings-message error">{passwordError}</div>}
        {passwordSuccess && <div className="settings-message success">{passwordSuccess}</div>}

        <div className="settings-form-group">
          <label className="settings-form-label">当前密码</label>
          <input
            type="password"
            className="settings-form-input"
            value={oldPassword}
            onChange={e => setOldPassword(e.target.value)}
            placeholder="输入当前密码"
            disabled={passwordLoading || !!passwordSuccess}
          />
        </div>

        <div className="settings-form-group">
          <label className="settings-form-label">新密码</label>
          <input
            type="password"
            className="settings-form-input"
            value={newPassword}
            onChange={e => setNewPassword(e.target.value)}
            placeholder="新密码（至少6位）"
            disabled={passwordLoading || !!passwordSuccess}
          />
        </div>

        <div className="settings-form-group">
          <label className="settings-form-label">确认新密码</label>
          <input
            type="password"
            className="settings-form-input"
            value={confirmPassword}
            onChange={e => setConfirmPassword(e.target.value)}
            placeholder="确认新密码"
            disabled={passwordLoading || !!passwordSuccess}
          />
        </div>

        <button
          className="settings-btn-primary"
          onClick={handlePasswordChange}
          disabled={passwordLoading || !!passwordSuccess}
        >
          {passwordLoading ? '处理中...' : '保存修改'}
        </button>
      </div>
    </>
  )

  // 渲染消息通知页
  const renderNotificationTab = () => (
    <>
      <div className="settings-section-header">
        <h2 className="settings-section-title">消息通知</h2>
        <p className="settings-section-desc">管理您的通知偏好设置</p>
      </div>

      <div className="settings-form-section">
        <div className="settings-form-section-title">通知设置</div>
        <div className="settings-binding-status">
          <div className="settings-binding-info">
            <div className="settings-binding-title">暂无可配置项</div>
            <div className="settings-binding-desc">消息通知功能正在开发中，敬请期待</div>
          </div>
        </div>
      </div>
    </>
  )

  // 渲染偏好设置页
  const renderPreferencesTab = () => (
    <>
      <div className="settings-section-header">
        <h2 className="settings-section-title">偏好设置</h2>
        <p className="settings-section-desc">个性化您的看板体验</p>
      </div>

      <div className="settings-form-section">
        <div className="settings-form-section-title">数据刷新</div>

        <div className="settings-item-row">
          <div className="settings-item-label">
            <span>刷新间隔</span>
            <div className="settings-item-hint">数据自动刷新的时间间隔</div>
          </div>
          <div className="settings-item-control">
            <input
              type="number"
              className="settings-number-input"
              value={config.interval}
              min={3}
              onChange={e => onConfigChange({ interval: parseInt(e.target.value) || 5 })}
            />
            <span className="settings-item-unit">秒</span>
          </div>
        </div>

        <div className="settings-item-row">
          <div className="settings-item-label">
            <span>仅交易时间刷新</span>
            <div className="settings-item-hint">开启后，非交易时间不会请求行情数据</div>
          </div>
          <div className="settings-item-control">
            <label className="settings-switch">
              <input
                type="checkbox"
                checked={config.refreshOnlyInMarketHours}
                onChange={e => onConfigChange({ refreshOnlyInMarketHours: e.target.checked })}
              />
              <span className="settings-switch-slider"></span>
            </label>
          </div>
        </div>

        <div className="settings-item-row">
          <div className="settings-item-label">
            <span>策略检查间隔</span>
            <div className="settings-item-hint">配对监控、AH溢价等策略的检查频率</div>
          </div>
          <div className="settings-item-control">
            <input
              type="number"
              className="settings-number-input"
              value={config.strategyCheckInterval ?? 30}
              min={10}
              onChange={e => onConfigChange({ strategyCheckInterval: parseInt(e.target.value) || 30 })}
            />
            <span className="settings-item-unit">秒</span>
          </div>
        </div>
      </div>

      <div className="settings-form-section">
        <div className="settings-form-section-title">外观与数据</div>

        <div className="settings-item-row">
          <div className="settings-item-label">
            <span>主题</span>
            <div className="settings-item-hint">选择界面显示主题</div>
          </div>
          <div className="settings-item-control">
            <select
              className="settings-select"
              value={config.theme}
              onChange={e => onConfigChange({ theme: e.target.value as 'light' | 'dark' | 'auto' })}
            >
              <option value="auto">跟随系统</option>
              <option value="light">浅色</option>
              <option value="dark">深色</option>
            </select>
          </div>
        </div>

        <div className="settings-item-row">
          <div className="settings-item-label">
            <span>数据源</span>
            <div className="settings-item-hint">选择行情数据来源（东方财富支持更多指标）</div>
          </div>
          <div className="settings-item-control">
            <select
              className="settings-select"
              value={config.quoteSource}
              onChange={e => onConfigChange({ quoteSource: e.target.value as QuoteSource })}
            >
              <option value="eastmoney">东方财富（推荐）</option>
              <option value="tencent">腾讯财经</option>
              <option value="sina">新浪财经</option>
            </select>
          </div>
        </div>

        <div className="settings-item-row">
          <div className="settings-item-label">
            <span>涨跌幅预警阈值</span>
            <div className="settings-item-hint">超过此阈值时触发通知</div>
          </div>
          <div className="settings-item-control">
            <input
              type="number"
              className="settings-number-input"
              value={config.pctThreshold}
              min={1}
              onChange={e => onConfigChange({ pctThreshold: parseFloat(e.target.value) || 5 })}
            />
            <span className="settings-item-unit">%</span>
          </div>
        </div>
      </div>
    </>
  )

  return (
    <div className={`settings-modal-backdrop ${open ? 'show' : ''}`} onClick={onClose}>
      <div className="settings-modal" onClick={e => e.stopPropagation()}>
        <button className="settings-modal-close" onClick={onClose}>&times;</button>

        <aside className="settings-sidebar">
          <div className="settings-sidebar-title">用户设置</div>

          <button
            className={`settings-nav-item ${activeTab === 'profile' ? 'active' : ''}`}
            onClick={() => setActiveTab('profile')}
          >
            <span className="settings-nav-icon">{NavIcons.profile}</span>
            个人资料
          </button>

          <button
            className={`settings-nav-item ${activeTab === 'security' ? 'active' : ''}`}
            onClick={() => setActiveTab('security')}
          >
            <span className="settings-nav-icon">{NavIcons.security}</span>
            账号安全
          </button>

          <button
            className={`settings-nav-item ${activeTab === 'notification' ? 'active' : ''}`}
            onClick={() => setActiveTab('notification')}
          >
            <span className="settings-nav-icon">{NavIcons.notification}</span>
            消息通知
          </button>

          <button
            className={`settings-nav-item ${activeTab === 'preferences' ? 'active' : ''}`}
            onClick={() => setActiveTab('preferences')}
          >
            <span className="settings-nav-icon">{NavIcons.preferences}</span>
            偏好设置
          </button>

          {isLoggedIn && (
            <button className="settings-nav-item settings-nav-logout" onClick={handleLogout}>
              <span className="settings-nav-icon">{NavIcons.logout}</span>
              退出登录
            </button>
          )}
        </aside>

        <main className="settings-content">
          {activeTab === 'profile' && renderProfileTab()}
          {activeTab === 'security' && renderSecurityTab()}
          {activeTab === 'notification' && renderNotificationTab()}
          {activeTab === 'preferences' && renderPreferencesTab()}
        </main>
      </div>
    </div>
  )
}

export default SettingsModal
