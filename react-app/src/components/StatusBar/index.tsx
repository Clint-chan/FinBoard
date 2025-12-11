import type { LoadingStatus } from '@/types'
import './StatusBar.css'

interface StatusBarProps {
  status: LoadingStatus
  lastUpdate: Date | null
}

function StatusBar({ status, lastUpdate }: StatusBarProps) {
  const getStatusText = () => {
    switch (status) {
      case 'loading': return '更新中...'
      case 'success': return '实时监控中'
      case 'closed': return '休市中'
      case 'error': return '数据获取失败'
      default: return '初始化中...'
    }
  }

  const getStatusClass = () => {
    switch (status) {
      case 'loading': return 'loading'
      case 'success': return 'active'
      case 'error': return 'error'
      default: return ''
    }
  }

  const formatTime = (date: Date | null) => {
    if (!date) return '--:--:--'
    return '更新: ' + date.toLocaleTimeString()
  }

  return (
    <div className="status-bar">
      <div className="status-left">
        <span className={`status-dot ${getStatusClass()}`}></span>
        <span>{getStatusText()}</span>
      </div>
      <div className="status-right">
        {formatTime(lastUpdate)}
      </div>
    </div>
  )
}

export default StatusBar
