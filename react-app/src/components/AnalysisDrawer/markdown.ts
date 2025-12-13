/**
 * Markdown 渲染工具
 * 支持表格、列表、代码块等常用语法
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

  // 斜体 *text*
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

// 检测是否是表格行
function isTableRow(line: string): boolean {
  return line.trim().startsWith('|') && line.trim().endsWith('|')
}

// 检测是否是表格分隔行
function isTableSeparator(line: string): boolean {
  return /^\|[\s\-:|]+\|$/.test(line.trim())
}

// 解析表格行
function parseTableRow(line: string, isHeader: boolean = false): string {
  const cells = line
    .trim()
    .slice(1, -1) // 移除首尾的 |
    .split('|')
    .map((cell) => cell.trim())

  const tag = isHeader ? 'th' : 'td'
  const cellsHtml = cells.map((cell) => `<${tag}>${parseInline(escapeHtml(cell))}</${tag}>`).join('')

  return `<tr>${cellsHtml}</tr>`
}

/**
 * 渲染 Markdown 为 HTML
 */
export function renderMarkdown(markdown: string): string {
  if (!markdown) return ''

  const lines = markdown.split('\n')
  const html: string[] = []
  let inList = false
  let inOrderedList = false
  let inCodeBlock = false
  let codeLines: string[] = []
  let inBlockquote = false
  let inTable = false

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const nextLine = lines[i + 1]

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

    // 表格处理
    if (isTableRow(line)) {
      // 检查下一行是否是分隔符（表示当前行是表头）
      if (!inTable && nextLine && isTableSeparator(nextLine)) {
        html.push('<table>')
        html.push('<thead>')
        html.push(parseTableRow(line, true))
        html.push('</thead>')
        html.push('<tbody>')
        inTable = true
        continue
      }

      // 跳过分隔行
      if (isTableSeparator(line)) {
        continue
      }

      // 表格数据行
      if (inTable) {
        html.push(parseTableRow(line, false))
        continue
      }
    } else if (inTable) {
      // 表格结束
      html.push('</tbody>')
      html.push('</table>')
      inTable = false
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
      if (inTable) {
        html.push('</tbody>')
        html.push('</table>')
        inTable = false
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
  if (inTable) {
    html.push('</tbody>')
    html.push('</table>')
  }

  return html.join('')
}

export default renderMarkdown
