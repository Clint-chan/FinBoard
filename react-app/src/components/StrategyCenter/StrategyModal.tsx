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
  PriceCondition,
  PairMonitorMode
} from '@/types/strategy'
import { generateStrategyId, getStrategyTypeLabel, calculateCorrelationAndBeta } from '@/services/strategyService'
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
  { id: 'sector_arb', label: '配对监控', desc: '监控两只股票的走势偏离或与基准的偏离' },
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
  
  // 内部高亮索引（用于添加新条件时的高亮）
  const [internalHighlightIndex, setInternalHighlightIndex] = useState<number | null>(null)
  
  // 条件列表容器 ref，用于滚动
  const conditionsListRef = useRef<HTMLDivElement>(null)
  const highlightedConditionRef = useRef<HTMLDivElement>(null)

  const isEdit = !!strategy
  
  // 合并外部和内部的高亮索引
  const activeHighlightIndex = highlightConditionIndex ?? internalHighlightIndex

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
      setInternalHighlightIndex(null)
    }
  }, [open, strategy])

  // 自动滚动到高亮的条件
  useEffect(() => {
    if (open && activeHighlightIndex !== null && activeHighlightIndex !== undefined && highlightedConditionRef.current) {
      // 延迟一点确保 DOM 已渲染
      setTimeout(() => {
        highlightedConditionRef.current?.scrollIntoView({
          behavior: 'smooth',
          block: 'center'
        })
      }, 100)
      
      // 内部高亮 1.5 秒后自动消失
      if (internalHighlightIndex !== null) {
        const timer = setTimeout(() => {
          setInternalHighlightIndex(null)
        }, 1500)
        return () => clearTimeout(timer)
      }
    }
  }, [open, activeHighlightIndex, priceConditions.length, internalHighlightIndex])

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
    const newIndex = priceConditions.length
    setPriceConditions([...priceConditions, { 
      id: `cond-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      type: 'price', 
      operator: 'above', 
      value: 0 
    }])
    // 高亮新添加的条件
    setInternalHighlightIndex(newIndex)
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
        if (!(formData as SectorArbStrategy).stockACode) newErrors.stockACode = '请选择核心观察标的'
        if (!(formData as SectorArbStrategy).stockBCode) newErrors.stockBCode = '请选择对标/基准标的'
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
      ;(newStrategy as SectorArbStrategy).monitorMode = (formData as SectorArbStrategy).monitorMode || 'return_diff'
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
              {/* 类型徽章已在头部显示，此处不再重复 */}

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
                <PairMonitorConfig 
                  formData={formData as Partial<SectorArbStrategy>}
                  errors={errors}
                  updateField={updateField}
                />
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
                              ref={activeHighlightIndex === idx ? highlightedConditionRef : null}
                              className={`price-condition-card ${activeHighlightIndex === idx ? 'highlighted' : ''}`}
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

// 配对监控配置组件
interface PairMonitorConfigProps {
  formData: Partial<SectorArbStrategy>
  errors: Record<string, string>
  updateField: (field: string, value: any) => void
}

function PairMonitorConfig({ formData, errors, updateField }: PairMonitorConfigProps) {
  const [searchQueryA, setSearchQueryA] = useState('')
  const [searchQueryB, setSearchQueryB] = useState('')
  const [searchResultsA, setSearchResultsA] = useState<SearchResult[]>([])
  const [searchResultsB, setSearchResultsB] = useState<SearchResult[]>([])
  const [showResultsA, setShowResultsA] = useState(false)
  const [showResultsB, setShowResultsB] = useState(false)
  const [searchingA, setSearchingA] = useState(false)
  const [searchingB, setSearchingB] = useState(false)
  const [calculatingStats, setCalculatingStats] = useState(false)

  // 初始化搜索框显示
  useEffect(() => {
    if (formData.stockAName) setSearchQueryA(formData.stockAName)
    if (formData.stockBName) setSearchQueryB(formData.stockBName)
  }, [formData.stockAName, formData.stockBName])

  // 当两只股票都选择后，自动计算相关性和 Beta
  useEffect(() => {
    const calcStats = async () => {
      if (!formData.stockACode || !formData.stockBCode) return
      // 如果已经有数据且股票没变，不重复计算
      if (formData.correlation !== undefined && formData.beta !== undefined) return

      setCalculatingStats(true)
      try {
        const result = await calculateCorrelationAndBeta(formData.stockACode, formData.stockBCode, 60)
        if (result) {
          updateField('correlation', result.correlation)
          updateField('beta', result.beta)
        }
      } catch (err) {
        console.error('计算统计数据失败:', err)
      } finally {
        setCalculatingStats(false)
      }
    }

    calcStats()
  }, [formData.stockACode, formData.stockBCode])

  const handleSearchA = useCallback(async (query: string) => {
    setSearchQueryA(query)
    if (query.length < 1) {
      setSearchResultsA([])
      setShowResultsA(false)
      return
    }
    setSearchingA(true)
    try {
      const results = await searchStock(query)
      setSearchResultsA(results.slice(0, 6))
      setShowResultsA(true)
    } catch (err) {
      console.error('搜索失败:', err)
    } finally {
      setSearchingA(false)
    }
  }, [])

  const handleSearchB = useCallback(async (query: string) => {
    setSearchQueryB(query)
    if (query.length < 1) {
      setSearchResultsB([])
      setShowResultsB(false)
      return
    }
    setSearchingB(true)
    try {
      const results = await searchStock(query)
      setSearchResultsB(results.slice(0, 6))
      setShowResultsB(true)
    } catch (err) {
      console.error('搜索失败:', err)
    } finally {
      setSearchingB(false)
    }
  }, [])

  const selectStockA = (result: SearchResult) => {
    setSearchQueryA(result.name)
    updateField('stockACode', result.code)
    updateField('stockAName', result.name)
    // 清除旧的统计数据，触发重新计算
    updateField('correlation', undefined)
    updateField('beta', undefined)
    setShowResultsA(false)
  }

  const selectStockB = (result: SearchResult) => {
    setSearchQueryB(result.name)
    updateField('stockBCode', result.code)
    updateField('stockBName', result.name)
    // 清除旧的统计数据，触发重新计算
    updateField('correlation', undefined)
    updateField('beta', undefined)
    setShowResultsB(false)
  }

  const getCodePrefix = (code?: string) => {
    if (!code) return '--'
    return code.toLowerCase().startsWith('sz') ? 'SZ' : 'SH'
  }

  const getCodeNumber = (code?: string) => {
    if (!code) return ''
    return code.replace(/^(sh|sz)/i, '').toUpperCase()
  }

  return (
    <div className="pair-monitor-config">
      {/* 配对标的选择卡片 */}
      <div className="pair-comparison-card">
        <div className="pair-comparison-inner">
          {/* 标的 A */}
          <div className="pair-stock-box">
            <label className="pair-stock-label">
              <span>核心观察标的 (X)</span>
              <span className="stock-code-badge">{getCodePrefix(formData.stockACode)}{getCodeNumber(formData.stockACode)}</span>
            </label>
            <div className="pair-stock-search">
              <input
                type="text"
                placeholder="输入代码或名称搜索"
                value={searchQueryA}
                onChange={e => handleSearchA(e.target.value)}
                onFocus={() => searchResultsA.length > 0 && setShowResultsA(true)}
                onBlur={() => setTimeout(() => setShowResultsA(false), 200)}
                className={errors.stockACode ? 'error' : ''}
              />
              {searchingA && <span className="search-spinner" />}
              {showResultsA && searchResultsA.length > 0 && (
                <div className="pair-search-results">
                  {searchResultsA.map(r => (
                    <div key={r.code} className="pair-search-item" onMouseDown={() => selectStockA(r)}>
                      <span className="item-name">{r.name}</span>
                      <span className="item-code">{r.code}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {formData.stockAPrice !== undefined && (
              <div className="pair-stock-price">
                <span>现价: <strong>{formData.stockAPrice?.toFixed(2)}</strong></span>
                <span className={formData.stockAPct && formData.stockAPct >= 0 ? 'up' : 'down'}>
                  {formData.stockAPct !== undefined ? `${formData.stockAPct >= 0 ? '+' : ''}${formData.stockAPct.toFixed(2)}%` : '--'}
                </span>
              </div>
            )}
            {errors.stockACode && <span className="error-msg">{errors.stockACode}</span>}
          </div>

          {/* VS 分隔符 */}
          <div className="pair-vs-divider">
            <div className="vs-line" />
            <div className="vs-badge">VS</div>
            <div className="vs-line" />
          </div>

          {/* 标的 B */}
          <div className="pair-stock-box">
            <label className="pair-stock-label">
              <span>对标/基准标的 (Y)</span>
              <span className="stock-code-badge secondary">{getCodePrefix(formData.stockBCode)}{getCodeNumber(formData.stockBCode)}</span>
            </label>
            <div className="pair-stock-search">
              <input
                type="text"
                placeholder="代码/指数/ETF"
                value={searchQueryB}
                onChange={e => handleSearchB(e.target.value)}
                onFocus={() => searchResultsB.length > 0 && setShowResultsB(true)}
                onBlur={() => setTimeout(() => setShowResultsB(false), 200)}
                className={errors.stockBCode ? 'error' : ''}
              />
              {searchingB && <span className="search-spinner" />}
              {showResultsB && searchResultsB.length > 0 && (
                <div className="pair-search-results">
                  {searchResultsB.map(r => (
                    <div key={r.code} className="pair-search-item" onMouseDown={() => selectStockB(r)}>
                      <span className="item-name">{r.name}</span>
                      <span className="item-code">{r.code}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {formData.stockBPrice !== undefined && (
              <div className="pair-stock-price">
                <span>现价: <strong>{formData.stockBPrice?.toFixed(2)}</strong></span>
                <span className={formData.stockBPct && formData.stockBPct >= 0 ? 'up' : 'down'}>
                  {formData.stockBPct !== undefined ? `${formData.stockBPct >= 0 ? '+' : ''}${formData.stockBPct.toFixed(2)}%` : '--'}
                </span>
              </div>
            )}
            {errors.stockBCode && <span className="error-msg">{errors.stockBCode}</span>}
          </div>
        </div>

        {/* 统计数据栏 */}
        <div className="pair-stats-bar">
          <div className="pair-stats-left">
            {calculatingStats ? (
              <span className="calculating">计算中...</span>
            ) : (
              <>
                <span>历史相关性: <strong>{formData.correlation?.toFixed(2) || '--'}</strong></span>
                <span>Beta系数: <strong>{formData.beta?.toFixed(2) || '--'}</strong></span>
              </>
            )}
          </div>
          <button type="button" className="pair-chart-link">查看价差走势图 &gt;</button>
        </div>
      </div>

      {/* 监控参数 */}
      <div className="form-row">
        <div className="form-group">
          <label>监控逻辑模式</label>
          <select 
            className="monitor-mode-select"
            value={formData.monitorMode || 'return_diff'} 
            onChange={e => updateField('monitorMode', e.target.value as PairMonitorMode)}
          >
            <option value="spread">价差偏离 (Spread Deviation)</option>
            <option value="ratio">比价偏离 (Price Ratio)</option>
            <option value="return_diff">涨跌幅差值 (Return Diff)</option>
          </select>
        </div>
        <div className="form-group">
          <label>
            偏离触发阈值
            {formData.monitorMode === 'spread' && <span className="label-hint">（价差绝对值）</span>}
            {formData.monitorMode === 'ratio' && <span className="label-hint">（比价偏离%）</span>}
            {(!formData.monitorMode || formData.monitorMode === 'return_diff') && <span className="label-hint">（涨跌幅差%）</span>}
          </label>
          <div className="input-with-unit">
            <input 
              type="number" 
              placeholder={formData.monitorMode === 'spread' ? '0.5' : '5'} 
              value={formData.threshold || ''} 
              onChange={e => updateField('threshold', parseFloat(e.target.value) || 0)} 
            />
            <span className="input-unit">{formData.monitorMode === 'spread' ? '元' : '%'}</span>
          </div>
          <span className="form-hint">
            {formData.monitorMode === 'spread' && '当 |X价格 - Y价格| 超过此值时触发信号'}
            {formData.monitorMode === 'ratio' && '当 (X/Y) 偏离历史均值超过此百分比时触发'}
            {(!formData.monitorMode || formData.monitorMode === 'return_diff') && '当 (X涨跌幅 - Y涨跌幅) 超过此值时触发信号'}
          </span>
        </div>
      </div>
    </div>
  )
}

export default StrategyModal
