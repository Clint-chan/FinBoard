# 备用数据源实现说明

## 功能概述

为 worker-news 添加了智能备用数据源机制,确保新闻爬取的连续性和可靠性。

## 实现逻辑

### 数据源配置

1. **主数据源**: `https://china.buzzing.cc/`
   - 专注于中国相关新闻
   - 优先级最高

2. **备用数据源**: `https://bloombergnew.buzzing.cc/lite/`
   - Bloomberg 全球新闻
   - 当主数据源无新增时自动启用

### 工作流程

```
开始爬取
    ↓
尝试主数据源 (china.buzzing.cc)
    ↓
检查新增数量
    ↓
新增 > 0? ──是──→ 返回结果 (source: china)
    ↓
   否
    ↓
切换到备用数据源 (bloombergnew.buzzing.cc/lite)
    ↓
返回合并结果 (source: bloomberg(backup))
```

## 代码改动

### 新增函数

```javascript
async function fetchFromSource(url, db, sourceName)
```
- 从指定 URL 爬取新闻
- 支持数据源标识
- 返回详细的爬取结果

### 修改函数

```javascript
async function fetchAndStoreNews(env)
```
- 先尝试主数据源
- 根据结果决定是否启用备用源
- 返回包含数据源信息的结果

## 测试结果

### 部署前
```json
{
  "totalNews": 3878,
  "todayNews": 0,
  "latestTime": "2026-02-01 13:01:12"
}
```

### 部署后首次爬取
```json
{
  "success": true,
  "inserted": 300,
  "skipped": 298,
  "total": 598,
  "source": "bloomberg(backup)",
  "primaryResult": {
    "success": true,
    "inserted": 0,
    "skipped": 298,
    "total": 298
  },
  "backupResult": {
    "success": true,
    "inserted": 300,
    "skipped": 0,
    "total": 300
  }
}
```

### 部署后数据状态
```json
{
  "totalNews": 4178,
  "todayNews": 300,
  "latestTime": "2026-02-05 21:01:59"
}
```

## 优势

1. **高可用性**: 主数据源故障时自动切换
2. **数据连续性**: 确保每次爬取都有新数据
3. **透明度**: 返回结果明确标注数据来源
4. **零配置**: 自动判断,无需手动干预

## 监控建议

可以通过返回的 `source` 字段监控数据源使用情况:
- `china`: 主数据源正常
- `bloomberg(backup)`: 使用了备用数据源
- `china(no-new-data)`: 两个数据源都无新数据

## 未来优化

1. 可以添加更多备用数据源
2. 实现数据源优先级队列
3. 添加数据源健康检查
4. 记录数据源切换日志到 KV
