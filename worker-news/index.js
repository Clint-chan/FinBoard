// Cloudflare Worker - 中国新闻爬取定时任务
// 每30分钟从 buzzing.cc 爬取中国相关新闻，存入 D1 数据库
// 每天下午5点获取A股复盘数据

import { fetchReviewData, storeReviewData, getStoredReview, getReviewByDate, listReviews } from './reviews.js';

/**
 * 初始化数据库表
 * 简化结构：id, title, summary, published_at, created_at
 */
async function initDB(db) {
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS daily_news (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      summary TEXT,
      published_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `).run();
  
  await db.prepare(`
    CREATE INDEX IF NOT EXISTS idx_news_published ON daily_news(published_at DESC)
  `).run();
}

/**
 * 爬取并存储中国新闻
 */
async function fetchAndStoreNews(env) {
  if (!env.DB) {
    console.error('D1 数据库未配置');
    return { success: false, error: 'DB not configured' };
  }
  
  console.log('开始爬取新闻...');
  
  try {
    await initDB(env.DB);
    
    // 爬取 buzzing.cc
    const response = await fetch('https://china.buzzing.cc/', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const html = await response.text();
    const news = parseNewsFromHTML(html);
    
    console.log(`解析到 ${news.length} 条新闻`);

    // 批量插入数据库
    let insertedCount = 0;
    let skippedCount = 0;
    
    for (const item of news) {
      try {
        const result = await env.DB.prepare(`
          INSERT OR IGNORE INTO daily_news (id, title, summary, published_at)
          VALUES (?, ?, ?, ?)
        `).bind(
          item.id,
          item.title,
          item.summary,
          item.publishedAt
        ).run();
        
        // 安全检查 result.meta
        const changes = result?.meta?.changes ?? result?.changes ?? 0;
        if (changes > 0) {
          insertedCount++;
        } else {
          skippedCount++;
        }
      } catch (e) {
        console.error('插入新闻失败:', item.title, e);
        skippedCount++;
      }
    }
    
    console.log(`完成: 新增 ${insertedCount} 条, 跳过 ${skippedCount} 条重复`);
    return { success: true, inserted: insertedCount, skipped: skippedCount, total: news.length };
  } catch (e) {
    console.error('爬取新闻失败:', e);
    return { success: false, error: e.message };
  }
}

/**
 * 从 HTML 解析新闻数据
 * buzzing.cc 的实际结构：
 * <article class="card article h-entry hentry">
 *   <a class="p-name entry-title bold no-underline u-url" href="...">标题</a>
 *   <div class="p-summary ..."><div>摘要 (link)</div><footer><time datetime="..."></footer></div>
 * </article>
 */
function parseNewsFromHTML(html) {
  const news = [];
  const seen = new Set(); // 用于去重：time + summary
  
  // 匹配 article 块（class 包含 card 和 article）
  const articleRegex = /<article[^>]*class="[^"]*card[^"]*article[^"]*"[^>]*>([\s\S]*?)<\/article>/gi;
  let articleMatch;
  
  while ((articleMatch = articleRegex.exec(html)) !== null) {
    const articleHtml = articleMatch[1];
    
    try {
      // 提取标题和链接 - class="p-name entry-title ..."
      const titleMatch = articleHtml.match(/<a[^>]*class="[^"]*p-name[^"]*"[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/i);
      if (!titleMatch) continue;
      
      const sourceUrl = titleMatch[1];
      // 标题可能包含 <span>序号</span>，需要清理
      let title = titleMatch[2].replace(/<[^>]*>/g, '').trim();
      title = decodeHTMLEntities(title);
      // 去掉标题前的序号（如 "1. "、"12. "）
      title = title.replace(/^\d+\.\s*/, '');
      
      // 提取摘要 - p-summary 内的第一个 div
      let summary = '';
      const summaryMatch = articleHtml.match(/<div[^>]*class="[^"]*p-summary[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
      if (summaryMatch) {
        // 提取括号前的英文原文
        const innerMatch = summaryMatch[1].match(/<div[^>]*>([^<(]+)/i);
        if (innerMatch) {
          summary = decodeHTMLEntities(innerMatch[1].trim());
        }
      }
      
      // 提取时间 - <time class="dt-published published" datetime="...">
      const timeMatch = articleHtml.match(/<time[^>]*datetime="([^"]*)"[^>]*>/i);
      const publishedAt = timeMatch ? timeMatch[1] : null;
      
      // 去重：time + summary 相同则跳过
      const dedupeKey = `${publishedAt}|${summary}`;
      if (seen.has(dedupeKey)) {
        continue;
      }
      seen.add(dedupeKey);
      
      // 用 time + summary 生成唯一 ID（更稳定的去重）
      const id = generateNewsId(summary, publishedAt);
      
      if (title && publishedAt) {
        news.push({ id, title, summary, publishedAt });
      }
    } catch (e) {
      continue;
    }
  }
  
  return news;
}

/**
 * 生成新闻唯一 ID（基于 summary + time）
 */
function generateNewsId(summary, publishedAt) {
  const str = `${summary}-${publishedAt}`;
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return `news_${Math.abs(hash).toString(36)}`;
}

/**
 * 解码 HTML 实体
 */
function decodeHTMLEntities(text) {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

/**
 * UTC 时间转北京时间 (UTC+8)
 * 输入: ISO 格式 "2025-12-23T10:02:06.000Z"
 * 输出: "2025-12-23 18:02:06"
 */
function utcToBeijing(utcStr) {
  if (!utcStr) return '';
  try {
    const date = new Date(utcStr);
    // 加8小时
    const beijingTime = new Date(date.getTime() + 8 * 60 * 60 * 1000);
    // 格式化为 YYYY-MM-DD HH:mm:ss
    const year = beijingTime.getUTCFullYear();
    const month = String(beijingTime.getUTCMonth() + 1).padStart(2, '0');
    const day = String(beijingTime.getUTCDate()).padStart(2, '0');
    const hours = String(beijingTime.getUTCHours()).padStart(2, '0');
    const minutes = String(beijingTime.getUTCMinutes()).padStart(2, '0');
    const seconds = String(beijingTime.getUTCSeconds()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  } catch (e) {
    return utcStr;
  }
}

/**
 * 北京时间转 UTC ISO 格式
 * 输入: "2025-12-23 18:02:06" (北京时间)
 * 输出: "2025-12-23T10:02:06.000Z" (UTC)
 */
function beijingToUtc(beijingStr) {
  if (!beijingStr) return '';
  try {
    // 解析北京时间字符串
    const [datePart, timePart] = beijingStr.split(' ');
    const [year, month, day] = datePart.split('-').map(Number);
    const [hours, minutes, seconds] = (timePart || '00:00:00').split(':').map(Number);
    
    // 创建 UTC 时间（北京时间减8小时）
    const utcDate = new Date(Date.UTC(year, month - 1, day, hours - 8, minutes, seconds || 0));
    return utcDate.toISOString();
  } catch (e) {
    return beijingStr;
  }
}

// CORS 头
function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  };
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders() }
  });
}

// ============ Worker 导出 ============

export default {
  // HTTP 请求处理（可选：提供 API 接口）
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders() });
    }
    
    const url = new URL(request.url);
    const path = url.pathname;
    
    // GET /news - 获取新闻列表
    // 参数: limit, offset, date(按日期), since(最早时间，北京时间格式)
    if (path === '/news' && request.method === 'GET') {
      const limit = parseInt(url.searchParams.get('limit') || '50');
      const offset = parseInt(url.searchParams.get('offset') || '0');
      const date = url.searchParams.get('date'); // 按日期筛选 YYYY-MM-DD
      const since = url.searchParams.get('since'); // 最早时间 YYYY-MM-DD HH:mm:ss (北京时间)
      
      if (!env.DB) {
        return jsonResponse({ error: '数据库未配置' }, 500);
      }
      
      try {
        await initDB(env.DB);
        
        let query, params;
        if (date) {
          // 按日期筛选
          query = `
            SELECT title, summary, published_at
            FROM daily_news 
            WHERE date(published_at, '+8 hours') = ?
            ORDER BY published_at DESC 
            LIMIT ? OFFSET ?
          `;
          params = [date, limit, offset];
        } else if (since) {
          // 按最早时间筛选（since 是北京时间，需要转为 UTC 比较）
          // 北京时间减8小时 = UTC
          const sinceUtc = beijingToUtc(since);
          query = `
            SELECT title, summary, published_at
            FROM daily_news 
            WHERE published_at >= ?
            ORDER BY published_at DESC 
            LIMIT ? OFFSET ?
          `;
          params = [sinceUtc, limit, offset];
        } else {
          query = `
            SELECT title, summary, published_at
            FROM daily_news 
            ORDER BY published_at DESC 
            LIMIT ? OFFSET ?
          `;
          params = [limit, offset];
        }
        
        const result = await env.DB.prepare(query).bind(...params).all();
        
        // 转换为简洁格式：时间(北京时间) + 标题 + 摘要
        const news = (result.results || []).map(item => ({
          time: utcToBeijing(item.published_at),
          title: item.title,
          summary: item.summary || ''
        }));
        
        return jsonResponse({ news, total: news.length });
      } catch (e) {
        console.error('获取新闻失败:', e);
        return jsonResponse({ error: '获取新闻失败' }, 500);
      }
    }
    
    // POST /fetch - 手动触发爬取
    if (path === '/fetch' && request.method === 'POST') {
      const result = await fetchAndStoreNews(env);
      return jsonResponse(result);
    }
    
    // GET /stats - 统计信息
    if (path === '/stats' && request.method === 'GET') {
      if (!env.DB) {
        return jsonResponse({ error: '数据库未配置' }, 500);
      }
      
      try {
        const total = await env.DB.prepare('SELECT COUNT(*) as count FROM daily_news').first();
        const today = await env.DB.prepare(`
          SELECT COUNT(*) as count FROM daily_news 
          WHERE date(published_at, '+8 hours') = date('now', '+8 hours')
        `).first();
        const latest = await env.DB.prepare(`
          SELECT published_at FROM daily_news ORDER BY published_at DESC LIMIT 1
        `).first();
        
        return jsonResponse({
          totalNews: total?.count || 0,
          todayNews: today?.count || 0,
          latestTime: utcToBeijing(latest?.published_at)
        });
      } catch (e) {
        return jsonResponse({ error: e.message }, 500);
      }
    }
    
    // ============ 复盘相关接口 ============
    
    // GET /review - 获取复盘数据
    // 参数: id (可选) 或 date (可选，格式 YYYY-MM-DD)
    if (path === '/review' && request.method === 'GET') {
      const newsId = url.searchParams.get('id');
      const date = url.searchParams.get('date'); // 新增：按日期查询
      
      // 按日期查询
      if (env.DB && date) {
        const stored = await getReviewByDate(env.DB, date);
        if (stored.success) {
          return jsonResponse({ 
            success: true, 
            id: stored.id,
            date: stored.date,
            markdown: stored.markdown, 
            cached: true 
          });
        }
        return jsonResponse({ success: false, error: `No review found for date: ${date}` }, 404);
      }
      
      // 按 ID 查询（先尝试从数据库获取）
      if (env.DB && newsId) {
        const stored = await getStoredReview(env.DB, newsId);
        if (stored.success) {
          return jsonResponse({ 
            success: true, 
            newsId,
            date: stored.date,
            markdown: stored.markdown, 
            cached: true 
          });
        }
      }
      
      // 实时获取
      const result = await fetchReviewData(newsId);
      if (result.success && env.DB) {
        // 存储到数据库
        const storeResult = await storeReviewData(env.DB, result.newsId, result.markdown);
        return jsonResponse({ ...result, date: storeResult.date });
      }
      return jsonResponse(result);
    }
    
    // POST /review/fetch - 手动触发复盘数据获取
    if (path === '/review/fetch' && request.method === 'POST') {
      const result = await fetchReviewData();
      if (result.success && env.DB) {
        const storeResult = await storeReviewData(env.DB, result.newsId, result.markdown);
        console.log('Store result:', storeResult);
        return jsonResponse({ 
          ...result, 
          stored: storeResult.success,
          storeError: storeResult.error,
          date: storeResult.date
        });
      }
      if (!env.DB) {
        return jsonResponse({ ...result, stored: false, error: 'DB not configured' });
      }
      return jsonResponse(result);
    }
    
    // POST /review/backfill - 批量补全历史数据
    // 参数: days (可选，默认30天)
    if (path === '/review/backfill' && request.method === 'POST') {
      if (!env.DB) {
        return jsonResponse({ error: 'DB not configured' }, 500);
      }
      
      try {
        const body = await request.json().catch(() => ({}));
        const days = parseInt(body.days) || 30;
        
        console.log(`开始补全最近 ${days} 天的复盘数据...`);
        
        // 生成日期范围（跳过周末）
        const dates = [];
        const now = new Date();
        
        for (let i = 0; i < days * 2; i++) { // *2 确保有足够的工作日
          const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
          const beijingTime = new Date(date.getTime() + 8 * 60 * 60 * 1000);
          const dayOfWeek = beijingTime.getUTCDay();
          
          // 跳过周末
          if (dayOfWeek === 0 || dayOfWeek === 6) continue;
          
          const year = beijingTime.getUTCFullYear();
          const month = String(beijingTime.getUTCMonth() + 1).padStart(2, '0');
          const day = String(beijingTime.getUTCDate()).padStart(2, '0');
          dates.push(`${year}${month}${day}`);
          
          if (dates.length >= days) break;
        }
        
        const results = { success: [], failed: [], skipped: [] };
        
        for (const dateStr of dates) {
          // 检查数据库中是否已存在
          const existingCheck = await env.DB.prepare(`
            SELECT id FROM daily_reviews WHERE date = ?
          `).bind(`${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`).first();
          
          if (existingCheck) {
            results.skipped.push(dateStr);
            continue;
          }
          
          // 优先尝试收评（02），然后午评（01）
          let success = false;
          for (const suffix of ['02', '01']) {
            const newsId = `${dateStr}${suffix}`;
            const result = await fetchReviewData(newsId);
            
            if (result.success) {
              const storeResult = await storeReviewData(env.DB, result.newsId, result.markdown);
              if (storeResult.success) {
                results.success.push(newsId);
                success = true;
                break; // 成功后不再尝试午评
              }
            }
          }
          
          if (!success) {
            results.failed.push(dateStr);
          }
        }
        
        return jsonResponse({
          success: true,
          days,
          total: dates.length,
          successCount: results.success.length,
          failedCount: results.failed.length,
          skippedCount: results.skipped.length,
          results
        });
      } catch (e) {
        console.error('批量补全失败:', e);
        return jsonResponse({ error: e.message }, 500);
      }
    }
    
    // GET /reviews - 获取复盘列表
    if (path === '/reviews' && request.method === 'GET') {
      const limit = parseInt(url.searchParams.get('limit') || '7');
      const result = await listReviews(env.DB, limit);
      return jsonResponse(result);
    }
    
    return jsonResponse({ 
      error: 'Not found', 
      endpoints: ['/news', '/fetch', '/stats', '/review', '/review/fetch', '/reviews'] 
    }, 404);
  },
  
  // 定时任务处理器
  // - 每30分钟爬取新闻
  // - 每天下午5点(北京时间)获取复盘数据
  async scheduled(event, env, ctx) {
    console.log('Cron triggered:', event.cron, new Date().toISOString());
    
    // 判断是哪个定时任务
    if (event.cron === '0 9 * * 1-5') {
      // 北京时间下午5点 = UTC 9点，工作日执行复盘
      console.log('执行复盘数据获取...');
      ctx.waitUntil((async () => {
        const result = await fetchReviewData();
        if (result.success && env.DB) {
          await storeReviewData(env.DB, result.newsId, result.markdown);
          console.log('复盘数据已存储:', result.newsId);
        } else {
          console.error('复盘数据获取失败:', result.error);
        }
      })());
    } else {
      // 默认：新闻爬取
      ctx.waitUntil(fetchAndStoreNews(env));
    }
  }
};
