const INLINE = new Set(['b', 'strong', 'i', 'em', 'u', 's', 'a', 'span', 'mark', 'br', 'img', 'code'])
const WRAPPERS = { b: '**', strong: '**', i: '*', em: '*', s: '~~', code: '`' }
const FILE_NAME_LIMIT = 60

export function treeOf(node) {
  if (node.nodeType === 3) return node.data
  if (node.nodeType !== 1) return ''
  const attrs = {}
  for (const { name, value } of node.attributes) attrs[name] = value
  return { tag: node.tagName.toLowerCase(), attrs, children: [...node.childNodes].map(treeOf) }
}

export function treeOfBoard(elements) {
  const children = []
  for (const element of elements) {
    const type = element.dataset.type
    if (type === 'text') children.push({ tag: 'div', attrs: {}, children: treeOf(element.querySelector('.note')).children })
    else if (type === 'image') children.push({ tag: 'div', attrs: {}, children: [treeOf(element.querySelector('img'))] })
    else if (type === 'link') children.push({ tag: 'div', attrs: {}, children: [{ tag: 'a', attrs: { href: element.href }, children: [element.textContent.trim()] }] })
    else if (type === 'file') children.push({ tag: 'div', attrs: {}, children: [`${element.querySelector('.file-name').textContent} (${element.querySelector('.file-meta').textContent})`] })
  }
  return { tag: 'div', attrs: {}, children }
}

