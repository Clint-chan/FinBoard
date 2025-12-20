// 判断是否为 ETF（上海51开头，深圳15/16开头）
export function isETF(code: string): boolean {
  const symbol = code.replace(/^(sh|sz)/, '')
  if (code.startsWith('sh') && symbol.startsWith('51')) return true
  if (code.startsWith('sz') && (symbol.startsWith('15') || symbol.startsWith('16'))) return true
  return false
}

// 检查是否为有效数字
function isValidNum(n: unknown): n is number {
  return typeof n === 'number' && !isNaN(n) && isFinite(n)
}

// 格式化数字（默认2位小数）
export function fmtNum(n: number | undefined | null): string {
  if (n === 0) return '0.00'
  if (!isValidNum(n)) return '--'
  return n.toFixed(2)
}

// 格式化价格（ETF 3位小数，其他2位）
export function fmtPrice(n: number | undefined | null, code?: string): string {
  if (!isValidNum(n)) return '--'
  const digits = code && isETF(code) ? 3 : 2
  return n.toFixed(digits)
}

// 格式化成交量
export function fmtVol(n: number | undefined | null): string {
  if (!isValidNum(n) || n === 0) return '--'
  return n >= 1e8 ? (n / 1e8).toFixed(2) + '亿' : n >= 1e4 ? (n / 1e4).toFixed(0) + '万' : n.toLocaleString()
}

// 格式化成交额
export function fmtAmt(n: number | undefined | null): string {
  if (!isValidNum(n) || n === 0) return '--'
  return n >= 1e8 ? (n / 1e8).toFixed(2) + '亿' : (n / 1e4).toFixed(0) + '万'
}

// 计算涨跌幅
export function calcPct(price: number | undefined, preClose: number | undefined): number {
  if (!isValidNum(preClose) || !isValidNum(price) || preClose === 0) return 0
  return (price - preClose) / preClose
}

// 获取涨跌样式类
export function getPctClass(pct: number): 'up' | 'down' | 'flat' {
  if (pct > 0) return 'up'
  if (pct < 0) return 'down'
  return 'flat'
}


// 发送浏览器通知
export function sendNotification(title: string, body: string): void {
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification(title, { body })
  }
}

// 请求通知权限
export function requestNotificationPermission(): void {
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission()
  }
}

// A股市场状态
export type MarketStatus = 
  | 'closed'      // 休市（周末、节假日、非交易时段）
  | 'pre-auction' // 集合竞价 9:15-9:25
  | 'pre-open'    // 竞价结果展示 9:25-9:30（不能撤单）
  | 'trading'     // 连续竞价（交易中）9:30-11:30, 13:00-15:00
  | 'lunch'       // 午间休市 11:30-13:00
  | 'post-close'  // 盘后 15:00-15:30（可查看收盘数据）

// 获取 A 股市场状态
export function getMarketStatus(): MarketStatus {
  const now = new Date()
  const day = now.getDay()
  
  // 周末休市
  if (day === 0 || day === 6) return 'closed'
  
  const time = now.getHours() * 60 + now.getMinutes()
  
  // 时间节点（分钟）
  const preAuctionStart = 9 * 60 + 15   // 9:15 集合竞价开始
  const preAuctionEnd = 9 * 60 + 25     // 9:25 集合竞价结束
  const preOpenEnd = 9 * 60 + 30        // 9:30 开盘
  const morningEnd = 11 * 60 + 30       // 11:30 上午收盘
  const afternoonStart = 13 * 60        // 13:00 下午开盘
  const afternoonEnd = 15 * 60          // 15:00 收盘
  const postCloseEnd = 15 * 60 + 30     // 15:30 盘后结束
  
  if (time >= preAuctionStart && time < preAuctionEnd) return 'pre-auction'
  if (time >= preAuctionEnd && time < preOpenEnd) return 'pre-open'
  if (time >= preOpenEnd && time <= morningEnd) return 'trading'
  if (time > morningEnd && time < afternoonStart) return 'lunch'
  if (time >= afternoonStart && time <= afternoonEnd) return 'trading'
  if (time > afternoonEnd && time <= postCloseEnd) return 'post-close'
  
  return 'closed'
}

// 获取市场状态显示文本
export function getMarketStatusText(): string {
  const status = getMarketStatus()
  switch (status) {
    case 'pre-auction': return '集合竞价'
    case 'pre-open': return '等待开盘'
    case 'trading': return '交易中'
    case 'lunch': return '午间休市'
    case 'post-close': return '已收盘'
    case 'closed': return '休市'
  }
}

// 判断是否应该自动刷新行情（集合竞价开始后都应该刷新）
export function shouldAutoRefresh(): boolean {
  const status = getMarketStatus()
  return status === 'pre-auction' || status === 'pre-open' || status === 'trading'
}

// 判断当前是否为 A 股交易时间（兼容旧接口）
export function isMarketOpen(): boolean {
  return getMarketStatus() === 'trading'
}
