## 部署
cd worker-news
npx wrangler deploy

## 第一次爬取
curl -X POST https://news.newestgpt.com/fetch

## 然后可以验证：
- 查看新闻列表：https://news.newestgpt.com/news
- 查看统计：https://news.newestgpt.com/stats

# 获取北京时间 2025-12-23 18:00:00 之后的新闻
https://news.newestgpt.com/news?since=2025-12-23 18:00:00

# 也可以只传日期+小时
https://news.newestgpt.com/news?since=2025-12-23 18:00
