/**
 * usePriceFlash - 价格闪烁动画 Hook
 * 当价格变化时触发闪烁效果
 */
import { useRef, useEffect, useCallback } from 'react'
import type { StockData } from '@/types'

interface PriceCache {
  [code: string]: number
}

export function usePriceFlash(stockData: Record<string, StockData>) {
  const priceCache = useRef<PriceCache>({})
  const flashTimeouts = useRef<Record<string, number>>({})

  // 检查价格变化并触发闪烁
  const checkPriceChange = useCallback((code: string, newPrice: number): 'up' | 'down' | null => {
    const oldPrice = priceCache.current[code]
    priceCache.current[code] = newPrice

    if (oldPrice === undefined || oldPrice === newPrice) {
      return null
    }

    return newPrice > oldPrice ? 'up' : 'down'
  }, [])

  // 应用闪烁效果到元素
  const applyFlash = useCallback((element: HTMLElement | null, direction: 'up' | 'down') => {
    if (!element) return

    // 移除旧的闪烁类
    element.classList.remove('price-flash-up', 'price-flash-down')

    // 强制重绘
    void element.offsetWidth

    // 添加新的闪烁类
    element.classList.add(`price-flash-${direction}`)

    // 动画结束后移除类
    const handleAnimationEnd = () => {
      element.classList.remove('price-flash-up', 'price-flash-down')
    }
    element.addEventListener('animationend', handleAnimationEnd, { once: true })
  }, [])

  // 获取某个股票的闪烁方向
  const getFlashDirection = useCallback((code: string): 'up' | 'down' | null => {
    const data = stockData[code]
    if (!data?.price) return null
    return checkPriceChange(code, data.price)
  }, [stockData, checkPriceChange])

  // 清理
  useEffect(() => {
    return () => {
      Object.values(flashTimeouts.current).forEach(clearTimeout)
    }
  }, [])

  return {
    getFlashDirection,
    applyFlash,
    checkPriceChange
  }
}

export default usePriceFlash
