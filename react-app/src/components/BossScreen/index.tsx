/**
 * BossScreen - 老板键遮罩组件
 * 按 ESC 显示假 GitHub 页面
 */
import { useEffect, useCallback } from 'react'
import './BossScreen.css'

interface BossScreenProps {
  visible: boolean
  onClose: () => void
  isDark?: boolean
}

// 原始标题和图标
const ORIGINAL_TITLE = 'Fintell'
const ORIGINAL_FAVICON = '/logo.png'
const GITHUB_TITLE = 'GitHub'
const GITHUB_FAVICON = 'https://github.githubassets.com/favicons/favicon.svg'

export function BossScreen({ visible, onClose, isDark = false }: BossScreenProps) {
  // 切换标题和图标
  useEffect(() => {
    if (visible) {
      document.title = GITHUB_TITLE
      const favicon = document.querySelector('link[rel="icon"]') as HTMLLinkElement
      if (favicon) favicon.href = GITHUB_FAVICON
    } else {
      document.title = ORIGINAL_TITLE
      const favicon = document.querySelector('link[rel="icon"]') as HTMLLinkElement
      if (favicon) favicon.href = ORIGINAL_FAVICON
    }
  }, [visible])

  // 监听 iframe 消息
  useEffect(() => {
    const handleMessage = (e: MessageEvent) => {
      if (e.data?.type === 'closeBossScreen') {
        onClose()
      }
    }
    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [onClose])

  // 监听 ESC 键（在主窗口）
  useEffect(() => {
    if (!visible) return
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        onClose()
      }
    }
    
    // 使用 capture 阶段捕获，优先级更高
    document.addEventListener('keydown', handleKeyDown, true)
    return () => document.removeEventListener('keydown', handleKeyDown, true)
  }, [visible, onClose])

  // 同步主题到 iframe 并设置焦点
  const handleIframeLoad = useCallback((iframe: HTMLIFrameElement | null) => {
    if (iframe?.contentWindow && visible) {
      // 发送主题消息
      iframe.contentWindow.postMessage({ type: 'theme', theme: isDark ? 'dark' : 'light' }, '*')
      // 设置焦点到 iframe，确保可以接收键盘事件
      setTimeout(() => {
        iframe.focus()
      }, 100)
    }
  }, [visible, isDark])

  if (!visible) return null

  return (
    <div className="boss-screen">
      <iframe
        ref={handleIframeLoad}
        src="/github-fake.html"
        title="GitHub"
        className="boss-iframe"
        tabIndex={0}
      />
      <div className="boss-hint">
        按 <kbd>ESC</kbd> 返回
      </div>
    </div>
  )
}

export default BossScreen
