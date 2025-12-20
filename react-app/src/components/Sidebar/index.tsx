import { useState, useCallback } from 'react'
import type { PageType, UserProfile } from '@/types'
import { cloudChangePassword } from '@/services/cloudService'
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
      <line x1="18" y1="20" x2="18" y2="10"></line>
      <line x1="12" y1="20" x2="12" y2="4"></line>
      <line x1="6" y1="20" x2="6" y2="14"></line>
    </svg>
  ),
  strategies: (
    <svg viewBox="0 0 24 24">
      <path d="M12 2L2 7l10 5 10-5-10-5z"></path>
      <path d="M2 17l10 5 10-5M2 12l10 5 10-5"></path>
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

  const navItems: { id: PageType | 'insight'; label: string; icon: JSX.Element; adminOnly?: boolean }[] = [
    { id: 'watchlist', label: 'Watchlist', icon: Icons.watchlist },
    { id: 'insight', label: 'Insight', icon: Icons.analysis },
    { id: 'strategies', label: 'Strategies', icon: Icons.strategies },
    { id: 'alerts', label: 'Alerts', icon: Icons.alerts },
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

        <div className="sidebar-user" onClick={displayUsername ? openProfileModal : onLoginClick}>
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
