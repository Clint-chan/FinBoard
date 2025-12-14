# 东方财富 API 接口测试脚本 (PowerShell)
# 使用方法: .\test-api-curl.ps1 [股票代码]

param(
    [string]$StockCode = "600519"
)

$MarketCode = if ($StockCode.StartsWith("6")) { 1 } else { 0 }

Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "测试股票: $StockCode (市场代码: $MarketCode)" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""

# 1. 测试盘口数据
Write-Host "1️⃣  测试盘口数据（买卖五档）" -ForegroundColor Yellow
Write-Host "-----------------------------------"
$url1 = "https://push2.eastmoney.com/api/qt/stock/get"
$params1 = @{
    fltt = "2"
    invt = "2"
    fields = "f11,f12,f13,f14,f15,f16,f17,f18,f19,f20,f31,f32,f33,f34,f35,f36,f37,f38,f39,f40,f43,f49,f161"
    secid = "$MarketCode.$StockCode"
}
try {
    $response1 = Invoke-RestMethod -Uri $url1 -Method Get -Body $params1
    $data = $response1.data
    Write-Host "✅ 盘口数据获取成功" -ForegroundColor Green
    Write-Host "买一: $($data.f19) ($($data.f20 * 100)手)"
    Write-Host "卖一: $($data.f39) ($($data.f40 * 100)手)"
    Write-Host "最新价: $($data.f43)"
    Write-Host "外盘/内盘: $($data.f49)/$($data.f161)"
} catch {
    Write-Host "❌ 盘口数据获取失败: $_" -ForegroundColor Red
}
Write-Host ""

# 2. 测试资金流向
Write-Host "2️⃣  测试资金流向（主力/大单/中单/小单）" -ForegroundColor Yellow
Write-Host "-----------------------------------"
$timestamp = [DateTimeOffset]::Now.ToUnixTimeMilliseconds()
$url2 = "https://push2his.eastmoney.com/api/qt/stock/fflow/daykline/get"
$params2 = @{
    lmt = "5"
    klt = "101"
    secid = "$MarketCode.$StockCode"
    fields1 = "f1,f2,f3,f7"
    fields2 = "f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61,f62,f63,f64,f65"
    ut = "b2884a393a59ad64002292a3e90d46a5"
    _ = $timestamp
}
try {
    $response2 = Invoke-RestMethod -Uri $url2 -Method Get -Body $params2
    $klines = $response2.data.klines
    if ($klines) {
        Write-Host "✅ 资金流向数据获取成功" -ForegroundColor Green
        Write-Host "最近 $($klines.Count) 天数据:"
        $latest = $klines[-1].Split(',')
        Write-Host "  日期: $($latest[0])"
        Write-Host "  主力净流入: $([math]::Round($latest[1] / 10000, 2))万"
        Write-Host "  主力净流入占比: $($latest[6])%"
    } else {
        Write-Host "⚠️  无资金流向数据" -ForegroundColor Yellow
    }
} catch {
    Write-Host "❌ 资金流向数据获取失败: $_" -ForegroundColor Red
}
Write-Host ""

# 3. 测试分时成交明细
Write-Host "3️⃣  测试分时成交明细（逐笔数据）" -ForegroundColor Yellow
Write-Host "-----------------------------------"
$url3 = "https://70.push2.eastmoney.com/api/qt/stock/details/sse"
$params3 = @{
    fields1 = "f1,f2,f3,f4"
    fields2 = "f51,f52,f53,f54,f55"
    mpi = "100"
    ut = "bd1d9ddb04089700cf9c27f6f7426281"
    fltt = "2"
    pos = "-0"
    secid = "$MarketCode.$StockCode"
    wbp2u = "|0|0|0|web"
}
try {
    $response3 = Invoke-WebRequest -Uri $url3 -Method Get -Body $params3
    $text = $response3.Content
    $lines = $text -split "`n" | Where-Object { $_ -match "^data: " }
    if ($lines.Count -gt 0) {
        $jsonStr = $lines[0] -replace "^data: ", ""
        $data3 = $jsonStr | ConvertFrom-Json
        if ($data3.data.details) {
            Write-Host "✅ 成交明细获取成功" -ForegroundColor Green
            Write-Host "总笔数: $($data3.data.details.Count)"
            $first = $data3.data.details[0].Split(',')
            Write-Host "最新一笔: 时间=$($first[0]) 价格=$($first[1]) 手数=$($first[2])"
        }
    } else {
        Write-Host "⚠️  无成交明细数据" -ForegroundColor Yellow
    }
} catch {
    Write-Host "❌ 成交明细获取失败: $_" -ForegroundColor Red
}
Write-Host ""

