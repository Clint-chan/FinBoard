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
 * 获取股吧评论 - 百度股市通接口
 */
export async function fetchStockComments(code: string): Promise<StockComment[]> {
  const symbol = code.replace(/^(sh|sz)/, '')
  
  // 判断市场代码
  const market = symbol.startsWith('6') ? 'ab' : 'ab'
  
  const url = 'https://finance.pae.baidu.com/api/stockwidget'
  const params = new URLSearchParams({
    code: symbol,
    market: market,
    type: 'stock',
    widgetType: 'talks',
    finClientType: 'pc'
  })

  try {
    const response = await fetch(`${url}?${params}`)
    const data = await response.json()
    
    if (data.ResultCode !== '0' || !data.Result?.content?.list) {
      return []
    }

    const comments: StockComment[] = data.Result.content.list.map((item: any) => {
      // 提取文本内容
      let content = ''
      if (item.content?.items) {
        content = item.content.items
          .filter((i: any) => i.type === 'text')
          .map((i: any) => i.data)
          .join('')
      }

      return {
        id: item.comment_id || item.reply_id || '',
        content: content.trim(),
        author: {
          name: item.author?.name || '匿名用户',
          avatar: item.author?.image?.src || ''
        },
        source: item.provider || '股吧',
        createTime: item.create_show_time || item.publish_time || '',
        likeCount: parseInt(item.like_count || '0'),
        replyCount: parseInt(item.reply_count || '0'),
        url: item.loc || item.third_url || item.real_loc || ''
      }
    }).filter((c: StockComment) => c.content.length > 0) // 过滤空评论

    return comments
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
