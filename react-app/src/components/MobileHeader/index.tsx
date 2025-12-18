/**
 * MobileHeader - 移动端顶部导航栏
 * 简洁设计，居中标题
 */

import React from 'react'
import './MobileHeader.css'

interface MobileHeaderProps {
  title?: string
  showBack?: boolean
  onBack?: () => void
}

export const MobileHeader: React.FC<MobileHeaderProps> = ({ 
  title = 'Fintell',
  showBack = false,
  onBack
}) => {
  return (
    <div className="mobile-header">
      {/* 左侧：返回按钮或占位 */}
      <div className="mobile-header-left">
        {showBack && onBack ? (
          <button className="mobile-back-btn" onClick={onBack} aria-label="返回">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 18l-6-6 6-6"/>
            </svg>
          </button>
        ) : (
          <div className="mobile-header-spacer"></div>
        )}
      </div>
      
      {/* 中间：标题 */}
      <div className="mobile-header-title">{title}</div>
      
      {/* 右侧：占位 */}
      <div className="mobile-header-right">
        <div className="mobile-header-spacer"></div>
      </div>
    </div>
  )
}
