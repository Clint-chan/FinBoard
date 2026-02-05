// A股复盘数据获取模块
// 数据源: 腾讯财经 snp.tenpay.com

/**
 * 清洗HTML标签和转义字符
 */
function cleanText(text) {
  if (!text || typeof text !== 'string') return '';
  // 去除HTML标签
  text = text.replace(/<[^>]+>/g, '');
  // 解码HTML实体
  return decodeHTMLEntities(text).trim();
}

/**
 * 解码HTML实体
 */
function decodeHTMLEntities(text) {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(code));
}

/**
 * 解析题材热点 (tcrd)
 */
function parseTcrd(contentList) {
  const lines = [];
  if (!Array.isArray(contentList)) return lines;

  for (const item of contentList) {
    const name = item.concept_name || '未知概念';
    const zdf = item.concept_zdf || '0.00';
    
    // 提取原因 (取列表第一条)
    const reasons = item.hot_spot?.hot_reason || [];
    const reasonText = reasons.length > 0 ? cleanText(reasons[0]) : '';
    
    // 提取领涨股
    const stocks = item.top2_stocks || [];
    const stockStrList = stocks.map(s => `${s.stock_name}(${s.stock_zdf}%)`);
    const stockDisplay = stockStrList.join(', ');

    // 格式化输出
    lines.push(`- **${name}** (涨幅 ${zdf}%)`);
    if (reasonText) {
      lines.push(`  > 催化: ${reasonText}`);
    }
    if (stockDisplay) {
      lines.push(`  > 领涨: ${stockDisplay}`);
    }
  }
  return lines;
}

/**
 * 解析社区热议 (sqry)
 */
function parseSqry(contentDict) {
  const lines = [];
  if (!contentDict || typeof contentDict !== 'object') return lines;

  const hotStocks = contentDict.hot_stock || [];
  if (hotStocks.length === 0) return lines;

  for (const stock of hotStocks) {
    const name = stock.name || '';
    const zdf = stock.zdf || '0';
    const cnt = stock.cnt || '0';
    
    // 涨跌幅符号
    const zdfNum = parseFloat(zdf);
    let arrow = '';
    if (zdfNum > 0) arrow = '🔺';
    else if (zdfNum < 0) arrow = '🔻';
    
    lines.push(`- **${name}** ${arrow} ${zdf}% (热度: ${cnt})`);
  }
  return lines;
}


/**
 * 获取复盘数据并生成 Markdown
 * @param {string} newsId - 可选，指定日期ID，默认当天（优先02收评，否则01午评）
 * @returns {Promise<{success: boolean, markdown?: string, newsId?: string, error?: string}>}
 */
export async function fetchReviewData(newsId = null) {
  // 生成 ID: 优先 YYYYMMDD02 (收评)，如果不存在则尝试 YYYYMMDD01 (午评)
  let tryIds = [];
  
  if (!newsId) {
    const now = new Date();
    // 转北京时间
    const beijingTime = new Date(now.getTime() + 8 * 60 * 60 * 1000);
    const year = beijingTime.getUTCFullYear();
    const month = String(beijingTime.getUTCMonth() + 1).padStart(2, '0');
    const day = String(beijingTime.getUTCDate()).padStart(2, '0');
    const baseId = `${year}${month}${day}`;
    
    // 优先尝试收评（02），然后午评（01）
    tryIds = [`${baseId}02`, `${baseId}01`];
  } else {
    tryIds = [newsId];
  }

  let lastError = null;
  
  // 依次尝试每个 ID
  for (const id of tryIds) {
    const url = `https://snp.tenpay.com/cgi/cgi-bin/snp/newsDailyInfo/getPushDailyDetail?id=${id}`;

    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0' }
      });

      if (!res.ok) {
        lastError = `HTTP ${res.status}`;
        continue; // 尝试下一个 ID
      }

      const jsonData = await res.json();
      
      // 检查响应是否有效
      if (jsonData.code !== 0 || !jsonData.data) {
        lastError = jsonData.msg || 'No data';
        continue;
      }
      
      const data = jsonData.data;

      // 生成 Markdown
      const lines = [];
      const genTime = new Date().toISOString().replace('T', ' ').slice(0, 19);
      
      lines.push(`# A股复盘日报 (${id})`);
      lines.push(`> 生成时间: ${genTime}`);
      lines.push('---');
      lines.push('');

      // 不需要副标题的板块
      const noSubtitleKeys = ['jryw', 'hsyp'];

      for (const [key, section] of Object.entries(data)) {
        if (!section || typeof section !== 'object') continue;
        
        const tabTitle = section.tab_title;
        if (!tabTitle) continue;

        // 标题输出
        lines.push(`## 📊 ${tabTitle}`);
        
        // 主标题
        if (section.title) {
          lines.push(`### ${section.title}`);
        }
        
        // 副标题
        const subTitle = section.sub_title || '';
        if (subTitle && !noSubtitleKeys.includes(key)) {
          lines.push(`_${subTitle}_`);
        }
        
        lines.push('');

        // 内容处理
        const rawContent = section.content;

        // CASE 1: 题材热点 (tcrd)
        if (key === 'tcrd') {
          const tcrdLines = parseTcrd(rawContent);
          lines.push(...tcrdLines);
        }
        // CASE 2: 社区热议 (sqry)
        else if (key === 'sqry') {
          const sqryLines = parseSqry(rawContent);
          lines.push(...sqryLines);
        }
        // CASE 3: 通用列表
        else if (Array.isArray(rawContent)) {
          for (const item of rawContent) {
            // 过滤图片
            if (item.type === 'image') continue;
            
            const desc = cleanText(item.desc);
            if (desc) {
              lines.push(`- ${desc}`);
            }
          }
        }

        lines.push('');
        lines.push('---');
        lines.push('');
      }

      // 成功获取数据，返回结果
      return {
        success: true,
        markdown: lines.join('\n'),
        newsId: id
      };

    } catch (e) {
      console.error(`获取复盘数据失败 (${id}):`, e);
      lastError = e.message;
      continue; // 尝试下一个 ID
    }
  }
  
  // 所有 ID 都失败了
  return {
    success: false,
    error: lastError || 'No valid review data found',
    newsId: tryIds[0]
  };
}

