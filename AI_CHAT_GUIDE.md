# AI 聊天功能使用指南

## 功能概述

AI 聊天功能已集成到分析大屏中，可以对股票进行智能分析和问答。

## 部署状态

✅ **后端 Worker 已部署**: `https://market-board-api.945036663.workers.dev`
✅ **前端已构建**: `react-app/dist/`
✅ **API 路由**: `/api/ai/chat` (流式响应)
✅ **配置接口**: `/api/ai/config` (GET/POST)

## 使用方法

### 1. 打开分析大屏

在主界面点击任意股票的"分析"按钮，会打开分析大屏。

### 2. 使用 AI 聊天

在右侧聊天区域：
- 输入问题，例如："现在适合买入吗？"
- AI 会自动采集该股票的实时数据（K线、技术指标等）
- 基于数据给出专业的分析建议

### 3. AI 分析模式

目前支持的模式：
- **日内做T** (intraday): 专注短线交易，给出具体买卖点位

## 技术实现

### 数据采集

后端自动采集以下数据：
- 实时行情（价格、涨跌幅、振幅、换手率、量比）
- 最近30根日K线
- 技术指标（MA5/10/20、MACD、RSI）
- 关键点位（前高、前低、支撑、压力）

### 流式响应

- 使用 Server-Sent Events (SSE) 实现流式输出
- 前端实时显示 AI 回复内容
- 支持 Markdown 格式渲染

### API 配置

默认配置（可通过 KV 存储修改）：
```javascript
{
  apiUrl: 'http://frp3.ccszxc.site:14266/v1/chat/completions',
  apiKey: 'zxc123',
  model: 'gemini-3-pro-preview-thinking'
}
```

## 测试建议

1. **基础测试**：
   - 打开分析大屏
   - 输入："分析一下当前走势"
   - 检查是否正常返回分析结果

2. **数据验证**：
   - 检查 AI 回复中是否包含实时数据
   - 验证技术指标是否准确

3. **流式响应**：
   - 观察回复是否逐字显示
   - 检查是否有延迟或卡顿

## 故障排查

### 如果 AI 无响应

1. 检查浏览器控制台是否有错误
2. 验证 Worker 是否正常运行：
   ```bash
   curl https://market-api.newestgpt.com/api/ai/config
   ```
3. 检查大模型 API 是否可访问

### 如果数据不准确

1. 检查股票代码是否正确传递
2. 验证东方财富 API 是否正常
3. 查看 Worker 日志

## 下一步优化

- [ ] 添加更多分析模式（趋势分析、基本面分析）
- [ ] 支持多轮对话上下文
- [ ] 添加图表数据可视化
- [ ] 优化提示词，提高分析质量
- [ ] 添加用户反馈机制

## 相关文件

- 前端服务: `react-app/src/services/aiChatService.ts`
- 分析大屏: `react-app/src/components/AnalysisDrawer/index.tsx`
- Worker 主文件: `worker/index.js`
- AI 聊天逻辑: `worker/ai-chat.js` (已合并到 index.js)
