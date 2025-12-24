import { useState, useCallback, useEffect } from 'react'
import type { PageType, UserProfile } from '@/types'
import { 
  cloudChangePassword, 
  getUserInfo, 
  sendBindEmailCode, 
  bindEmail, 
  sendChangeEmailCode, 
  changeEmail 
} from '@/services/cloudService'
import './Sidebar.css'

// 图标组件
const Icons = {
  watchlist: (
    <svg viewBox="0 0 24 24">
      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path>
    </svg>
  ),
  analysis: (
    <svg viewBox="0 0 24 24">
      <path d="M3 3v18h18"></path>
      <path d="m19 9-5 5-4-4-3 3"></path>
    </svg>
  ),
  daily: (
    <svg viewBox="0 0 24 24">
      <path d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z"></path>
    </svg>
  ),
  strategies: (
    <svg viewBox="0 0 24 24">
      <path d="m12 3-8.8 4.7a.8.8 0 0 0 0 1.4L12 13.9l8.8-4.7a.8.8 0 0 0 0-1.4L12 3Z"></path>
      <path d="m21.2 13.4-8.8 4.7a.8.8 0 0 1-.8 0L2.8 13.4"></path>
      <path d="m21.2 17.4-8.8 4.7a.8.8 0 0 1-.8 0L2.8 17.4"></path>
    </svg>
  ),
  alerts: (
    <svg viewBox="0 0 24 24">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
      <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
    </svg>
  ),
  settings: (
    <svg viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="3"></circle>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
    </svg>
  ),
  admin: (
    <svg viewBox="0 0 24 24">
      <path d="M12 2L2 7l10 5 10-5-10-5z"></path>
      <path d="M2 17l10 5 10-5"></path>
      <path d="M2 12l10 5 10-5"></path>
    </svg>
  ),
  login: (
    <svg viewBox="0 0 24 24">
      <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"></path>
      <polyline points="10 17 15 12 10 7"></polyline>
      <line x1="15" y1="12" x2="3" y2="12"></line>
    </svg>
  ),
  logout: (
    <svg viewBox="0 0 24 24">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
      <polyline points="16 17 21 12 16 7"></polyline>
      <line x1="21" y1="12" x2="9" y2="12"></line>
    </svg>
  ),
  edit: (
    <svg viewBox="0 0 24 24">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
    </svg>
  ),
  close: (
    <svg viewBox="0 0 24 24">
      <line x1="18" y1="6" x2="6" y2="18"></line>
      <line x1="6" y1="6" x2="18" y2="18"></line>
    </svg>
  ),
  user: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
      <circle cx="12" cy="7" r="4"></circle>
    </svg>
  ),
}

interface SidebarProps {
  activePage: PageType
  user: UserProfile | null
  isLoggedIn?: boolean
  cloudUsername?: string | null
  syncing?: boolean
  isAdmin?: boolean
  expanded?: boolean
  onExpandedChange?: (expanded: boolean) => void
  onPageChange: (page: PageType) => void
  onLoginClick: () => void
  onLogoutClick: () => void
  onInsightClick: () => void
  onProfileSave: (profile: UserProfile) => void
  onSync?: () => void | Promise<void>
  token?: string | null
  onProfileClick?: () => void  // 新增：点击用户头像时的回调
}

