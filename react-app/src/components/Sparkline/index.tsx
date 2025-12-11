/**
 * Sparkline - 迷你走势图组件
 */
import { useState, useEffect } from 'react'
import { fetchSparklineData, generateSparklinePath, type SparklineData } from '@/services/chartService'
import './Sparkline.css'

interface SparklineProps {
  code: string
  className?: string
}

// 缓存数据
const dataCache = new Map<string, { data: SparklineData | null; time: number }>()
const CACHE_TTL = 300000 // 5分钟缓存

export function Sparkline({ code, className = '' }: SparklineProps) {
  const [data, setData] = useState<SparklineData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    const loadData = async () => {
      // 检查缓存
      const cached = dataCache.get(code)
      if (cached && Date.now() - cached.time < CACHE_TTL) {
        setData(cached.data)
        setLoading(false)
        return
      }

      setLoading(true)
      try {
        const results = await fetchSparklineData([code])
        const sparkData = results.get(code) || null
        
        if (!cancelled) {
          dataCache.set(code, { data: sparkData, time: Date.now() })
          setData(sparkData)
        }
      } catch {
        if (!cancelled) {
          setData(null)
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    loadData()

    return () => {
      cancelled = true
    }
  }, [code])

  if (loading || !data || !data.points || data.points.length < 2) {
    return (
      <svg className={`sparkline ${className}`} viewBox="0 0 50 24">
        <polyline points="" />
      </svg>
    )
  }

  const path = generateSparklinePath(data.points)
  const colorClass = data.isUp ? 'up' : 'down'

  return (
    <svg className={`sparkline ${colorClass} ${className}`} viewBox="0 0 50 24">
      <polyline points={path} />
    </svg>
  )
}

export default Sparkline
