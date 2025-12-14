/**
 * MobileHeader - 移动端顶部导航栏
 */

import React from 'react'
import './MobileHeader.css'

interface MobileHeaderProps {
  onMenuClick: () => void
  title?: string
}

export const MobileHeader: React.FC<MobileHeaderProps> = ({ 
  onMenuClick,
  title = 'Fintell'
}) => {
  return (
    <div className="mobile-header">
      <button className="mobile-menu-btn" onClick={onMenuClick} aria-label="打开菜单">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>
      
      <div className="mobile-header-title">{title}</div>
      
      <div className="mobile-header-spacer"></div>
    </div>
  )
}
