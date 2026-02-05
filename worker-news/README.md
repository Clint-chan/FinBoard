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

## 数据源策略

### 主数据源
- **china.buzzing.cc** - 中国相关新闻（优先）

### 备用数据源
- **bloombergnew.buzzing.cc/lite** - Bloomberg 全球新闻
- 触发条件：当主数据源爬取无新增数据时自动切换
- 确保即使主数据源暂时无更新，也能持续获取新闻

### 爬取逻辑
1. 首先尝试从 china.buzzing.cc 爬取中国新闻
2. 如果新增数据为 0，自动切换到 bloombergnew.buzzing.cc/lite
3. 返回结果会标注数据来源（china 或 bloomberg(backup)）

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
