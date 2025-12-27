/**
 * 日报图片生成模块
 * 使用 Satori 生成 SVG，再用 resvg-wasm 转换为 PNG
 */
import satori from 'satori'
import { Resvg, initWasm } from '@resvg/resvg-wasm'

// WASM 初始化状态
let wasmInitialized = false

/**
 * 初始化 WASM（从 CDN 加载）
 */
async function ensureWasmInit() {
  if (wasmInitialized) return
  
  // 从 unpkg CDN 加载 WASM
  const wasmUrl = 'https://unpkg.com/@aspect-dev/resvg-wasm@2.6.2/index_bg.wasm'
  const wasmResponse = await fetch(wasmUrl)
  const wasmBuffer = await wasmResponse.arrayBuffer()
  await initWasm(wasmBuffer)
  wasmInitialized = true
  console.log('resvg WASM initialized')
}

// 字体缓存
let fontCache = null

/**
 * 加载中文字体
 */
async function loadFont() {
  if (fontCache) return fontCache
  
  // 使用 Google Fonts 的 Noto Sans SC
  const fontUrl = 'https://fonts.gstatic.com/s/notosanssc/v36/k3kCo84MPvpLmixcA63oeAL7Iqp5IZJF9bmaG9_FnYxNbPzS5HE.woff2'
  const res = await fetch(fontUrl)
  fontCache = await res.arrayBuffer()
  return fontCache
}

/**
 * 生成日报图片
 * @param {object} report - 日报内容
 * @param {string} date - 日期 YYYY-MM-DD
 * @returns {Promise<Uint8Array>} PNG 图片数据
 */
export async function generateDailyImage(report, date) {
  await ensureWasmInit()
  const fontData = await loadFont()
  
  const formattedDate = date.replace(/-/g, '.')
  
  // 构建 Satori 元素
  const element = buildReportElement(report, formattedDate)
  
  // 生成 SVG（600px 宽度，适合邮件显示）
  const svg = await satori(element, {
    width: 600,
    height: 1100,
    fonts: [{
      name: 'Noto Sans SC',
      data: fontData,
      weight: 400,
      style: 'normal'
    }]
  })
  
  // SVG 转 PNG
  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: 600 }
  })
  const pngData = resvg.render()
  return pngData.asPng()
}


/**
 * 构建日报元素（Satori 虚拟 DOM）
 */
function buildReportElement(report, formattedDate) {
  return {
    type: 'div',
    props: {
      style: {
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        height: '100%',
        backgroundColor: '#f8fafc',
        padding: '28px',
        fontFamily: 'Noto Sans SC'
      },
      children: [
        buildHeader(formattedDate),
        buildPrediction(report.prediction),
        buildSectors(report.sectors),
        buildActionable(report.actionable),
        buildIntelligence(report.intelligence),
        buildFooter()
      ].filter(Boolean)
    }
  }
}

/**
 * Header
 */
function buildHeader(formattedDate) {
  return {
    type: 'div',
    props: {
      style: {
        display: 'flex',
        alignItems: 'center',
        marginBottom: '20px',
        paddingBottom: '16px',
        borderBottom: '2px solid #e2e8f0'
      },
      children: [
        {
          type: 'div',
          props: {
            style: {
              width: '48px',
              height: '48px',
              backgroundColor: '#7c3aed',
              borderRadius: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              fontSize: '24px',
              fontWeight: 'bold',
              marginRight: '14px'
            },
            children: 'F'
          }
        },
        {
          type: 'div',
          props: {
            style: { display: 'flex', flexDirection: 'column' },
            children: [
              {
                type: 'div',
                props: {
                  style: { fontSize: '26px', fontWeight: 'bold', color: '#1e293b' },
                  children: 'Fintell 每日早报'
                }
              },
              {
                type: 'div',
                props: {
                  style: { fontSize: '14px', color: '#64748b', marginTop: '2px' },
                  children: formattedDate
                }
              }
            ]
          }
        }
      ]
    }
  }
}

/**
 * 大盘研判
 */
