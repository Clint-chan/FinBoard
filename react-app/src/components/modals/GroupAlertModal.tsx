/**
 * GroupAlertModal - 分组异动预警配置弹窗
 * 机构级设计风格
 */
import { useState, useEffect } from 'react'
import type { GroupAlertStrategy, GroupAlertType } from '@/types/strategy'
import type { StockCategory } from '@/types'
import { generateStrategyId } from '@/services/strategyService'
import './Modal.css'

interface GroupAlertModalProps {
  open: boolean
  category: StockCategory | null
  existingStrategy?: GroupAlertStrategy | null
  onClose: () => void
  onSave: (strategy: GroupAlertStrategy) => void
}

// 图标组件 - 使用固定尺寸
const IconRise = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
    <polyline points="17 6 23 6 23 12" />
  </svg>
)

const IconFall = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 18 13.5 8.5 8.5 13.5 1 6" />
    <polyline points="17 18 23 18 23 12" />
  </svg>
)

const IconLimitUp = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
)

const IconLimitOpen = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M7 11V7a5 5 0 0 1 9.9-1" />
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
  </svg>
)

const IconVolume = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="20" x2="18" y2="4" />
    <line x1="6" y1="20" x2="6" y2="14" />
    <line x1="12" y1="20" x2="12" y2="10" />
  </svg>
)

const IconCheck = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
  </svg>
)

const IconUncheck = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="9" />
  </svg>
)

const IconClose = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 6 6 18" />
    <path d="m6 6 12 12" />
  </svg>
)

const IconStart = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2v4" /><path d="m16.2 7.8 2.9-2.9" /><path d="M18 12h4" />
    <path d="m16.2 16.2 2.9 2.9" /><path d="M12 18v4" /><path d="m4.9 19.1 2.9-2.9" />
    <path d="M2 12h4" /><path d="m4.9 4.9 2.9 2.9" />
  </svg>
)

