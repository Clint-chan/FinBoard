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
 * 用户注册（需要邮箱验证码）
 */
export async function cloudRegister(email: string, password: string, code: string): Promise<AuthResponse> {
  const res = await fetch(`${SYNC_API}/api/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, code })
  })

  const data = await res.json()
  if (!res.ok) {
    throw new Error((data as ErrorResponse).error || '注册失败')
  }
  // 注册成功后自动登录
  return cloudLogin(email, password)
}

/**
 * 发送注册验证码
 */
export async function sendVerifyCode(email: string): Promise<void> {
  const res = await fetch(`${SYNC_API}/api/send-code`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email })
  })

  const data = await res.json()
  if (!res.ok) {
    throw new Error((data as ErrorResponse).error || '发送验证码失败')
  }
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
  console.log('[CloudService] 云端返回数据:', data)
  console.log('[CloudService] 云端 config:', data.config)
  console.log('[CloudService] 云端 alerts:', data.config?.alerts)
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

/**
 * 修改密码
 */
export async function cloudChangePassword(token: string, oldPassword: string, newPassword: string): Promise<void> {
  if (!token) throw new Error('未登录')

  const res = await fetch(`${SYNC_API}/api/change-password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ oldPassword, newPassword })
  })

  const data = await res.json()
  if (!res.ok) {
    throw new Error((data as ErrorResponse).error || '修改密码失败')
  }
}

/**
 * 找回密码 - 发送验证码
 */
export async function sendResetPasswordCode(email: string): Promise<void> {
  const res = await fetch(`${SYNC_API}/api/reset-password/send-code`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email })
  })

  const data = await res.json()
  if (!res.ok) {
    throw new Error((data as ErrorResponse).error || '发送验证码失败')
  }
}

/**
 * 找回密码 - 重置密码
 */
export async function resetPassword(email: string, code: string, newPassword: string): Promise<void> {
  const res = await fetch(`${SYNC_API}/api/reset-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, code, newPassword })
  })

  const data = await res.json()
  if (!res.ok) {
    throw new Error((data as ErrorResponse).error || '重置密码失败')
  }
}

/**
 * 换绑邮箱 - 发送验证码到新邮箱
 */
export async function sendChangeEmailCode(token: string, newEmail: string): Promise<void> {
  if (!token) throw new Error('未登录')

  const res = await fetch(`${SYNC_API}/api/change-email/send-code`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ newEmail })
  })

  const data = await res.json()
  if (!res.ok) {
    throw new Error((data as ErrorResponse).error || '发送验证码失败')
  }
}

/**
 * 换绑邮箱 - 确认换绑
 */
export async function changeEmail(token: string, newEmail: string, code: string): Promise<AuthResponse> {
  if (!token) throw new Error('未登录')

  const res = await fetch(`${SYNC_API}/api/change-email`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ newEmail, code })
  })

  const data = await res.json()
  if (!res.ok) {
    throw new Error((data as ErrorResponse).error || '换绑邮箱失败')
  }
  return data as AuthResponse
}

/**
 * 获取用户信息
 */
export async function getUserInfo(token: string): Promise<{ username: string; email: string | null; aiQuota: number }> {
  if (!token) throw new Error('未登录')

  const res = await fetch(`${SYNC_API}/api/user/info`, {
    headers: { 'Authorization': `Bearer ${token}` }
  })

  const data = await res.json()
  if (!res.ok) {
    throw new Error((data as ErrorResponse).error || '获取用户信息失败')
  }
  return data
}

/**
 * 绑定邮箱 - 发送验证码（针对没有邮箱的老用户）
 */
export async function sendBindEmailCode(token: string, email: string): Promise<void> {
  if (!token) throw new Error('未登录')

  const res = await fetch(`${SYNC_API}/api/bind-email/send-code`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ email })
  })

  const data = await res.json()
  if (!res.ok) {
    throw new Error((data as ErrorResponse).error || '发送验证码失败')
  }
}

/**
 * 绑定邮箱 - 确认绑定
 */
export async function bindEmail(token: string, email: string, code: string): Promise<{ email: string }> {
  if (!token) throw new Error('未登录')

  const res = await fetch(`${SYNC_API}/api/bind-email`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ email, code })
  })

  const data = await res.json()
  if (!res.ok) {
    throw new Error((data as ErrorResponse).error || '绑定邮箱失败')
  }
  return data
}

export default {
  cloudLogin,
  cloudRegister,
  sendVerifyCode,
  cloudSaveConfig,
  cloudLoadConfig,
  verifyToken,
  cloudChangePassword,
  sendResetPasswordCode,
  resetPassword,
  sendChangeEmailCode,
  changeEmail,
  getUserInfo,
  sendBindEmailCode,
  bindEmail
}