function buildPrediction(prediction) {
  if (!prediction) return null
  
  return {
    type: 'div',
    props: {
      style: {
        backgroundColor: '#faf5ff',
        borderRadius: '14px',
        padding: '18px',
        marginBottom: '16px',
        border: '1px solid #e9d5ff'
      },
      children: [
        {
          type: 'div',
          props: {
            style: { fontSize: '12px', fontWeight: 'bold', color: '#7c3aed', marginBottom: '10px' },
            children: '📊 大盘核心研判'
          }
        },
        {
          type: 'div',
          props: {
            style: { fontSize: '22px', fontWeight: 'bold', color: '#1e1b4b', marginBottom: '4px' },
            children: prediction.tone || ''
          }
        },
        {
          type: 'div',
          props: {
            style: { fontSize: '14px', color: '#6b7280', marginBottom: '10px' },
            children: prediction.subtitle || ''
          }
        },
        {
          type: 'div',
          props: {
            style: { fontSize: '13px', color: '#4b5563', lineHeight: 1.5 },
            children: stripHtml(prediction.summary || '')
          }
        },
        // 资金面
        {
          type: 'div',
          props: {
            style: { display: 'flex', gap: '12px', marginTop: '14px' },
            children: [
              buildInfoBox('北向资金', stripHtml(prediction.northbound || '-')),
              buildInfoBox('成交量预期', stripHtml(prediction.volume || '-'))
            ]
          }
        }
      ]
    }
  }
}

function buildInfoBox(label, value) {
  return {
    type: 'div',
    props: {
      style: {
        flex: 1,
        backgroundColor: 'white',
        borderRadius: '8px',
        padding: '10px',
        border: '1px solid #e5e7eb'
      },
      children: [
        {
          type: 'div',
          props: {
            style: { fontSize: '10px', color: '#9ca3af', marginBottom: '4px' },
            children: label
          }
        },
        {
          type: 'div',
          props: {
            style: { fontSize: '12px', color: '#374151' },
            children: value
          }
        }
      ]
    }
  }
}


/**
 * 板块分析
 */
function buildSectors(sectors) {
  if (!sectors) return null
  
  return {
    type: 'div',
    props: {
      style: { display: 'flex', gap: '12px', marginBottom: '16px' },
      children: [
        buildSectorCard('📈 利好板块', sectors.bullish || [], '#16a34a', '#f0fdf4', '#dcfce7'),
        buildSectorCard('📉 承压板块', sectors.bearish || [], '#dc2626', '#fef2f2', '#fee2e2')
      ]
    }
  }
}

function buildSectorCard(title, items, color, bgColor, itemBg) {
  const sectorItems = items.slice(0, 3).map(item => ({
    type: 'div',
    props: {
      style: {
        backgroundColor: itemBg,
        borderRadius: '8px',
        padding: '10px',
        marginBottom: '8px'
      },
      children: [
        {
          type: 'div',
          props: {
            style: { fontSize: '13px', fontWeight: 'bold', color: '#1f2937', marginBottom: '3px' },
            children: item.name || ''
          }
        },
        {
          type: 'div',
          props: {
            style: { fontSize: '11px', color: '#6b7280' },
            children: item.reason || ''
          }
        }
      ]
    }
  }))
  
  return {
    type: 'div',
    props: {
      style: {
        flex: 1,
        backgroundColor: 'white',
        borderRadius: '14px',
        padding: '14px',
        border: `1px solid ${itemBg}`
      },
      children: [
        {
          type: 'div',
          props: {
            style: { fontSize: '13px', fontWeight: 'bold', color, marginBottom: '10px' },
            children: title
          }
        },
        ...sectorItems
      ]
    }
  }
}

/**
 * 交易策略
 */
