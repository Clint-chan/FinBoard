/**
 * GroupAlertModal - 分组异动预警配置弹窗
 */
import { useState, useEffect } from 'react'
import type { GroupAlertStrategy, GroupAlertType } from '@/types/strategy'
import type { StockCategory } from '@/types'
import { generateStrategyId } from '@/services/strategyService'
import './Modal.css'

interface GroupAlertModalProps {
  open: boolean
  category: StockCategory | null
  existingStrategy?: GroupAlertStrategy | null  // 编辑现有策略
  onClose: () => void
  onSave: (strategy: GroupAlertStrategy) => void
}

const ALERT_TYPE_OPTIONS: { id: GroupAlertType; label: string; desc: string }[] = [
  { id: 'limit_up', label: '涨停', desc: '股票触及涨停价' },
  { id: 'limit_open', label: '开板', desc: '涨停打开' },
  { id: 'volume_surge', label: '量能异动', desc: '成交量突然放大' },
  { id: 'rapid_rise', label: '快速拉升', desc: '短时间内快速上涨' },
  { id: 'rapid_fall', label: '快速下跌', desc: '短时间内快速下跌' }
]

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
  const [rapidFallThreshold, setRapidFallThreshold] = useState(2)

  // 初始化表单
  useEffect(() => {
    if (existingStrategy) {
      setAlertTypes(existingStrategy.alertTypes)
      setVolumeSurgeMultiplier(existingStrategy.volumeSurgeMultiplier)
      setRapidRiseThreshold(existingStrategy.rapidRiseThreshold)
      setRapidFallThreshold(existingStrategy.rapidFallThreshold)
    } else {
      // 默认值
      setAlertTypes(['limit_up', 'limit_open', 'volume_surge'])
      setVolumeSurgeMultiplier(3)
      setRapidRiseThreshold(2)
      setRapidFallThreshold(2)
    }
  }, [existingStrategy, open])

  const toggleAlertType = (type: GroupAlertType) => {
    setAlertTypes(prev => {
      if (prev.includes(type)) {
        return prev.filter(t => t !== type)
      }
      return [...prev, type]
    })
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
      rapidFallThreshold
    }

    onSave(strategy)
    onClose()
  }

  if (!open || !category) return null

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content group-alert-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>分组异动预警</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          <div className="group-alert-header-info">
            <span className="group-alert-label">监控分组</span>
            <span className="group-alert-name">{category.name}</span>
            <span className="group-alert-divider">·</span>
            <span className="group-alert-count">{category.codes.length} 只股票</span>
          </div>

          <div className="group-alert-section">
            <div className="section-title">异动类型</div>
            <div className="alert-type-tags">
              {ALERT_TYPE_OPTIONS.map(option => (
                <button
                  key={option.id}
                  type="button"
                  className={`alert-type-tag ${alertTypes.includes(option.id) ? 'active' : ''}`}
                  onClick={() => toggleAlertType(option.id)}
                  title={option.desc}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {alertTypes.includes('volume_surge') && (
            <div className="group-alert-param">
              <label>
                <span>量能放大倍数</span>
                <div className="param-input-group">
                  <input
                    type="number"
                    min="1.5"
                    max="10"
                    step="0.5"
                    value={volumeSurgeMultiplier}
                    onChange={e => setVolumeSurgeMultiplier(Number(e.target.value))}
                  />
                  <span className="param-unit">倍</span>
                </div>
              </label>
              <span className="param-hint">实时成交量增速 &gt; 近期均速 × {volumeSurgeMultiplier}</span>
            </div>
          )}

          {alertTypes.includes('rapid_rise') && (
            <div className="group-alert-param">
              <label>
                <span>快速拉升阈值</span>
                <div className="param-input-group">
                  <input
                    type="number"
                    min="0.5"
                    max="10"
                    step="0.5"
                    value={rapidRiseThreshold}
                    onChange={e => setRapidRiseThreshold(Number(e.target.value))}
                  />
                  <span className="param-unit">%</span>
                </div>
              </label>
              <span className="param-hint">短时涨幅 &gt; {rapidRiseThreshold}%（约1分钟内）</span>
            </div>
          )}

          {alertTypes.includes('rapid_fall') && (
            <div className="group-alert-param">
              <label>
                <span>快速下跌阈值</span>
                <div className="param-input-group">
                  <input
                    type="number"
                    min="0.5"
                    max="10"
                    step="0.5"
                    value={rapidFallThreshold}
                    onChange={e => setRapidFallThreshold(Number(e.target.value))}
                  />
                  <span className="param-unit">%</span>
                </div>
              </label>
              <span className="param-hint">短时跌幅 &gt; {rapidFallThreshold}%（约1分钟内）</span>
            </div>
          )}
        </div>

        <div className="modal-actions">
          <button onClick={onClose}>取消</button>
          <button 
            className="primary" 
            onClick={handleSave}
            disabled={alertTypes.length === 0}
          >
            {existingStrategy ? '保存修改' : '创建预警'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default GroupAlertModal
