## 部署
cd worker-news
npx wrangler deploy

## 第一次爬取
curl -X POST https://news.newestgpt.com/fetch

## 然后可以验证：
- 查看新闻列表：https://news.newestgpt.com/news
- 查看统计：https://news.newestgpt.com/stats