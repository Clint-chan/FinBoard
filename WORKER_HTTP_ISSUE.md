# Worker HTTP 访问问题

## 问题描述

Worker 在调用大模型 API 时返回 405 或超时错误。

## 原因分析

**更新**：Cloudflare Workers **可以**访问 HTTP 端点！之前的理解有误。

实际问题可能是：
1. **错误的 API 地址**：配置的地址不可达
2. **网络超时**：后端服务响应慢或不稳定
3. **端口问题**：防火墙或网络策略阻止

## 已验证可用的配置

通过测试，以下地址可以正常访问：
```
http://frp3.ccszxc.site:14266/v1/chat/completions
```

**Worker 可以直接访问 HTTP 端点**，因为 Worker 运行在服务器端，不受浏览器 Mixed Content 限制。

## 解决方案

### ✅ 方案 1: 直接使用 HTTP 端点（已采用）

Worker 可以直接访问 HTTP 端点，无需额外配置：

```javascript
const AI_DEFAULT_CONFIG = {
  apiUrl: 'http://frp3.ccszxc.site:14266/v1/chat/completions',
  apiKey: 'zxc123',
  model: 'gemini-3-pro-preview-thinking'
}
```

**优点**：
- 简单直接，无需额外配置
- Worker 运行在服务器端，不受浏览器限制
- 速度快，延迟低

**注意**：
- 前端不能直接调用 HTTP API（浏览器 Mixed Content 限制）
- 必须通过 Worker 作为中间层

### 方案 2: 配置 HTTPS（可选，更安全）

如果需要更高的安全性，可以配置 HTTPS：

1. 使用 Cloudflare Tunnel
2. 配置 SSL 证书
3. 使用反向代理（Nginx + Let's Encrypt）

## 当前状态

- ✅ 大模型 API 工作正常（`http://frp3.ccszxc.site:14266`）
- ✅ Worker 代码逻辑正确
- ✅ 数据采集功能正常
- ✅ Worker 可以访问 HTTP 端点
- ✅ 已更新配置为可用地址

## 架构说明

```
用户浏览器 (HTTPS)
    ↓
Cloudflare Worker (HTTPS)
    ↓
大模型 API (HTTP)
```

- 用户通过 HTTPS 访问 Worker
- Worker 通过 HTTP 访问大模型 API
- 不存在 Mixed Content 问题

## 更新配置方法

### 方法 1: 修改代码

编辑 `worker/index.js`:
```javascript
const AI_DEFAULT_CONFIG = {
  apiUrl: 'https://your-https-endpoint.com/v1/chat/completions',
  apiKey: 'your-key',
  model: 'your-model'
}
```

然后重新部署：
```bash
cd worker
npx wrangler deploy
```

### 方法 2: 通过 API 更新

```bash
curl -X POST https://market-api.newestgpt.com/api/ai/config \
  -H "Content-Type: application/json" \
  -d '{
    "apiUrl": "https://your-https-endpoint.com/v1/chat/completions",
    "apiKey": "your-key",
    "model": "your-model"
  }'
```

### 方法 3: 通过前端更新

在前端调用 `updateAIConfig` 函数：
```javascript
import { updateAIConfig } from '@/services/aiChatService'

await updateAIConfig({
  apiUrl: 'https://your-https-endpoint.com/v1/chat/completions',
  apiKey: 'your-key',
  model: 'your-model'
})
```

## 验证配置

```bash
# 查看当前配置
curl https://market-api.newestgpt.com/api/ai/config
```

## 参考资料

- [Cloudflare Workers Fetch API](https://developers.cloudflare.com/workers/runtime-apis/fetch/)
- [Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/)
- [Let's Encrypt](https://letsencrypt.org/)
