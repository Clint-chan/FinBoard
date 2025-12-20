import { useState, useEffect, useCallback, useRef } from 'react'
import { useLocalStorage } from '@/hooks/useLocalStorage'
import { useQuotes } from '@/hooks/useQuotes'
import { useTheme } from '@/hooks/useTheme'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'
import { useCloudSync } from '@/hooks/useCloudSync'
import { useAlertCheck } from '@/hooks/useAlertCheck'
import { requestNotificationPermission } from '@/utils/format'
import { runMigration } from '@/services/migrationService'
import { loadStrategies, saveStrategies, generateStrategyId } from '@/services/strategyService'
import type { PriceAlertStrategy, PriceCondition } from '@/types/strategy'
import Sidebar from '@/components/Sidebar'
import { MobileHeader } from '@/components/MobileHeader'
import { MobileTabBar, type MobileTab } from '@/components/MobileTabBar'
import { MobileStockList } from '@/components/MobileStockList'
import { MobileStockDetail } from '@/components/MobileStockDetail'
import { MobileProfile } from '@/components/MobileProfile'
import { FintellChat } from '@/components/FintellChat'
import StockTable from '@/components/StockTable'
import StatusBar from '@/components/StatusBar'
import ChartTooltip from '@/components/ChartTooltip'
import ContextMenu from '@/components/ContextMenu'
import { AddStockModal, AlertModal, CostModal, AuthModal } from '@/components/modals'
import { AdminPage } from '@/components/AdminPage'
import { StrategyCenter } from '@/components/StrategyCenter'
import { AnalysisDrawer } from '@/components/AnalysisDrawer'
import { BossScreen } from '@/components/BossScreen'
import { DEFAULT_CONFIG } from '@/services/config'
import type { UserConfig, PageType, ContextMenuState, ChartTooltipState, UserProfile, AlertCondition } from '@/types'
import '@/styles/index.css'

// 在应用启动前执行数据迁移
runMigration()

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
    
    // 获取股票名称
    const stockName = stockData[normalizedCode]?.name || normalizedCode.toUpperCase()
    
    // 构建新的预警条件
    const newConditions: PriceCondition[] = alerts.map(a => ({
      type: 'price' as const,
      operator: a.operator,
      value: a.price,
      note: a.note
    }))
    
    // === 保存到新的策略系统 ===
    const existingStrategies = loadStrategies()
    
    // 查找该股票是否已有价格预警策略
    const existingStrategyIndex = existingStrategies.findIndex(
      s => s.type === 'price' && (s as PriceAlertStrategy).code === normalizedCode
    )
    
    if (existingStrategyIndex >= 0) {
      // 追加到现有策略
      const existingStrategy = existingStrategies[existingStrategyIndex] as PriceAlertStrategy
      const existingConditions = existingStrategy.conditions || []
      
      // 合并条件（去重）
      newConditions.forEach(nc => {
        const exists = existingConditions.some(ec => 
          ec.type === nc.type && ec.operator === nc.operator && ec.value === nc.value
        )
        if (!exists) {
          existingConditions.push(nc)
        }
      })
      
      existingStrategy.conditions = existingConditions
      existingStrategy.updatedAt = Date.now()
      existingStrategies[existingStrategyIndex] = existingStrategy
    } else {
      // 创建新策略
      const newStrategy: PriceAlertStrategy = {
        id: generateStrategyId(),
        name: stockName,
        type: 'price',
        status: 'running',
        enabled: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        code: normalizedCode,
        stockName,
        conditions: newConditions
      }
      existingStrategies.push(newStrategy)
    }
    
    saveStrategies(existingStrategies)
    
    // === 同时保存到老的预警系统（保持兼容） ===
    const existingOldConditions = config.alerts[normalizedCode]?.conditions || []
    const allOldConditions: AlertCondition[] = [...existingOldConditions]
    newConditions.forEach(nc => {
      const exists = allOldConditions.some(ec => 
        ec.type === nc.type && ec.operator === nc.operator && ec.value === nc.value
      )
      if (!exists) {
        allOldConditions.push(nc as AlertCondition)
      }
    })
    updateConfig({
      alerts: { ...config.alerts, [normalizedCode]: { conditions: allOldConditions } }
    })
  }, [config.alerts, config.codes, stockData, updateConfig])

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
    else if (tab === 'strategies') setActivePage('strategies')
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
      case 'strategies': return '策略'
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
      {/* 移动端顶部导航 - 在行情详情页和 Fintell 对话时隐藏 */}
      {(!isMobile || (mobileTab !== 'market' || !mobileStockCode)) && !fintellOpen && (
        <MobileHeader 
          title={isMobile ? getMobileTitle() : (activePage === 'watchlist' ? '行情看板' : activePage === 'strategies' ? '策略中心' : activePage === 'settings' ? '设置' : '管理')}
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

      {/* 移动端"我的"页面 */}
      {isMobile && mobileTab === 'profile' && (
        <div className="mobile-profile-container">
          <MobileProfile
            isLoggedIn={isLoggedIn}
            username={cloudUsername || undefined}
            onLoginSuccess={handleAuthSuccess}
            onLogout={handleLogout}
            onSync={async () => {
              try {
                await cloudSync()
                refresh()
              } catch (err) {
                console.error('Sync error:', err)
              }
            }}
            syncing={syncing}
            config={{
              interval: config.interval,
              pctThreshold: config.pctThreshold,
              refreshOnlyInMarketHours: config.refreshOnlyInMarketHours ?? true,
              quoteSource: config.quoteSource || 'eastmoney',
              theme: config.theme
            }}
            onConfigChange={updateConfig}
          />
        </div>
      )}
      
      {/* 主内容区域 - 移动端仅在策略页面显示 */}
      <main className={`main-content ${isMobile && (mobileTab === 'watchlist' || mobileTab === 'market' || mobileTab === 'profile') ? 'mobile-hidden' : ''}`}>
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
        
        {activePage === 'strategies' && <StrategyCenter stockData={stockData} />}
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