function Sidebar({
  activePage,
  user,
  isLoggedIn = false,
  expanded: externalExpanded,
  onExpandedChange,
  cloudUsername,
  syncing = false,
  isAdmin = false,
  onPageChange,
  onLoginClick,
  onLogoutClick,
  onInsightClick,
  onProfileSave,
  onSync,
  token,
  onProfileClick,
}: SidebarProps) {
  const [expanded, setExpanded] = useState(false)
  const [profileModalOpen, setProfileModalOpen] = useState(false)
  const [editUsername, setEditUsername] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [passwordSuccess, setPasswordSuccess] = useState(false)

  // 邮箱相关状态
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [showEmailForm, setShowEmailForm] = useState(false)
  const [emailFormMode, setEmailFormMode] = useState<'bind' | 'change'>('bind')
  const [newEmail, setNewEmail] = useState('')
  const [emailCode, setEmailCode] = useState('')
  const [emailLoading, setEmailLoading] = useState(false)
  const [emailSendingCode, setEmailSendingCode] = useState(false)
  const [emailCountdown, setEmailCountdown] = useState(0)
  const [emailError, setEmailError] = useState('')
  const [emailSuccess, setEmailSuccess] = useState('')

  // 获取用户邮箱信息
  useEffect(() => {
    if (isLoggedIn && token) {
      getUserInfo(token)
        .then(info => setUserEmail(info.email))
        .catch(() => setUserEmail(null))
    } else {
      setUserEmail(null)
    }
  }, [isLoggedIn, token])

  const navItems: { id: PageType | 'insight'; label: string; icon: JSX.Element; adminOnly?: boolean }[] = [
    { id: 'watchlist', label: 'Watchlist', icon: Icons.watchlist },
    { id: 'daily', label: 'Daily', icon: Icons.daily },
    { id: 'insight', label: 'Insight', icon: Icons.analysis },
    { id: 'strategies', label: 'Strategies', icon: Icons.strategies },
    { id: 'settings', label: 'Settings', icon: Icons.settings },
    { id: 'admin', label: 'Admin', icon: Icons.admin, adminOnly: true },
  ]

  const handleNavClick = (id: PageType | 'insight') => {
    if (id === 'insight') {
      onInsightClick()
    } else {
      onPageChange(id)
    }
  }

  // 显示的用户名：优先云端用户名，其次本地用户资料
  const displayUsername = cloudUsername || user?.username

  const openProfileModal = useCallback(() => {
    setEditUsername(cloudUsername || user?.username || '')
    // 只使用有效的头像 URL（data: 或 http 开头）
    const validAvatar = user?.avatar && (user.avatar.startsWith('data:') || user.avatar.startsWith('http')) ? user.avatar : ''
    setAvatarUrl(validAvatar)
    setOldPassword('')
    setNewPassword('')
    setConfirmPassword('')
    setPasswordError('')
    setPasswordSuccess(false)
    setProfileModalOpen(true)
  }, [user, cloudUsername])

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    
    if (file.size > 500 * 1024) {
      alert('图片大小不能超过 500KB')
      return
    }
    
    const reader = new FileReader()
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        const size = 128
        canvas.width = size
        canvas.height = size
        const ctx = canvas.getContext('2d')!
        
        const minDim = Math.min(img.width, img.height)
        const sx = (img.width - minDim) / 2
        const sy = (img.height - minDim) / 2
        
        ctx.drawImage(img, sx, sy, minDim, minDim, 0, 0, size, size)
        const compressedUrl = canvas.toDataURL('image/jpeg', 0.8)
        setAvatarUrl(compressedUrl)
        
        // 自动保存头像
        onProfileSave({
          username: editUsername,
          avatar: compressedUrl
        })
      }
      img.src = dataUrl
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  const handlePasswordChange = async () => {
    setPasswordError('')
    setPasswordSuccess(false)

    if (!oldPassword || !newPassword || !confirmPassword) {
      setPasswordError('请填写所有密码字段')
      return
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('两次新密码输入不一致')
      return
    }

    if (newPassword.length < 6) {
      setPasswordError('新密码长度至少 6 位')
      return
    }

    if (!token) {
      setPasswordError('未登录，无法修改密码')
      return
    }

    try {
      await cloudChangePassword(token, oldPassword, newPassword)
      setPasswordSuccess(true)
      setOldPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setTimeout(() => setPasswordSuccess(false), 3000)
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : '修改密码失败')
    }
  }

  // 打开邮箱绑定/换绑表单
  const openEmailForm = (mode: 'bind' | 'change') => {
    setEmailFormMode(mode)
    setNewEmail('')
    setEmailCode('')
    setEmailError('')
    setEmailSuccess('')
    setShowEmailForm(true)
  }

  // 发送邮箱验证码
  const handleSendEmailCode = async () => {
    if (!newEmail.trim()) {
      setEmailError('请先输入邮箱')
      return
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(newEmail.trim())) {
      setEmailError('邮箱格式不正确')
      return
    }

    if (!token) {
      setEmailError('请先登录')
      return
    }

    setEmailSendingCode(true)
    setEmailError('')

    try {
      if (emailFormMode === 'bind') {
        await sendBindEmailCode(token, newEmail.trim())
      } else {
        await sendChangeEmailCode(token, newEmail.trim())
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
  }

  // 确认绑定/换绑邮箱
  const handleEmailSubmit = async () => {
    if (!newEmail.trim() || !emailCode.trim()) {
      setEmailError('请填写邮箱和验证码')
      return
    }

    if (!token) {
      setEmailError('请先登录')
      return
    }

    setEmailLoading(true)
    setEmailError('')

    try {
      if (emailFormMode === 'bind') {
        const result = await bindEmail(token, newEmail.trim(), emailCode.trim())
        setUserEmail(result.email)
        setEmailSuccess('邮箱绑定成功')
      } else {
        const result = await changeEmail(token, newEmail.trim(), emailCode.trim())
        localStorage.setItem('cloud_token', result.token)
        setUserEmail(newEmail.trim())
        setEmailSuccess('邮箱换绑成功')
      }
      setTimeout(() => {
        setShowEmailForm(false)
        setEmailSuccess('')
      }, 1500)
    } catch (err) {
      setEmailError(err instanceof Error ? err.message : '操作失败')
    } finally {
      setEmailLoading(false)
    }
  }

  const isExpanded = externalExpanded !== undefined ? externalExpanded : expanded

  return (
    <>
      {/* 移动端遮罩 */}
      {isExpanded && externalExpanded && (
        <div 
          className="sidebar-backdrop"
          onClick={() => onExpandedChange?.(false)}
        />
      )}
      
      <aside
        className={`sidebar ${isExpanded ? 'expanded' : ''}`}
        onMouseEnter={() => !externalExpanded && setExpanded(true)}
        onMouseLeave={() => !externalExpanded && setExpanded(false)}
      >
        <div className="sidebar-logo">
          <span className="sidebar-logo-text">Fintell</span>
        </div>

        <nav className="sidebar-nav">
          {navItems
            .filter(item => !item.adminOnly || isAdmin)
            .map(item => (
            <div
              key={item.id}
              className={`sidebar-item ${activePage === item.id ? 'active' : ''}`}
              onClick={() => handleNavClick(item.id)}
            >
              <span className="sidebar-icon">{item.icon}</span>
              <span className="sidebar-label">{item.label}</span>
            </div>
          ))}
        </nav>

        <div className="sidebar-user" onClick={displayUsername ? (onProfileClick || openProfileModal) : onLoginClick}>
          {/* 同步按钮 - 小图标 */}
          {isLoggedIn && onSync && (
            <button 
              className={`sync-icon-btn ${syncing ? 'syncing' : ''}`}
              onClick={(e) => {
                e.stopPropagation()
                onSync()
              }}
              title="同步云端配置"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2" />
              </svg>
            </button>
          )}
          <div className="sidebar-avatar">
            {user?.avatar && (user.avatar.startsWith('data:') || user.avatar.startsWith('http')) ? (
              <img src={user.avatar} alt="" />
            ) : (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                <circle cx="12" cy="7" r="4"></circle>
              </svg>
            )}
          </div>
          <span className="sidebar-username">{displayUsername || 'Login'}</span>
        </div>
      </aside>

      {/* 用户资料弹窗 */}
      {profileModalOpen && (
        <div className="profile-modal-backdrop show" onClick={() => setProfileModalOpen(false)}>
          <div className="profile-modal" onClick={e => e.stopPropagation()}>
            <div className="profile-modal-header">
              <span className="profile-modal-title">用户资料</span>
              <div className="profile-modal-close" onClick={() => setProfileModalOpen(false)}>
                {Icons.close}
              </div>
            </div>
            <div className="profile-modal-body">
              {/* 用户信息 */}
              <div className="profile-info-section">
                <div className="profile-avatar-large">
                  {avatarUrl && (avatarUrl.startsWith('data:') || avatarUrl.startsWith('http')) ? (
                    <img src={avatarUrl} alt="头像" />
                  ) : (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                      <circle cx="12" cy="7" r="4"></circle>
                    </svg>
                  )}
                </div>
                <label className="profile-avatar-upload-btn">
                  <input type="file" accept="image/*" onChange={handleAvatarUpload} />
                  上传头像
                </label>
                <div className="profile-username-display">{editUsername}</div>
              </div>

              {/* 邮箱绑定 */}
              {isLoggedIn && (
                <div className="profile-email-section">
                  <h3 className="profile-section-title">绑定邮箱</h3>
                  
                  {!showEmailForm ? (
                    <div className="profile-email-display">
                      {userEmail ? (
                        <>
                          <span className="profile-email-text">{userEmail}</span>
                          <button className="profile-email-btn" onClick={() => openEmailForm('change')}>换绑</button>
                        </>
                      ) : (
                        <>
                          <span className="profile-email-text profile-email-empty">未绑定</span>
                          <button className="profile-email-btn profile-email-btn-primary" onClick={() => openEmailForm('bind')}>去绑定</button>
                        </>
                      )}
                    </div>
                  ) : (
                    <div className="profile-email-form">
                      {emailError && <div className="profile-message profile-message-error">{emailError}</div>}
                      {emailSuccess && <div className="profile-message profile-message-success">{emailSuccess}</div>}
                      
                      <div className="profile-form-group">
                        <div className="profile-input-with-btn">
                          <input
                            type="email"
                            value={newEmail}
                            onChange={e => setNewEmail(e.target.value)}
                            placeholder={emailFormMode === 'bind' ? '请输入邮箱' : '请输入新邮箱'}
                            disabled={emailLoading || !!emailSuccess}
                          />
                          <button
                            className="profile-send-code-btn"
                            onClick={handleSendEmailCode}
                            disabled={emailSendingCode || emailCountdown > 0 || emailLoading || !!emailSuccess}
                          >
                            {emailCountdown > 0 ? `${emailCountdown}s` : (emailSendingCode ? '发送中' : '获取验证码')}
                          </button>
                        </div>
                      </div>
                      
                      <div className="profile-form-group">
                        <input
                          type="text"
                          value={emailCode}
                          onChange={e => setEmailCode(e.target.value)}
                          placeholder="请输入验证码"
                          maxLength={6}
                          disabled={emailLoading || !!emailSuccess}
                        />
                      </div>
                      
                      <div className="profile-email-actions">
                        <button 
                          className="profile-btn profile-btn-secondary"
                          onClick={() => setShowEmailForm(false)}
                          disabled={emailLoading}
                        >
                          取消
                        </button>
                        <button 
                          className="profile-btn profile-btn-primary"
                          onClick={handleEmailSubmit}
                          disabled={emailLoading || !!emailSuccess}
                        >
                          {emailLoading ? '处理中...' : '确认'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* 修改密码 */}
              {isLoggedIn && (
                <div className="profile-password-section">
                  <h3 className="profile-section-title">修改密码</h3>
                  
                  {passwordError && (
                    <div className="profile-message profile-message-error">
                      {passwordError}
                    </div>
                  )}
                  
                  {passwordSuccess && (
                    <div className="profile-message profile-message-success">
                      密码修改成功
                    </div>
                  )}

                  <div className="profile-form-group">
                    <label>当前密码</label>
                    <input
                      type="password"
                      value={oldPassword}
                      onChange={e => setOldPassword(e.target.value)}
                      placeholder="请输入当前密码"
                    />
                  </div>

                  <div className="profile-form-group">
                    <label>新密码</label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                      placeholder="至少 6 位"
                    />
                  </div>

                  <div className="profile-form-group">
                    <label>确认新密码</label>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)}
                      placeholder="再次输入新密码"
                    />
                  </div>

                  <button 
                    className="profile-btn profile-btn-primary"
                    onClick={handlePasswordChange}
                  >
                    修改密码
                  </button>
                </div>
              )}

              {/* 登出按钮 */}
              {isLoggedIn && (
                <div className="profile-logout-section">
                  <button 
                    className="profile-btn profile-btn-logout"
                    onClick={() => {
                      setProfileModalOpen(false)
                      onLogoutClick()
                    }}
                  >
                    退出登录
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default Sidebar
