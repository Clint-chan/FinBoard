/**
 * Markdown 渲染工具
 * 简单的 Markdown 解析器，支持常用语法
 */

// 转义 HTML 特殊字符
function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  }
  return text.replace(/[&<>"']/g, c => map[c])
}

// 解析行内元素
function parseInline(text: string): string {
  // 转义 HTML
  let result = escapeHtml(text)
  
  // 粗体 **text** 或 __text__
  result = result.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  result = result.replace(/__(.+?)__/g, '<strong>$1</strong>')
  
  // 斜体 *text* 或 _text_
  result = result.replace(/\*(.+?)\*/g, '<em>$1</em>')
  result = result.replace(/_(.+?)_/g, '<em>$1</em>')
  
  // 行内代码 `code`
  result = result.replace(/`([^`]+)`/g, '<code>$1</code>')
  
  // 链接 [text](url)
  result = result.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
  
  return result
}

/**
 * 渲染 Markdown 为 HTML
 */
export function renderMarkdown(markdown: string): string {
  if (!markdown) return ''
  
  // 先提取并保护 <think> 标签内容
  const thinkPlaceholders: string[] = []
  let processedMarkdown = markdown.replace(/<think>([\s\S]*?)<\/think>/g, (_, thinkContent) => {
    const placeholder = `__THINK_PLACEHOLDER_${thinkPlaceholders.length}__`
    thinkPlaceholders.push(thinkContent.trim())
    return placeholder
  })
  
  const lines = processedMarkdown.split('\n')
  const html: string[] = []
  let inList = false
  let inOrderedList = false
  let inCodeBlock = false
  let codeContent: string[] = []
  let inBlockquote = false
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    
    // 代码块 ```
    if (line.startsWith('```')) {
      if (inCodeBlock) {
        html.push(`<pre><code>${escapeHtml(codeContent.join('\n'))}</code></pre>`)
        codeContent = []
        inCodeBlock = false
      } else {
        inCodeBlock = true
      }
      continue
    }
    
    if (inCodeBlock) {
      codeContent.push(line)
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
    
    // 标题 # ## ### #### ##### ######
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/)
    if (headingMatch) {
      const level = headingMatch[1].length
      const text = parseInline(headingMatch[2])
      html.push(`<h${level}>${text}</h${level}>`)
      continue
    }
    
    // 引用 >
    if (line.startsWith('>')) {
      const text = parseInline(line.slice(1).trim())
      if (!inBlockquote) {
        html.push('<blockquote>')
        inBlockquote = true
      }
      html.push(`<p>${text}</p>`)
      continue
    } else if (inBlockquote) {
      html.push('</blockquote>')
      inBlockquote = false
    }
    
    // 无序列表 - 或 *
    const ulMatch = line.match(/^[-*]\s+(.+)$/)
    if (ulMatch) {
      if (!inList) {
        html.push('<ul>')
        inList = true
      }
      html.push(`<li>${parseInline(ulMatch[1])}</li>`)
      continue
    } else if (inList) {
      html.push('</ul>')
      inList = false
    }
    
    // 有序列表 1. 2. 3.
    const olMatch = line.match(/^\d+\.\s+(.+)$/)
    if (olMatch) {
      if (!inOrderedList) {
        html.push('<ol>')
        inOrderedList = true
      }
      html.push(`<li>${parseInline(olMatch[1])}</li>`)
      continue
    } else if (inOrderedList) {
      html.push('</ol>')
      inOrderedList = false
    }
    
    // 分隔线 --- 或 ***
    if (/^[-*]{3,}$/.test(line.trim())) {
      html.push('<hr>')
      continue
    }
    
    // 普通段落
    html.push(`<p>${parseInline(line)}</p>`)
  }
  
  // 关闭未闭合的标签
  if (inList) html.push('</ul>')
  if (inOrderedList) html.push('</ol>')
  if (inBlockquote) html.push('</blockquote>')
  if (inCodeBlock) {
    html.push(`<pre><code>${escapeHtml(codeContent.join('\n'))}</code></pre>`)
  }
  
  // 恢复 think 标签
  let result = html.join('')
  thinkPlaceholders.forEach((thinkContent, index) => {
    const placeholder = `__THINK_PLACEHOLDER_${index}__`
    const thinkHtml = `<details class="thinking-block">
      <summary>💭 思考过程</summary>
      <div class="thinking-content">${escapeHtml(thinkContent)}</div>
    </details>`
    result = result.replace(placeholder, thinkHtml)
  })
  
  return result
}

export default renderMarkdown
