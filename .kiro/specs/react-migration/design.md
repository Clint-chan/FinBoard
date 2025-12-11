# React 迁移架构设计

## 项目结构

```
react-app/
├── public/
│   ├── logo.png
│   ├── manifest.json
│   └── assets/              # 静态资源（头像等）
├── src/
│   ├── components/          # React 组件
│   │   ├── Sidebar/         # 侧边栏
│   │   ├── StockTable/      # 股票表格
│   │   ├── StatusBar/       # 状态栏
│   │   ├── ChartTooltip/    # 分时图悬浮
│   │   ├── SuperChart/      # K线图组件 ⭐
│   │   ├── AnalysisDrawer/  # 分析大屏 ⭐
│   │   ├── ContextMenu/     # 右键菜单
│   │   ├── BossScreen/      # 老板键遮罩
│   │   └── modals/          # 弹窗组件
│   ├── hooks/               # 自定义 Hooks
│   │   ├── useLocalStorage.ts
│   │   ├── useQuotes.ts
│   │   ├── useTheme.ts
│   │   ├── useDragSort.ts   # 拖拽排序
│   │   └── useCloudSync.ts  # 云同步
│   ├── services/            # API 服务
│   │   ├── config.ts
│   │   ├── dataService.ts
│   │   ├── chartService.ts  # 图表数据服务 ⭐
│   │   └── cloudService.ts  # 云同步服务
│   ├── types/               # TypeScript 类型
│   │   └── index.ts
│   ├── utils/               # 工具函数
│   │   ├── format.ts
│   │   └── indicators.ts    # 技术指标计算 ⭐
│   ├── styles/              # 全局样式
│   ├── App.tsx
│   └── main.tsx
├── index.html
├── package.json
├── tsconfig.json
└── vite.config.ts
```

## 组件设计

### SuperChart 组件
```typescript
interface SuperChartProps {
  code: string
  width?: number
  height?: number
  fillContainer?: boolean
  isDark?: boolean
  defaultTab?: 'intraday' | '5min' | '15min' | '30min' | '60min' | 'daily' | 'weekly' | 'monthly'
  subIndicators?: ('vol' | 'macd' | 'rsi')[]
  showBoll?: boolean
}
```

### AnalysisDrawer 组件
```typescript
interface AnalysisDrawerProps {
  open: boolean
  code: string
  onClose: () => void
  stockList: string[]
  stockData: Record<string, StockData>
}
```

## 状态管理

使用 React Context + useReducer 管理全局状态：

```typescript
interface AppState {
  config: UserConfig
  stockData: Record<string, StockData>
  user: UserProfile | null
  theme: 'light' | 'dark' | 'auto'
}
```

## 数据流

1. **行情数据**: useQuotes hook → 定时轮询 → 更新 stockData
2. **配置数据**: useLocalStorage → localStorage 持久化
3. **云同步**: useCloudSync → 登录后自动同步
4. **图表数据**: chartService → 东方财富 API
