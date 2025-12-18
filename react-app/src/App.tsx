import { useState, useEffect, useCallback, useRef } from 'react'
import { useLocalStorage } from '@/hooks/useLocalStorage'
import { useQuotes } from '@/hooks/useQuotes'
import { useTheme } from '@/hooks/useTheme'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'
import { useCloudSync } from '@/hooks/useCloudSync'
import { useAlertCheck } from '@/hooks/useAlertCheck'
import { requestNotificationPermission } from '@/utils/format'
import Sidebar from '@/components/Sidebar'
import { MobileHeader } from '@/components/MobileHeader'
import { MobileTabBar, type MobileTab } from '@/components/MobileTabBar'
import { MobileStockList } from '@/components/MobileStockList'
import { MobileStockDetail } from '@/components/MobileStockDetail'
import { FintellChat } from '@/components/FintellChat'
import StockTable from '@/components/StockTable'
import StatusBar from '@/components/StatusBar'
import ChartTooltip from '@/components/ChartTooltip'
import ContextMenu from '@/components/ContextMenu'
import { AddStockModal, AlertModal, CostModal, AuthModal } from '@/components/modals'
import { AdminPage } from '@/components/AdminPage'
import { AnalysisDrawer } from '@/components/AnalysisDrawer'
import { BossScreen } from '@/components/BossScreen'
import { DEFAULT_CONFIG } from '@/services/config'
import type { UserConfig, PageType, ContextMenuState, ChartTooltipState, UserProfile, AlertCondition } from '@/types'
import '@/styles/index.css'

