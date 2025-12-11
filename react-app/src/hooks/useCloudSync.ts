/**
 * useCloudSync - 云同步 Hook
 * 管理登录状态和配置同步
 */
import { useState, useCallback, useEffect, useRef } from 'react'
import { cloudSaveConfig, cloudLoadConfig, verifyToken } from '@/services/cloudService'
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
        onConfigLoaded(cloudConfig)
      }
      setLastSyncTime(new Date())
    } catch (err) {
      console.error('Failed to load cloud config:', err)
    } finally {
      setSyncing(false)
    }
  }, [onConfigLoaded])


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
        await cloudSaveConfig(auth.token, config)
        setLastSyncTime(new Date())
      } catch (err) {
        console.error('Failed to save config to cloud:', err)
      } finally {
        setSyncing(false)
      }
    }, 2000)
  }, [auth?.token, config])

  // 手动同步
  const sync = useCallback(async () => {
    if (!auth?.token) return

    setSyncing(true)
    try {
      // 先保存本地配置
      await cloudSaveConfig(auth.token, config)
      setLastSyncTime(new Date())
    } catch (err) {
      console.error('Sync failed:', err)
    } finally {
      setSyncing(false)
    }
  }, [auth?.token, config])

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

  return {
    isLoggedIn: !!auth,
    username: auth?.username || null,
    syncing,
    lastSyncTime,
    login,
    logout,
    sync
  }
}

export default useCloudSync
