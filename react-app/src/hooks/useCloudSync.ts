/**
 * useCloudSync - 云同步 Hook
 * 管理登录状态和配置同步
 */
import { useState, useCallback, useEffect, useRef } from 'react'
import { cloudSaveConfig, cloudLoadConfig, verifyToken } from '@/services/cloudService'
import { migrateConfig } from '@/services/migrationService'
import { loadStrategies, saveStrategies } from '@/services/strategyService'
import type { UserConfig } from '@/types'

interface CloudAuth {
  token: string
  username: string
}

interface UseCloudSyncOptions {
  config: UserConfig
  onConfigLoaded: (config: Partial<UserConfig>) => void
}

const AUTH_STORAGE_KEY = 'market_board_auth'

// 从云端配置中提取策略并保存到 localStorage
function syncStrategiesToLocal(cloudConfig: Partial<UserConfig>) {
  if (cloudConfig.strategies && Array.isArray(cloudConfig.strategies)) {
    console.log('[CloudSync] 同步策略到本地:', cloudConfig.strategies.length, '个策略')
    saveStrategies(cloudConfig.strategies as any[])
    // 触发策略更新事件
    window.dispatchEvent(new CustomEvent('strategies-updated'))
  }
}

// 将本地策略添加到配置中准备上传
function addStrategiesToConfig(config: UserConfig): UserConfig {
  const strategies = loadStrategies()
  return { ...config, strategies }
}

export function useCloudSync({ config, onConfigLoaded }: UseCloudSyncOptions) {
  const [auth, setAuth] = useState<CloudAuth | null>(() => {
    try {
      const stored = localStorage.getItem(AUTH_STORAGE_KEY)
      return stored ? JSON.parse(stored) : null
    } catch {
      return null
    }
  })
  
  const [syncing, setSyncing] = useState(false)
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null)
  const saveTimeoutRef = useRef<number | null>(null)
  const isInitialMount = useRef(true)

  // 登录成功
  const login = useCallback(async (token: string, username: string) => {
    const newAuth = { token, username }
    setAuth(newAuth)
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(newAuth))

    // 加载云端配置
    setSyncing(true)
    try {
      const cloudConfig = await cloudLoadConfig(token)
      if (cloudConfig) {
        // 迁移旧版数据格式
        const migratedConfig = migrateConfig(cloudConfig)
        // 同步策略到本地
        syncStrategiesToLocal(migratedConfig)
        onConfigLoaded(migratedConfig)
      }
      setLastSyncTime(new Date())
    } catch (err) {
      console.error('Failed to load cloud config:', err)
    } finally {
      setSyncing(false)
    }
  }, [onConfigLoaded])
  
  // 页面加载时自动同步（如果已登录）
  useEffect(() => {
    if (auth?.token) {
      // 延迟一点，避免阻塞初始渲染
      const timer = setTimeout(() => {
        cloudLoadConfig(auth.token).then(cloudConfig => {
          if (cloudConfig) {
            // 迁移旧版数据格式
            const migratedConfig = migrateConfig(cloudConfig)
            // 同步策略到本地
            syncStrategiesToLocal(migratedConfig)
            onConfigLoaded(migratedConfig)
          }
        }).catch(err => {
          console.error('Auto sync failed:', err)
        })
      }, 1000)
      
      return () => clearTimeout(timer)
    }
  }, []) // 只在挂载时执行一次
  // eslint-disable-line react-hooks/exhaustive-deps


  // 登出
  const logout = useCallback(() => {
    setAuth(null)
    localStorage.removeItem(AUTH_STORAGE_KEY)
    setLastSyncTime(null)
  }, [])

  // 保存配置到云端（防抖）
  const saveToCloud = useCallback(async () => {
    if (!auth?.token) return

    // 清除之前的定时器
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }

    // 延迟保存，避免频繁请求
    saveTimeoutRef.current = window.setTimeout(async () => {
      setSyncing(true)
      try {
        // 将本地策略添加到配置中一起上传
        const configWithStrategies = addStrategiesToConfig(config)
        await cloudSaveConfig(auth.token, configWithStrategies)
        setLastSyncTime(new Date())
      } catch (err) {
        console.error('Failed to save config to cloud:', err)
      } finally {
        setSyncing(false)
      }
    }, 2000)
  }, [auth?.token, config])

  // 手动同步（双向：先拉取云端，再保存本地）
  const sync = useCallback(async () => {
    if (!auth?.token) return

    setSyncing(true)
    try {
      // 1. 先从云端加载最新配置
      const cloudConfig = await cloudLoadConfig(auth.token)
      console.log('[CloudSync] 云端配置:', cloudConfig)
      
      if (cloudConfig) {
        // 迁移旧版数据格式
        const migratedConfig = migrateConfig(cloudConfig)
        console.log('[CloudSync] 迁移后配置:', migratedConfig)
        console.log('[CloudSync] 迁移后 strategies:', migratedConfig.strategies?.length || 0, '个策略')
        // 同步策略到本地
        syncStrategiesToLocal(migratedConfig)
        onConfigLoaded(migratedConfig)
      }
      
      setLastSyncTime(new Date())
    } catch (err) {
      console.error('Sync failed:', err)
      throw err
    } finally {
      setSyncing(false)
    }
  }, [auth?.token, onConfigLoaded])

  // 验证 Token 有效性
  useEffect(() => {
    if (auth?.token) {
      verifyToken(auth.token).then(valid => {
        if (!valid) {
          logout()
        }
      })
    }
  }, [auth?.token, logout])

  // 配置变化时自动保存到云端
  useEffect(() => {
    // 跳过初始挂载
    if (isInitialMount.current) {
      isInitialMount.current = false
      return
    }

    if (auth?.token) {
      saveToCloud()
    }
  }, [config, auth?.token, saveToCloud])

  // 清理定时器
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
    }
  }, [])

  // 监听策略更新事件，触发云同步
  useEffect(() => {
    if (!auth?.token) return
    
    const handleStrategiesUpdated = () => {
      console.log('[CloudSync] 检测到策略更新，触发云同步')
      saveToCloud()
    }
    
    window.addEventListener('strategies-updated', handleStrategiesUpdated)
    return () => window.removeEventListener('strategies-updated', handleStrategiesUpdated)
  }, [auth?.token, saveToCloud])

  return {
    isLoggedIn: !!auth,
    username: auth?.username || null,
    syncing,
    lastSyncTime,
    login,
    logout,
    sync,
    triggerSave: saveToCloud // 暴露手动触发保存的方法
  }
}

export default useCloudSync
