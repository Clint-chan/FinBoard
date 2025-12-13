/**
 * Markdown 渲染工具
 * 支持 AI 思考过程的流式渲染
 */

// 转义 HTML 特殊字符
function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  }
  return text.replace(/[&<>"']/g, (c) => map[c])
}

// 解析行内 Markdown
function parseInline(text: string): string {
  let result = text

  // 粗体 **text**
  result = result.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')

  // 斜体 *text*（不匹配 **）
  result = result.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '<em>$1</em>')

  // 行内代码 `code`
  result = result.replace(/`([^`]+)`/g, '<code>$1</code>')

  // 链接 [text](url)
  result = result.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener">$1</a>'
  )

  return result
}

// 思考块图标 SVG
const THINKING_ICON = `<svg class="thinking-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
  <circle cx="12" cy="12" r="10"/>
  <path d="M12 6v6l4 2"/>
</svg>`

/**
 * 渲染思考块
 * @param content 思考内容
 * @param isComplete 是否已完成（有 </think> 结束标签）
 */
function renderThinkingBlock(content: string, isComplete: boolean): string {
  const statusText = isComplete ? '思考过程' : '思考中...'
  const collapsedClass = isComplete ? 'collapsed' : ''

  // 处理思考内容：转义 HTML，保留换行
  const lines = content
    .trim()
    .split('\n')
    .filter((l) => l.trim())
  const formattedContent = lines.map((line) => `<p>${escapeHtml(line)}</p>`).join('')

  return `<div class="thinking-block ${collapsedClass}">
    <div class="thinking-header">
      ${THINKING_ICON}
      <span class="thinking-status">${statusText}</span>
      <svg class="thinking-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="6 9 12 15 18 9"/>
      </svg>
    </div>
    <div class="thinking-body">
      ${formattedContent}
    </div>
  </div>`
}

/**
 * 渲染 Markdown 为 HTML
 */
export function renderMarkdown(markdown: string): string {
  if (!markdown) return ''

  let content = markdown
  const blocks: { html: string; placeholder: string }[] = []

  // 0. 预处理：移除 AI 可能重复的用户问题（通常在 think 标签后紧跟）
  // 匹配模式：</think> 后面紧跟的短句（通常是重复的用户问题）
  content = content.replace(/<\/think>\s*([^<\n]{1,20})\n/g, (match, possibleQuestion) => {
    // 如果这个短句看起来像是重复的问题（没有标点或只有简单标点），移除它
    const trimmed = possibleQuestion.trim()
    if (trimmed && !trimmed.includes('。') && !trimmed.includes('！') && !trimmed.includes('：')) {
      return '</think>\n'
    }
    return match
  })

  // 1. 处理完整的 <think>...</think>
  content = content.replace(/<think>([\s\S]*?)<\/think>/g, (_, thinkContent) => {
    const placeholder = `\x00T${blocks.length}\x00`
    blocks.push({
      html: renderThinkingBlock(thinkContent, true),
      placeholder,
    })
    return placeholder
  })

  // 2. 处理未闭合的 <think>...（流式场景）
  const pendingMatch = content.match(/<think>([\s\S]*)$/)
  if (pendingMatch) {
    const placeholder = `\x00P${blocks.length}\x00`
    blocks.push({
      html: renderThinkingBlock(pendingMatch[1], false),
      placeholder,
    })
    content = content.replace(/<think>([\s\S]*)$/, placeholder)
  }

  // 3. 渲染 Markdown
  const lines = content.split('\n')
  const html: string[] = []
  let inList = false
  let inOrderedList = false
  let inCodeBlock = false
  let codeLines: string[] = []
  let inBlockquote = false

  for (const line of lines) {
    // 占位符单独一行
    if (/^\x00[TP]\d+\x00$/.test(line)) {
      if (inList) {
        html.push('</ul>')
        inList = false
      }
      if (inOrderedList) {
        html.push('</ol>')
        inOrderedList = false
      }
      if (inBlockquote) {
        html.push('</blockquote>')
        inBlockquote = false
      }
      html.push(line)
      continue
    }

    // 代码块
    if (line.startsWith('```')) {
      if (inCodeBlock) {
        html.push(`<pre><code>${escapeHtml(codeLines.join('\n'))}</code></pre>`)
        codeLines = []
        inCodeBlock = false
      } else {
        inCodeBlock = true
      }
      continue
    }
    if (inCodeBlock) {
      codeLines.push(line)
      continue
    }

    // 空行
    if (!line.trim()) {
      if (inList) {
        html.push('</ul>')
        inList = false
      }
      if (inOrderedList) {
        html.push('</ol>')
        inOrderedList = false
      }
      if (inBlockquote) {
        html.push('</blockquote>')
        inBlockquote = false
      }
      continue
    }

    // 标题
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/)
    if (headingMatch) {
      const level = headingMatch[1].length
      html.push(`<h${level}>${parseInline(escapeHtml(headingMatch[2]))}</h${level}>`)
      continue
    }

    // 引用
    if (line.startsWith('>')) {
      if (!inBlockquote) {
        html.push('<blockquote>')
        inBlockquote = true
      }
      html.push(`<p>${parseInline(escapeHtml(line.slice(1).trim()))}</p>`)
      continue
    } else if (inBlockquote) {
      html.push('</blockquote>')
      inBlockquote = false
    }

    // 无序列表
    const ulMatch = line.match(/^[-*]\s+(.+)$/)
    if (ulMatch) {
      if (!inList) {
        html.push('<ul>')
        inList = true
      }
      html.push(`<li>${parseInline(escapeHtml(ulMatch[1]))}</li>`)
      continue
    } else if (inList) {
      html.push('</ul>')
      inList = false
    }

    // 有序列表
    const olMatch = line.match(/^\d+\.\s+(.+)$/)
    if (olMatch) {
      if (!inOrderedList) {
        html.push('<ol>')
        inOrderedList = true
      }
      html.push(`<li>${parseInline(escapeHtml(olMatch[1]))}</li>`)
      continue
    } else if (inOrderedList) {
      html.push('</ol>')
      inOrderedList = false
    }

    // 分隔线
    if (/^[-*]{3,}$/.test(line.trim())) {
      html.push('<hr>')
      continue
    }

    // 普通段落
    html.push(`<p>${parseInline(escapeHtml(line))}</p>`)
  }

  // 关闭未闭合标签
  if (inList) html.push('</ul>')
  if (inOrderedList) html.push('</ol>')
  if (inBlockquote) html.push('</blockquote>')
  if (inCodeBlock) {
    html.push(`<pre><code>${escapeHtml(codeLines.join('\n'))}</code></pre>`)
  }

  // 4. 替换占位符
  let result = html.join('')
  blocks.forEach(({ html: blockHtml, placeholder }) => {
    result = result.replace(placeholder, blockHtml)
    result = result.replace(`<p>${placeholder}</p>`, blockHtml)
  })

  return result
}

export default renderMarkdown