export function fileName(title, extension) {
  const clean = Array.from(String(title || '').replace(/[\\/:*?"<>|\u0000-\u001f]/g, '')).slice(0, FILE_NAME_LIMIT).join('').trim()
  return `${clean || 'rabisco'}.${extension}`
}

const isText = (node) => typeof node === 'string'
const linkTarget = (url) => url.replace(/[()]/g, (char) => (char === '(' ? '%28' : '%29'))
const isInline = (node) => isText(node) || INLINE.has(node.tag)
const hasClass = (node, name) => (node.attrs.class || '').split(/\s+/).includes(name)

function imageUrl(node, origin) {
  const src = node.attrs.src || ''
  return src.startsWith('/') ? `${origin}${src}` : ''
}

function wrap(marker, text) {
  const match = /^(\s*)([\s\S]*?)(\s*)$/.exec(text)
  return match[2] === '' ? text : `${match[1]}${marker}${match[2]}${marker}${match[3]}`
}

function inline(nodes, options) {
  return nodes.map((node) => {
    if (isText(node)) return node
    if (node.tag === 'br') return '\n'
    if (node.tag === 'code' && !options.markdown) return inline(node.children, options)
    if (node.tag === 'img') {
      const url = imageUrl(node, options.origin)
      if (!url) return ''
      return options.markdown ? `![image](${linkTarget(url)})` : url
    }
    const text = inline(node.children, options)
    if (!options.markdown) return text
    if (WRAPPERS[node.tag]) return wrap(WRAPPERS[node.tag], text)
    if (node.tag === 'a' && node.attrs.href) return `[${text}](${linkTarget(node.attrs.href)})`
    return text
  }).join('')
}

function listItems(node, options, depth) {
  const checklist = hasClass(node, 'ck')
  const lines = []
  let number = 0
  for (const item of node.children) {
    if (isText(item) || item.tag !== 'li') continue
    number += 1
    const own = item.children.filter((child) => isInline(child) || !['ul', 'ol'].includes(child.tag))
    const nested = item.children.filter((child) => !isText(child) && ['ul', 'ol'].includes(child.tag))
    const marker = node.tag === 'ol' ? `${number}. ` : checklist ? (hasClass(item, 'on') ? '- [x] ' : '- [ ] ') : '- '
    lines.push(`${'  '.repeat(depth)}${marker}${blocks(own, options, depth + 1).join('\n')}`)
    for (const list of nested) lines.push(...listItems(list, options, depth + 1))
  }
  return lines
}

function tableRows(node, options) {
  const rows = []
  const collect = (parent) => {
    for (const child of parent.children) {
      if (isText(child)) continue
      if (child.tag === 'tr') rows.push(child.children.filter((cell) => !isText(cell) && cell.tag === 'td').map((cell) => inline(cell.children, options).replace(/\s*\n\s*/g, ' ').trim()))
      else collect(child)
    }
  }
  collect(node)
  if (!options.markdown) return rows.map((cells) => cells.join('\t')).join('\n')
  const width = Math.max(1, ...rows.map((cells) => cells.length))
  const line = (cells) => `| ${Array.from({ length: width }, (_, index) => (cells[index] || '').replace(/\|/g, '\\|')).join(' | ')} |`
  const [head = [], ...rest] = rows
  return [line(head), `|${' --- |'.repeat(width)}`, ...rest.map(line)].join('\n')
}

function block(node, options, depth) {
  if (isText(node)) return node
  const heading = node.tag === 'h1' ? '# ' : node.tag === 'h2' ? '## ' : ''
  if (heading && node.children.every(isInline)) return `${options.markdown ? heading : ''}${inline(node.children, options)}`
  if (node.tag === 'hr') return '---'
  if (node.tag === 'ul' || node.tag === 'ol') return listItems(node, options, depth).join('\n')
  if (node.tag === 'table') return tableRows(node, options)
  if (node.tag === 'pre') {
    const code = inline(node.children, { ...options, markdown: false }).replace(/\n$/, '')
    return options.markdown ? `\`\`\`\n${code}\n\`\`\`` : code
  }
  if (node.tag === 'blockquote') {
    const inner = blocks(node.children, options, depth).join(options.markdown ? '\n\n' : '\n')
    return options.markdown ? inner.split('\n').map((line) => `> ${line}`).join('\n') : inner
  }
  if (isInline(node)) return inline([node], options)
  return blocks(node.children, options, depth).join(options.markdown ? '\n\n' : '\n')
}

function blocks(children, options, depth = 0) {
  const result = []
  let run = []
  const flushRun = () => {
    if (run.length === 0) return
    const text = inline(run, options)
    if (text.trim() !== '') result.push(text)
    run = []
  }
  for (const child of children) {
    if (isInline(child)) {
      run.push(child)
      continue
    }
    flushRun()
    const text = block(child, options, depth)
    if (text !== '') result.push(text)
  }
  flushRun()
  return result
}

export function toMarkdown(tree, origin) {
  return `${blocks(tree.children, { markdown: true, origin }).join('\n\n')}\n`
}

export function toText(tree, origin) {
  return `${blocks(tree.children, { markdown: false, origin }).join('\n')}\n`
}

const HTML_ATTRS = { a: ['href'], img: ['src', 'width', 'height'] }
const HTML_STYLE = 'body{margin:0;background:#edebe7;color:#1b1a17;font:16px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}article{max-width:760px;margin:0 auto;padding:40px 24px}article>*{margin:0 0 16px}h1{font-size:32px}h2{font-size:21px}ul,ol{padding-left:1.3em}ul.ck{list-style:none;padding:0}ul.ck>li::before{content:"☐ "}ul.ck>li.on::before{content:"☑ "}ul.ck>li.on{opacity:.6}a{color:#33524d}blockquote{margin:0 0 16px;font-style:italic}pre{padding:12px;border-radius:4px;background:#e3e0da;font:13px/1.5 ui-monospace,Menlo,Consolas,monospace;white-space:pre-wrap}code{padding:0 .25em;border-radius:3px;background:#e3e0da;font:.9em ui-monospace,Menlo,Consolas,monospace}pre code{padding:0;background:none;font:inherit}hr{border:0;border-top:1px solid #d3d0c9}table{border-collapse:collapse;font-size:15px}td{border:1px solid #d3d0c9;padding:4px 8px;vertical-align:top}img{display:block;max-width:100%;height:auto;border-radius:4px}mark.hl1,.hl1{background:#d9c583}mark.hl2,.hl2{background:#a8bd9c}mark.hl3,.hl3{background:#d2a7a7}mark{color:inherit}.c1{color:#8e4a40}.c2{color:#4a637c}.c3{color:#605e57}'

export function escapeHtml(text) {
  return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function htmlOf(node, origin) {
  if (isText(node)) return escapeHtml(node)
  const attrs = []
  for (const name of HTML_ATTRS[node.tag] || []) {
    const value = name === 'src' ? imageUrl(node, origin) : node.attrs[name]
    if (value) attrs.push(` ${name}="${escapeHtml(value)}"`)
  }
  if (node.attrs.class) attrs.push(` class="${escapeHtml(node.attrs.class)}"`)
  if (node.tag === 'img' && node.attrs['data-width']) attrs.push(` style="width:${escapeHtml(node.attrs['data-width'])}%"`)
  if (node.tag === 'br' || node.tag === 'hr' || node.tag === 'img') return `<${node.tag}${attrs.join('')}>`
  if (node.tag === 'a') attrs.push(' target="_blank" rel="noopener noreferrer"')
  return `<${node.tag}${attrs.join('')}>${node.children.map((child) => htmlOf(child, origin)).join('')}</${node.tag}>`
}

export function toHtml(tree, origin, title, language = 'en') {
  const body = tree.children.map((child) => htmlOf(child, origin)).join('\n')
  return `<!doctype html>\n<html lang="${escapeHtml(language)}">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n<title>${escapeHtml(title)}</title>\n<style>${HTML_STYLE}</style>\n</head>\n<body>\n<article>\n${body}\n</article>\n</body>\n</html>\n`
}