function App() {
  // 配置状态
  const [config, setConfig] = useLocalStorage<UserConfig>('market_board_config', DEFAULT_CONFIG)
  
  // UI 状态
  const [activePage, setActivePage] = useState<PageType>('watchlist')
  const [addStockOpen, setAddStockOpen] = useState(false)
  const [alertModal, setAlertModal] = useState<{ open: boolean; code: string | null; initialPrice?: number; editIndex?: number }>({ open: false, code: null })
  const [costModal, setCostModal] = useState<{ open: boolean; code: string | null }>({ open: false, code: null })
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({ open: false, x: 0, y: 0, code: null })
  const [chartTooltip, setChartTooltip] = useState<ChartTooltipState>({ visible: false, code: null, x: 0, y: 0 })
  const [analysisDrawer, setAnalysisDrawer] = useState<{ open: boolean; code: string }>({ open: false, code: '' })
  const [bossMode, setBossMode] = useState(false)
  const [authModalOpen, setAuthModalOpen] = useState(false)
  const [expandedAlerts, setExpandedAlerts] = useState<Record<string, boolean>>({})
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  
  // 移动端状态
  const [mobileTab, setMobileTab] = useState<MobileTab>('watchlist')
  const [mobileStockCode, setMobileStockCode] = useState<string>('') // 当前查看的股票（行情页）
  const [fintellOpen, setFintellOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768)
  
  // 当切换到行情页时，如果没有选中股票，默认选第一只
  useEffect(() => {
    if (isMobile && mobileTab === 'market' && !mobileStockCode && config.codes.length > 0) {
      setMobileStockCode(config.codes[0])
    }
  }, [isMobile, mobileTab, mobileStockCode, config.codes])
  
  // 管理员账号
  const ADMIN_USERS = ['cdg']
  
  // 对照原版 app.js 的 chartHovered 变量 - 使用 ref 避免闭包问题
  const chartHoveredRef = useRef(false)
  // 定时器 ref - 对照原版 state.tooltipTimer
  const tooltipTimerRef = useRef<number | null>(null)
  // 当前显示的图表 code - 对照原版 currentChartCode，避免重复触发
  const currentChartCodeRef = useRef<string | null>(null)
  
  // 用户状态（简化版，实际项目中应该用 Context 或状态管理库）
  const [user, setUser] = useState<UserProfile | null>(config.userProfile || null)
  
  // 主题
  const { isDark } = useTheme(config.theme)
  // 固定页面标题
  useEffect(() => {
    document.title = 'Fintell'
  }, [])
  
  // 监听窗口大小变化
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768)
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])
  
  // 行情数据
  const { stockData, status, lastUpdate, refresh } = useQuotes(
    config.codes, 
    config.interval,
    config.quoteSource || 'eastmoney',
    config.refreshOnlyInMarketHours ?? true
  )

  // 云同步
  const { isLoggedIn, username: cloudUsername, syncing, login: cloudLogin, logout: cloudLogout, sync: cloudSync } = useCloudSync({
    config,
    onConfigLoaded: (cloudConfig) => {
      setConfig(prev => ({ ...prev, ...cloudConfig }))
    }
  })

  // 是否是管理员
  const isAdmin = cloudUsername ? ADMIN_USERS.includes(cloudUsername) : false

  // 更新配置
  const updateConfig = useCallback((updates: Partial<UserConfig>) => {
    setConfig(prev => ({ ...prev, ...updates }))
  }, [setConfig])

  // 预警触发回调 - 标记条件已触发
  const handleAlertTriggered = useCallback((code: string, condIndex: number, _price: number) => {
    const alert = config.alerts[code]
    if (!alert?.conditions?.[condIndex]) return
    
    // 标记条件已触发
    const newConditions = [...alert.conditions]
    if (!newConditions[condIndex].triggered) {
      newConditions[condIndex] = {
        ...newConditions[condIndex],
        triggered: true,
        triggeredAt: Date.now()
      }
      updateConfig({
        alerts: { ...config.alerts, [code]: { conditions: newConditions } }
      })
    }
  }, [config.alerts, updateConfig])

  // 预警检查
  useAlertCheck({
    stockData,
    alerts: config.alerts,
    pctThreshold: config.pctThreshold,
    onAlertTriggered: handleAlertTriggered
  })

  // 请求通知权限
  useEffect(() => {
    requestNotificationPermission()
  }, [])

  // 添加股票
  const addStock = useCallback((code: string) => {
    if (!config.codes.includes(code)) {
      updateConfig({ codes: [...config.codes, code] })
    }
    setAddStockOpen(false)
  }, [config.codes, updateConfig])

  // 删除股票
  const deleteStock = useCallback((code: string) => {
    const newAlerts = { ...config.alerts }
    delete newAlerts[code]
    const newCosts = { ...config.costs }
    delete newCosts[code]
    
    updateConfig({
      codes: config.codes.filter(c => c !== code),
      alerts: newAlerts,
      costs: newCosts
    })
    setContextMenu({ open: false, x: 0, y: 0, code: null })
  }, [config, updateConfig])

  // 保存预警
  const saveAlert = useCallback((code: string, conditions: AlertCondition[]) => {
    updateConfig({
      alerts: { ...config.alerts, [code]: { conditions } }
    })
    setAlertModal({ open: false, code: null })
  }, [config.alerts, updateConfig])

  // 确认预警（入库历史并删除）
  const confirmAlert = useCallback((code: string, condIndex: number) => {
    const alert = config.alerts[code]
    if (!alert?.conditions?.[condIndex]) return
    
    const condition = alert.conditions[condIndex]
    const stock = stockData[code]
    
    // 添加到历史记录
    const historyItem = {
      code,
      stockName: stock?.name || code,
      condition: { ...condition },
      triggeredAt: condition.triggeredAt || Date.now(),
      confirmedAt: Date.now(),
      price: stock?.price || 0
    }
    
    const newHistory = [...(config.alertHistory || []), historyItem]
    
    // 从当前预警中删除
    const newConditions = alert.conditions.filter((_, i) => i !== condIndex)
    const newAlerts = { ...config.alerts }
    if (newConditions.length === 0) {
      delete newAlerts[code]
    } else {
      newAlerts[code] = { conditions: newConditions }
    }
    
    updateConfig({
      alerts: newAlerts,
      alertHistory: newHistory
    })
  }, [config.alerts, config.alertHistory, stockData, updateConfig])

  // 删除历史记录
  const deleteHistoryItem = useCallback((index: number) => {
    const newHistory = (config.alertHistory || []).filter((_, i) => i !== index)
    updateConfig({ alertHistory: newHistory })
  }, [config.alertHistory, updateConfig])

  // 清空所有历史记录
  const clearAllHistory = useCallback(() => {
    if (confirm('确定清空所有预警历史记录？')) {
      updateConfig({ alertHistory: [] })
    }
  }, [updateConfig])

  // 从 AI 卡片直接保存多个预警（追加到现有条件）
  const saveAlertsFromAI = useCallback((code: string, alerts: Array<{ price: number; operator: 'above' | 'below'; note: string }>) => {
    // 标准化 code 格式：确保与 config.codes 中的格式一致
    // AI 可能返回 "sh600233" 或 "600233"，需要匹配到正确的 code
    let normalizedCode = code
    
    // 如果 code 不在 config.codes 中，尝试添加前缀
    if (!config.codes.includes(code)) {
      const codeNum = code.replace(/^(sh|sz)/i, '')
      const withSh = `sh${codeNum}`
      const withSz = `sz${codeNum}`
      
      if (config.codes.includes(withSh)) {
        normalizedCode = withSh
      } else if (config.codes.includes(withSz)) {
        normalizedCode = withSz
      } else {
        // 根据代码规则推断前缀
        normalizedCode = codeNum.startsWith('6') ? `sh${codeNum}` : `sz${codeNum}`
      }
    }
    
    const existingConditions = config.alerts[normalizedCode]?.conditions || []
    const newConditions: AlertCondition[] = alerts.map(a => ({
      type: 'price' as const,
      operator: a.operator,
      value: a.price,
      note: a.note
    }))
    // 合并现有条件和新条件（去重）
    const allConditions = [...existingConditions]
    newConditions.forEach(nc => {
      const exists = allConditions.some(ec => 
        ec.type === nc.type && ec.operator === nc.operator && ec.value === nc.value
      )
      if (!exists) {
        allConditions.push(nc)
      }
    })
    updateConfig({
      alerts: { ...config.alerts, [normalizedCode]: { conditions: allConditions } }
    })
  }, [config.alerts, config.codes, updateConfig])

  // 保存成本
  const saveCost = useCallback((code: string, cost: number | null) => {
    const newCosts = { ...config.costs }
    if (cost === null) {
      delete newCosts[code]
    } else {
      newCosts[code] = cost
    }
    updateConfig({ costs: newCosts })
    setCostModal({ open: false, code: null })
  }, [config.costs, updateConfig])

  // 拖拽排序
  const reorderStocks = useCallback((fromIndex: number, toIndex: number) => {
    const newCodes = [...config.codes]
    const [removed] = newCodes.splice(fromIndex, 1)
    newCodes.splice(toIndex, 0, removed)
    updateConfig({ codes: newCodes })
  }, [config.codes, updateConfig])

  // 右键菜单
  const handleContextMenu = useCallback((e: React.MouseEvent, code: string) => {
    e.preventDefault()
    setContextMenu({ open: true, x: e.clientX, y: e.clientY, code })
  }, [])

  /**
   * 图表悬浮逻辑 - 完全对照原版 app.js 的实现
   * 原版逻辑：
   * 1. mouseover 时延迟 200ms 显示图表
   * 2. mouseout 时延迟 100ms 检查 chartHovered，如果为 false 才隐藏
   * 3. 图表的 mouseenter 设置 chartHovered = true
   * 4. 图表的 mouseleave 设置 chartHovered = false 并立即隐藏
   * 
   * 修复：
   * - 如果当前已经显示该 code 的图表，不重复触发（避免闪屏）
   * - 对照原版 view.js 的 currentChartCode 逻辑
   */
  const handleChartShow = useCallback((code: string, e: React.MouseEvent) => {
    // 对照原版：if (!chartHovered) { ... setTimeout 200ms ... }
    // 修复：如果已经显示该 code 的图表，不重复触发
    if (!chartHoveredRef.current && currentChartCodeRef.current !== code) {
      if (tooltipTimerRef.current) clearTimeout(tooltipTimerRef.current)
      tooltipTimerRef.current = window.setTimeout(() => {
        currentChartCodeRef.current = code
        setChartTooltip({ visible: true, code, x: e.clientX, y: e.clientY })
        tooltipTimerRef.current = null
      }, 200)
    }
  }, [])

  const handleChartHide = useCallback(() => {
    // 对照原版：清除定时器，延迟 100ms 检查 chartHovered
    if (tooltipTimerRef.current) {
      clearTimeout(tooltipTimerRef.current)
      tooltipTimerRef.current = null
    }
    // 延迟隐藏，给用户时间移入图表
    setTimeout(() => {
      if (!chartHoveredRef.current) {
        currentChartCodeRef.current = null
        setChartTooltip(prev => ({ ...prev, visible: false }))
      }
    }, 100)
  }, [])

  // 图表 mouseenter - 对照原版
  const handleChartMouseEnter = useCallback(() => {
    chartHoveredRef.current = true
  }, [])

  // 图表 mouseleave - 对照原版
  const handleChartMouseLeave = useCallback(() => {
    chartHoveredRef.current = false
    currentChartCodeRef.current = null
    setChartTooltip(prev => ({ ...prev, visible: false }))
  }, [])

  // 双击打开分析大屏（桌面端）或行情详情（移动端）
  const handleDoubleClick = useCallback((code: string) => {
    if (isMobile) {
      setMobileStockCode(code)
      setMobileTab('market')
    } else {
      setAnalysisDrawer({ open: true, code })
    }
  }, [isMobile])

  // 打开分析大屏（从侧边栏 Insight 按钮）
  const handleInsightClick = useCallback(() => {
    // 默认打开第一只股票的分析
    const firstCode = config.codes[0] || ''
    if (firstCode) {
      setAnalysisDrawer({ open: true, code: firstCode })
    }
  }, [config.codes])

  // 保存用户资料
  const handleProfileSave = useCallback((profile: UserProfile) => {
    setUser(profile)
    updateConfig({ userProfile: profile })
  }, [updateConfig])

  // 关闭右键菜单
  useEffect(() => {
    const handleClick = () => setContextMenu(prev => ({ ...prev, open: false }))
    document.addEventListener('click', handleClick)
    return () => document.removeEventListener('click', handleClick)
  }, [])

  // ESC 键处理
  const handleEscape = useCallback(() => {
    // 优先级：Fintell > 弹窗 > 分析大屏 > 移动端行情详情 > 老板键
    if (fintellOpen) {
      setFintellOpen(false)
    } else if (authModalOpen) {
      setAuthModalOpen(false)
    } else if (addStockOpen) {
      setAddStockOpen(false)
    } else if (alertModal.open) {
      setAlertModal({ open: false, code: null })
    } else if (costModal.open) {
      setCostModal({ open: false, code: null })
    } else if (analysisDrawer.open) {
      setAnalysisDrawer({ open: false, code: '' })
    } else if (isMobile && mobileStockCode) {
      setMobileStockCode('')
      setMobileTab('watchlist')
    } else {
      setBossMode(prev => !prev)
    }
  }, [fintellOpen, authModalOpen, addStockOpen, alertModal.open, costModal.open, analysisDrawer.open, isMobile, mobileStockCode])

  // 处理登录成功
  const handleAuthSuccess = useCallback((token: string, username: string) => {
    cloudLogin(token, username)
    // 更新用户资料
    setUser(prev => prev ? { ...prev, username } : { username, avatar: '' })
    // 登录后立即刷新行情，显示新加的股票
    setTimeout(() => {
      refresh()
    }, 500)
  }, [cloudLogin, refresh])

  // 处理登出
  const handleLogout = useCallback(() => {
    cloudLogout()
    setUser(null)
  }, [cloudLogout])

  // 快捷键系统
  useKeyboardShortcuts({
    onRefresh: refresh,
    onSettings: () => setActivePage('settings'),
    onAddStock: () => setAddStockOpen(true),
    onEscape: handleEscape
  })

  // 移动端标签页切换处理
  const handleMobileTabChange = useCallback((tab: MobileTab) => {
    // AI 标签页直接打开 Fintell 对话
    if (tab === 'ai') {
      setFintellOpen(true)
      return
    }
    
    setMobileTab(tab)
    
    // 切换到行情页时，如果没有选中股票，默认选第一只
    if (tab === 'market' && !mobileStockCode && config.codes.length > 0) {
      setMobileStockCode(config.codes[0])
    }
    
    // 同步到桌面端页面
    if (tab === 'watchlist') setActivePage('watchlist')
    else if (tab === 'alerts') setActivePage('alerts')
    else if (tab === 'profile') setActivePage('settings')
  }, [mobileStockCode, config.codes])

  // 获取移动端标题
  const getMobileTitle = () => {
    if (mobileTab === 'market' && mobileStockCode) {
      return stockData[mobileStockCode]?.name || mobileStockCode
    }
    switch (mobileTab) {
      case 'watchlist': return '自选'
      case 'market': return '行情'
      case 'ai': return 'AI'
      case 'alerts': return '预警'
      case 'profile': return '我的'
      default: return 'Fintell'
    }
  }

  // 移动端长按处理（打开右键菜单）
  const handleMobileLongPress = useCallback((code: string, pos: { clientX: number; clientY: number }) => {
    setContextMenu({ open: true, x: pos.clientX, y: pos.clientY, code })
  }, [])

  return (
    <div className={`app ${isMobile ? 'mobile-layout' : ''}`} data-theme={isDark ? 'dark' : 'light'}>
      {/* 移动端顶部导航 - 仅在非行情详情页显示 */}
      {(!isMobile || mobileTab !== 'market' || !mobileStockCode) && (
        <MobileHeader 
          title={isMobile ? getMobileTitle() : (activePage === 'watchlist' ? '行情看板' : activePage === 'alerts' ? '价格预警' : activePage === 'settings' ? '设置' : '管理')}
        />
      )}
      
      {/* 桌面端侧边栏 - 移动端隐藏 */}
      {!isMobile && (
      <Sidebar
        activePage={activePage}
        user={user}
        isLoggedIn={isLoggedIn}
        cloudUsername={cloudUsername}
        syncing={syncing}
        isAdmin={isAdmin}
        expanded={mobileSidebarOpen}
        onExpandedChange={setMobileSidebarOpen}
        onPageChange={(page) => {
          setActivePage(page)
          setMobileSidebarOpen(false)
        }}
        onLoginClick={() => {
          setAuthModalOpen(true)
          setMobileSidebarOpen(false)
        }}
        onLogoutClick={handleLogout}
        onInsightClick={handleInsightClick}
        onProfileSave={handleProfileSave}
        onSync={async () => {
          try {
            await cloudSync()
            // 同步后刷新行情
            refresh()
          } catch (err) {
            console.error('Sync error:', err)
          }
        }}
        token={localStorage.getItem('cloud_token')}
      />
      )}
      
      {/* 移动端自选列表 */}
      {isMobile && mobileTab === 'watchlist' && (
        <div className="mobile-watchlist-container">
          <MobileStockList
            codes={config.codes}
            stockData={stockData}
            costs={config.costs}
            alerts={config.alerts}
            onStockTap={(code) => {
              setMobileStockCode(code)
              setMobileTab('market')
            }}
            onStockLongPress={handleMobileLongPress}
            onAddStock={() => setAddStockOpen(true)}
          />
        </div>
      )}
      
      {/* 主内容区域 - 移动端仅在预警/我的页面显示 */}
      <main className={`main-content ${isMobile && (mobileTab === 'watchlist' || mobileTab === 'market') ? 'mobile-hidden' : ''}`}>
        {activePage === 'watchlist' && (
          <div className="page">
            {/* 对照原版：header 只有标题，设置按钮是隐藏的 */}
            <header>
              <div className="header-title">
                <h1>行情看板</h1>
                <p>正在追踪 <span>{config.codes.length}</span> 只标的</p>
              </div>
            </header>
            
            <div className="card">
              <StockTable
                codes={config.codes}
                stockData={stockData}
                costs={config.costs}
                alerts={config.alerts}
                onContextMenu={handleContextMenu}
                onChartShow={handleChartShow}
                onChartHide={handleChartHide}
                onReorder={reorderStocks}
                onAddStock={() => setAddStockOpen(true)}
                onDoubleClick={handleDoubleClick}
              />
              <StatusBar
                status={status}
                lastUpdate={lastUpdate}
              />
            </div>
          </div>
        )}
        
        {activePage === 'alerts' && (
          <div className="page">
            <header className="page-header">
              <h1>预警中心</h1>
              <p>管理所有股票的价格预警</p>
            </header>
            <div className="alert-list">
              {Object.keys(config.alerts).length === 0 ? (
                <div className="settings-card" style={{ textAlign: 'center', padding: '48px', color: 'var(--text-tertiary)' }}>
                  <p>暂无预警设置</p>
                  <p style={{ fontSize: '0.85rem' }}>右键点击股票可添加预警条件</p>
                </div>
              ) : (
                Object.entries(config.alerts).map(([code, alert]) => {
                  const isExpanded = expandedAlerts[code] || false
                  return (
                    <div key={code} className={`alert-card ${isExpanded ? 'expanded' : ''}`}>
                      <div 
                        className="alert-card-header"
                        onClick={() => setExpandedAlerts(prev => ({ ...prev, [code]: !prev[code] }))}
                      >
                        <div className="alert-card-left">
                          <svg className="alert-card-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="9 18 15 12 9 6"></polyline>
                          </svg>
                          <div className="alert-card-info">
                            <span className="alert-card-name">{stockData[code]?.name || code}</span>
                            <span className="alert-card-count">{alert.conditions.length} 个预警条件</span>
                          </div>
                        </div>
                        <div className="alert-card-actions" onClick={e => e.stopPropagation()}>
                          <button 
                            className="alert-card-btn"
                            onClick={() => setAlertModal({ open: true, code })}
                          >
                            添加
                          </button>
                          <button 
                            className="alert-card-btn delete"
                            onClick={() => {
                              if (confirm('确定删除该股票的所有预警？')) {
                                const newAlerts = { ...config.alerts }
                                delete newAlerts[code]
                                updateConfig({ alerts: newAlerts })
                              }
                            }}
                          >
                            全部删除
                          </button>
                        </div>
                      </div>
                      <div className="alert-card-body">
                        <div className="alert-card-conditions">
                          {alert.conditions.map((cond, idx) => (
                            <div key={idx} className={`alert-card-cond ${cond.triggered ? 'triggered' : ''}`}>
                              <div className="alert-card-cond-content">
                                <div className="alert-card-cond-text">
                                  {cond.triggered && <span className="triggered-badge">已触发</span>}
                                  {cond.type === 'price' ? '价格' : '涨跌幅'}
                                  {cond.operator === 'above' ? (cond.type === 'pct' ? ' ≥ ' : ' 突破 ') : (cond.type === 'pct' ? ' ≤ ' : ' 跌破 ')}
                                  <strong>{cond.value}</strong>{cond.type === 'pct' ? '%' : ' 元'}
                                </div>
                                {cond.note && (
                                  <div className="alert-card-cond-note">{cond.note}</div>
                                )}
                                {cond.triggeredAt && (
                                  <div className="alert-card-cond-time">
                                    触发于 {new Date(cond.triggeredAt).toLocaleString()}
                                  </div>
                                )}
                              </div>
                              <div className="alert-card-cond-actions">
                                {cond.triggered && (
                                  <button 
                                    className="alert-card-cond-btn confirm"
                                    onClick={() => confirmAlert(code, idx)}
                                    title="确认并归档"
                                  >
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                      <polyline points="20 6 9 17 4 12"></polyline>
                                    </svg>
                                  </button>
                                )}
                                <button 
                                  className="alert-card-cond-btn edit"
                                  onClick={() => setAlertModal({ open: true, code, editIndex: idx })}
                                  title="编辑此条件"
                                >
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                                  </svg>
                                </button>
                                <button 
                                  className="alert-card-cond-btn del"
                                  onClick={() => {
                                    const newConditions = alert.conditions.filter((_, i) => i !== idx)
                                    if (newConditions.length === 0) {
                                      const newAlerts = { ...config.alerts }
                                      delete newAlerts[code]
                                      updateConfig({ alerts: newAlerts })
                                    } else {
                                      updateConfig({
                                        alerts: { ...config.alerts, [code]: { conditions: newConditions } }
                                      })
                                    }
                                  }}
                                  title="删除此条件"
                                >
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <line x1="18" y1="6" x2="6" y2="18"></line>
                                    <line x1="6" y1="6" x2="18" y2="18"></line>
                                  </svg>
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
            
            {/* 预警历史记录 */}
            {(config.alertHistory?.length || 0) > 0 && (
              <div className="alert-history-section">
                <div className="alert-history-header">
                  <h3>预警历史</h3>
                  <button className="clear-history-btn" onClick={clearAllHistory}>
                    清空历史
                  </button>
                </div>
                <div className="alert-history-list">
                  {config.alertHistory?.map((item, idx) => (
                    <div key={idx} className="alert-history-item">
                      <div className="history-item-info">
                        <span className="history-stock-name">{item.stockName}</span>
                        <span className="history-condition">
                          {item.condition.type === 'price' ? '价格' : '涨跌幅'}
                          {item.condition.operator === 'above' ? ' 突破 ' : ' 跌破 '}
                          {item.condition.value}{item.condition.type === 'pct' ? '%' : ''}
                        </span>
                        {item.condition.note && (
                          <span className="history-note">{item.condition.note}</span>
                        )}
                      </div>
                      <div className="history-item-meta">
                        <span className="history-price">触发价: {item.price.toFixed(2)}</span>
                        <span className="history-time">{new Date(item.confirmedAt).toLocaleDateString()}</span>
                        <button 
                          className="history-del-btn"
                          onClick={() => deleteHistoryItem(idx)}
                          title="删除此记录"
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
        
        {activePage === 'settings' && (
          <div className="page">
            <header className="page-header">
              <h1>设置</h1>
              <p>个性化你的看板</p>
            </header>
            <div className="settings-card">
              <div className="settings-row">
                <div>
                  <label>刷新间隔</label>
                  <div className="hint">数据自动刷新的时间间隔</div>
                </div>
                <div className="settings-input">
                  <input
                    type="number"
                    value={config.interval}
                    min={3}
                    onChange={(e) => updateConfig({ interval: parseInt(e.target.value) || 5 })}
                  />
                  <span>秒</span>
                </div>
              </div>
              <div className="settings-row">
                <div>
                  <label>涨跌幅预警阈值</label>
                  <div className="hint">超过此阈值时触发通知</div>
                </div>
                <div className="settings-input">
                  <input
                    type="number"
                    value={config.pctThreshold}
                    min={1}
                    onChange={(e) => updateConfig({ pctThreshold: parseFloat(e.target.value) || 5 })}
                  />
                  <span>%</span>
                </div>
              </div>
              <div className="settings-row">
                <div>
                  <label>仅交易时间刷新</label>
                  <div className="hint">开启后，非交易时间（周末、盘前盘后）不会请求行情数据</div>
                </div>
                <div className="settings-input">
                  <label className="switch">
                    <input
                      type="checkbox"
                      checked={config.refreshOnlyInMarketHours ?? true}
                      onChange={(e) => updateConfig({ refreshOnlyInMarketHours: e.target.checked })}
                    />
                    <span className="slider"></span>
                  </label>
                </div>
              </div>
              <div className="settings-row">
                <div>
                  <label>数据源</label>
                  <div className="hint">选择行情数据来源（东方财富支持市盈率等更多指标）</div>
                </div>
                <div className="settings-input">
                  <select
                    value={config.quoteSource || 'eastmoney'}
                    onChange={(e) => updateConfig({ quoteSource: e.target.value as any })}
                    style={{ 
                      padding: '6px 12px', 
                      borderRadius: '6px', 
                      border: '1px solid var(--border-light)',
                      background: 'var(--bg-surface)',
                      color: 'var(--text-primary)',
                      cursor: 'pointer'
                    }}
                  >
                    <option value="eastmoney">东方财富（推荐）</option>
                    <option value="tencent">腾讯财经</option>
                    <option value="sina">新浪财经</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {activePage === 'admin' && isAdmin && <AdminPage />}
      </main>

      {/* 移动端行情详情页 */}
      {isMobile && mobileTab === 'market' && mobileStockCode && (
        <div className="mobile-stock-detail-container">
          <MobileStockDetail
            code={mobileStockCode}
            stockData={stockData}
            stockList={config.codes}
            isDark={isDark}
            onStockChange={setMobileStockCode}
            onBack={() => {
              setMobileStockCode('')
              setMobileTab('watchlist')
            }}
            onOpenAlert={(code, price) => {
              setAlertModal({ open: true, code, initialPrice: price })
            }}
            alerts={config.alerts}
          />
        </div>
      )}

      {/* 移动端底部导航栏 */}
      {isMobile && (
        <MobileTabBar
          activeTab={mobileTab}
          onTabChange={handleMobileTabChange}
        />
      )}

      {/* Fintell 全屏对话 */}
      <FintellChat
        open={fintellOpen}
        onClose={() => setFintellOpen(false)}
        stockCode={mobileStockCode || config.codes[0]}
        stockData={stockData}
        stockList={config.codes}
        isDark={isDark}
        onSaveAlerts={saveAlertsFromAI}
      />

      {/* 弹窗 */}
      <AddStockModal
        open={addStockOpen}
        onClose={() => setAddStockOpen(false)}
        onAdd={addStock}
        existingCodes={config.codes}
      />
      
      <AlertModal
        open={alertModal.open}
        code={alertModal.code}
        stockData={alertModal.code ? stockData[alertModal.code] : undefined}
        conditions={alertModal.code ? config.alerts[alertModal.code]?.conditions || [] : []}
        onClose={() => setAlertModal({ open: false, code: null })}
        onSave={saveAlert}
        initialPrice={alertModal.initialPrice}
        editIndex={alertModal.editIndex}
      />
      
      <CostModal
        open={costModal.open}
        code={costModal.code}
        stockData={costModal.code ? stockData[costModal.code] : undefined}
        currentCost={costModal.code ? config.costs[costModal.code] : undefined}
        onClose={() => setCostModal({ open: false, code: null })}
        onSave={saveCost}
      />
      
      <ContextMenu
        open={contextMenu.open}
        x={contextMenu.x}
        y={contextMenu.y}
        onClose={() => setContextMenu(prev => ({ ...prev, open: false }))}
        onSetAlert={() => setAlertModal({ open: true, code: contextMenu.code })}
        onSetCost={() => setCostModal({ open: true, code: contextMenu.code })}
        onDelete={() => contextMenu.code && deleteStock(contextMenu.code)}
      />
      
      <ChartTooltip
        visible={chartTooltip.visible}
        code={chartTooltip.code}
        stockName={chartTooltip.code ? stockData[chartTooltip.code]?.name : undefined}
        stockPrice={chartTooltip.code ? stockData[chartTooltip.code]?.price : undefined}
        stockPreClose={chartTooltip.code ? stockData[chartTooltip.code]?.preClose : undefined}
        x={chartTooltip.x}
        y={chartTooltip.y}
        onMouseEnter={handleChartMouseEnter}
        onMouseLeave={handleChartMouseLeave}
        alertLines={chartTooltip.code && config.alerts[chartTooltip.code]
          ? config.alerts[chartTooltip.code].conditions
              .filter(c => c.type === 'price' && !c.triggered)
              .map(c => ({ price: c.value, operator: c.operator, note: c.note }))
          : []}
      />

      {/* 分析大屏 */}
      <AnalysisDrawer
        open={analysisDrawer.open}
        code={analysisDrawer.code}
        onClose={() => setAnalysisDrawer({ open: false, code: '' })}
        stockList={config.codes}
        stockData={stockData}
        isDark={isDark}
        onOpenAlert={(code, price) => {
          setAlertModal({ open: true, code, initialPrice: price })
        }}
        onSaveAlerts={saveAlertsFromAI}
        alerts={config.alerts}
      />

      {/* 老板键遮罩 */}
      <BossScreen
        visible={bossMode}
        onClose={() => setBossMode(false)}
        isDark={isDark}
      />

      {/* 登录/注册弹窗 */}
      <AuthModal
        open={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        onSuccess={handleAuthSuccess}
      />
    </div>
  )
}

export default App
