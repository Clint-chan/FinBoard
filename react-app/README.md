# Stock Board - React + TypeScript 版本

基于 Vite + React + TypeScript 的股票看板应用，从原生 JS 版本迁移而来。

## 开发

```bash
cd react-app
npm install
npm run dev
```

访问 http://localhost:3000

## 构建部署

```bash
npm run build
```

构建产物在 `dist/` 目录，可直接部署到 Cloudflare Pages：

```bash
npm run deploy
# 或
npx wrangler pages deploy dist --project-name=stock-board
```

## 项目结构

```
react-app/
├── public/
│   ├── logo.png
│   └── manifest.json
├── src/
│   ├── components/           # React 组件
│   │   ├── Sidebar/          # 侧边栏
│   │   ├── StockTable/       # 股票表格
│   │   ├── StatusBar/        # 状态栏
│   │   ├── ChartTooltip/     # 分时图悬浮
│   │   ├── ContextMenu/      # 右键菜单
│   │   ├── SuperChart/       # 高级图表（分时/K线）
│   │   ├── AnalysisDrawer/   # 分析大屏
│   │   ├── BossScreen/       # 老板键遮罩
│   │   └── modals/           # 弹窗组件
│   ├── hooks/                # 自定义 Hooks
│   │   ├── useLocalStorage.ts
│   │   ├── useQuotes.ts
│   │   ├── useTheme.ts
│   │   ├── useCloudSync.ts
│   │   ├── useDragSort.ts
│   │   ├── useKeyboardShortcuts.ts
│   │   └── usePriceFlash.ts
│   ├── services/             # API 服务
│   │   ├── config.ts
│   │   ├── dataService.ts
│   │   ├── chartService.ts
│   │   └── cloudService.ts
│   ├── types/                # TypeScript 类型定义
│   │   └── index.ts
│   ├── styles/               # 全局样式
│   │   └── index.css
│   ├── utils/                # 工具函数
│   │   ├── format.ts
│   │   └── indicators.ts
│   ├── App.tsx               # 主应用
│   └── main.tsx              # 入口
├── index.html
├── package.json
├── tsconfig.json
└── vite.config.ts
```

## TypeScript 优势

- **类型安全**：编译时发现错误，减少运行时 bug
- **智能提示**：IDE 自动补全更精准
- **接口定义**：API 响应类型清晰
- **重构友好**：改代码时自动检查影响范围

## 类型定义示例

```typescript
// 股票数据
interface StockData {
  name: string
  price: number
  preClose: number
  vol: number
  // ...
}

// 用户配置
interface UserConfig {
  codes: string[]
  interval: number
  alerts: Record<string, AlertConfig>
  // ...
}
```

## 功能对比

| 功能 | 原生 JS | React + TS |
|------|---------|------------|
| 实时行情 | ✅ | ✅ |
| 自动刷新 | ✅ | ✅ |
| 价格预警 | ✅ | ✅ |
| 持仓成本 | ✅ | ✅ |
| 分时图表 | ✅ | ✅ |
| K线图表 | ✅ | ✅ |
| 技术指标 | ✅ | ✅ |
| 侧边栏 | ✅ | ✅ |
| 用户资料编辑 | ✅ | ✅ |
| 拖拽排序 | ✅ | ✅ |
| 云同步 | ✅ | ✅ |
| 老板键 | ✅ | ✅ |
| 分析大屏 | ✅ | ✅ |
| PWA 支持 | ✅ | ✅ |

## 后续扩展

React + TypeScript 架构便于：

1. **添加后端**：可以共享类型定义，配合 tRPC 实现端到端类型安全
2. **状态管理**：可引入 Zustand / Jotai 等轻量状态库
3. **测试**：配合 Vitest + Testing Library 编写单元测试
4. **组件库**：可引入 Radix UI / shadcn/ui 等无样式组件库

## 技术栈

- React 18
- TypeScript 5
- Vite 5
- 纯 CSS（无 UI 框架）
- 腾讯/新浪/东方财富 API