function buildActionable(actionable) {
  if (!actionable) return null
  
  return {
    type: 'div',
    props: {
      style: {
        backgroundColor: '#fefce8',
        borderRadius: '14px',
        padding: '16px',
        marginBottom: '16px',
        border: '1px solid #fde047'
      },
      children: [
        {
          type: 'div',
          props: {
            style: { fontSize: '12px', fontWeight: 'bold', color: '#854d0e', marginBottom: '12px' },
            children: '🎯 今日交易策略'
          }
        },
        {
          type: 'div',
          props: {
            style: { display: 'flex', gap: '12px' },
            children: [
              buildActionBox('🛡️ 防守避雷', actionable.avoid || '-', '#d97706', '#fffbeb'),
              buildActionBox('⚡ 关注替代', actionable.focus || '-', '#059669', '#ecfdf5')
            ]
          }
        }
      ]
    }
  }
}

function buildActionBox(label, value, color, bgColor) {
  return {
    type: 'div',
    props: {
      style: {
        flex: 1,
        backgroundColor: bgColor,
        borderRadius: '10px',
        padding: '12px'
      },
      children: [
        {
          type: 'div',
          props: {
            style: { fontSize: '11px', color, fontWeight: 'bold', marginBottom: '6px' },
            children: label
          }
        },
        {
          type: 'div',
          props: {
            style: { fontSize: '13px', color: '#1f2937', fontWeight: '500' },
            children: value
          }
        }
      ]
    }
  }
}

/**
 * 情报矩阵（简化版）
 */
function buildIntelligence(intelligence) {
  if (!intelligence || !intelligence.length) return null
  
  const colorMap = {
    tech: { bg: '#eff6ff', border: '#bfdbfe', text: '#1e40af' },
    fin: { bg: '#fef3c7', border: '#fcd34d', text: '#92400e' },
    geo: { bg: '#fee2e2', border: '#fca5a5', text: '#991b1b' },
    soc: { bg: '#ecfdf5', border: '#6ee7b7', text: '#065f46' },
    other: { bg: '#f3f4f6', border: '#d1d5db', text: '#374151' }
  }
  
  const cards = intelligence.slice(0, 4).map(cat => {
    const colors = colorMap[cat.color] || colorMap.other
    const firstItem = cat.items?.[0]
    
    return {
      type: 'div',
      props: {
        style: {
          flex: 1,
          backgroundColor: colors.bg,
          borderRadius: '10px',
          padding: '12px',
          border: `1px solid ${colors.border}`
        },
        children: [
          {
            type: 'div',
            props: {
              style: { fontSize: '11px', fontWeight: 'bold', color: colors.text, marginBottom: '6px' },
              children: cat.category
            }
          },
          firstItem ? {
            type: 'div',
            props: {
              style: { fontSize: '12px', fontWeight: '600', color: '#1f2937', marginBottom: '4px' },
              children: firstItem.title
            }
          } : null,
          firstItem ? {
            type: 'div',
            props: {
              style: { fontSize: '10px', color: '#6b7280', lineHeight: 1.4 },
              children: firstItem.summary?.substring(0, 60) + (firstItem.summary?.length > 60 ? '...' : '')
            }
          } : null
        ].filter(Boolean)
      }
    }
  })
  
  return {
    type: 'div',
    props: {
      style: { marginBottom: '16px' },
      children: [
        {
          type: 'div',
          props: {
            style: { fontSize: '12px', fontWeight: 'bold', color: '#6b7280', marginBottom: '10px' },
            children: '🌐 全球情报矩阵'
          }
        },
        {
          type: 'div',
          props: {
            style: { display: 'flex', gap: '10px' },
            children: cards
          }
        }
      ]
    }
  }
}

/**
 * Footer
 */
function buildFooter() {
  return {
    type: 'div',
    props: {
      style: {
        marginTop: 'auto',
        textAlign: 'center',
        paddingTop: '14px',
        borderTop: '1px solid #e2e8f0'
      },
      children: [
        {
          type: 'div',
          props: {
            style: { fontSize: '11px', color: '#94a3b8' },
            children: 'Fintell | board.newestgpt.com'
          }
        }
      ]
    }
  }
}

/**
 * 去除 HTML 标签
 */
function stripHtml(html) {
  if (!html) return ''
  return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim()
}