# 4. 测试实时行情
Write-Host "4️⃣  测试实时行情（完整字段）" -ForegroundColor Yellow
Write-Host "-----------------------------------"
$url4 = "https://push2.eastmoney.com/api/qt/stock/get"
$params4 = @{
    ut = "fa5fd1943c7b386f172d6893dbfba10b"
    invt = "2"
    fltt = "2"
    fields = "f43,f44,f45,f46,f47,f48,f50,f57,f58,f60,f168,f169,f170,f171"
    secid = "$MarketCode.$StockCode"
}
try {
    $response4 = Invoke-RestMethod -Uri $url4 -Method Get -Body $params4
    $data4 = $response4.data
    Write-Host "✅ 实时行情获取成功" -ForegroundColor Green
    Write-Host "股票名称: $($data4.f58)"
    Write-Host "最新价: $($data4.f43)"
    Write-Host "涨跌幅: $($data4.f170)%"
    Write-Host "换手率: $($data4.f168)%"
    Write-Host "量比: $($data4.f50)"
} catch {
    Write-Host "❌ 实时行情获取失败: $_" -ForegroundColor Red
}
Write-Host ""

# 5. 测试K线数据
Write-Host "5️⃣  测试K线数据（60分钟，最近10根）" -ForegroundColor Yellow
Write-Host "-----------------------------------"
$url5 = "https://push2his.eastmoney.com/api/qt/stock/kline/get"
$params5 = @{
    fields1 = "f1,f2,f3,f4,f5,f6"
    fields2 = "f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61"
    ut = "7eea3edcaed734bea9cbfc24409ed989"
    klt = "60"
    fqt = "1"
    secid = "$MarketCode.$StockCode"
    beg = "0"
    end = "20500101"
    lmt = "10"
}
try {
    $response5 = Invoke-RestMethod -Uri $url5 -Method Get -Body $params5
    $klines5 = $response5.data.klines
    if ($klines5) {
        Write-Host "✅ K线数据获取成功" -ForegroundColor Green
        Write-Host "K线数量: $($klines5.Count)"
        $latest5 = $klines5[-1].Split(',')
        Write-Host "最新K线: 时间=$($latest5[0]) 收盘=$($latest5[2])"
    }
} catch {
    Write-Host "❌ K线数据获取失败: $_" -ForegroundColor Red
}
Write-Host ""

# 6. 测试分时数据
Write-Host "6️⃣  测试分时数据（当日）" -ForegroundColor Yellow
Write-Host "-----------------------------------"
$url6 = "https://push2.eastmoney.com/api/qt/stock/trends2/get"
$params6 = @{
    fields1 = "f1,f2,f3,f4,f5,f6,f7,f8,f9,f10,f11,f12,f13"
    fields2 = "f51,f52,f53,f54,f55,f56,f57,f58"
    ut = "7eea3edcaed734bea9cbfc24409ed989"
    ndays = "1"
    iscr = "0"
    secid = "$MarketCode.$StockCode"
}
try {
    $response6 = Invoke-RestMethod -Uri $url6 -Method Get -Body $params6
    $trends = $response6.data.trends
    if ($trends) {
        Write-Host "✅ 分时数据获取成功" -ForegroundColor Green
        Write-Host "分时点数: $($trends.Count)"
        Write-Host "昨收: $($response6.data.preClose)"
    }
} catch {
    Write-Host "❌ 分时数据获取失败: $_" -ForegroundColor Red
}
Write-Host ""

Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "✅ 所有测试完成" -ForegroundColor Green
Write-Host "=========================================" -ForegroundColor Cyan
