/**
 * useCloudSync - 云同步 Hook
 * 管理登录状态和配置同步
 */
import { useState, useCallback, useEffect, useRef } from 'react'
import {
  cloudSaveConfig,
  cloudLoadConfig,
  verifyToken
} from '@/services/cloudService'
import { migrateConfig } from '@/services/migrationService'
import { loadStrategies, saveStrategies } from '@/services/strategyService'
import type { UserConfig } from '@/types'

interface CloudAuth {
  token: string
  username: string
  nickname?: string | null
}

interface UseCloudSyncOptions {
  config: UserConfig
  onConfigLoaded: (config: Partial<UserConfig>) => void
}

const AUTH_STORAGE_KEY = 'market_board_auth'

// 从云端配置中提取策略并保存到 localStorage
function syncStrategiesToLocal(cloudConfig: Partial<UserConfig>) {
  if (cloudConfig.strategies && Array.isArray(cloudConfig.strategies)) {
    console.log(
      '[CloudSync] 同步策略到本地:',
      cloudConfig.strategies.length,
      '个策略'
    )
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
  // 使用 ref 保存最新的 config，确保保存时使用最新值
  const configRef = useRef(config)

  // 更新 configRef
  useEffect(() => {
    configRef.current = config
  }, [config])

  // 登录成功
  const login = useCallback(
    async (token: string, username: string, nickname?: string | null) => {
      const newAuth = { token, username, nickname }
      setAuth(newAuth)
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(newAuth))

      // 加载云端配置
      setSyncing(true)
      try {
        const cloudConfig = await cloudLoadConfig(token)
        if (cloudConfig) {
          console.log('[CloudSync] 登录后加载云端配置:', {
            codes: cloudConfig.codes?.length || 0,
            categories: cloudConfig.categories?.length || 0
          })
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
    },
    [onConfigLoaded]
  )

  // 页面加载时自动同步（如果已登录）
  useEffect(() => {
    if (auth?.token) {
      // 延迟一点，避免阻塞初始渲染
      const timer = setTimeout(() => {
        console.log('[CloudSync] 页面加载，从云端拉取配置...')
        cloudLoadConfig(auth.token)
          .then((cloudConfig) => {
            if (cloudConfig) {
              console.log('[CloudSync] 云端配置加载成功:', {
                codes: cloudConfig.codes?.length || 0,
                categories: cloudConfig.categories?.length || 0
              })
              // 迁移旧版数据格式
              const migratedConfig = migrateConfig(cloudConfig)
              // 同步策略到本地
              syncStrategiesToLocal(migratedConfig)
              onConfigLoaded(migratedConfig)
            }
          })
          .catch((err) => {
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

  // 更新昵称
  const updateNickname = useCallback((nickname: string | null) => {
    if (!auth) return
    const newAuth = { ...auth, nickname }
    setAuth(newAuth)
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(newAuth))
  }, [auth])

  // 保存配置到云端（防抖）- 使用 ref 获取最新 config
  const saveToCloud = useCallback(() => {
    if (!auth?.token) return

    // 清除之前的定时器
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }

    // 延迟保存，避免频繁请求
    saveTimeoutRef.current = window.setTimeout(async () => {
      setSyncing(true)
      try {
        // 使用 ref 获取最新的 config
        const latestConfig = configRef.current
        // 将本地策略添加到配置中一起上传
        const configWithStrategies = addStrategiesToConfig(latestConfig)
        console.log('[CloudSync] 保存配置到云端:', {
          codes: configWithStrategies.codes?.length || 0,
          categories: configWithStrategies.categories?.length || 0,
          strategies: configWithStrategies.strategies?.length || 0
        })
        await cloudSaveConfig(auth.token, configWithStrategies)
        setLastSyncTime(new Date())
        console.log('[CloudSync] 保存成功')
      } catch (err) {
        console.error('Failed to save config to cloud:', err)
      } finally {
        setSyncing(false)
      }
    }, 2000)
  }, [auth?.token]) // 移除 config 依赖，使用 ref

  // 手动同步（先保存本地到云端，确保本地修改不丢失）
  const sync = useCallback(async () => {
    if (!auth?.token) return

    setSyncing(true)
    try {
      // 使用 ref 获取最新的 config
      const latestConfig = configRef.current
      // 1. 先把本地配置（包括策略）保存到云端
      const configWithStrategies = addStrategiesToConfig(latestConfig)
      console.log('[CloudSync] 手动同步 - 上传本地配置到云端:', {
        codes: configWithStrategies.codes?.length || 0,
        categories: configWithStrategies.categories?.length || 0,
        strategies: configWithStrategies.strategies?.length || 0
      })
      await cloudSaveConfig(auth.token, configWithStrategies)

      setLastSyncTime(new Date())
      console.log('[CloudSync] 手动同步成功')
    } catch (err) {
      console.error('Sync failed:', err)
      throw err
    } finally {
      setSyncing(false)
    }
  }, [auth?.token])

  // 验证 Token 有效性
  useEffect(() => {
    if (auth?.token) {
      verifyToken(auth.token).then((valid) => {
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
      console.log('[CloudSync] 检测到配置变化，准备保存...')
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
    nickname: auth?.nickname || null,
    syncing,
    lastSyncTime,
    login,
    logout,
    updateNickname,
    sync,
    triggerSave: saveToCloud // 暴露手动触发保存的方法
  }
}

export default useCloudSync
