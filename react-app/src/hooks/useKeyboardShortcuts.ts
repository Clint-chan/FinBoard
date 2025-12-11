/**
 * useKeyboardShortcuts - 快捷键系统 Hook
 */
import { useEffect, useCallback } from 'react'

interface ShortcutHandlers {
  onRefresh?: () => void
  onSettings?: () => void
  onBossKey?: () => void
  onAddStock?: () => void
  onEscape?: () => void
}

export function useKeyboardShortcuts(handlers: ShortcutHandlers) {
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // 如果在输入框中，不处理快捷键
    const target = e.target as HTMLElement
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') {
      // 但 Escape 键仍然处理
      if (e.key !== 'Escape') return
    }

    switch (e.key) {
      case 'Escape':
        // 老板键优先级最高
        handlers.onEscape?.()
        break

      case 'r':
      case 'R':
        // 刷新数据
        if (!e.ctrlKey && !e.metaKey) {
          e.preventDefault()
          handlers.onRefresh?.()
        }
        break

      case 's':
      case 'S':
        // 打开设置
        if (!e.ctrlKey && !e.metaKey) {
          e.preventDefault()
          handlers.onSettings?.()
        }
        break

      case 'a':
      case 'A':
        // 添加股票
        if (!e.ctrlKey && !e.metaKey) {
          e.preventDefault()
          handlers.onAddStock?.()
        }
        break
    }
  }, [handlers])

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])
}

export default useKeyboardShortcuts
