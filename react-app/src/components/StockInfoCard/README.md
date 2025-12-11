# StockInfoCard 组件

股票详细信息卡片组件，用于在 SuperChart 中显示股票的基本面和市场数据。

## 功能特性

- ✅ 显示股票基本信息（代码、名称、价格）
- ✅ 市值与股本数据
- ✅ 估值指标（PE、PB、PS、换手率）
- ✅ 财务指标（ROE、EPS、BVPS、振幅）
- ✅ 行业和上市时间
- ✅ 支持深色/浅色主题
- ✅ 响应式设计
- ✅ 加载状态和错误处理
- ✅ 平滑动画效果

## 使用方法

### 基本用法

```tsx
import { StockInfoCard } from '@/components/StockInfoCard'

function MyComponent() {
  const [showInfo, setShowInfo] = useState(false)

  return (
    <div>
      <button 
        onMouseEnter={() => setShowInfo(true)}
        onMouseLeave={() => setShowInfo(false)}
      >
        查看股票信息
      </button>
      
      <StockInfoCard 
        code="000001" 
        visible={showInfo}
        onLoad={(info) => console.log('股票信息已加载', info)}
      />
    </div>
  )
}
```

### 在 SuperChart 中使用

```tsx
<div 
  className="sc-name"
  onMouseEnter={() => setShowStockInfo(true)}
  onMouseLeave={() => setShowStockInfo(false)}
>
  {stockName}
  {showStockInfo && (
    <div className="sc-stock-info-popup">
      <StockInfoCard code={code} visible={showStockInfo} />
    </div>
  )}
</div>
```

## Props

| 属性 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| code | string | ✅ | - | 股票代码（如 "000001"） |
| visible | boolean | ✅ | - | 是否显示卡片 |
| onLoad | (info: StockInfo) => void | ❌ | - | 数据加载完成回调 |

## StockInfo 数据结构

```typescript
interface StockInfo {
  // 基本信息
  code: string              // 股票代码
  name: string              // 股票名称
  price: number             // 当前价格
  preClose: number          // 昨收价
  
  // 市场数据
  totalShares?: number      // 总股本（万股）
  floatShares?: number      // 流通股（万股）
  totalMarketCap?: number   // 总市值（亿元）
  floatMarketCap?: number   // 流通市值（亿元）
  
  // 行业与上市信息
  industry?: string         // 所属行业
  listDate?: string         // 上市时间
  
  // 估值指标
  pe?: number              // 市盈率（动态）
  pb?: number              // 市净率
  ps?: number              // 市销率
  
  // 财务指标
  roe?: number             // 净资产收益率
  eps?: number             // 每股收益
  bvps?: number            // 每股净资产
  
  // 交易数据
  turnoverRate?: number    // 换手率
  amplitude?: number       // 振幅
  volume?: number          // 成交量
  amount?: number          // 成交额
}
```

## 样式定制

组件使用 CSS Variables，可以通过修改变量来定制样式：

```css
:root {
  --bg-surface: #ffffff;
  --text-primary: #111827;
  --text-secondary: #6b7280;
  --text-tertiary: #9ca3af;
  --border-light: #e5e7eb;
  --color-up: #ef4444;
  --color-down: #10b981;
  --shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
}
```

## 数据接口集成

### 后端 API 示例

```python
# Python Flask 示例
from flask import Flask, jsonify
import akshare as ak

app = Flask(__name__)

@app.route('/api/stock/info/<code>')
def get_stock_info(code):
    try:
        # 获取基本信息
        df = ak.stock_individual_info_em(symbol=code)
        
        # 转换为字典
        info_dict = {}
        for _, row in df.iterrows():
            info_dict[row['item']] = row['value']
        
        # 格式化返回数据
        return jsonify({
            'code': code,
            'name': info_dict.get('股票简称', ''),
            'price': float(info_dict.get('最新', 0)),
            'totalShares': float(info_dict.get('总股本', 0)),
            'floatShares': float(info_dict.get('流通股', 0)),
            'totalMarketCap': float(info_dict.get('总市值', 0)) / 100000000,
            'floatMarketCap': float(info_dict.get('流通市值', 0)) / 100000000,
            'industry': info_dict.get('行业', ''),
            'listDate': info_dict.get('上市时间', ''),
            # ... 其他字段
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500
```

### 前端调用示例

```typescript
// 在 StockInfoCard 组件中
const fetchStockInfo = async () => {
  try {
    const response = await fetch(`/api/stock/info/${code}`)
    const data = await response.json()
    setInfo(data)
  } catch (err) {
    setError('加载失败')
  }
}
```

## 注意事项

1. **数据更新频率**：建议缓存数据，避免频繁请求
2. **错误处理**：需要处理网络错误和数据缺失情况
3. **性能优化**：仅在 `visible=true` 时加载数据
4. **响应式**：在小屏幕上注意卡片位置和大小

## 浏览器兼容性

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## 更新日志

### v1.0.0 (2024-12-11)
- ✨ 初始版本
- ✨ 支持基本信息展示
- ✨ 支持深色主题
- ✨ 添加动画效果
