/**
 * StrategyCenter - 策略监控中心
 * 支持多种策略类型：价格预警、行业套利、AH溢价、假突破/异动、分组异动
 */
import { useState, useEffect, useCallback, useMemo } from 'react'
import { motion } from 'framer-motion'
import type {
  Strategy,
  StrategyType,
  SectorArbStrategy,
  AHPremiumStrategy,
  FakeBreakoutStrategy,
  PriceAlertStrategy,
  PriceCondition,
  GroupAlertStrategy
} from '@/types/strategy'
import type { StockData, StrategyAlertHistoryItem, StockCategory } from '@/types'
import {
  loadStrategies,
  saveStrategies,
  getStrategyTypeLabel,
  getGroupAlertTypeLabel
} from '@/services/strategyService'
import { StrategyModal } from './StrategyModal'
import { GroupAlertModal } from '@/components/modals/GroupAlertModal'
import { initSampleStrategies } from './sampleStrategies'
import './StrategyCenter.css'

// Props 类型
interface StrategyCenterProps {
  stockData?: Record<string, StockData>
  categories?: StockCategory[]
  alertHistory?: StrategyAlertHistoryItem[]
  onAlertHistoryChange?: (history: StrategyAlertHistoryItem[]) => void
}

// 策略类型 Tab - 使用优化后的 SVG 图标
const STRATEGY_TABS: { id: StrategyType | 'all'; label: string; icon: JSX.Element }[] = [
  { 
    id: 'all', 
    label: '全部策略',
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="7" height="7" x="3" y="3" rx="1" /><rect width="7" height="7" x="14" y="3" rx="1" /><rect width="7" height="7" x="14" y="14" rx="1" /><rect width="7" height="7" x="3" y="14" rx="1" /></svg>
  },
  { 
    id: 'group_alert', 
    label: '分组异动',
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
  },
  { 
    id: 'sector_arb', 
    label: '配对监控',
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18" /><path d="M18 17V9" /><path d="M13 17V5" /><path d="M8 17v-3" /></svg>
  },
  { 
    id: 'ah_premium', 
    label: 'AH溢价',
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="2" x2="22" y1="12" y2="12" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /></svg>
  },
  { 
    id: 'fake_breakout', 
    label: '假突破',
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" /><path d="M12 9v4" /><path d="M12 17h.01" /></svg>
  },
  { 
    id: 'price', 
    label: '价格预警',
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></svg>
  }
]

// 图标组件
const Icons = {
  plus: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 4v16m8-8H4" />
    </svg>
  ),
  search: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="11" cy="11" r="8" />
      <path d="M21 21l-4.35-4.35" />
    </svg>
  ),
  edit: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  ),
  trash: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  ),
  pause: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="6" y="4" width="4" height="16" />
      <rect x="14" y="4" width="4" height="16" />
    </svg>
  ),
  play: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polygon points="5 3 19 12 5 21 5 3" />
    </svg>
  ),
  empty: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
      <path d="M12 12v4m0-4l-2 2m2-2l2 2" />
    </svg>
  )
}

// 筛选状态类型
type FilterStatus = 'all' | 'triggered' | 'running'

