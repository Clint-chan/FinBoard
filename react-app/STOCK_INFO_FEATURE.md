# 股票信息卡片功能实现总结

## 📋 功能概述

在 Insight 大屏的 SuperChart 组件中，当用户鼠标悬停在股票名称上时，会弹出一个详细的股票信息卡片，展示该股票的基本面和市场数据。

## 🎯 设计目标

1. **专业性**：参考同花顺、东方财富等专业看盘软件的指标体系
2. **一致性**：UI 风格与项目整体设计保持一致
3. **易用性**：悬停即显示，操作简单直观
4. **性能**：按需加载，避免不必要的请求

## 📊 核心指标

### 1. 市值股本（4项）
- 总市值、流通市值
- 总股本、流通股

### 2. 估值指标（4项）
- 市盈率(PE-动态)
- 市净率(PB)
- 市销率(PS)
- 换手率

### 3. 财务指标（4项）
- **净资产收益率(ROE)** - 重点指标，高亮显示
- 每股收益(EPS)
- 每股净资产(BVPS)
- 振幅

### 4. 基本信息（2项）
- 所属行业
- 上市时间

**总计：14 个核心指标**

## 🎨 UI 设计特点

### 配色方案
```css
/* 涨跌颜色 */
--color-up: #ef4444 (浅色) / #f87171 (深色)
--color-down: #10b981 (浅色) / #34d399 (深色)

/* 文本颜色 */
--text-primary: #111827 (浅色) / #f1f5f9 (深色)
--text-secondary: #6b7280 (浅色) / #94a3b8 (深色)
--text-tertiary: #9ca3af (浅色) / #64748b (深色)

/* 背景和边框 */
--bg-surface: #ffffff (浅色) / #1e293b (深色)
--border-light: #e5e7eb (浅色) / #334155 (深色)
```

### 布局特点
- **卡片尺寸**：320-380px 宽度，自适应高度
- **圆角**：8px
- **阴影**：中等阴影 (shadow-md)
- **间距**：16px 外边距，内部使用 Grid 布局
- **字体**：Inter 字体家族，数字使用等宽字体

### 交互设计
```
悬停股票名称 → 延迟 300ms → 显示卡片
                              ↓
                         鼠标移入卡片 → 保持显示
                              ↓
                         鼠标移出 → 延迟 200ms → 隐藏卡片
```

## 📁 文件结构

```
react-app/
├── src/
│   └── components/
│       ├── StockInfoCard/
│       │   ├── index.tsx              # 组件主文件
│       │   ├── StockInfoCard.css      # 样式文件
│       │   └── README.md              # 组件文档
│       └── SuperChart/
│           ├── index.tsx              # 已集成 StockInfoCard
│           └── SuperChart.css         # 已添加相关样式
└── docs/
    └── stock-info-card-design.md      # 设计文档
```

## 🔌 数据接口

### akshare 接口
```python
import akshare as ak

# 东方财富 - 个股基本信息（推荐）
df = ak.stock_individual_info_em(symbol="000002")

# 返回数据示例：
#    item               value
# 0    最新               7.05
# 1  股票代码             000002
# 2  股票简称            万科Ａ
# 3   总股本       11930709471.0
# 4   流通股        9716935865.0
# 5   总市值  84111501770.550003
# 6  流通市值      68504397848.25
# 7    行业              房地产开发
# 8  上市时间            19910129
```

### 备选接口
```python
# 雪球 - 公司概况（需要 token）
df = ak.stock_individual_basic_info_xq(symbol="SH601127")

# 新浪 - 财务指标
df = ak.stock_financial_abstract(symbol="600004")
```

## 💻 代码示例

### 组件使用
```tsx
import { StockInfoCard } from '@/components/StockInfoCard'

// 在 SuperChart 中集成
<div 
  className="sc-name sc-name-hoverable"
  onMouseEnter={handleShowInfo}
  onMouseLeave={handleHideInfo}
>
  {stockName}
  {showStockInfo && (
    <div className="sc-stock-info-popup">
      <StockInfoCard 
        code={code} 
        visible={showStockInfo}
        onLoad={(info) => console.log('数据加载完成', info)}
      />
    </div>
  )}
</div>
```

