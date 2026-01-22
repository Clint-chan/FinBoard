## 部署
cd worker-news
npx wrangler deploy

## API 接口

### 新闻接口
- `GET /news` - 获取新闻列表
- `GET /news?limit=50&offset=0` - 分页查询
- `GET /news?date=2026-01-22` - 按日期查询
- `GET /news?since=2026-01-22 18:00:00` - 按时间范围查询（北京时间）
- `GET /stats` - 获取统计信息
- `POST /fetch` - 手动触发新闻爬取

### 复盘接口
- `GET /review` - 获取当天复盘（优先收评02，否则午评01）
- `GET /review?id=2026012202` - 按 ID 查询
- `GET /review?date=2026-01-22` - 按日期查询
- `POST /review/fetch` - 手动触发复盘数据获取
- `POST /review/backfill` - 批量补全历史数据
  ```json
  { "days": 30 }  // 补全最近30天（默认）
  ```
- `GET /reviews` - 获取复盘列表
- `GET /reviews?limit=30` - 指定返回数量

## 第一次使用

### 1. 爬取新闻
```bash
curl -X POST https://news.newestgpt.com/fetch
```

### 2. 获取今日复盘
```bash
curl -X POST https://news.newestgpt.com/review/fetch
```

### 3. 批量补全历史复盘（最近30天）
```bash
curl -X POST https://news.newestgpt.com/review/backfill \
  -H "Content-Type: application/json" \
  -d '{"days": 30}'
```

## 验证

### 查看新闻
- 新闻列表：https://news.newestgpt.com/news
- 统计信息：https://news.newestgpt.com/stats

### 查看复盘
- 今日复盘：https://news.newestgpt.com/review
- 复盘列表：https://news.newestgpt.com/reviews
- 指定日期：https://news.newestgpt.com/review?date=2026-01-22

## 复盘功能特性

### 智能获取策略
- 优先获取收评（02）数据，包含全天完整信息
- 如果收评不存在，自动降级到午评（01）
- 确保每天都能获取到复盘数据

### 数据存储
- 使用 D1 数据库存储，支持按日期和 ID 查询
- 同一天的新数据会覆盖旧数据
- 支持批量补全历史数据（跳过周末）

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
