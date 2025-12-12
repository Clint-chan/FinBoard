# Worker HTTP 访问问题

## 问题描述

Worker 在调用大模型 API 时返回 405 错误：
```
LLM API error: 405
```

## 原因分析

**Cloudflare Workers 默认不支持访问 HTTP（非 HTTPS）端点**。

当前配置的大模型 API 地址：
```
http://frp3.ccszxc.site:14266/v1/chat/completions
```

这是一个 HTTP 端点，Cloudflare Workers 出于安全考虑会阻止访问。

## 解决方案

### 方案 1: 使用 HTTPS 端点（推荐）

如果大模型 API 支持 HTTPS，修改配置：

```javascript
const AI_DEFAULT_CONFIG = {
  apiUrl: 'https://frp3.ccszxc.site:14266/v1/chat/completions',  // 改为 HTTPS
  apiKey: 'zxc123',
  model: 'gemini-3-pro-preview-thinking'
}
```

或者通过 KV 存储更新配置：
```bash
# 使用 wrangler 更新配置
npx wrangler kv:key put --namespace-id=581a1195af51480b9b65fd50826fb33b "ai_config" '{"apiUrl":"https://your-api-endpoint.com/v1/chat/completions","apiKey":"your-key","model":"your-model"}'
```

### 方案 2: 配置 SSL 证书

如果你控制 `frp3.ccszxc.site` 服务器，可以：

1. 安装 SSL 证书（Let's Encrypt 免费）
2. 配置 Nginx/Apache 支持 HTTPS
3. 更新 Worker 配置使用 HTTPS 端点

### 方案 3: 使用 Cloudflare Tunnel

使用 Cloudflare Tunnel 将 HTTP 服务暴露为 HTTPS：

1. 安装 cloudflared
2. 创建 Tunnel
3. 配置域名指向 Tunnel
4. 更新 Worker 配置

### 方案 4: 使用代理服务

创建一个支持 HTTP 的代理服务（不推荐，安全性较低）。

## 临时测试方案

在本地测试时，可以直接调用 HTTP API（Node.js 环境支持）。

但在 Cloudflare Workers 环境中，必须使用 HTTPS。

## 当前状态

- ✅ 大模型 API 本身工作正常（本地测试通过）
- ✅ Worker 代码逻辑正确
- ✅ 数据采集功能正常
- ❌ Worker 无法访问 HTTP 端点（Cloudflare 限制）

## 下一步

1. 确认大模型 API 是否支持 HTTPS
2. 如果支持，更新配置为 HTTPS 端点
3. 如果不支持，考虑配置 SSL 证书或使用 Cloudflare Tunnel

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