### 后端 API 示例
```python
from flask import Flask, jsonify
import akshare as ak

@app.route('/api/stock/info/<code>')
def get_stock_info(code):
    df = ak.stock_individual_info_em(symbol=code)
    # 处理数据并返回 JSON
    return jsonify(formatted_data)
```

## ✅ 已完成的工作

1. ✅ 设计指标体系（参考专业看盘软件）
2. ✅ 创建 StockInfoCard 组件
3. ✅ 设计符合项目风格的 UI
4. ✅ 实现深色/浅色主题支持
5. ✅ 添加悬停交互逻辑
6. ✅ 集成到 SuperChart 组件
7. ✅ 编写组件文档和使用说明
8. ✅ 创建设计文档

## 🚀 下一步工作

### 1. 后端接口开发
```python
# 需要在 Python 后端添加接口
# 文件：backend/api/stock.py

@app.route('/api/stock/info/<code>')
def get_stock_info(code):
    # 调用 akshare 获取数据
    # 格式化并返回
    pass
```

### 2. 前端数据集成
```typescript
// 在 StockInfoCard/index.tsx 中
// 替换模拟数据为真实 API 调用

const fetchStockInfo = async () => {
  const response = await fetch(`/api/stock/info/${code}`)
  const data = await response.json()
  setInfo(data)
}
```

### 3. 数据缓存优化
```typescript
// 添加缓存机制，避免重复请求
const stockInfoCache = new Map<string, StockInfo>()

if (stockInfoCache.has(code)) {
  setInfo(stockInfoCache.get(code))
} else {
  // 请求数据并缓存
}
```

### 4. 错误处理增强
- 网络错误重试机制
- 数据缺失的友好提示
- 加载超时处理

### 5. 性能优化
- 防抖处理
- 虚拟滚动（如果有列表）
- 懒加载图片（如果添加图表）

## 📝 使用说明

### 用户操作
1. 在 Insight 大屏中打开任意股票图表
2. 将鼠标悬停在图表顶部的股票名称上
3. 等待 300ms 后自动显示股票信息卡片
4. 可以将鼠标移入卡片查看详细信息
5. 移出卡片后 200ms 自动隐藏

### 开发者集成
```bash
# 1. 组件已创建在
react-app/src/components/StockInfoCard/

# 2. 已集成到 SuperChart
react-app/src/components/SuperChart/index.tsx

# 3. 查看文档
react-app/src/components/StockInfoCard/README.md
react-app/docs/stock-info-card-design.md
```

## 🎯 设计亮点

1. **专业指标体系**：14 个核心指标，覆盖估值、财务、市场三大维度
2. **视觉一致性**：完全遵循项目的设计规范和配色方案
3. **交互友好**：合理的延迟时间，避免误触和频繁闪烁
4. **响应式设计**：支持桌面和移动端
5. **主题支持**：完美适配深色和浅色主题
6. **性能优化**：按需加载，避免不必要的请求
7. **可扩展性**：易于添加更多指标和功能

## 📚 参考资料

- 同花顺 F10 资料页面
- 东方财富个股详情页
- 通达信软件 F10 界面
- akshare 文档：https://akshare.akfamily.xyz/

## 🔗 相关文件

- 组件实现：`react-app/src/components/StockInfoCard/index.tsx`
- 组件样式：`react-app/src/components/StockInfoCard/StockInfoCard.css`
- 组件文档：`react-app/src/components/StockInfoCard/README.md`
- 设计文档：`react-app/docs/stock-info-card-design.md`
- 集成位置：`react-app/src/components/SuperChart/index.tsx`

---

**创建时间**：2024-12-11  
**版本**：v1.0.0  
**状态**：✅ UI 设计完成，等待后端接口集成