/**
 * 从 newsId 提取日期 (YYYYMMDD02 -> YYYY-MM-DD)
 */
function extractDateFromNewsId(newsId) {
  if (!newsId || newsId.length < 8) return null;
  const year = newsId.slice(0, 4);
  const month = newsId.slice(4, 6);
  const day = newsId.slice(6, 8);
  return `${year}-${month}-${day}`;
}

/**
 * 存储复盘数据到 D1
 */
export async function storeReviewData(db, newsId, markdown) {
  if (!db) {
    return { success: false, error: 'DB not configured' };
  }

  // 从 newsId 提取日期，用于与 report 表关联
  const date = extractDateFromNewsId(newsId);

  try {
    // 创建表（如果不存在），包含 date 字段用于关联
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS daily_reviews (
        id TEXT PRIMARY KEY,
        date TEXT NOT NULL,
        markdown TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `).run();

    // 创建 date 索引
    await db.prepare(`
      CREATE INDEX IF NOT EXISTS idx_reviews_date ON daily_reviews(date)
    `).run();

    // 插入或更新
    await db.prepare(`
      INSERT OR REPLACE INTO daily_reviews (id, date, markdown, created_at)
      VALUES (?, ?, ?, datetime('now'))
    `).bind(newsId, date, markdown).run();

    return { success: true, newsId, date };
  } catch (e) {
    console.error('存储复盘数据失败:', e);
    return { success: false, error: e.message };
  }
}

/**
 * 获取已存储的复盘数据
 */
export async function getStoredReview(db, newsId) {
  if (!db) {
    return { success: false, error: 'DB not configured' };
  }

  try {
    const result = await db.prepare(`
      SELECT date, markdown, created_at FROM daily_reviews WHERE id = ?
    `).bind(newsId).first();

    if (result) {
      return { success: true, date: result.date, markdown: result.markdown, createdAt: result.created_at };
    }
    return { success: false, error: 'Not found' };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

/**
 * 根据日期获取复盘数据 (用于与 report 关联)
 */
export async function getReviewByDate(db, date) {
  if (!db) {
    return { success: false, error: 'DB not configured' };
  }

  try {
    const result = await db.prepare(`
      SELECT id, date, markdown, created_at FROM daily_reviews WHERE date = ?
    `).bind(date).first();

    if (result) {
      return { success: true, id: result.id, date: result.date, markdown: result.markdown, createdAt: result.created_at };
    }
    return { success: false, error: 'Not found' };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

/**
 * 获取最近的复盘列表
 */
export async function listReviews(db, limit = 7) {
  if (!db) {
    return { success: false, error: 'DB not configured' };
  }

  try {
    const result = await db.prepare(`
      SELECT id, date, created_at FROM daily_reviews 
      ORDER BY date DESC LIMIT ?
    `).bind(limit).all();

    return { 
      success: true, 
      reviews: result.results || [] 
    };
  } catch (e) {
    return { success: false, error: e.message };
  }
}
