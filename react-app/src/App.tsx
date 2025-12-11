import { useState, useEffect, useCallback, useRef } from 'react'
import { useLocalStorage } from '@/hooks/useLocalStorage'
import { useQuotes } from '@/hooks/useQuotes'
import { useTheme } from '@/hooks/useTheme'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'
import { useCloudSync } from '@/hooks/useCloudSync'
import { useAlertCheck } from '@/hooks/useAlertCheck'
import { requestNotificationPermission } from '@/utils/format'
import Sidebar from '@/components/Sidebar'
import StockTable from '@/components/StockTable'
import StatusBar from '@/components/StatusBar'
import ChartTooltip from '@/components/ChartTooltip'
import ContextMenu from '@/components/ContextMenu'
import { AddStockModal, AlertModal, CostModal, AuthModal } from '@/components/modals'
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
  const [alertModal, setAlertModal] = useState<{ open: boolean; code: string | null }>({ open: false, code: null })
  const [costModal, setCostModal] = useState<{ open: boolean; code: string | null }>({ open: false, code: null })
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({ open: false, x: 0, y: 0, code: null })
  const [chartTooltip, setChartTooltip] = useState<ChartTooltipState>({ visible: false, code: null, x: 0, y: 0 })
  const [analysisDrawer, setAnalysisDrawer] = useState<{ open: boolean; code: string }>({ open: false, code: '' })
  const [bossMode, setBossMode] = useState(false)
  const [authModalOpen, setAuthModalOpen] = useState(false)
  
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
  
  // 行情数据
  const { stockData, status, lastUpdate, refresh } = useQuotes(
    config.codes, 
    config.interval,
    config.quoteSource || 'eastmoney'
  )

  // 云同步
  const { isLoggedIn, username: cloudUsername, syncing, login: cloudLogin, logout: cloudLogout } = useCloudSync({
    config,
    onConfigLoaded: (cloudConfig) => {
      setConfig(prev => ({ ...prev, ...cloudConfig }))
    }
  })

  // 预警检查
  useAlertCheck({
    stockData,
    alerts: config.alerts,
    pctThreshold: config.pctThreshold
  })

  // 请求通知权限
  useEffect(() => {
    requestNotificationPermission()
  }, [])

  // 更新配置
  const updateConfig = useCallback((updates: Partial<UserConfig>) => {
    setConfig(prev => ({ ...prev, ...updates }))
  }, [setConfig])

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

  // 双击打开分析大屏
  const handleDoubleClick = useCallback((code: string) => {
    setAnalysisDrawer({ open: true, code })
  }, [])

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
    // 优先级：弹窗 > 分析大屏 > 老板键
    if (authModalOpen) {
      setAuthModalOpen(false)
    } else if (addStockOpen) {
      setAddStockOpen(false)
    } else if (alertModal.open) {
      setAlertModal({ open: false, code: null })
    } else if (costModal.open) {
      setCostModal({ open: false, code: null })
    } else if (analysisDrawer.open) {
      setAnalysisDrawer({ open: false, code: '' })
    } else {
      setBossMode(prev => !prev)
    }
  }, [authModalOpen, addStockOpen, alertModal.open, costModal.open, analysisDrawer.open])

  // 处理登录成功
  const handleAuthSuccess = useCallback((token: string, username: string) => {
    cloudLogin(token, username)
    // 更新用户资料
    setUser(prev => prev ? { ...prev, username } : { username, avatar: '' })
  }, [cloudLogin])

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

  return (
    <div className="app" data-theme={isDark ? 'dark' : 'light'}>
      <Sidebar
        activePage={activePage}
        user={user}
        isLoggedIn={isLoggedIn}
        cloudUsername={cloudUsername}
        syncing={syncing}
        onPageChange={setActivePage}
        onLoginClick={() => setAuthModalOpen(true)}
        onLogoutClick={handleLogout}
        onInsightClick={handleInsightClick}
        onProfileSave={handleProfileSave}
      />
      
      <main className="main-content">
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
            <div className="settings-card">
              {Object.keys(config.alerts).length === 0 ? (
                <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text-tertiary)' }}>
                  <p>暂无预警设置</p>
                  <p style={{ fontSize: '0.85rem' }}>右键点击股票可添加预警条件</p>
                </div>
              ) : (
                Object.entries(config.alerts).map(([code, alert]) => (
                  <div key={code} className="settings-row">
                    <div>
                      <label>{stockData[code]?.name || code}</label>
                      <div className="hint">{alert.conditions.length} 个预警条件</div>
                    </div>
                    <button onClick={() => setAlertModal({ open: true, code })}>编辑</button>
                  </div>
                ))
              )}
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
      </main>

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
      />

      {/* 分析大屏 */}
      <AnalysisDrawer
        open={analysisDrawer.open}
        code={analysisDrawer.code}
        onClose={() => setAnalysisDrawer({ open: false, code: '' })}
        stockList={config.codes}
        stockData={stockData}
        isDark={isDark}
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
