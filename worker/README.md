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

# 微信公众号（认证服务号，用于自动发布日报文章）
npx wrangler secret put WECHAT_MP_APPID
npx wrangler secret put WECHAT_MP_SECRET
```

## 微信公众号自动发布

### 前提条件

- 认证公众号（订阅号或服务号均可，需完成微信认证）
- 已开通「发布功能」权限

### 配置步骤

1. 登录 [微信公众平台](https://mp.weixin.qq.com)
2. 进入「设置与开发」→「基本配置」
3. 获取 AppID 和 AppSecret
4. 配置到 Worker:
   ```bash
   npx wrangler secret put WECHAT_MP_APPID
   # 输入你的 AppID
   
   npx wrangler secret put WECHAT_MP_SECRET
   # 输入你的 AppSecret
   ```

### 工作原理

1. 每日 7 点（北京时间）生成日报
2. 发送邮件给订阅用户
3. 同时创建微信公众号草稿（不自动发布）
4. 9 点检查：如果还没有手动发布，则自动发布
5. 文章包含：大盘预判、看多/看空板块、操作建议、重要资讯

### 注意事项

- 订阅号每天只能群发 1 次
- 服务号每月只能群发 4 次
- 如果当天已发布过，API 会返回错误
- 建议在非交易日手动检查发布状态

## 日报邮件截图功能

### 工作原理

1. 每日 7 点（北京时间）自动生成日报
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