export function GroupAlertModal({
  open,
  category,
  existingStrategy,
  onClose,
  onSave
}: GroupAlertModalProps) {
  const [alertTypes, setAlertTypes] = useState<GroupAlertType[]>(['limit_up', 'limit_open', 'volume_surge'])
  const [volumeSurgeMultiplier, setVolumeSurgeMultiplier] = useState(3)
  const [rapidRiseThreshold, setRapidRiseThreshold] = useState(2)
  const [rapidFallThreshold, setRapidFallThreshold] = useState(3)
  // Alpha Monitor
  const [alphaMonitorEnabled, setAlphaMonitorEnabled] = useState(false)
  const [alphaThreshold, setAlphaThreshold] = useState(2)

  useEffect(() => {
    if (existingStrategy) {
      setAlertTypes(existingStrategy.alertTypes)
      setVolumeSurgeMultiplier(existingStrategy.volumeSurgeMultiplier)
      setRapidRiseThreshold(existingStrategy.rapidRiseThreshold)
      setRapidFallThreshold(existingStrategy.rapidFallThreshold)
      setAlphaMonitorEnabled(existingStrategy.alphaMonitorEnabled || false)
      setAlphaThreshold(existingStrategy.alphaThreshold || 2)
    } else {
      setAlertTypes(['limit_up', 'limit_open', 'volume_surge'])
      setVolumeSurgeMultiplier(3)
      setRapidRiseThreshold(2)
      setRapidFallThreshold(3)
      setAlphaMonitorEnabled(false)
      setAlphaThreshold(2)
    }
  }, [existingStrategy, open])

  const toggleAlertType = (type: GroupAlertType) => {
    setAlertTypes(prev =>
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    )
  }

  // 切换 Alpha Monitor
  const toggleAlphaMonitor = () => {
    setAlphaMonitorEnabled(!alphaMonitorEnabled)
  }

  const handleSave = () => {
    if (!category || alertTypes.length === 0) return
    const now = Date.now()
    const strategy: GroupAlertStrategy = {
      id: existingStrategy?.id || generateStrategyId(),
      name: `分组监控 · ${category.name}`,
      type: 'group_alert',
      status: 'running',
      enabled: true,
      createdAt: existingStrategy?.createdAt || now,
      updatedAt: now,
      categoryId: category.id,
      categoryName: category.name,
      alertTypes,
      volumeSurgeMultiplier,
      rapidRiseThreshold,
      rapidFallThreshold,
      alphaMonitorEnabled,
      alphaThreshold
    }
    onSave(strategy)
    onClose()
  }

  if (!open || !category) return null

  const isActive = (type: GroupAlertType) => alertTypes.includes(type)

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="group-alert-modal-v2" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="gam-header">
          <div>
            <h1 className="gam-title">策略监控配置</h1>
            <div className="gam-subtitle">
              <span className="gam-label">TARGET GROUP</span>
              <span className="gam-group-tag">
                {category.name}
                <span className="gam-group-count">{category.codes.length} 标的</span>
              </span>
            </div>
          </div>
          <button className="gam-close" onClick={onClose}>
            <IconClose />
          </button>
        </div>

        {/* Body */}
        <div className="gam-body">
          {/* 价格异动 */}
          <div className="gam-section">
            <label className="gam-section-label">价格异动 (Price Action)</label>
            <div className="gam-grid-2">
              {/* 快速拉升 */}
              <div
                className={`gam-card ${isActive('rapid_rise') ? 'active-red' : ''}`}
                onClick={() => toggleAlertType('rapid_rise')}
              >
                <div className="gam-card-header">
                  <div className="gam-card-left">
                    <div className={`gam-icon-box ${isActive('rapid_rise') ? 'icon-red' : ''}`}>
                      <IconRise />
                    </div>
                    <div>
                      <div className="gam-card-title">快速拉升</div>
                      <div className="gam-card-desc">短时涨幅</div>
                    </div>
                  </div>
                  <div className={`gam-checkbox ${isActive('rapid_rise') ? 'check-red' : ''}`}>
                    {isActive('rapid_rise') ? <IconCheck /> : <IconUncheck />}
                  </div>
                </div>
                <div className={`gam-input-row ${isActive('rapid_rise') ? 'input-red' : 'input-disabled'}`}>
                  <span className="gam-input-label">阈值</span>
                  <input
                    type="number"
                    value={rapidRiseThreshold}
                    onChange={e => setRapidRiseThreshold(Number(e.target.value))}
                    onClick={e => e.stopPropagation()}
                    disabled={!isActive('rapid_rise')}
                  />
                  <span className="gam-input-unit">%</span>
                </div>
              </div>

              {/* 快速下跌 */}
              <div
                className={`gam-card ${isActive('rapid_fall') ? 'active-green' : ''}`}
                onClick={() => toggleAlertType('rapid_fall')}
              >
                <div className="gam-card-header">
                  <div className="gam-card-left">
                    <div className={`gam-icon-box ${isActive('rapid_fall') ? 'icon-green' : ''}`}>
                      <IconFall />
                    </div>
                    <div>
                      <div className="gam-card-title">快速下跌</div>
                      <div className="gam-card-desc">短时跌幅</div>
                    </div>
                  </div>
                  <div className={`gam-checkbox ${isActive('rapid_fall') ? 'check-green' : ''}`}>
                    {isActive('rapid_fall') ? <IconCheck /> : <IconUncheck />}
                  </div>
                </div>
                <div className={`gam-input-row ${isActive('rapid_fall') ? 'input-green' : 'input-disabled'}`}>
                  <span className="gam-input-label">阈值</span>
                  <input
                    type="number"
                    value={rapidFallThreshold}
                    onChange={e => setRapidFallThreshold(Number(e.target.value))}
                    onClick={e => e.stopPropagation()}
                    disabled={!isActive('rapid_fall')}
                  />
                  <span className="gam-input-unit">%</span>
                </div>
              </div>
            </div>
          </div>

          {/* 关键状态 */}
          <div className="gam-section">
            <label className="gam-section-label">关键状态 (Key Events)</label>
            <div className="gam-grid-2">
              {/* 涨停封板 */}
              <div
                className={`gam-switch-card ${isActive('limit_up') ? 'switch-active-red' : ''}`}
                onClick={() => toggleAlertType('limit_up')}
              >
                <div className="gam-switch-left">
                  <div className={`gam-switch-icon ${isActive('limit_up') ? 'icon-red' : ''}`}>
                    <IconLimitUp />
                  </div>
                  <span className="gam-switch-text">涨停封板</span>
                </div>
                <div className={`gam-toggle ${isActive('limit_up') ? 'toggle-on-red' : ''}`}>
                  <div className="gam-toggle-dot" />
                </div>
              </div>

              {/* 开板/炸板 */}
              <div
                className={`gam-switch-card ${isActive('limit_open') ? 'switch-active-orange' : ''}`}
                onClick={() => toggleAlertType('limit_open')}
              >
                <div className="gam-switch-left">
                  <div className={`gam-switch-icon ${isActive('limit_open') ? 'icon-orange' : ''}`}>
                    <IconLimitOpen />
                  </div>
                  <span className="gam-switch-text">开板/炸板</span>
                </div>
                <div className={`gam-toggle ${isActive('limit_open') ? 'toggle-on-orange' : ''}`}>
                  <div className="gam-toggle-dot" />
                </div>
              </div>
            </div>
          </div>

          {/* 量能因子 */}
          <div className="gam-section">
            <label className="gam-section-label">量能因子 (Volume Factor)</label>
            <div className={`gam-volume-card ${isActive('volume_surge') ? 'active-blue' : ''}`}>
              <div className="gam-volume-header">
                <div className="gam-volume-left">
                  <div className={`gam-volume-icon ${isActive('volume_surge') ? 'icon-blue-solid' : ''}`}>
                    <IconVolume />
                  </div>
                  <div>
                    <div className="gam-volume-title">
                      <span>量能瞬间爆发</span>
                      <span className="gam-alpha-tag">Alpha</span>
                    </div>
                    <p className="gam-volume-desc">最新成交量增量 &gt; 均值 × 倍数</p>
                  </div>
                </div>
                <div
                  className={`gam-toggle gam-toggle-lg ${isActive('volume_surge') ? 'toggle-on-blue' : ''}`}
                  onClick={e => { e.stopPropagation(); toggleAlertType('volume_surge') }}
                >
                  <div className="gam-toggle-dot" />
                </div>
              </div>
              <div className={`gam-volume-input ${isActive('volume_surge') ? '' : 'input-disabled'}`}>
                <span className="gam-input-label">放大倍数</span>
                <input
                  type="range"
                  min="1"
                  max="10"
                  step="0.5"
                  value={volumeSurgeMultiplier}
                  onChange={e => setVolumeSurgeMultiplier(Number(e.target.value))}
                  disabled={!isActive('volume_surge')}
                  className="gam-slider"
                />
                <div className="gam-vol-display">
                  <input
                    type="number"
                    value={volumeSurgeMultiplier}
                    onChange={e => setVolumeSurgeMultiplier(Number(e.target.value))}
                    disabled={!isActive('volume_surge')}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Alpha Monitor - 龙头过滤器 */}
          <div className="gam-section">
            <label className="gam-section-label">龙头过滤器 (Alpha Monitor)</label>
            <div className={`gam-alpha-card ${alphaMonitorEnabled ? 'active-purple' : ''}`}>
              <div className="gam-alpha-header">
                <div className="gam-alpha-left">
                  <div className={`gam-alpha-icon ${alphaMonitorEnabled ? 'icon-purple-solid' : ''}`}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M3 3v18h18" />
                      <path d="M7 12l3-3 3 3 5-5" />
                      <circle cx="18" cy="7" r="2" fill="currentColor" />
                    </svg>
                  </div>
                  <div>
                    <div className="gam-alpha-title">
                      <span>龙头过滤器</span>
                      <span className="gam-alpha-badge">Alpha</span>
                    </div>
                    <p className="gam-alpha-desc">开启后，只有跑赢分组平均的龙头股才会触发异动预警</p>
                  </div>
                </div>
                <div
                  className={`gam-toggle gam-toggle-lg ${alphaMonitorEnabled ? 'toggle-on-purple' : ''}`}
                  onClick={toggleAlphaMonitor}
                >
                  <div className="gam-toggle-dot" />
                </div>
              </div>
              <div className={`gam-alpha-input ${alphaMonitorEnabled ? '' : 'input-disabled'}`}>
                <span className="gam-input-label">超额阈值</span>
                <input
                  type="range"
                  min="0.5"
                  max="5"
                  step="0.5"
                  value={alphaThreshold}
                  onChange={e => setAlphaThreshold(Number(e.target.value))}
                  disabled={!alphaMonitorEnabled}
                  className="gam-slider gam-slider-purple"
                />
                <div className="gam-alpha-display">
                  <input
                    type="number"
                    value={alphaThreshold}
                    onChange={e => setAlphaThreshold(Number(e.target.value))}
                    disabled={!alphaMonitorEnabled}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="gam-footer">
          <button className="gam-btn-cancel" onClick={onClose}>取消</button>
          <button
            className="gam-btn-primary"
            onClick={handleSave}
            disabled={alertTypes.length === 0}
          >
            <IconStart />
            {existingStrategy ? '保存配置' : '启动盯盘'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default GroupAlertModal
