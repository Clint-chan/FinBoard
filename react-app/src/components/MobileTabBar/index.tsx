/**
 * MobileTabBar - 移动端底部导航栏
 * 自选、行情、AI（中间突出）、预警、我的
 */
import './MobileTabBar.css'

export type MobileTab = 'watchlist' | 'market' | 'ai' | 'strategies' | 'profile'

interface MobileTabBarProps {
  activeTab: MobileTab
  onTabChange: (tab: MobileTab) => void
}

const Icons = {
  watchlist: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="7" height="7"></rect>
      <rect x="14" y="3" width="7" height="7"></rect>
      <rect x="14" y="14" width="7" height="7"></rect>
      <rect x="3" y="14" width="7" height="7"></rect>
    </svg>
  ),
  market: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M18 20V10"></path>
      <path d="M12 20V4"></path>
      <path d="M6 20v-6"></path>
    </svg>
  ),
  // AI 图标 - 机器人/智能助手风格
  ai: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {/* 头部外框 */}
      <rect x="4" y="4" width="16" height="12" rx="2"></rect>
      {/* 左眼 */}
      <circle cx="9" cy="10" r="1.5" fill="currentColor" stroke="none"></circle>
      {/* 右眼 */}
      <circle cx="15" cy="10" r="1.5" fill="currentColor" stroke="none"></circle>
      {/* 天线 */}
      <path d="M12 4V2"></path>
      <circle cx="12" cy="1.5" r="0.5" fill="currentColor" stroke="none"></circle>
      {/* 底部支架 */}
      <path d="M8 16v2"></path>
      <path d="M16 16v2"></path>
      <path d="M6 18h12"></path>
    </svg>
  ),
  alerts: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
      <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
    </svg>
  ),
  profile: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
      <circle cx="12" cy="7" r="4"></circle>
    </svg>
  )
}

export function MobileTabBar({ activeTab, onTabChange }: MobileTabBarProps) {
  const tabs: { id: MobileTab; label: string; icon: JSX.Element }[] = [
    { id: 'watchlist', label: '自选', icon: Icons.watchlist },
    { id: 'market', label: '行情', icon: Icons.market },
    { id: 'ai', label: 'AI', icon: Icons.ai },
    { id: 'strategies', label: '策略', icon: Icons.alerts },
    { id: 'profile', label: '我的', icon: Icons.profile }
  ]

  return (
    <nav className="mobile-tab-bar">
      {tabs.map(tab => (
        <div
          key={tab.id}
          className={`tab-item ${activeTab === tab.id ? 'active' : ''} ${tab.id === 'ai' ? 'ai-btn' : ''}`}
          onClick={() => onTabChange(tab.id)}
        >
          {tab.id === 'ai' ? (
            <div className="ai-icon-wrapper">
              {tab.icon}
            </div>
          ) : (
            <span className="tab-icon">{tab.icon}</span>
          )}
          <span className="tab-label">{tab.label}</span>
        </div>
      ))}
    </nav>
  )
}

export default MobileTabBar
