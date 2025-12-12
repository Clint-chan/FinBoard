/**
 * AI API 测试脚本
 * 用于验证 Worker AI 功能是否正常工作
 */

const API_BASE = 'https://market-api.newestgpt.com'

async function testAIConfig() {
  console.log('📋 测试 AI 配置获取...')
  try {
    const response = await fetch(`${API_BASE}/api/ai/config`)
    const data = await response.json()
    console.log('✅ 配置获取成功:', data)
    return true
  } catch (error) {
    console.error('❌ 配置获取失败:', error.message)
    return false
  }
}

async function testAIChat() {
  console.log('\n💬 测试 AI 聊天（流式响应）...')
  try {
    const response = await fetch(`${API_BASE}/api/ai/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: [
          { role: 'user', content: '分析一下当前走势' }
        ],
        stockData: {
          code: '600519',
          name: '贵州茅台',
          price: 1650.00,
          preClose: 1640.00,
          high: 1660.00,
          low: 1645.00,
          vol: 1000000,
          amt: 1650000000
        },
        mode: 'intraday'
      })
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }

    console.log('✅ 连接成功，开始接收流式数据...\n')

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let fullContent = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      const chunk = decoder.decode(value, { stream: true })
      const lines = chunk.split('\n').filter(line => line.trim())

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6)
          if (data === '[DONE]') {
            console.log('\n\n✅ 流式响应完成')
            continue
          }

          try {
            const json = JSON.parse(data)
            if (json.content) {
              process.stdout.write(json.content)
              fullContent += json.content
            }
            if (json.error) {
              throw new Error(json.error)
            }
          } catch (e) {
            if (e.message !== 'Unexpected end of JSON input') {
              console.error('\n❌ 解析错误:', e.message)
            }
          }
        }
      }
    }

    console.log('\n\n📊 总字符数:', fullContent.length)
    return true
  } catch (error) {
    console.error('❌ 聊天测试失败:', error.message)
    return false
  }
}

async function testStockDataCollection() {
  console.log('\n📈 测试股票数据采集...')
  try {
    const response = await fetch(`${API_BASE}/api/ai/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: [
          { role: 'user', content: '请列出当前采集到的所有数据' }
        ],
        stockData: {
          code: '000001',
          name: '平安银行'
        },
        mode: 'intraday'
      })
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }

    console.log('✅ 数据采集请求成功\n')

    const reader = response.body.getReader()
    const decoder = new TextDecoder()

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      const chunk = decoder.decode(value, { stream: true })
      const lines = chunk.split('\n').filter(line => line.trim())

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6)
          if (data === '[DONE]') continue

          try {
            const json = JSON.parse(data)
            if (json.content) {
              process.stdout.write(json.content)
            }
          } catch (e) {}
        }
      }
    }

    console.log('\n\n✅ 数据采集测试完成')
    return true
  } catch (error) {
    console.error('❌ 数据采集测试失败:', error.message)
    return false
  }
}

async function runTests() {
  console.log('🚀 开始测试 AI API...\n')
  console.log('=' .repeat(60))

  const results = []

  // 测试 1: 配置获取
  results.push(await testAIConfig())

  // 测试 2: AI 聊天
  results.push(await testAIChat())

  // 测试 3: 数据采集
  results.push(await testStockDataCollection())

  console.log('\n' + '='.repeat(60))
  console.log('\n📊 测试结果汇总:')
  console.log(`✅ 通过: ${results.filter(r => r).length}/${results.length}`)
  console.log(`❌ 失败: ${results.filter(r => !r).length}/${results.length}`)

  if (results.every(r => r)) {
    console.log('\n🎉 所有测试通过！AI 功能正常工作。')
  } else {
    console.log('\n⚠️  部分测试失败，请检查配置和网络连接。')
  }
}

// 运行测试
runTests().catch(console.error)
