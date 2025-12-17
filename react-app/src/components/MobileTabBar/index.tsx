/**
 * MobileTabBar - 移动端底部导航栏
 * 对照 2.html 设计：自选、行情、交易（中间突出）、我的
 */
import './MobileTabBar.css'

export type MobileTab = 'watchlist' | 'market' | 'trade' | 'alerts' | 'profile'

interface MobileTabBarProps {
  activeTab: MobileTab
  onTabChange: (tab: MobileTab) => void
  onFintellClick?: () => void
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
  trade: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 5v14M5 12h14"/>
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

export function MobileTabBar({ activeTab, onTabChange, onFintellClick }: MobileTabBarProps) {
  const tabs: { id: MobileTab; label: string; icon: JSX.Element }[] = [
    { id: 'watchlist', label: '自选', icon: Icons.watchlist },
    { id: 'market', label: '行情', icon: Icons.market },
    { id: 'trade', label: '交易', icon: Icons.trade },
    { id: 'alerts', label: '预警', icon: Icons.alerts },
    { id: 'profile', label: '我的', icon: Icons.profile }
  ]

  return (
    <>
      {/* Fintell 悬浮入口 */}
      {onFintellClick && (
        <div className="fintell-fab" onClick={onFintellClick}>
          <svg className="fintell-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path>
          </svg>
          <span className="fintell-text">问Fintell</span>
        </div>
      )}

      {/* 底部导航栏 */}
      <nav className="mobile-tab-bar">
        {tabs.map(tab => (
          <div
            key={tab.id}
            className={`tab-item ${activeTab === tab.id ? 'active' : ''} ${tab.id === 'trade' ? 'trade-btn' : ''}`}
            onClick={() => onTabChange(tab.id)}
          >
            {tab.id === 'trade' ? (
              <div className="trade-icon-wrapper">
                {tab.icon}
              </div>
            ) : (
              <span className="tab-icon">{tab.icon}</span>
            )}
            <span className="tab-label">{tab.label}</span>
          </div>
        ))}
      </nav>
    </>
  )
}

export default MobileTabBar
