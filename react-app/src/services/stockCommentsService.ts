/**
 * 股吧评论服务 - 基于百度股市通接口
 */

export interface StockComment {
  id: string
  content: string
  author: {
    name: string
    avatar: string
  }
  source: string       // 来源：东方财富等
  createTime: string   // 发布时间
  likeCount: number    // 点赞数
  replyCount: number   // 回复数
  url: string          // 原帖链接
}

/**
 * 获取股吧评论 - 通过 Cloudflare Worker 代理
 */
export async function fetchStockComments(code: string): Promise<StockComment[]> {
  const symbol = code.replace(/^(sh|sz)/, '')
  
  // 使用 Worker 代理接口
  const apiUrl = 'https://market-api.newestgpt.com/api/stock/comments/' + symbol
  
  try {
    const response = await fetch(apiUrl)
    
    if (!response.ok) {
      console.error('Failed to fetch comments:', response.status)
      return []
    }

    const data = await response.json()
    return data.comments || []
  } catch (error) {
    console.error('Failed to fetch stock comments:', error)
    return []
  }
}

// 缓存机制
const commentsCache = new Map<string, { data: StockComment[]; time: number }>()
const CACHE_DURATION = 180000 // 3分钟缓存

/**
 * 获取股吧评论（带缓存）
 */
export async function fetchStockCommentsCached(code: string): Promise<StockComment[]> {
  const cached = commentsCache.get(code)
  if (cached && Date.now() - cached.time < CACHE_DURATION) {
    return cached.data
  }
  
  const data = await fetchStockComments(code)
  commentsCache.set(code, { data, time: Date.now() })
  return data
}
