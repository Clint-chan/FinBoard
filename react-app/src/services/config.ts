import type { UserConfig } from '@/types'

// 云同步 API 地址
export const SYNC_API = 'https://market-api.newestgpt.com'

// 默认配置
export const DEFAULT_CONFIG: UserConfig = {
  codes: ['sh600054', 'sz159855', 'sh600233'],
  interval: 5,
  pctThreshold: 5,
  alerts: {},
  costs: {},
  theme: 'auto',
  refreshOnlyInMarketHours: true // 默认仅在交易时间刷新
}

// 预设头像列表
export const AVATARS = [
  'assets/image/1bdad17b3d2cc5cd26215f6e316b85e5.jpeg',
  'assets/image/540da47b31f230d37870b722d116e596.jpeg',
  'assets/image/6acbc1dfa9534d340bad2f5bb49cf5f2.jpeg',
  'assets/image/fc85b7ec2cec9d3be8aa27e954bd1978.jpeg',
]
