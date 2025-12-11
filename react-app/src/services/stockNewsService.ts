/**
 * 股票新闻服务 - 基于东方财富接口
 */

export interface StockNews {
  title: string        // 新闻标题
  content: string      // 新闻内容摘要
  publishTime: string  // 发布时间
  source: string       // 文章来源
  url: string          // 新闻链接
}

/**
 * 获取个股新闻 - 东方财富接口
 * 最近 100 条新闻
 */
export async function fetchStockNews(code: string): Promise<StockNews[]> {
  const symbol = code.replace(/^(sh|sz)/, '')
  
  const url = 'https://search-api-web.eastmoney.com/search/jsonp'
  
  const innerParam = {
    uid: '',
    keyword: symbol,
    type: ['cmsArticleWebOld'],
    client: 'web',
    clientType: 'web',
    clientVersion: 'curr',
    param: {
      cmsArticleWebOld: {
        searchScope: 'default',
        sort: 'default',
        pageIndex: 1,
        pageSize: 20, // 获取最近 20 条
        preTag: '<em>',
        postTag: '</em>'
      }
    }
  }
  
  const timestamp = Date.now()
  const params = new URLSearchParams({
    cb: `jQuery${timestamp}`,
    param: JSON.stringify(innerParam),
    _: String(timestamp)
  })

  const response = await fetch(`${url}?${params}`)
  const text = await response.text()
  
  // 移除 JSONP 包装
  const jsonText = text.replace(/^jQuery\d+\(/, '').replace(/\)$/, '')
  const data = JSON.parse(jsonText)
  
  if (!data.result?.cmsArticleWebOld) {
    return []
  }

  const newsList: StockNews[] = data.result.cmsArticleWebOld.map((item: any) => {
    // 清理 HTML 标签
    const cleanText = (str: string) => {
      return str
        .replace(/<em>/g, '')
        .replace(/<\/em>/g, '')
        .replace(/\(<em>/g, '')
        .replace(/<\/em>\)/g, '')
        .replace(/\u3000/g, '')
        .replace(/\r\n/g, ' ')
        .trim()
    }

    return {
      title: cleanText(item.title || ''),
      content: cleanText(item.content || ''),
      publishTime: item.date || '',
      source: item.mediaName || '',
      url: `http://finance.eastmoney.com/a/${item.code}.html`
    }
  })

  return newsList
}

// 缓存机制
const newsCache = new Map<string, { data: StockNews[]; time: number }>()
const CACHE_DURATION = 300000 // 5分钟缓存

/**
 * 获取个股新闻（带缓存）
 */
export async function fetchStockNewsCached(code: string): Promise<StockNews[]> {
  const cached = newsCache.get(code)
  if (cached && Date.now() - cached.time < CACHE_DURATION) {
    return cached.data
  }
  
  const data = await fetchStockNews(code)
  newsCache.set(code, { data, time: Date.now() })
  return data
}
