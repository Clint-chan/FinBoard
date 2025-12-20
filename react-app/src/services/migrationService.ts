/**
 * 数据迁移服务
 * 负责将旧版数据格式迁移到新版
 */
import type { AlertConfig, AlertCondition } from '@/types'

// 旧版预警格式（简单的 above/below 数值）
interface LegacyAlertConfig {
  above?: number
  below?: number
}

// 旧版配置格式
interface LegacyUserConfig {
  codes?: string[]
  interval?: number
  pctThreshold?: number
  alerts?: Record<string, LegacyAlertConfig | AlertConfig>
  costs?: Record<string, number>
  theme?: 'light' | 'dark' | 'auto'
}

const CONFIG_KEY = 'market_board_config'
const MIGRATION_FLAG_KEY = 'market_board_migration_v2'

/**
 * 检查是否是旧版预警格式
 */
function isLegacyAlert(alert: unknown): alert is LegacyAlertConfig {
  if (!alert || typeof alert !== 'object') return false
  const a = alert as Record<string, unknown>
  // 旧版格式：{ above?: number, below?: number }
  // 新版格式：{ conditions: AlertCondition[] }
  return (
    !('conditions' in a) &&
    (typeof a.above === 'number' || typeof a.below === 'number')
  )
}

/**
 * 将旧版预警转换为新版格式
 */
function convertLegacyAlert(legacy: LegacyAlertConfig): AlertConfig {
  const conditions: AlertCondition[] = []
  
  if (typeof legacy.above === 'number' && legacy.above > 0) {
    conditions.push({
      type: 'price',
      operator: 'above',
      value: legacy.above,
      note: '从旧版迁移'
    })
  }
  
  if (typeof legacy.below === 'number' && legacy.below > 0) {
    conditions.push({
      type: 'price',
      operator: 'below',
      value: legacy.below,
      note: '从旧版迁移'
    })
  }
  
  return { conditions }
}

/**
 * 迁移预警数据
 */
function migrateAlerts(
  alerts: Record<string, LegacyAlertConfig | AlertConfig>
): Record<string, AlertConfig> {
  const migrated: Record<string, AlertConfig> = {}
  let migratedCount = 0
  
  for (const [code, alert] of Object.entries(alerts)) {
    if (isLegacyAlert(alert)) {
      migrated[code] = convertLegacyAlert(alert)
      migratedCount++
      console.log(`[Migration] 迁移预警: ${code}`, alert, '->', migrated[code])
    } else if (alert && 'conditions' in alert) {
      // 已经是新版格式
      migrated[code] = alert as AlertConfig
    }
  }
  
  if (migratedCount > 0) {
    console.log(`[Migration] 共迁移 ${migratedCount} 个预警`)
  }
  
  return migrated
}

/**
 * 迁移配置对象（用于云端同步下来的数据）
 * 返回迁移后的配置，如果没有需要迁移的内容则返回原配置
 */
export function migrateConfig<T extends { alerts?: Record<string, unknown> }>(config: T): T {
  console.log('[Migration] 输入配置:', config)
  console.log('[Migration] alerts 字段:', config.alerts)
  
  if (!config.alerts || Object.keys(config.alerts).length === 0) {
    console.log('[Migration] alerts 为空，跳过迁移')
    return config
  }
  
  // 检查每个 alert 的格式
  for (const [code, alert] of Object.entries(config.alerts)) {
    console.log(`[Migration] ${code}:`, alert, '是旧版格式:', isLegacyAlert(alert))
  }
  
  const hasLegacy = Object.values(config.alerts).some(isLegacyAlert)
  if (!hasLegacy) {
    console.log('[Migration] 没有旧版格式，跳过迁移')
    return config
  }
  
  console.log('[Migration] 检测到旧版预警格式，开始迁移...')
  const migratedAlerts = migrateAlerts(config.alerts as Record<string, LegacyAlertConfig | AlertConfig>)
  
  return {
    ...config,
    alerts: migratedAlerts
  }
}

/**
 * 执行数据迁移
 * 在应用启动时调用，自动检测并迁移旧版数据
 */
export function runMigration(): boolean {
  // 检查是否已经迁移过
  const migrated = localStorage.getItem(MIGRATION_FLAG_KEY)
  if (migrated === 'done') {
    return false
  }
  
  try {
    const raw = localStorage.getItem(CONFIG_KEY)
    if (!raw) {
      // 没有配置数据，标记为已迁移
      localStorage.setItem(MIGRATION_FLAG_KEY, 'done')
      return false
    }
    
    const config = JSON.parse(raw) as LegacyUserConfig
    let needsSave = false
    
    // 迁移预警数据
    if (config.alerts && Object.keys(config.alerts).length > 0) {
      const hasLegacy = Object.values(config.alerts).some(isLegacyAlert)
      if (hasLegacy) {
        config.alerts = migrateAlerts(config.alerts)
        needsSave = true
      }
    }
    
    // 保存迁移后的配置
    if (needsSave) {
      localStorage.setItem(CONFIG_KEY, JSON.stringify(config))
      console.log('[Migration] 配置已更新')
    }
    
    // 标记迁移完成
    localStorage.setItem(MIGRATION_FLAG_KEY, 'done')
    return needsSave
  } catch (error) {
    console.error('[Migration] 迁移失败:', error)
    return false
  }
}

/**
 * 重置迁移标记（用于测试）
 */
export function resetMigrationFlag(): void {
  localStorage.removeItem(MIGRATION_FLAG_KEY)
}

/**
 * 获取迁移状态
 */
export function getMigrationStatus(): 'pending' | 'done' | 'error' {
  const flag = localStorage.getItem(MIGRATION_FLAG_KEY)
  if (flag === 'done') return 'done'
  if (flag === 'error') return 'error'
  return 'pending'
}

export default {
  runMigration,
  migrateConfig,
  resetMigrationFlag,
  getMigrationStatus
}
