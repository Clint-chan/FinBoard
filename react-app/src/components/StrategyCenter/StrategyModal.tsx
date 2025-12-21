/**
 * StrategyModal - 新建/编辑策略弹窗
 */
import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { 
  Strategy, 
  StrategyType,
  SectorArbStrategy,
  AHPremiumStrategy,
  FakeBreakoutStrategy,
  PriceAlertStrategy,
  PriceCondition
} from '@/types/strategy'
import { generateStrategyId, getStrategyTypeLabel } from '@/services/strategyService'
import { searchStock } from '@/services/dataService'
import type { SearchResult } from '@/types'
import './StrategyModal.css'

interface StrategyModalProps {
  open: boolean
  strategy: Strategy | null
  highlightConditionIndex?: number | null  // 高亮的条件索引
  onClose: () => void
  onSave: (strategy: Strategy) => void
}

const STRATEGY_TYPES: { id: StrategyType; label: string; desc: string }[] = [
  { id: 'sector_arb', label: '行业套利', desc: '监控同行业两只股票的走势偏离' },
  { id: 'ah_premium', label: 'AH溢价', desc: '监控A股与H股的溢价率变化' },
  { id: 'fake_breakout', label: '假突破/异动', desc: '监控高开但板块走弱的诱多信号' },
  { id: 'price', label: '价格预警', desc: '监控股票价格突破或跌破指定价位' }
]

