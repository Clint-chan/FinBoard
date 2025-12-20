/**
 * StrategyCenter - 策略监控中心
 * 支持多种策略类型：价格预警、行业套利、AH溢价、假突破/异动
 */
import { useState, useEffect, useCallback, useMemo } from 'react'
import type { 
  Strategy, 
  StrategyType,
  SectorArbStrategy,
  AHPremiumStrategy,
  FakeBreakoutStrategy,
  PriceAlertStrategy
} from '@/types/strategy'
import type { StockData } from '@/types'
import {
  loadStrategies,
  saveStrategies,
  checkAllStrategies,
  getStrategyTypeLabel
} from '@/services/strategyService'
import { StrategyModal } from './StrategyModal'
import { initSampleStrategies } from './sampleStrategies'
import './StrategyCenter.css'

// Props 类型
interface StrategyCenterProps {
  stockData?: Record<string, StockData>
}

// 策略类型 Tab
const STRATEGY_TABS: { id: StrategyType | 'all'; label: string }[] = [
  { id: 'all', label: '全部策略' },
  { id: 'sector_arb', label: '行业套利' },
  { id: 'ah_premium', label: 'AH溢价' },
  { id: 'fake_breakout', label: '假突破/异动' },
  { id: 'price', label: '价格预警' }
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
  more: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="1" />
      <circle cx="12" cy="5" r="1" />
      <circle cx="12" cy="19" r="1" />
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
  history: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  ),
  empty: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
      <path d="M12 12v4m0-4l-2 2m2-2l2 2" />
    </svg>
  )
}

