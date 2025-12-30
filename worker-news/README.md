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

## 复盘功能

### 接口
- `GET /review` - 获取当天复盘数据
- `GET /review?id=2025123002` - 获取指定日期复盘
- `POST /review/fetch` - 手动触发复盘数据获取
- `GET /reviews` - 获取最近7天复盘列表
- `GET /reviews?limit=30` - 获取最近30天复盘列表

### 定时任务
- 每30分钟爬取新闻
- 每天下午5点(北京时间)自动获取A股复盘数据(仅工作日)

### 数据源
腾讯财经 snp.tenpay.com，包含：
- 题材热点 (tcrd)
- 社区热议 (sqry)
- 今日要闻 (jryw)
- 沪深要评 (hsyp)
- 等其他板块...
