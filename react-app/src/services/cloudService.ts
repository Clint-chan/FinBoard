/**
 * 云同步服务
 * 提供登录、注册、配置同步功能
 */
import type { UserConfig } from '@/types'

// 云同步 API 地址
const SYNC_API = 'https://market-api.newestgpt.com'

// 认证响应
export interface AuthResponse {
  token: string
  username: string
}

// 错误响应
interface ErrorResponse {
  error: string
}

/**
 * 用户登录
 */
export async function cloudLogin(username: string, password: string): Promise<AuthResponse> {
  const res = await fetch(`${SYNC_API}/api/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  })
  
  const data = await res.json()
  if (!res.ok) {
    throw new Error((data as ErrorResponse).error || '登录失败')
  }
  return data as AuthResponse
}

/**
 * 用户注册
 */
export async function cloudRegister(username: string, password: string): Promise<AuthResponse> {
  const res = await fetch(`${SYNC_API}/api/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  })
  
  const data = await res.json()
  if (!res.ok) {
    throw new Error((data as ErrorResponse).error || '注册失败')
  }
  return data as AuthResponse
}


/**
 * 保存配置到云端
 */
export async function cloudSaveConfig(token: string, config: Partial<UserConfig>): Promise<void> {
  if (!token) return
  
  await fetch(`${SYNC_API}/api/config`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ config })
  })
}

/**
 * 从云端加载配置
 */
export async function cloudLoadConfig(token: string): Promise<Partial<UserConfig> | null> {
  if (!token) return null
  
  const res = await fetch(`${SYNC_API}/api/config`, {
    headers: { 'Authorization': `Bearer ${token}` }
  })
  
  if (!res.ok) return null
  
  const data = await res.json()
  return data.config || null
}

/**
 * 验证 Token 是否有效
 */
export async function verifyToken(token: string): Promise<boolean> {
  if (!token) return false
  
  try {
    const res = await fetch(`${SYNC_API}/api/config`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    return res.ok
  } catch {
    return false
  }
}

export default {
  cloudLogin,
  cloudRegister,
  cloudSaveConfig,
  cloudLoadConfig,
  verifyToken
}
