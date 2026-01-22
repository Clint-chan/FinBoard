// 批量补全历史复盘数据
// 用法: node backfill_reviews.js [days]
// 例如: node backfill_reviews.js 30  (补全最近30天)

import { fetchReviewData } from './reviews.js';

// 生成日期范围
function generateDateRange(days) {
  const dates = [];
  const now = new Date();
  
  for (let i = 0; i < days; i++) {
    const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    // 转北京时间
    const beijingTime = new Date(date.getTime() + 8 * 60 * 60 * 1000);
    const year = beijingTime.getUTCFullYear();
    const month = String(beijingTime.getUTCMonth() + 1).padStart(2, '0');
    const day = String(beijingTime.getUTCDate()).padStart(2, '0');
    
    // 跳过周末（周六=6, 周日=0）
    const dayOfWeek = beijingTime.getUTCDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      continue;
    }
    
    dates.push(`${year}${month}${day}`);
  }
  
  return dates;
}

async function backfillReviews(days = 30) {
  console.log(`开始补全最近 ${days} 天的复盘数据...\n`);
  
  const dates = generateDateRange(days);
  console.log(`生成了 ${dates.length} 个工作日\n`);
  
  const results = {
    success: [],
    failed: []
  };
  
  for (const dateStr of dates) {
    // 优先尝试收评（02），然后午评（01）
    for (const suffix of ['02', '01']) {
      const newsId = `${dateStr}${suffix}`;
      
      try {
        console.log(`尝试获取: ${newsId}...`);
        const result = await fetchReviewData(newsId);
        
        if (result.success) {
          console.log(`✅ 成功: ${newsId} (${result.markdown.length} 字符)`);
          results.success.push(newsId);
          
          // 成功获取收评后，不再尝试午评
          if (suffix === '02') {
            break;
          }
        } else {
          console.log(`❌ 失败: ${newsId} - ${result.error}`);
          
          // 如果是收评失败，继续尝试午评
          if (suffix === '02') {
            continue;
          }
          
          results.failed.push(newsId);
        }
      } catch (e) {
        console.log(`❌ 异常: ${newsId} - ${e.message}`);
        results.failed.push(newsId);
      }
      
      // 延迟，避免请求过快
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  
  console.log(`\n=== 补全完成 ===`);
  console.log(`成功: ${results.success.length} 条`);
  console.log(`失败: ${results.failed.length} 条`);
  
  if (results.success.length > 0) {
    console.log(`\n成功列表:`);
    results.success.forEach(id => console.log(`  - ${id}`));
  }
  
  if (results.failed.length > 0) {
    console.log(`\n失败列表:`);
    results.failed.forEach(id => console.log(`  - ${id}`));
  }
}

// 从命令行参数获取天数
const days = parseInt(process.argv[2]) || 30;
backfillReviews(days).catch(console.error);
