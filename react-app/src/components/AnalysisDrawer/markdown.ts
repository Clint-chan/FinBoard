/**
 * Markdown 渲染工具
 * 简单的 Markdown 解析器，支持常用语法和 AI 思考过程
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

// 解析行内元素（不转义 HTML，因为我们已经处理过了）
function parseInlineRaw(text: string): string {
  let result = text
  
  // 粗体 **text** 或 __text__
  result = result.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  result = result.replace(/__(.+?)__/g, '<strong>$1</strong>')
  
  // 斜体 *text* 或 _text_（但不匹配 ** 或 __）
  result = result.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '<em>$1</em>')
  result = result.replace(/(?<!_)_(?!_)(.+?)(?<!_)_(?!_)/g, '<em>$1</em>')
  
  // 行内代码 `code`
  result = result.replace(/`([^`]+)`/g, '<code>$1</code>')
  
  // 链接 [text](url)
  result = result.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
  
  return result
}

/**
 * 渲染思考块为 HTML
 */
function renderThinkingBlock(content: string, isComplete: boolean): string {
  const openAttr = isComplete ? '' : ' open'
  
  // 简单处理思考内容：保留换行，转义 HTML
  const lines = content.trim().split('\n')
  const formattedContent = lines
    .map(line => escapeHtml(line))
    .join('<br>')
  
  return `<div class="thinking-block"${openAttr}>
    <div class="thinking-header" onclick="this.parentElement.classList.toggle('collapsed')">
      <span class="thinking-icon">${isComplete ? '💭' : '🧠'}</span>
      <span class="thinking-title">${isComplete ? '思考过程' : '思考中...'}</span>
      <span class="thinking-toggle">▼</span>
    </div>
    <div class="thinking-content">${formattedContent}</div>
  </div>`
}

/**
 * 渲染 Markdown 为 HTML
 * 支持流式渲染场景下的 think 标签
 */
export function renderMarkdown(markdown: string): string {
  if (!markdown) return ''
  
  // 第一步：处理 think 标签
  let content = markdown
  const thinkBlocks: { html: string; placeholder: string }[] = []
  
  // 处理完整的 <think>...</think>
  content = content.replace(/<think>([\s\S]*?)<\/think>/g, (_, thinkContent) => {
    const placeholder = `\x00THINK${thinkBlocks.length}\x00`
    thinkBlocks.push({
      html: renderThinkingBlock(thinkContent, true),
      placeholder
    })
    return placeholder
  })
  
  // 处理未闭合的 <think>...（流式场景）
  const pendingMatch = content.match(/<think>([\s\S]*)$/)
  if (pendingMatch) {
    const placeholder = `\x00PENDING${thinkBlocks.length}\x00`
    thinkBlocks.push({
      html: renderThinkingBlock(pendingMatch[1], false),
      placeholder
    })
    content = content.replace(/<think>([\s\S]*)$/, placeholder)
  }
  
  // 第二步：渲染 Markdown
  const lines = content.split('\n')
  const html: string[] = []
  let inList = false
  let inOrderedList = false
  let inCodeBlock = false
  let codeContent: string[] = []
  let inBlockquote = false
  
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i]
    
    // 检查是否包含占位符（单独一行）
    const placeholderMatch = line.match(/^\x00(THINK|PENDING)\d+\x00$/)
    if (placeholderMatch) {
      // 关闭之前的列表等
      if (inList) { html.push('</ul>'); inList = false }
      if (inOrderedList) { html.push('</ol>'); inOrderedList = false }
      if (inBlockquote) { html.push('</blockquote>'); inBlockquote = false }
      html.push(line) // 保留占位符，后面替换
      continue
    }
    
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
      if (inList) { html.push('</ul>'); inList = false }
      if (inOrderedList) { html.push('</ol>'); inOrderedList = false }
      if (inBlockquote) { html.push('</blockquote>'); inBlockquote = false }
      continue
    }
    
    // 标题
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/)
    if (headingMatch) {
      const level = headingMatch[1].length
      html.push(`<h${level}>${parseInlineRaw(escapeHtml(headingMatch[2]))}</h${level}>`)
      continue
    }
    
    // 引用
    if (line.startsWith('>')) {
      if (!inBlockquote) { html.push('<blockquote>'); inBlockquote = true }
      html.push(`<p>${parseInlineRaw(escapeHtml(line.slice(1).trim()))}</p>`)
      continue
    } else if (inBlockquote) {
      html.push('</blockquote>')
      inBlockquote = false
    }
    
    // 无序列表
    const ulMatch = line.match(/^[-*]\s+(.+)$/)
    if (ulMatch) {
      if (!inList) { html.push('<ul>'); inList = true }
      html.push(`<li>${parseInlineRaw(escapeHtml(ulMatch[1]))}</li>`)
      continue
    } else if (inList) {
      html.push('</ul>')
      inList = false
    }
    
    // 有序列表
    const olMatch = line.match(/^\d+\.\s+(.+)$/)
    if (olMatch) {
      if (!inOrderedList) { html.push('<ol>'); inOrderedList = true }
      html.push(`<li>${parseInlineRaw(escapeHtml(olMatch[1]))}</li>`)
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
    html.push(`<p>${parseInlineRaw(escapeHtml(line))}</p>`)
  }
  
  // 关闭未闭合的标签
  if (inList) html.push('</ul>')
  if (inOrderedList) html.push('</ol>')
  if (inBlockquote) html.push('</blockquote>')
  if (inCodeBlock) {
    html.push(`<pre><code>${escapeHtml(codeContent.join('\n'))}</code></pre>`)
  }
  
  // 第三步：替换占位符为思考块 HTML
  let result = html.join('')
  thinkBlocks.forEach(({ html: blockHtml, placeholder }) => {
    result = result.replace(placeholder, blockHtml)
    // 也替换被包裹在 <p> 标签中的情况
    result = result.replace(`<p>${placeholder}</p>`, blockHtml)
  })
  
  return result
}

export default renderMarkdown