export function StrategyModal({ open, strategy, highlightConditionIndex, onClose, onSave }: StrategyModalProps) {
  const [step, setStep] = useState<'type' | 'config'>('type')
  const [selectedType, setSelectedType] = useState<StrategyType | null>(null)
  const [formData, setFormData] = useState<Partial<Strategy>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  
  // 价格预警相关状态
  const [priceConditions, setPriceConditions] = useState<PriceCondition[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [showSearchResults, setShowSearchResults] = useState(false)
  
  // 条件列表容器 ref，用于滚动
  const conditionsListRef = useRef<HTMLDivElement>(null)
  const highlightedConditionRef = useRef<HTMLDivElement>(null)

  const isEdit = !!strategy

  // 初始化表单
  useEffect(() => {
    if (open) {
      if (strategy) {
        setSelectedType(strategy.type)
        setFormData(strategy)
        setStep('config')
        if (strategy.type === 'price') {
          // 确保每个条件都有唯一 id
          const conditions = ((strategy as PriceAlertStrategy).conditions || []).map((c, i) => ({
            ...c,
            id: c.id || `cond-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 7)}`
          }))
          setPriceConditions(conditions)
          setSearchQuery((strategy as PriceAlertStrategy).stockName || (strategy as PriceAlertStrategy).code || '')
        }
      } else {
        setSelectedType(null)
        setFormData({})
        setStep('type')
        setPriceConditions([])
        setSearchQuery('')
      }
      setErrors({})
      setSearchResults([])
      setShowSearchResults(false)
    }
  }, [open, strategy])

  // 自动滚动到高亮的条件
  useEffect(() => {
    if (open && highlightConditionIndex !== null && highlightConditionIndex !== undefined && highlightedConditionRef.current) {
      // 延迟一点确保 DOM 已渲染
      setTimeout(() => {
        highlightedConditionRef.current?.scrollIntoView({
          behavior: 'smooth',
          block: 'center'
        })
      }, 100)
    }
  }, [open, highlightConditionIndex, priceConditions.length])

  // 搜索股票
  const handleSearch = useCallback(async (query: string) => {
    setSearchQuery(query)
    if (query.length < 1) {
      setSearchResults([])
      setShowSearchResults(false)
      return
    }
    
    setSearching(true)
    try {
      const results = await searchStock(query)
      setSearchResults(results.slice(0, 8))
      setShowSearchResults(true)
    } catch (err) {
      console.error('搜索失败:', err)
    } finally {
      setSearching(false)
    }
  }, [])

  // 选择股票
  const handleSelectStock = (result: SearchResult) => {
    setSearchQuery(result.name)
    updateField('code', result.code)
    updateField('stockName', result.name)
    setShowSearchResults(false)
  }

  // 选择策略类型
  const handleSelectType = (type: StrategyType) => {
    setSelectedType(type)
    setFormData({ type, name: '', enabled: true })
    if (type === 'price') {
      setPriceConditions([{ 
        id: `cond-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        type: 'price', 
        operator: 'above', 
        value: 0 
      }])
    }
    setStep('config')
  }

  // 更新表单字段
  const updateField = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }))
    }
  }

  // 添加预警条件
  const addCondition = () => {
    setPriceConditions([...priceConditions, { 
      id: `cond-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      type: 'price', 
      operator: 'above', 
      value: 0 
    }])
  }

  // 更新预警条件
  const updateCondition = (idx: number, field: keyof PriceCondition, value: any) => {
    const newConditions = [...priceConditions]
    newConditions[idx] = { ...newConditions[idx], [field]: value }
    setPriceConditions(newConditions)
  }

  // 删除预警条件
  const deleteCondition = (idx: number) => {
    setPriceConditions(priceConditions.filter((_, i) => i !== idx))
  }

  // 验证表单
  const validate = (): boolean => {
    const newErrors: Record<string, string> = {}

    if (selectedType !== 'price' && !formData.name?.trim()) {
      newErrors.name = '请输入策略名称'
    }

    switch (selectedType) {
      case 'sector_arb':
        if (!(formData as SectorArbStrategy).longCode) newErrors.longCode = '请输入做多标的代码'
        if (!(formData as SectorArbStrategy).shortCode) newErrors.shortCode = '请输入做空标的代码'
        if (!(formData as SectorArbStrategy).benchmarkCode) newErrors.benchmarkCode = '请输入基准ETF代码'
        if (!(formData as SectorArbStrategy).threshold) newErrors.threshold = '请输入偏离阈值'
        break
      case 'ah_premium':
        if (!(formData as AHPremiumStrategy).aCode) newErrors.aCode = '请输入A股代码'
        if (!(formData as AHPremiumStrategy).hCode) newErrors.hCode = '请输入H股代码'
        break
      case 'fake_breakout':
        if (!(formData as FakeBreakoutStrategy).sectorCode) newErrors.sectorCode = '请输入板块代码'
        break
      case 'price':
        if (!(formData as PriceAlertStrategy).code) newErrors.code = '请选择股票'
        if (priceConditions.length === 0) newErrors.conditions = '请添加至少一个预警条件'
        break
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  // 保存策略
  const handleSave = () => {
    if (!validate()) return

    const now = Date.now()
    // 价格预警策略名称格式：价格监控 · 股票名
    const strategyName = selectedType === 'price' 
      ? `价格监控 · ${(formData as PriceAlertStrategy).stockName || (formData as PriceAlertStrategy).code || '未知'}`
      : formData.name

    const newStrategy: Strategy = {
      ...formData,
      name: strategyName,
      id: strategy?.id || generateStrategyId(),
      type: selectedType!,
      status: 'running',
      enabled: true,
      createdAt: strategy?.createdAt || now,
      updatedAt: now
    } as Strategy

    if (selectedType === 'sector_arb') {
      (newStrategy as SectorArbStrategy).threshold = (formData as SectorArbStrategy).threshold || 5
    }
    if (selectedType === 'ah_premium') {
      (newStrategy as AHPremiumStrategy).lowThreshold = (formData as AHPremiumStrategy).lowThreshold || 25
      ;(newStrategy as AHPremiumStrategy).highThreshold = (formData as AHPremiumStrategy).highThreshold || 40
      ;(newStrategy as AHPremiumStrategy).avgPremium = (formData as AHPremiumStrategy).avgPremium || 30
    }
    if (selectedType === 'fake_breakout') {
      (newStrategy as FakeBreakoutStrategy).openThreshold = (formData as FakeBreakoutStrategy).openThreshold || 3
      ;(newStrategy as FakeBreakoutStrategy).volumeRatioThreshold = (formData as FakeBreakoutStrategy).volumeRatioThreshold || 1
    }
    if (selectedType === 'price') {
      const validConditions = priceConditions.filter(c => {
        const val = typeof c.value === 'string' ? parseFloat(c.value as any) : c.value
        return !isNaN(val) && val !== 0
      }).map(c => ({
        ...c,
        value: typeof c.value === 'string' ? parseFloat(c.value as any) : c.value
      }))
      ;(newStrategy as PriceAlertStrategy).conditions = validConditions
    }

    onSave(newStrategy)
  }

  if (!open) return null

  return (
    <div className="strategy-modal-backdrop" onClick={onClose}>
      <div className="strategy-modal" onClick={e => e.stopPropagation()}>
        <div className="strategy-modal-header">
          <div className="modal-header-left">
            <h2>{isEdit ? '编辑策略' : '新建策略'}</h2>
            {step === 'config' && selectedType && (
              <span className={`modal-type-badge type-${selectedType.replace('_', '-')}`}>
                {getTypeIcon(selectedType)}
                {getStrategyTypeLabel(selectedType)}
              </span>
            )}
          </div>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="strategy-modal-body">
          {step === 'type' ? (
            <div className="strategy-type-select">
              <p className="type-select-hint">选择策略类型</p>
              <div className="strategy-type-grid">
                {STRATEGY_TYPES.map(type => (
                  <div
                    key={type.id}
                    className={`strategy-type-card ${selectedType === type.id ? 'selected' : ''}`}
                    onClick={() => handleSelectType(type.id)}
                  >
                    <div className="type-card-icon">{getTypeIcon(type.id)}</div>
                    <div className="type-card-content">
                      <h4>{type.label}</h4>
                      <p>{type.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="strategy-config-form">
              {!isEdit && (
                <button className="btn-back" onClick={() => setStep('type')}>← 返回选择类型</button>
              )}

              {/* 价格预警不显示下方的类型徽章，因为头部已经有了 */}
              {selectedType !== 'price' && (
                <div className="config-type-badge">
                  {getTypeIcon(selectedType!)}
                  <span>{getStrategyTypeLabel(selectedType!)}</span>
                </div>
              )}

              {selectedType !== 'price' && (
                <div className="form-group">
                  <label>策略名称 *</label>
                  <input
                    type="text"
                    placeholder="如：机器人板块强弱配对"
                    value={formData.name || ''}
                    onChange={e => updateField('name', e.target.value)}
                    className={errors.name ? 'error' : ''}
                  />
                  {errors.name && <span className="error-msg">{errors.name}</span>}
                </div>
              )}

              {selectedType === 'sector_arb' && (
                <>
                  <div className="form-row">
                    <div className="form-group">
                      <label>做多标的代码 *</label>
                      <input type="text" placeholder="如：sh603166" value={(formData as SectorArbStrategy).longCode || ''} onChange={e => updateField('longCode', e.target.value)} className={errors.longCode ? 'error' : ''} />
                      {errors.longCode && <span className="error-msg">{errors.longCode}</span>}
                    </div>
                    <div className="form-group">
                      <label>做空标的代码 *</label>
                      <input type="text" placeholder="如：sz002050" value={(formData as SectorArbStrategy).shortCode || ''} onChange={e => updateField('shortCode', e.target.value)} className={errors.shortCode ? 'error' : ''} />
                      {errors.shortCode && <span className="error-msg">{errors.shortCode}</span>}
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label>基准ETF代码 *</label>
                      <input type="text" placeholder="如：sz159770" value={(formData as SectorArbStrategy).benchmarkCode || ''} onChange={e => updateField('benchmarkCode', e.target.value)} className={errors.benchmarkCode ? 'error' : ''} />
                      {errors.benchmarkCode && <span className="error-msg">{errors.benchmarkCode}</span>}
                    </div>
                    <div className="form-group">
                      <label>偏离阈值 (%)</label>
                      <input type="number" placeholder="5" value={(formData as SectorArbStrategy).threshold || ''} onChange={e => updateField('threshold', parseFloat(e.target.value) || 0)} />
                    </div>
                  </div>
                </>
              )}

              {selectedType === 'ah_premium' && (
                <>
                  <div className="form-row">
                    <div className="form-group">
                      <label>A股代码 *</label>
                      <input type="text" placeholder="如：sh600036" value={(formData as AHPremiumStrategy).aCode || ''} onChange={e => updateField('aCode', e.target.value)} className={errors.aCode ? 'error' : ''} />
                      {errors.aCode && <span className="error-msg">{errors.aCode}</span>}
                    </div>
                    <div className="form-group">
                      <label>H股代码 *</label>
                      <input type="text" placeholder="如：03968" value={(formData as AHPremiumStrategy).hCode || ''} onChange={e => updateField('hCode', e.target.value)} className={errors.hCode ? 'error' : ''} />
                      {errors.hCode && <span className="error-msg">{errors.hCode}</span>}
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label>低溢价阈值 (%) - 做多A</label>
                      <input type="number" placeholder="25" value={(formData as AHPremiumStrategy).lowThreshold || ''} onChange={e => updateField('lowThreshold', parseFloat(e.target.value) || 0)} />
                    </div>
                    <div className="form-group">
                      <label>高溢价阈值 (%) - 做空A</label>
                      <input type="number" placeholder="40" value={(formData as AHPremiumStrategy).highThreshold || ''} onChange={e => updateField('highThreshold', parseFloat(e.target.value) || 0)} />
                    </div>
                  </div>
                  <div className="form-group">
                    <label>历史平均溢价率 (%)</label>
                    <input type="number" placeholder="30" value={(formData as AHPremiumStrategy).avgPremium || ''} onChange={e => updateField('avgPremium', parseFloat(e.target.value) || 0)} />
                  </div>
                </>
              )}

              {selectedType === 'fake_breakout' && (
                <>
                  <div className="form-group">
                    <label>板块代码 *</label>
                    <input type="text" placeholder="如：BK0447 (半导体)" value={(formData as FakeBreakoutStrategy).sectorCode || ''} onChange={e => updateField('sectorCode', e.target.value)} className={errors.sectorCode ? 'error' : ''} />
                    {errors.sectorCode && <span className="error-msg">{errors.sectorCode}</span>}
                    <span className="form-hint">可在东方财富行业板块页面查看板块代码</span>
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label>高开阈值 (%)</label>
                      <input type="number" placeholder="3" value={(formData as FakeBreakoutStrategy).openThreshold || ''} onChange={e => updateField('openThreshold', parseFloat(e.target.value) || 0)} />
                    </div>
                    <div className="form-group">
                      <label>量比阈值</label>
                      <input type="number" placeholder="1" step="0.1" value={(formData as FakeBreakoutStrategy).volumeRatioThreshold || ''} onChange={e => updateField('volumeRatioThreshold', parseFloat(e.target.value) || 0)} />
                    </div>
                  </div>
                </>
              )}

              {selectedType === 'price' && (
                <div className="price-alert-config">
                  <div className="form-group stock-search-group">
                    <label>股票名称/代码 <span className="required">*</span></label>
                    <div className="stock-search-wrapper">
                      <span className="stock-prefix">
                        {(formData as PriceAlertStrategy).code 
                          ? ((formData as PriceAlertStrategy).code?.toLowerCase().startsWith('sz') ? 'SZ' : 'SH')
                          : '--'}
                      </span>
                      <input
                        type="text"
                        placeholder="输入股票代码或名称搜索..."
                        value={searchQuery}
                        onChange={e => handleSearch(e.target.value)}
                        onFocus={() => searchResults.length > 0 && setShowSearchResults(true)}
                        className={errors.code ? 'error' : ''}
                      />
                      {searching && <span className="search-loading">搜索中...</span>}
                      {showSearchResults && searchResults.length > 0 && (
                        <div className="search-results">
                          {searchResults.map(result => (
                            <div key={result.code} className="search-result-item" onClick={() => handleSelectStock(result)}>
                              <span className="result-name">{result.name}</span>
                              <span className="result-code">{result.code}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    {errors.code && <span className="error-msg">{errors.code}</span>}
                  </div>

                  <div className="section-divider" />

                  <div className="price-conditions-section">
                    <div className="conditions-header">
                      <label>预警条件配置</label>
                      <button className="add-condition-link" onClick={addCondition}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M12 4v16m8-8H4" />
                        </svg>
                        添加条件
                      </button>
                    </div>
                    {errors.conditions && <span className="error-msg">{errors.conditions}</span>}
                    
                    <div className="price-conditions-list" ref={conditionsListRef}>
                      <AnimatePresence mode="popLayout">
                        {priceConditions.length === 0 ? (
                          <motion.div 
                            key="empty"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="conditions-empty"
                          >
                            暂无预警条件，点击上方按钮添加
                          </motion.div>
                        ) : (
                          priceConditions.map((cond, idx) => (
                            <motion.div 
                              key={cond.id || `condition-${idx}`}
                              initial={{ opacity: 0, y: -10, scale: 0.95 }}
                              animate={{ opacity: 1, y: 0, scale: 1 }}
                              exit={{ opacity: 0, x: -20, scale: 0.9, transition: { duration: 0.2 } }}
                              transition={{ duration: 0.2, ease: "easeOut" }}
                              ref={highlightConditionIndex === idx ? highlightedConditionRef : null}
                              className={`price-condition-card ${highlightConditionIndex === idx ? 'highlighted' : ''}`}
                            >
                              <button className="condition-delete-btn" onClick={() => deleteCondition(idx)} title="删除条件">
                                <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                                  <path d="M18 6 6 18M6 6l12 12" />
                                </svg>
                              </button>
                              
                              <div className="condition-controls">
                                <select value={cond.type} onChange={e => updateCondition(idx, 'type', e.target.value as 'price' | 'pct')}>
                                  <option value="price">价格</option>
                                  <option value="pct">涨跌幅</option>
                                </select>
                                <span className="condition-label">当</span>
                                <select value={cond.operator} onChange={e => updateCondition(idx, 'operator', e.target.value as 'above' | 'below')}>
                                  <option value="above">{cond.type === 'pct' ? '≥' : '突破'}</option>
                                  <option value="below">{cond.type === 'pct' ? '≤' : '跌破'}</option>
                                </select>
                                <div className="condition-value-wrapper">
                                  <input 
                                    type="text" 
                                    inputMode="decimal" 
                                    value={cond.value || ''} 
                                    placeholder="阈值" 
                                    onChange={e => updateCondition(idx, 'value', e.target.value)} 
                                  />
                                  <span className="condition-unit">{cond.type === 'pct' ? '%' : '元'}</span>
                                </div>
                              </div>
                              
                              <input 
                                type="text" 
                                className="condition-note-input" 
                                value={(cond as any).note || ''} 
                                placeholder="添加备注或逻辑说明..." 
                                onChange={e => updateCondition(idx, 'note' as any, e.target.value)} 
                              />
                            </motion.div>
                          ))
                        )}
                      </AnimatePresence>
                      
                      <button className="add-condition-card" onClick={addCondition}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M12 4v16m8-8H4" />
                        </svg>
                        添加新的监控条件
                      </button>
                    </div>
                  </div>

                  <div className="form-group">
                    <label>全局策略逻辑备忘</label>
                    <textarea 
                      placeholder="在此记录该策略的核心思路..." 
                      value={formData.note || ''} 
                      onChange={e => updateField('note', e.target.value)} 
                      rows={3} 
                    />
                  </div>
                </div>
              )}

              {selectedType !== 'price' && (
                <div className="form-group">
                  <label>策略备注</label>
                  <textarea placeholder="记录策略逻辑或交易理由..." value={formData.note || ''} onChange={e => updateField('note', e.target.value)} rows={3} />
                </div>
              )}
            </div>
          )}
        </div>

        {step === 'config' && (
          <div className="strategy-modal-footer">
            <button className="btn-cancel" onClick={onClose}>取消</button>
            <button className="btn-save" onClick={handleSave}>{isEdit ? '保存修改' : '创建策略'}</button>
          </div>
        )}
      </div>
    </div>
  )
}

function getTypeIcon(type: StrategyType) {
  const icons: Record<StrategyType, JSX.Element> = {
    sector_arb: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 3v18h18" /><path d="M18 17V9" /><path d="M13 17V5" /><path d="M8 17v-3" />
      </svg>
    ),
    ah_premium: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" /><line x1="2" x2="22" y1="12" y2="12" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
      </svg>
    ),
    fake_breakout: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" /><path d="M12 9v4" /><path d="M12 17h.01" />
      </svg>
    ),
    price: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
      </svg>
    )
  }
  return icons[type] || null
}

export default StrategyModal
