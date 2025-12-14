#!/bin/bash

# 东方财富 API 接口测试脚本
# 使用方法: ./test-api-curl.sh [股票代码]

STOCK_CODE=${1:-600519}
MARKET_CODE=1

# 判断市场代码
if [[ $STOCK_CODE == 6* ]]; then
  MARKET_CODE=1
else
  MARKET_CODE=0
fi

echo "========================================="
echo "测试股票: $STOCK_CODE (市场代码: $MARKET_CODE)"
echo "========================================="
echo ""

# 1. 测试盘口数据
echo "1️⃣  测试盘口数据（买卖五档）"
echo "-----------------------------------"
curl -s "https://push2.eastmoney.com/api/qt/stock/get?fltt=2&invt=2&fields=f11,f12,f13,f14,f15,f16,f17,f18,f19,f20,f31,f32,f33,f34,f35,f36,f37,f38,f39,f40,f43,f49,f161&secid=${MARKET_CODE}.${STOCK_CODE}" | jq '.'
echo ""
echo ""

# 2. 测试资金流向
echo "2️⃣  测试资金流向（主力/大单/中单/小单）"
echo "-----------------------------------"
TIMESTAMP=$(date +%s)000
curl -s "https://push2his.eastmoney.com/api/qt/stock/fflow/daykline/get?lmt=5&klt=101&secid=${MARKET_CODE}.${STOCK_CODE}&fields1=f1,f2,f3,f7&fields2=f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61,f62,f63,f64,f65&ut=b2884a393a59ad64002292a3e90d46a5&_=${TIMESTAMP}" | jq '.'
echo ""
echo ""

# 3. 测试分时成交明细（前100笔）
echo "3️⃣  测试分时成交明细（逐笔数据）"
echo "-----------------------------------"
curl -s "https://70.push2.eastmoney.com/api/qt/stock/details/sse?fields1=f1,f2,f3,f4&fields2=f51,f52,f53,f54,f55&mpi=100&ut=bd1d9ddb04089700cf9c27f6f7426281&fltt=2&pos=-0&secid=${MARKET_CODE}.${STOCK_CODE}&wbp2u=|0|0|0|web"
echo ""
echo ""

# 4. 测试实时行情（完整字段）
echo "4️⃣  测试实时行情（完整字段）"
echo "-----------------------------------"
curl -s "https://push2.eastmoney.com/api/qt/stock/get?ut=fa5fd1943c7b386f172d6893dbfba10b&invt=2&fltt=2&fields=f43,f44,f45,f46,f47,f48,f50,f57,f58,f60,f168,f169,f170,f171&secid=${MARKET_CODE}.${STOCK_CODE}" | jq '.'
echo ""
echo ""

# 5. 测试K线数据（60分钟）
echo "5️⃣  测试K线数据（60分钟，最近10根）"
echo "-----------------------------------"
curl -s "https://push2his.eastmoney.com/api/qt/stock/kline/get?fields1=f1,f2,f3,f4,f5,f6&fields2=f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61&ut=7eea3edcaed734bea9cbfc24409ed989&klt=60&fqt=1&secid=${MARKET_CODE}.${STOCK_CODE}&beg=0&end=20500101&lmt=10" | jq '.'
echo ""
echo ""

# 6. 测试分时数据
echo "6️⃣  测试分时数据（当日）"
echo "-----------------------------------"
curl -s "https://push2.eastmoney.com/api/qt/stock/trends2/get?fields1=f1,f2,f3,f4,f5,f6,f7,f8,f9,f10,f11,f12,f13&fields2=f51,f52,f53,f54,f55,f56,f57,f58&ut=7eea3edcaed734bea9cbfc24409ed989&ndays=1&iscr=0&secid=${MARKET_CODE}.${STOCK_CODE}" | jq '.data.trends | length'
echo ""
echo ""

echo "========================================="
echo "✅ 所有测试完成"
echo "========================================="
