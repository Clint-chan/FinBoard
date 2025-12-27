# Market Board API Worker

Cloudflare Worker 后端，提供用户认证、配置同步、AI 分析、日报生成等功能。

## 部署

```bash
cd worker
npm install
npx wrangler deploy
```

## 环境变量配置

### 必需的 Secrets

```bash
# Brevo 邮件 API（用于验证码、日报推送）
npx wrangler secret put BREVO_API_KEY

# AI 分析 API
npx wrangler secret put AI_API_KEY

# JWT 密钥
npx wrangler secret put JWT_SECRET
```

### 可选的 Secrets

```bash
# ScreenshotOne API（用于日报邮件截图）
npx wrangler secret put SCREENSHOT_API_KEY
```

## 日报邮件截图功能

### 工作原理

1. 每日 6 点（北京时间）自动生成日报
2. 发送邮件时，调用 ScreenshotOne API 截取日报页面
3. 截图 URL: `https://board.newestgpt.com/?page=daily&date=YYYY-MM-DD&screenshot=1`
4. 前端在 `screenshot=1` 模式下隐藏导航栏、浮动按钮，只显示日报内容

### 配置 ScreenshotOne

1. 注册 https://screenshotone.com（免费 100 次/月）
2. 获取 Access Key
3. 配置到 Worker:
   ```bash
   npx wrangler secret put SCREENSHOT_API_KEY
   ```

### 降级方案

如果未配置 `SCREENSHOT_API_KEY`，自动使用精美 HTML 邮件模板。

## 测试

管理员可在后台发送测试邮件验证效果。
