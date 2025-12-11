// 格式化数字
export function fmtNum(n: number | undefined | null): string {
  return (n || n === 0) ? Number(n).toFixed(2) : '--'
}

// 格式化成交量
export function fmtVol(n: number | undefined | null): string {
  if (!n) return '--'
  return n >= 1e8 ? (n / 1e8).toFixed(2) + '亿' : n >= 1e4 ? (n / 1e4).toFixed(0) + '万' : n.toLocaleString()
}

// 格式化成交额
export function fmtAmt(n: number | undefined | null): string {
  return !n ? '--' : n >= 1e8 ? (n / 1e8).toFixed(2) + '亿' : (n / 1e4).toFixed(0) + '万'
}

// 计算涨跌幅
export function calcPct(price: number | undefined, preClose: number | undefined): number {
  if (!preClose || !price) return 0
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

// 判断当前是否为 A 股交易时间
// 交易时间：周一至周五 9:30-11:30, 13:00-15:00
export function isMarketOpen(): boolean {
  const now = new Date()
  const day = now.getDay()
  
  // 周末不开盘
  if (day === 0 || day === 6) return false
  
  const hours = now.getHours()
  const minutes = now.getMinutes()
  const time = hours * 60 + minutes // 转换为分钟数便于比较
  
  // 上午 9:30 - 11:30 (570 - 690)
  // 下午 13:00 - 15:00 (780 - 900)
  const morningStart = 9 * 60 + 30  // 9:30
  const morningEnd = 11 * 60 + 30   // 11:30
  const afternoonStart = 13 * 60     // 13:00
  const afternoonEnd = 15 * 60       // 15:00
  
  return (time >= morningStart && time <= morningEnd) ||
         (time >= afternoonStart && time <= afternoonEnd)
}
