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
  PriceAlertStrategy,
  PriceCondition
} from '@/types/strategy'
import type { StockData } from '@/types'
import {
  loadStrategies,
  saveStrategies,
  checkAllStrategies,
  getStrategyTypeLabel,
  getStrategyTypeColor
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
  const handleEditStrategy = useCallback((strategy: Strategy) => {
    setEditingStrategy(strategy)
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
            {filteredStrategies.map(strategy => (
              <StrategyCard
                key={strategy.id}
                strategy={strategy}
                stockData={stockData}
                onEdit={() => handleEditStrategy(strategy)}
                onDelete={() => handleDeleteStrategy(strategy.id)}
                onToggle={() => handleToggleStrategy(strategy.id)}
              />
            ))}
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
        onClose={() => {
          setModalOpen(false)
          setEditingStrategy(null)
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
  onEdit: () => void
  onDelete: () => void
  onToggle: () => void
}

function StrategyCard({ strategy, stockData = {}, onEdit, onDelete, onToggle }: StrategyCardProps) {
  const typeColorClass = getStrategyTypeColor(strategy.type)
  const isTriggered = strategy.status === 'triggered'

  const formatTime = (ts?: number) => {
    if (!ts) return ''
    const d = new Date(ts)
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}`
  }

  return (
    <div className={`strategy-card ${isTriggered ? 'triggered' : ''}`}>
      <div className="strategy-card-body">
        {/* 头部 */}
        <div className="strategy-card-header">
          <div className="strategy-card-title">
            <span className={`strategy-type-badge ${typeColorClass}`}>
              {getStrategyTypeLabel(strategy.type)}
            </span>
            <h3 className="strategy-card-name">{strategy.name}</h3>
            {strategy.type === 'sector_arb' && (
              <p className="strategy-card-desc">
                基准：{(strategy as SectorArbStrategy).benchmarkName || (strategy as SectorArbStrategy).benchmarkCode}
              </p>
            )}
            {strategy.type === 'ah_premium' && (
              <p className="strategy-card-desc">
                比较对象：{(strategy as AHPremiumStrategy).aCode} / {(strategy as AHPremiumStrategy).hCode}
              </p>
            )}
            {strategy.type === 'price' && (
              <p className="strategy-card-desc">
                {(strategy as PriceAlertStrategy).stockName || (strategy as PriceAlertStrategy).code}
              </p>
            )}
          </div>
          <div className="strategy-card-status">
            {isTriggered ? (
              <span className="status-triggered">
                <span className="dot" />
                已触发
              </span>
            ) : strategy.enabled ? (
              <span className="status-running">
                <span className="dot" />
                监控中
              </span>
            ) : (
              <span className="status-running" style={{ color: 'var(--text-tertiary)' }}>
                已暂停
              </span>
            )}
            {strategy.triggeredAt && (
              <span className="strategy-time">{formatTime(strategy.triggeredAt)}</span>
            )}
          </div>
        </div>

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
            <PriceAlertContent strategy={strategy as PriceAlertStrategy} stockData={stockData} />
          )}
        </div>

        {/* 底部 */}
        <div className="strategy-card-footer">
          <span className="strategy-logic">
            {strategy.note || getStrategyLogic(strategy)}
          </span>
          <div className="strategy-actions">
            <button className="strategy-action-btn" onClick={onToggle} title={strategy.enabled ? '暂停' : '启动'}>
              {strategy.enabled ? Icons.pause : Icons.play}
            </button>
            <button className="strategy-action-btn" onClick={onEdit} title="编辑">
              {Icons.edit}
            </button>
            <button className="strategy-action-btn" onClick={onDelete} title="删除">
              {Icons.trash}
            </button>
          </div>
        </div>
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

// 价格预警内容
interface PriceAlertContentProps {
  strategy: PriceAlertStrategy
  stockData?: Record<string, StockData>
}

function PriceAlertContent({ strategy, stockData = {} }: PriceAlertContentProps) {
  const [expanded, setExpanded] = useState(false)
  const conditions = strategy.conditions || []
  
  // 从实时数据获取当前价格
  const stock = stockData[strategy.code]
  const currentPrice = stock?.price || 0
  const preClose = stock?.preClose || 0
  const pctChange = preClose ? ((currentPrice - preClose) / preClose * 100) : 0
  const isUp = pctChange >= 0

  // 最多显示3个，超过则折叠
  const MAX_VISIBLE = 3
  const visibleConditions = expanded ? conditions : conditions.slice(0, MAX_VISIBLE)
  const hasMore = conditions.length > MAX_VISIBLE

  // 计算距离目标价的百分比
  const calcDistance = (targetPrice: number, _operator: 'above' | 'below') => {
    if (!currentPrice) return '--'
    const diff = ((targetPrice - currentPrice) / currentPrice * 100)
    // 对于突破，正数表示还需上涨；对于跌破，负数表示还需下跌
    return diff.toFixed(1)
  }

  return (
    <div className="price-alert-box">
      {/* 当前价格区域 */}
      <div className="price-alert-header">
        <div className="price-current">
          <span className="price-value">{currentPrice ? currentPrice.toFixed(2) : '--'}</span>
          <span className={`price-change ${isUp ? 'up' : 'down'}`}>
            {currentPrice ? `${isUp ? '+' : ''}${pctChange.toFixed(2)}%` : '--'}
          </span>
        </div>
      </div>

      {/* 预警条件列表 */}
      <div className="price-alert-conditions">
        {visibleConditions.map((cond, idx) => (
          <PriceConditionItem
            key={idx}
            condition={cond}
            currentPrice={currentPrice}
            distance={calcDistance(cond.value, cond.operator)}
          />
        ))}
        
        {conditions.length === 0 && (
          <div className="price-condition-empty">
            <span>暂无预警条件</span>
          </div>
        )}
      </div>

      {/* 展开/收起按钮 */}
      {hasMore && (
        <button 
          className="price-alert-expand"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? '收起' : `查看全部 ${conditions.length} 个条件`}
          <svg 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="2"
            style={{ transform: expanded ? 'rotate(180deg)' : 'none' }}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
      )}
    </div>
  )
}

// 单个预警条件项
interface PriceConditionItemProps {
  condition: PriceCondition
  currentPrice: number
  distance: string
  onEdit?: () => void
  onDelete?: () => void
  onConfirm?: () => void
}

function PriceConditionItem({ condition, distance }: PriceConditionItemProps) {
  const isTriggered = condition.triggered
  const isAbove = condition.operator === 'above'
  const isPct = condition.type === 'pct'
  
  // 判断是否接近目标（5%以内）
  const distanceNum = parseFloat(distance)
  const isNear = !isNaN(distanceNum) && Math.abs(distanceNum) < 5

  return (
    <div className={`price-condition-item ${isTriggered ? 'triggered' : ''} ${isNear ? 'near' : ''}`}>
      <div className="condition-main">
        <span className={`condition-icon ${isAbove ? 'above' : 'below'}`}>
          {isAbove ? '↑' : '↓'}
        </span>
        <div className="condition-info">
          <span className="condition-target">
            {isPct ? '涨跌幅' : ''}{isAbove ? '突破' : '跌破'} 
            <strong>{condition.value}{isPct ? '%' : ''}</strong>
          </span>
          {condition.note && (
            <span className="condition-note">{condition.note}</span>
          )}
        </div>
      </div>
      <div className="condition-status">
        {isTriggered ? (
          <span className="status-badge triggered">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            已触发
          </span>
        ) : (
          <span className={`status-distance ${isNear ? 'near' : ''}`}>
            距离 {distance}%
          </span>
        )}
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