export function StrategyCenter({
  stockData = {},
  categories = [],
  alertHistory = [],
  onAlertHistoryChange
}: StrategyCenterProps) {
  const [strategies, setStrategies] = useState<Strategy[]>([])
  const [activeTab, setActiveTab] = useState<StrategyType | 'all'>('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editingStrategy, setEditingStrategy] = useState<Strategy | null>(null)
  const [highlightConditionIndex, setHighlightConditionIndex] = useState<number | null>(null)
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all')
  const [historyDrawerOpen, setHistoryDrawerOpen] = useState(false)
  // 分组异动弹窗状态
  const [groupAlertModalOpen, setGroupAlertModalOpen] = useState(false)
  const [editingGroupAlert, setEditingGroupAlert] = useState<GroupAlertStrategy | null>(null)

  // 保存预警历史记录（通过 props 回调，支持云同步）
  const saveAlertHistory = useCallback(
    (item: StrategyAlertHistoryItem) => {
      if (!onAlertHistoryChange) return

      // 添加新记录到开头，保留最近100条
      const newHistory = [item, ...alertHistory].slice(0, 100)
      onAlertHistoryChange(newHistory)
    },
    [alertHistory, onAlertHistoryChange]
  )

  // 加载策略
  useEffect(() => {
    const loadData = () => {
      const loaded = loadStrategies()
      if (loaded.length === 0) {
        const samples = initSampleStrategies()
        setStrategies(samples)
      } else {
        setStrategies(loaded)
      }
    }
    
    // 首次加载
    loadData()
    
    // 监听 storage 事件（其他标签页或组件修改时触发）
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'fintell_strategies') {
        loadData()
      }
    }
    window.addEventListener('storage', handleStorage)
    
    // 监听自定义事件（同一标签页内的修改）
    const handleStrategiesUpdated = () => {
      loadData()
    }
    window.addEventListener('strategies-updated', handleStrategiesUpdated)
    
    // 监听页面可见性变化（切换回来时刷新）
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        loadData()
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)
    
    return () => {
      window.removeEventListener('storage', handleStorage)
      window.removeEventListener('strategies-updated', handleStrategiesUpdated)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [])

  // 策略检查已移至 App 层级的 useStrategyMonitor hook
  // StrategyCenter 只负责 UI 展示，通过监听 'strategies-updated' 事件刷新数据

  // 筛选策略
  const filteredStrategies = useMemo(() => {
    let result = strategies

    // 按类型筛选
    if (activeTab !== 'all') {
      result = result.filter(s => s.type === activeTab)
    }

    // 按状态筛选
    if (filterStatus === 'triggered') {
      result = result.filter(s => s.status === 'triggered')
    } else if (filterStatus === 'running') {
      result = result.filter(s => s.status === 'running' && s.enabled)
    }

    // 按搜索词筛选
    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      result = result.filter(s => 
        s.name.toLowerCase().includes(term) ||
        getStrategyTypeLabel(s.type).toLowerCase().includes(term)
      )
    }

    return result
  }, [strategies, activeTab, searchTerm, filterStatus])

  // 统计数据
  const stats = useMemo(() => {
    const triggered = strategies.filter(s => s.status === 'triggered').length
    const running = strategies.filter(s => s.status === 'running' && s.enabled).length
    return { triggered, running, total: strategies.length }
  }, [strategies])

  // 保存策略
  const handleSaveStrategy = useCallback((strategy: Strategy) => {
    setStrategies(prev => {
      const exists = prev.find(s => s.id === strategy.id)
      const updated = exists 
        ? prev.map(s => s.id === strategy.id ? strategy : s)
        : [...prev, strategy]
      saveStrategies(updated)
      return updated
    })
    setModalOpen(false)
    setEditingStrategy(null)
  }, [])

  // 删除策略
  const handleDeleteStrategy = useCallback((id: string) => {
    if (!confirm('确定要删除这个策略吗？')) return
    setStrategies(prev => {
      const updated = prev.filter(s => s.id !== id)
      saveStrategies(updated)
      return updated
    })
  }, [])

  // 切换策略状态
  const handleToggleStrategy = useCallback((id: string) => {
    setStrategies(prev => {
      const updated = prev.map(s => {
        if (s.id !== id) return s
        return {
          ...s,
          enabled: !s.enabled,
          status: !s.enabled ? 'running' : 'paused'
        } as Strategy
      })
      saveStrategies(updated)
      return updated
    })
  }, [])

  // 编辑策略
  const handleEditStrategy = useCallback((strategy: Strategy, conditionIndex?: number) => {
    // 分组异动策略使用专门的弹窗
    if (strategy.type === 'group_alert') {
      setEditingGroupAlert(strategy as GroupAlertStrategy)
      setGroupAlertModalOpen(true)
      return
    }
    setEditingStrategy(strategy)
    setHighlightConditionIndex(conditionIndex ?? null)
    setModalOpen(true)
  }, [])

  // 保存分组异动策略
  const handleSaveGroupAlert = useCallback(
    (strategy: GroupAlertStrategy) => {
      setStrategies(prev => {
        const exists = prev.find(s => s.id === strategy.id)
        const updated = exists
          ? prev.map(s => (s.id === strategy.id ? strategy : s))
          : [...prev, strategy]
        saveStrategies(updated)
        return updated
      })
      setGroupAlertModalOpen(false)
      setEditingGroupAlert(null)
    },
    []
  )

  // 新建策略
  const handleNewStrategy = useCallback(() => {
    setEditingStrategy(null)
    setModalOpen(true)
  }, [])

  // 确认价格预警条件 - 标记为已确认并加入历史记录
  const handleConfirmCondition = useCallback(
    (strategyId: string, conditionIndex: number, condition: PriceCondition) => {
      // 找到对应的策略
    const strategy = strategies.find(s => s.id === strategyId) as PriceAlertStrategy | undefined
    if (!strategy) return

    // 更新条件状态为已确认
    const newConditions = [...(strategy.conditions || [])]
    if (newConditions[conditionIndex]) {
      newConditions[conditionIndex] = {
        ...newConditions[conditionIndex],
        confirmed: true,
        confirmedAt: Date.now()
      }
    }

    // 更新策略
    const updatedStrategy = { ...strategy, conditions: newConditions }
    setStrategies(prev => {
      const updated = prev.map(s => s.id === strategyId ? updatedStrategy : s)
      saveStrategies(updated)
      return updated
    })

    // 保存到历史记录
    const condTypeLabel = condition.type === 'price' ? '价格' : '涨跌幅'
    const condOpLabel = condition.operator === 'above' ? '突破' : '跌破'
    saveAlertHistory({
      id: `${strategyId}_cond${conditionIndex}_${Date.now()}`,
      type: 'price',
      title: `${strategy.stockName || strategy.code} ${condTypeLabel}${condOpLabel}`,
      description: `${condTypeLabel}${condOpLabel} ${condition.value}${condition.type === 'pct' ? '%' : ''}${condition.note ? ` (${condition.note})` : ''}`,
      timestamp: condition.triggeredAt || Date.now(),
      data: {
        code: strategy.code,
        stockName: strategy.stockName,
        conditionType: condition.type,
        conditionOperator: condition.operator,
        conditionValue: condition.value,
        note: condition.note
      }
    })
  }, [strategies, saveAlertHistory])

  // 删除价格预警条件
  const handleDeleteCondition = useCallback((strategyId: string, conditionIndex: number) => {
    const strategy = strategies.find(s => s.id === strategyId) as PriceAlertStrategy | undefined
    if (!strategy) return

    const newConditions = [...(strategy.conditions || [])]
    newConditions.splice(conditionIndex, 1)

    // 如果删除后没有条件了，可以选择删除整个策略或保留空策略
    // 这里选择保留策略，用户可以继续添加条件
    const updatedStrategy = { 
      ...strategy, 
      conditions: newConditions,
      // 如果所有条件都删除了，重置状态为运行中
      status: newConditions.length === 0 ? 'running' as const : strategy.status,
      updatedAt: Date.now()
    }

    setStrategies(prev => {
      const updated = prev.map(s => s.id === strategyId ? updatedStrategy : s)
      saveStrategies(updated)
      return updated
    })
  }, [strategies])

  return (
    <div className="strategy-center">
      {/* 头部 */}
      <header className="strategy-header">
        <div className="strategy-header-left">
          <h1>策略监控中心</h1>
          <div className="strategy-badges">
            {stats.triggered > 0 && (
              <span className="strategy-badge triggered">
                <span className="pulse-dot" />
                {stats.triggered}个策略触发中
              </span>
            )}
            <span className="strategy-badge running">
              运行中: {stats.running}
            </span>
          </div>
        </div>
        <button className="btn-new-strategy" onClick={handleNewStrategy}>
          {Icons.plus}
          新建策略
        </button>
      </header>

      {/* Tab 导航 - 丝滑动画版 + Tubelight 效果 */}
      <div className="strategy-tabs">
        <div className="strategy-tabs-inner">
          {STRATEGY_TABS.map(tab => {
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                className={`strategy-tab ${isActive ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                <span className="tab-icon">{tab.icon}</span>
                <span className="tab-label">{tab.label}</span>
                {isActive && (
                  <motion.div
                    layoutId="activeTab"
                    className="tab-indicator"
                    initial={false}
                    transition={{
                      type: "spring",
                      stiffness: 500,
                      damping: 35
                    }}
                  >
                    {/* Tubelight 顶部光效 */}
                    <div className="tubelight">
                      <div className="tubelight-glow" />
                      <div className="tubelight-glow-md" />
                      <div className="tubelight-glow-sm" />
                    </div>
                  </motion.div>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* 工具栏 */}
      <div className="strategy-toolbar">
        <div className="strategy-search">
          {Icons.search}
          <input
            type="text"
            placeholder="搜索策略..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="strategy-filters">
          <button 
            className={`filter-btn ${filterStatus === 'all' ? 'active' : ''}`}
            onClick={() => setFilterStatus('all')}
          >
            全部
          </button>
          <button 
            className={`filter-btn ${filterStatus === 'triggered' ? 'active' : ''}`}
            onClick={() => setFilterStatus('triggered')}
          >
            已触发
          </button>
          <button 
            className={`filter-btn ${filterStatus === 'running' ? 'active' : ''}`}
            onClick={() => setFilterStatus('running')}
          >
            运行中
          </button>
        </div>
      </div>

      {/* 策略列表 */}
      <div className="strategy-content">
        {filteredStrategies.length === 0 ? (
          <div className="strategy-empty">
            {Icons.empty}
            <h3>暂无策略</h3>
            <p>点击"新建策略"开始创建你的第一个监控策略</p>
          </div>
        ) : (
          <div className="strategy-grid">
            {/* 左列 - 偶数索引 */}
            <div className="strategy-column">
              {filteredStrategies.filter((_, i) => i % 2 === 0).map(strategy => (
                <StrategyCard
                  key={strategy.id}
                  strategy={strategy}
                  stockData={stockData}
                  onEdit={(conditionIndex) => handleEditStrategy(strategy, conditionIndex)}
                  onDelete={() => handleDeleteStrategy(strategy.id)}
                  onToggle={() => handleToggleStrategy(strategy.id)}
                  onConfirmCondition={handleConfirmCondition}
                  onDeleteCondition={handleDeleteCondition}
                />
              ))}
            </div>
            {/* 右列 - 奇数索引 */}
            <div className="strategy-column">
              {filteredStrategies.filter((_, i) => i % 2 === 1).map(strategy => (
                <StrategyCard
                  key={strategy.id}
                  strategy={strategy}
                  stockData={stockData}
                  onEdit={(conditionIndex) => handleEditStrategy(strategy, conditionIndex)}
                  onDelete={() => handleDeleteStrategy(strategy.id)}
                  onToggle={() => handleToggleStrategy(strategy.id)}
                  onConfirmCondition={handleConfirmCondition}
                  onDeleteCondition={handleDeleteCondition}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 历史记录按钮 */}
      <button className="btn-history" onClick={() => setHistoryDrawerOpen(true)}>
        <span className="dot" />
        历史预警记录
      </button>

      {/* 历史预警记录抽屉 */}
      <HistoryDrawer 
        open={historyDrawerOpen} 
        onClose={() => setHistoryDrawerOpen(false)}
        historyItems={alertHistory}
      />

      {/* 新建/编辑策略弹窗 */}
      <StrategyModal
        open={modalOpen}
        strategy={editingStrategy}
        highlightConditionIndex={highlightConditionIndex}
        onClose={() => {
          setModalOpen(false)
          setEditingStrategy(null)
          setHighlightConditionIndex(null)
        }}
        onSave={handleSaveStrategy}
      />

      {/* 分组异动策略编辑弹窗 */}
      <GroupAlertModal
        open={groupAlertModalOpen}
        category={
          editingGroupAlert
            ? categories.find(c => c.id === editingGroupAlert.categoryId) || {
                id: editingGroupAlert.categoryId,
                name: editingGroupAlert.categoryName,
                codes: []
              }
            : null
        }
        existingStrategy={editingGroupAlert}
        onClose={() => {
          setGroupAlertModalOpen(false)
          setEditingGroupAlert(null)
        }}
        onSave={handleSaveGroupAlert}
      />
    </div>
  )
}

// 策略卡片组件
interface StrategyCardProps {
  strategy: Strategy
  stockData?: Record<string, StockData>
  onEdit: (conditionIndex?: number) => void
  onDelete: () => void
  onToggle: () => void
  onConfirmCondition?: (strategyId: string, conditionIndex: number, condition: PriceCondition) => void
  onDeleteCondition?: (strategyId: string, conditionIndex: number) => void
}

// 获取策略标签文字
function getStrategyTagLabel(type: Strategy['type']): string {
  switch (type) {
    case 'price': return '价格监控'
    case 'sector_arb': return '配对监控'
    case 'ah_premium': return 'AH溢价'
    case 'fake_breakout': return '假突破预警'
    case 'group_alert': return '分组异动'
  }
}

// 获取策略显示名称（不含类型前缀）
function getStrategyDisplayName(strategy: Strategy): string {
  switch (strategy.type) {
    case 'price': {
      const ps = strategy as PriceAlertStrategy
      return ps.stockName || ps.code || '未知'
    }
    case 'sector_arb': {
      // 使用用户自定义的名称，或者生成默认名称
      if (strategy.name && !strategy.name.startsWith('配对监控')) {
        return strategy.name
      }
      const ss = strategy as SectorArbStrategy
      const stockAName = ss.stockAName || ss.stockACode
      const stockBName = ss.stockBName || ss.stockBCode
      return `${stockAName} / ${stockBName}`
    }
    case 'ah_premium': {
      if (strategy.name && !strategy.name.startsWith('AH溢价')) {
        return strategy.name
      }
      const as = strategy as AHPremiumStrategy
      return as.aName || as.aCode
    }
    case 'fake_breakout': {
      if (strategy.name && !strategy.name.startsWith('假突破')) {
        return strategy.name
      }
      const fs = strategy as FakeBreakoutStrategy
      return `${fs.sectorName || fs.sectorCode} · 诱多监控`
    }
    case 'group_alert': {
      const gs = strategy as GroupAlertStrategy
      return gs.categoryName || '未知分组'
    }
  }
}

function StrategyCard({ strategy, stockData = {}, onEdit, onDelete, onToggle, onConfirmCondition, onDeleteCondition }: StrategyCardProps) {
  const isTriggered = strategy.status === 'triggered'
  const isPriceAlert = strategy.type === 'price'

  // 价格预警特殊处理：从实时数据获取价格
  const priceStrategy = isPriceAlert ? strategy as PriceAlertStrategy : null
  const stock = priceStrategy ? stockData[priceStrategy.code] : null
  const currentPrice = stock?.price || 0
  const preClose = stock?.preClose || 0
  const pctChange = preClose ? ((currentPrice - preClose) / preClose * 100) : 0
  const isUp = pctChange >= 0
  
  // 策略标签和名称
  const tagLabel = getStrategyTagLabel(strategy.type)
  const displayName = getStrategyDisplayName(strategy)
  
  // 获取策略类型对应的 CSS class
  const typeClass = `type-${strategy.type.replace('_', '-')}`
  
  // 格式化触发时间
  const formatTriggerTime = (timestamp?: number) => {
    if (!timestamp) return ''
    const date = new Date(timestamp)
    return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  }

  return (
    <div className={`strategy-card ${isTriggered ? 'triggered' : ''} ${isPriceAlert ? 'price-alert-card' : ''}`}>
      <div className="strategy-card-body">
        {/* 头部 - 价格预警使用特殊布局 */}
        {isPriceAlert ? (
          <div className="price-alert-header">
            <div className="header-left">
              <div className="title-row">
                <span className={`strategy-type-tag ${typeClass}`}>{tagLabel}</span>
                <h3 className="strategy-card-name">{displayName}</h3>
              </div>
              <p className="strategy-card-desc">{priceStrategy?.code?.toUpperCase()}</p>
            </div>
            <div className="header-right">
              <div className="price-box">
                <span className={`current-price ${isUp ? 'up' : 'down'}`}>
                  {currentPrice ? currentPrice.toFixed(3) : '--'}
                </span>
                <span className={`price-change ${isUp ? 'up' : 'down'}`}>
                  {currentPrice ? `${isUp ? '+' : ''}${pctChange.toFixed(2)}%` : '--'}
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div className="strategy-card-header">
            <div className="strategy-card-title">
              <div className="title-row">
                <span className={`strategy-type-tag ${typeClass}`}>{tagLabel}</span>
                <h3 className="strategy-card-name">{displayName}</h3>
              </div>
              {strategy.type === 'sector_arb' ? (
                <p className="strategy-card-desc">
                  模式：{(strategy as SectorArbStrategy).monitorMode === 'spread' ? '价差偏离' : 
                        (strategy as SectorArbStrategy).monitorMode === 'ratio' ? '比价偏离' : '涨跌幅差值'}
                </p>
              ) : strategy.type === 'ah_premium' ? (
                <p className="strategy-card-desc">
                  比较对象：{(strategy as AHPremiumStrategy).aCode} / {(strategy as AHPremiumStrategy).hCode}
                </p>
              ) : null}
            </div>
            {/* 右侧状态区域 */}
            <div className="strategy-card-status">
              {isTriggered ? (
                <>
                  <span className="status-triggered">
                    <span className="pulse-dot" />
                    已触发
                  </span>
                  {strategy.triggeredAt && (
                    <span className="trigger-time">{formatTriggerTime(strategy.triggeredAt)}</span>
                  )}
                </>
              ) : (
                <span className={`status-running ${!strategy.enabled ? 'paused' : ''}`}>
                  <span className="status-dot" />
                  {strategy.enabled ? '监控中' : '已暂停'}
                </span>
              )}
            </div>
          </div>
        )}

        {/* 内容区域 */}
        <div className="strategy-card-content">
          {strategy.type === 'sector_arb' && (
            <SectorArbContent strategy={strategy as SectorArbStrategy} />
          )}
          {strategy.type === 'ah_premium' && (
            <AHPremiumContent strategy={strategy as AHPremiumStrategy} />
          )}
          {strategy.type === 'fake_breakout' && (
            <FakeBreakoutContent strategy={strategy as FakeBreakoutStrategy} />
          )}
          {strategy.type === 'group_alert' && (
            <GroupAlertContent strategy={strategy as GroupAlertStrategy} />
          )}
          {strategy.type === 'price' && (
            <PriceAlertContent 
              strategy={strategy as PriceAlertStrategy} 
              stockData={stockData}
              onEdit={onEdit}
              onDelete={onDelete}
              onToggle={onToggle}
              onConfirmCondition={onConfirmCondition ? (idx, cond) => onConfirmCondition(strategy.id, idx, cond) : undefined}
              onDeleteCondition={onDeleteCondition ? (idx) => onDeleteCondition(strategy.id, idx) : undefined}
            />
          )}
        </div>

        {/* 底部 - 价格预警不显示 */}
        {!isPriceAlert && (
          <div className="strategy-card-footer">
            <span className="strategy-logic">
              {strategy.note || getStrategyLogic(strategy)}
            </span>
            <div className="strategy-actions">
              <button className="strategy-action-btn" onClick={onToggle} title={strategy.enabled ? '暂停' : '启动'}>
                {strategy.enabled ? Icons.pause : Icons.play}
              </button>
              <button className="strategy-action-btn" onClick={() => onEdit()} title="编辑">
                {Icons.edit}
              </button>
              <button className="strategy-action-btn" onClick={onDelete} title="删除">
                {Icons.trash}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// 配对监控内容（原行业套利）
function SectorArbContent({ strategy }: { strategy: SectorArbStrategy }) {
  const stockAPct = strategy.stockAPct ?? 0
  const stockBPct = strategy.stockBPct ?? 0
  const sectorPct = strategy.sectorPct ?? 0
  const deviation = strategy.deviation ?? 0
  const deviationPct = Math.min(Math.abs(deviation) / strategy.threshold * 100, 100)
  
  // 计算相对板块的溢价/折价
  const stockAVsSector = strategy.sectorCode ? (stockAPct - sectorPct) : null
  const stockBVsSector = strategy.sectorCode ? (stockBPct - sectorPct) : null

  return (
    <div className="arb-comparison">
      <div className="arb-stock">
        <div className="arb-stock-name">{strategy.stockAName || strategy.stockACode}</div>
        <div className="arb-stock-pct-value" data-trend={stockAPct >= 0 ? 'up' : 'down'}>
          {stockAPct >= 0 ? '+' : ''}{stockAPct.toFixed(2)}%
        </div>
        {stockAVsSector !== null && (
          <div className={`arb-vs-sector ${stockAVsSector >= 0 ? 'premium' : 'discount'}`}>
            {stockAVsSector >= 0 ? '溢价' : '折价'} {Math.abs(stockAVsSector).toFixed(1)}%
          </div>
        )}
      </div>

      <div className="arb-divider">
        <div className="arb-deviation-label">
          <span>偏离度</span>
          <span className="arb-deviation-value">
            {Math.abs(deviation).toFixed(1)}% (阈值{strategy.threshold}%)
          </span>
        </div>
        <div className="arb-progress">
          <div 
            className="arb-progress-bar" 
            style={{ width: `${deviationPct}%` }}
          />
        </div>
        {strategy.sectorCode && strategy.sectorName && (
          <div className="arb-sector-ref">
            <span className="sector-name">{strategy.sectorName}</span>
            <span className="sector-pct" data-trend={sectorPct >= 0 ? 'up' : 'down'}>
              {sectorPct >= 0 ? '+' : ''}{sectorPct.toFixed(2)}%
            </span>
          </div>
        )}
      </div>

      <div className="arb-stock">
        <div className="arb-stock-name">{strategy.stockBName || strategy.stockBCode}</div>
        <div className="arb-stock-pct-value" data-trend={stockBPct >= 0 ? 'up' : 'down'}>
          {stockBPct >= 0 ? '+' : ''}{stockBPct.toFixed(2)}%
        </div>
        {stockBVsSector !== null && (
          <div className={`arb-vs-sector ${stockBVsSector >= 0 ? 'premium' : 'discount'}`}>
            {stockBVsSector >= 0 ? '溢价' : '折价'} {Math.abs(stockBVsSector).toFixed(1)}%
          </div>
        )}
      </div>
    </div>
  )
}

// AH溢价内容
function AHPremiumContent({ strategy }: { strategy: AHPremiumStrategy }) {
  const premium = strategy.premium ?? 0
  const avgPremium = strategy.avgPremium ?? 30
  const premiumPct = Math.min(premium / 50 * 100, 100) // 假设最大50%
  const avgMarkerPos = avgPremium / 50 * 100

  return (
    <div className="ah-premium-box">
      <div className="ah-premium-label">当前溢价率 (Premium)</div>
      <div className="ah-premium-value">
        <span className="value">{premium >= 0 ? '+' : ''}{premium.toFixed(1)}%</span>
        <span className="avg">/ 历史均值 {avgPremium}%</span>
      </div>
      <div className="ah-premium-bar">
        <div className="fill" style={{ width: `${premiumPct}%` }} />
        <div className="marker" style={{ left: `${avgMarkerPos}%` }} title="均值" />
      </div>
      <div className="ah-thresholds">
        <div className="ah-threshold-item">
          <span className="dot" />
          <span>溢价率 &lt; {strategy.lowThreshold}% (做多A股)</span>
        </div>
        <div className="ah-threshold-item">
          <span className="dot" />
          <span>溢价率 &gt; {strategy.highThreshold}% (做空A股)</span>
        </div>
      </div>
    </div>
  )
}

// 假突破内容
function FakeBreakoutContent({ strategy }: { strategy: FakeBreakoutStrategy }) {
  const suspects = strategy.suspects || []

  return (
    <>
      <div className="fake-breakout-desc">
        监控逻辑：个股高开 &gt; {strategy.openThreshold}% 且 竞价量比 &lt; {strategy.volumeRatioThreshold}，同时板块指数低开或走弱。
      </div>
      {suspects.length > 0 && (
        <div className="fake-breakout-suspects">
          <div className="suspects-title">今日疑似诱多标的</div>
          {suspects.map(suspect => (
            <div key={suspect.code} className="suspect-item">
              <div className="suspect-info">
                <span className="suspect-name">{suspect.name}</span>
                <span className="suspect-code">{suspect.code}</span>
              </div>
              <div className="suspect-data">
                <span className="up">开 +{suspect.openPct.toFixed(1)}%</span>
                <span className="down">板块 {suspect.sectorPct.toFixed(1)}%</span>
                <span className="warn">⚠️背离</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  )
}

// 分组异动内容 - 优化UI与其他策略卡片一致
function GroupAlertContent({ strategy }: { strategy: GroupAlertStrategy }) {
  const triggeredStocks = strategy.triggeredStocks || []
  
  // 构建异动类型标签
  const alertTypeTags: { type: string; label: string; color: string }[] = []
  if (strategy.alertTypes.includes('limit_up')) {
    alertTypeTags.push({ type: 'limit_up', label: '涨停', color: 'red' })
  }
  if (strategy.alertTypes.includes('limit_open')) {
    alertTypeTags.push({ type: 'limit_open', label: '开板', color: 'orange' })
  }
  if (strategy.alertTypes.includes('volume_surge')) {
    alertTypeTags.push({ type: 'volume_surge', label: `量能>${strategy.volumeSurgeMultiplier}倍`, color: 'blue' })
  }
  if (strategy.alertTypes.includes('rapid_rise')) {
    alertTypeTags.push({ type: 'rapid_rise', label: `拉升>${strategy.rapidRiseThreshold}%`, color: 'red' })
  }
  if (strategy.alertTypes.includes('rapid_fall')) {
    alertTypeTags.push({ type: 'rapid_fall', label: `下跌>${strategy.rapidFallThreshold}%`, color: 'green' })
  }

  return (
    <div className="group-alert-content">
      {/* 监控配置 */}
      <div className="group-alert-tags">
        {alertTypeTags.map(tag => (
          <span key={tag.type} className={`ga-tag ga-tag-${tag.color}`}>
            {tag.label}
          </span>
        ))}
      </div>
      
      {/* 触发的股票列表 */}
      {triggeredStocks.length > 0 && (
        <div className="group-alert-triggered">
          <div className="triggered-title">
            <span className="pulse-dot" />
            触发异动 ({triggeredStocks.length})
          </div>
          <div className="triggered-list">
            {triggeredStocks.slice(0, 5).map((stock, idx) => (
              <div key={`${stock.code}-${idx}`} className="triggered-item">
                <div className="triggered-left">
                  <span className="triggered-name">{stock.name}</span>
                  <span className="triggered-code">{stock.code.toUpperCase()}</span>
                </div>
                <div className="triggered-right">
                  <span className={`triggered-type-tag type-${stock.alertType}`}>
                    {getGroupAlertTypeLabel(stock.alertType)}
                  </span>
                  <span className={`triggered-value ${stock.alertType === 'rapid_fall' ? 'down' : 'up'}`}>
                    {stock.alertType === 'volume_surge' 
                      ? `${stock.value}倍` 
                      : stock.alertType === 'limit_up' || stock.alertType === 'limit_open'
                        ? `¥${stock.price.toFixed(2)}`
                        : `${stock.value >= 0 ? '+' : ''}${stock.value}%`}
                  </span>
                </div>
              </div>
            ))}
          </div>
          {triggeredStocks.length > 5 && (
            <div className="triggered-more">还有 {triggeredStocks.length - 5} 只股票触发...</div>
          )}
        </div>
      )}
      
      {/* 无触发时显示监控状态 */}
      {triggeredStocks.length === 0 && (
        <div className="group-alert-idle">
          <span className="idle-icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          </span>
          <span>实时监控中，等待异动触发...</span>
        </div>
      )}
    </div>
  )
}

// 价格预警内容 - 只显示条件列表，头部信息在卡片头部显示
interface PriceAlertContentProps {
  strategy: PriceAlertStrategy
  stockData?: Record<string, StockData>
  onEdit?: (conditionIndex?: number) => void
  onDelete?: () => void
  onToggle?: () => void
  onConfirmCondition?: (conditionIndex: number, condition: PriceCondition) => void
  onDeleteCondition?: (conditionIndex: number) => void
}

function PriceAlertContent({ strategy, onEdit, onDelete, onToggle, onConfirmCondition, onDeleteCondition }: PriceAlertContentProps) {
  const [expanded, setExpanded] = useState(false)
  const conditions = strategy.conditions || []

  // 最多显示3个，超过则折叠
  const MAX_VISIBLE = 3
  const hasMore = conditions.length > MAX_VISIBLE

  // 涨跌图标组件
  const TrendIcon = ({ isUp }: { isUp: boolean }) => (
    <span className={`trend-icon ${isUp ? 'up' : 'down'}`}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        {isUp ? (
          // 上涨图标 - 折线向上
          <polyline points="4 16 8 12 12 14 20 6" />
        ) : (
          // 下跌图标 - 折线向下
          <polyline points="4 8 8 12 12 10 20 18" />
        )}
        {isUp ? (
          <polyline points="16 6 20 6 20 10" />
        ) : (
          <polyline points="16 18 20 18 20 14" />
        )}
      </svg>
    </span>
  )

  // 操作处理 - 编辑单个条件
  const handleEditCondition = (idx: number, e: React.MouseEvent) => {
    e.stopPropagation()
    // 调用父组件的编辑方法，打开策略编辑弹窗，并传递条件索引
    if (onEdit) {
      onEdit(idx)
    }
  }

  const handleDeleteCondition = (idx: number, e: React.MouseEvent) => {
    e.stopPropagation()
    if (confirm('确定删除这个预警条件吗？')) {
      if (onDeleteCondition) {
        onDeleteCondition(idx)
      }
    }
  }

  const handleConfirm = (idx: number, e: React.MouseEvent) => {
    e.stopPropagation()
    const cond = conditions[idx]
    if (cond && onConfirmCondition) {
      onConfirmCondition(idx, cond)
    }
  }

  return (
    <div className="price-alert-list">
      {/* 预警条件列表 - 始终渲染所有条件，用 CSS 控制显示 */}
      {conditions.map((cond, idx) => {
        // 判断是上涨还是下跌条件
        const isUpCondition = cond.operator === 'above'
        const isHidden = !expanded && idx >= MAX_VISIBLE
        const isConfirmed = cond.confirmed
        
        return (
          <div 
            key={idx} 
            className={`alert-item ${cond.triggered ? 'triggered' : ''} ${isConfirmed ? 'confirmed' : ''} ${isHidden ? 'collapsed' : ''}`}
          >
            <div className="condition-info">
              <TrendIcon isUp={isUpCondition} />
              <span className="condition-title">
                {cond.type === 'price' ? '价格' : '涨跌幅'}
                {cond.operator === 'above' ? '突破' : '跌破'}{' '}
                <span className={`condition-val ${isUpCondition ? 'up' : 'down'}`}>{cond.value}{cond.type === 'pct' ? '%' : ''}</span>
              </span>
              {/* 备注 - 同一行显示，hover时淡入，不省略 */}
              {cond.note && <span className="remark-inline">{cond.note}</span>}
              {/* 已确认标记 */}
              {isConfirmed && <span className="confirmed-badge">✓ 已确认</span>}
            </div>
            <div className="item-actions">
              <button className="action-btn" onClick={(e) => handleEditCondition(idx, e)} title="编辑">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
              </button>
              <button className="action-btn" onClick={(e) => handleDeleteCondition(idx, e)} title="删除">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                </svg>
              </button>
              {/* 只在触发但未确认时显示确认按钮 */}
              {cond.triggered && !isConfirmed && (
                <button className="action-btn confirm" onClick={(e) => handleConfirm(idx, e)} title="确认并加入历史记录">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </button>
              )}
            </div>
          </div>
        )
      })}
      
      {conditions.length === 0 && (
        <div className="alert-item empty">
          <span>暂无预警条件</span>
        </div>
      )}

      {/* 展开/收起按钮 */}
      {hasMore && (
        <button 
          className="expand-btn"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? '收起' : `查看全部 ${conditions.length} 个`}
          <svg 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="2"
            style={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)' }}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
      )}

      {/* 底部操作栏 - 与其他策略卡片一致 */}
      <div className="price-alert-footer">
        <div className="strategy-actions">
          <button className="strategy-action-btn" onClick={onToggle} title={strategy.enabled ? '暂停' : '启动'}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              {strategy.enabled ? (
                <>
                  <rect x="6" y="4" width="4" height="16" />
                  <rect x="14" y="4" width="4" height="16" />
                </>
              ) : (
                <polygon points="5 3 19 12 5 21 5 3" />
              )}
            </svg>
          </button>
          <button className="strategy-action-btn" onClick={() => onEdit && onEdit()} title="编辑">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
          </button>
          <button className="strategy-action-btn" onClick={onDelete} title="删除">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}

// 获取策略逻辑描述
function getStrategyLogic(strategy: Strategy): string {
  switch (strategy.type) {
    case 'sector_arb':
      return `策略逻辑: 多头超额收益 > ${(strategy as SectorArbStrategy).threshold}% 且 空头跑输行业`
    case 'ah_premium':
      return `策略逻辑: 溢价率超出 ${(strategy as AHPremiumStrategy).lowThreshold}%-${(strategy as AHPremiumStrategy).highThreshold}% 区间`
    case 'fake_breakout':
      return `策略逻辑: 高开 > ${(strategy as FakeBreakoutStrategy).openThreshold}% 且板块走弱`
    case 'price':
      return `日线 MACD 金叉`
    default:
      return ''
  }
}

// 历史预警记录抽屉组件
interface HistoryDrawerProps {
  open: boolean
  onClose: () => void
  historyItems: StrategyAlertHistoryItem[]
}

// 历史记录筛选类型
type HistoryFilterType = 'all' | 'sector_arb' | 'price' | 'ah_premium'

function HistoryDrawer({ open, onClose, historyItems }: HistoryDrawerProps) {
  const [filterType, setFilterType] = useState<HistoryFilterType>('all')

  // 筛选历史记录
  const filteredHistory = useMemo(() => {
    if (filterType === 'all') return historyItems
    return historyItems.filter(item => item.type === filterType)
  }, [historyItems, filterType])

  // 按日期分组
  const groupedHistory = useMemo(() => {
    const groups: Record<string, StrategyAlertHistoryItem[]> = {}
    filteredHistory.forEach(item => {
      const date = new Date(item.timestamp)
      const today = new Date()
      const yesterday = new Date(today)
      yesterday.setDate(yesterday.getDate() - 1)
      
      let dateKey: string
      if (date.toDateString() === today.toDateString()) {
        dateKey = `Today, ${date.toLocaleDateString('en-US', { day: 'numeric', month: 'short' })}`
      } else if (date.toDateString() === yesterday.toDateString()) {
        dateKey = `Yesterday, ${date.toLocaleDateString('en-US', { day: 'numeric', month: 'short' })}`
      } else {
        dateKey = date.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' })
      }
      
      if (!groups[dateKey]) groups[dateKey] = []
      groups[dateKey].push(item)
    })
    return groups
  }, [filteredHistory])

  // 获取类型标签
  const getTypeLabel = (type: StrategyAlertHistoryItem['type']) => {
    switch (type) {
      case 'sector_arb': return { text: '配对 · 卖出信号', color: 'red' }
      case 'price': return { text: '价格 · 跌破支撑', color: 'emerald' }
      case 'ah_premium': return { text: 'AH溢价 · 机会', color: 'blue' }
      case 'fake_breakout': return { text: '假突破 · 预警', color: 'orange' }
      default: return { text: '系统', color: 'slate' }
    }
  }

  // 格式化时间
  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString('zh-CN', { 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit' 
    })
  }

  if (!open) return null

  return (
    <>
      {/* 遮罩层 */}
      <div className="history-drawer-overlay" onClick={onClose} />
      
      {/* 抽屉 */}
      <div className="history-drawer">
        {/* 头部 */}
        <div className="history-drawer-header">
          <div>
            <h2>历史预警记录</h2>
            <p>Alert History & Signal Snapshots</p>
          </div>
          <button className="close-btn" onClick={onClose}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* 筛选标签 */}
        <div className="history-drawer-filters">
          <button 
            className={`filter-tag ${filterType === 'all' ? 'active' : ''}`}
            onClick={() => setFilterType('all')}
          >
            全部记录
          </button>
          <button 
            className={`filter-tag ${filterType === 'sector_arb' ? 'active' : ''}`}
            onClick={() => setFilterType('sector_arb')}
          >
            配对套利
          </button>
          <button 
            className={`filter-tag ${filterType === 'price' ? 'active' : ''}`}
            onClick={() => setFilterType('price')}
          >
            价格预警
          </button>
          <button 
            className={`filter-tag ${filterType === 'ah_premium' ? 'active' : ''}`}
            onClick={() => setFilterType('ah_premium')}
          >
            AH溢价
          </button>
        </div>

        {/* 内容区域 */}
        <div className="history-drawer-content">
          {Object.entries(groupedHistory).map(([dateKey, items]) => (
            <div key={dateKey} className="history-group">
              <div className="history-date-header">
                <span>{dateKey}</span>
              </div>
              <div className="history-timeline">
                {items.map(item => {
                  const typeInfo = getTypeLabel(item.type)
                  return (
                    <div key={item.id} className="history-item">
                      <div className={`timeline-dot ${typeInfo.color}`} />
                      <div className="history-card">
                        <div className="history-card-header">
                          <span className={`type-tag ${typeInfo.color}`}>{typeInfo.text}</span>
                          <span className="time">{formatTime(item.timestamp)}</span>
                        </div>
                        <h4>{item.title}</h4>
                        <p>{item.description}</p>
                        {item.data && (
                          <div className="history-card-data">
                            {item.type === 'sector_arb' && item.data.spread != null && (
                              <>
                                <div>
                                  <div className="data-label">Spread (价差)</div>
                                  <div className="data-value red">
                                    {(item.data.spread as number).toFixed(1)}% 
                                    <span className="threshold">/ 阈值 {item.data.threshold as number}%</span>
                                  </div>
                                </div>
                                {item.data.zScore != null && (
                                  <div>
                                    <div className="data-label">Z-Score</div>
                                    <div className="data-value">{(item.data.zScore as number).toFixed(2)} σ</div>
                                  </div>
                                )}
                              </>
                            )}
                            {item.type === 'price' && item.data.price != null && (
                              <div className="price-data">
                                <span className="label">触发价:</span>
                                <span className="value emerald">{(item.data.price as number).toFixed(2)}</span>
                              </div>
                            )}
                            {item.type === 'ah_premium' && item.data.premium != null && (
                              <div className="premium-data">
                                <div className="premium-row">
                                  <span className="label">溢价率 (Premium)</span>
                                  <span className="value blue">{(item.data.premium as number).toFixed(1)}%</span>
                                </div>
                                <div className="premium-bar">
                                  <div className="fill" style={{ width: `${Math.min((item.data.premium as number) / 50 * 100, 100)}%` }} />
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
          
          {filteredHistory.length === 0 && (
            <div className="history-empty">
              <p>暂无历史记录</p>
            </div>
          )}
        </div>

        {/* 底部 */}
        <div className="history-drawer-footer">
          <button className="view-all-btn">
            查看所有历史归档
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </button>
        </div>
      </div>
    </>
  )
}

export default StrategyCenter