export function StrategyCenter({ stockData = {} }: StrategyCenterProps) {
  const [strategies, setStrategies] = useState<Strategy[]>([])
  const [activeTab, setActiveTab] = useState<StrategyType | 'all'>('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editingStrategy, setEditingStrategy] = useState<Strategy | null>(null)
  const [highlightConditionIndex, setHighlightConditionIndex] = useState<number | null>(null)
  const [_loading, setLoading] = useState(false)

  // 加载策略
  useEffect(() => {
    // 首次加载时初始化示例数据
    const loaded = loadStrategies()
    if (loaded.length === 0) {
      const samples = initSampleStrategies()
      setStrategies(samples)
    } else {
      setStrategies(loaded)
    }
  }, [])

  // 定时检查策略（每30秒）
  useEffect(() => {
    if (strategies.length === 0) return

    const check = async () => {
      setLoading(true)
      try {
        const updated = await checkAllStrategies(strategies)
        setStrategies(updated)
        saveStrategies(updated)
      } catch (err) {
        console.error('检查策略失败:', err)
      } finally {
        setLoading(false)
      }
    }

    // 首次加载时检查
    check()

    const interval = setInterval(check, 30000)
    return () => clearInterval(interval)
  }, [strategies.length])

  // 筛选策略
  const filteredStrategies = useMemo(() => {
    let result = strategies

    // 按类型筛选
    if (activeTab !== 'all') {
      result = result.filter(s => s.type === activeTab)
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
  }, [strategies, activeTab, searchTerm])

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
    setEditingStrategy(strategy)
    setHighlightConditionIndex(conditionIndex ?? null)
    setModalOpen(true)
  }, [])

  // 新建策略
  const handleNewStrategy = useCallback(() => {
    setEditingStrategy(null)
    setModalOpen(true)
  }, [])

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

      {/* Tab 导航 */}
      <div className="strategy-tabs">
        {STRATEGY_TABS.map(tab => (
          <button
            key={tab.id}
            className={`strategy-tab ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
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
          <button className="filter-btn active">全部</button>
          <button className="filter-btn">已触发</button>
          <button className="filter-btn">运行中</button>
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
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 历史记录按钮 */}
      <button className="btn-history">
        <span className="dot" />
        历史预警记录
      </button>

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
}

// 获取策略标签文字
function getStrategyTagLabel(type: Strategy['type']): string {
  switch (type) {
    case 'price': return '价格监控'
    case 'sector_arb': return '行业套利'
    case 'ah_premium': return 'AH溢价'
    case 'fake_breakout': return '假突破预警'
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
      if (strategy.name && !strategy.name.startsWith('行业套利')) {
        return strategy.name
      }
      const ss = strategy as SectorArbStrategy
      const longName = ss.longName || ss.longCode
      const shortName = ss.shortName || ss.shortCode
      return `${longName} / ${shortName}`
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
  }
}

function StrategyCard({ strategy, stockData = {}, onEdit, onDelete, onToggle }: StrategyCardProps) {
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
                <span className={`status-badge ${isTriggered ? 'triggered' : strategy.enabled ? '' : 'paused'}`}>
                  <span className="status-dot" />
                  {isTriggered ? '已触发' : strategy.enabled ? '监控中' : '已暂停'}
                </span>
              </div>
              <p className="strategy-card-desc">{priceStrategy?.code?.toUpperCase()}</p>
            </div>
            <div className="price-box">
              <span className={`current-price ${isUp ? 'up' : 'down'}`}>
                {currentPrice ? currentPrice.toFixed(3) : '--'}
              </span>
              <span className={`price-change ${isUp ? 'up' : 'down'}`}>
                {currentPrice ? `${isUp ? '+' : ''}${pctChange.toFixed(2)}%` : '--'}
              </span>
            </div>
          </div>
        ) : (
          <div className="strategy-card-header">
            <div className="strategy-card-title">
              <div className="title-row">
                <span className={`strategy-type-tag ${typeClass}`}>{tagLabel}</span>
                <h3 className="strategy-card-name">{displayName}</h3>
                <span className={`status-badge ${isTriggered ? 'triggered' : strategy.enabled ? '' : 'paused'}`}>
                  <span className="status-dot" />
                  {isTriggered ? '已触发' : strategy.enabled ? '监控中' : '已暂停'}
                </span>
              </div>
              {strategy.type === 'sector_arb' ? (
                <p className="strategy-card-desc">
                  基准：{(strategy as SectorArbStrategy).benchmarkName || (strategy as SectorArbStrategy).benchmarkCode}
                </p>
              ) : strategy.type === 'ah_premium' ? (
                <p className="strategy-card-desc">
                  比较对象：{(strategy as AHPremiumStrategy).aCode} / {(strategy as AHPremiumStrategy).hCode}
                </p>
              ) : null}
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
          {strategy.type === 'price' && (
            <PriceAlertContent 
              strategy={strategy as PriceAlertStrategy} 
              stockData={stockData}
              onEdit={onEdit}
              onDelete={onDelete}
              onToggle={onToggle}
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

// 行业套利内容
function SectorArbContent({ strategy }: { strategy: SectorArbStrategy }) {
  const longPct = strategy.longPct ?? 0
  const shortPct = strategy.shortPct ?? 0
  const benchmarkPct = strategy.benchmarkPct ?? 0
  const deviation = strategy.deviation ?? 0
  const deviationPct = Math.min(Math.abs(deviation) / strategy.threshold * 100, 100)

  const longExcess = longPct - benchmarkPct
  const shortExcess = shortPct - benchmarkPct

  return (
    <div className="arb-comparison">
      <div className="arb-stock">
        <div className="arb-stock-name">{strategy.longName || strategy.longCode}</div>
        <div className={`arb-stock-pct ${longPct >= 0 ? 'up' : 'down'}`}>
          {longPct >= 0 ? '+' : ''}{longPct.toFixed(2)}%
        </div>
        <span className="arb-stock-tag">
          {longExcess >= 0 ? '超' : '弱'}指数 {Math.abs(longExcess).toFixed(1)}%
        </span>
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
        <span className="arb-vs">VS</span>
      </div>

      <div className="arb-stock">
        <div className="arb-stock-name">{strategy.shortName || strategy.shortCode}</div>
        <div className={`arb-stock-pct ${shortPct >= 0 ? 'up' : 'down'}`}>
          {shortPct >= 0 ? '+' : ''}{shortPct.toFixed(2)}%
        </div>
        <span className="arb-stock-tag">
          {shortExcess >= 0 ? '超' : '弱'}指数 {Math.abs(shortExcess).toFixed(1)}%
        </span>
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

// 价格预警内容 - 只显示条件列表，头部信息在卡片头部显示
interface PriceAlertContentProps {
  strategy: PriceAlertStrategy
  stockData?: Record<string, StockData>
  onEdit?: (conditionIndex?: number) => void
  onDelete?: () => void
  onToggle?: () => void
}

function PriceAlertContent({ strategy, onEdit, onDelete, onToggle }: PriceAlertContentProps) {
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
      console.log('删除条件', idx)
      // TODO: 删除条件
    }
  }

  const handleConfirm = (idx: number, e: React.MouseEvent) => {
    e.stopPropagation()
    console.log('确认条件', idx)
    // TODO: 标记为已确认，加入历史记录
  }

  return (
    <div className="price-alert-list">
      {/* 预警条件列表 - 始终渲染所有条件，用 CSS 控制显示 */}
      {conditions.map((cond, idx) => {
        // 判断是上涨还是下跌条件
        const isUpCondition = cond.operator === 'above'
        const isHidden = !expanded && idx >= MAX_VISIBLE
        
        return (
          <div 
            key={idx} 
            className={`alert-item ${cond.triggered ? 'triggered' : ''} ${isHidden ? 'collapsed' : ''}`}
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
              {cond.triggered && (
                <button className="action-btn confirm" onClick={(e) => handleConfirm(idx, e)} title="确认">
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

export default StrategyCenter
