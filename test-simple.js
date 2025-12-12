const API_BASE = 'https://market-board-api.945036663.workers.dev'

async function test() {
  try {
    const response = await fetch(`${API_BASE}/api/ai/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [{ role: 'user', content: '测试' }],
        stockData: { code: '600519' },
        mode: 'intraday'
      })
    })

    console.log('Status:', response.status)
    const text = await response.text()
    console.log('Response:', text.substring(0, 500))
  } catch (error) {
    console.error('Error:', error.message)
  }
}

test()
