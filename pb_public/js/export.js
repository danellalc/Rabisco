const INLINE = new Set(['b', 'strong', 'i', 'em', 'u', 's', 'a', 'span', 'mark', 'br', 'img'])
const WRAPPERS = { b: '**', strong: '**', i: '*', em: '*', s: '~~' }
const FILE_NAME_LIMIT = 60

export function treeOf(node) {
  if (node.nodeType === 3) return node.data
  if (node.nodeType !== 1) return ''
  const attrs = {}
  for (const { name, value } of node.attributes) attrs[name] = value
  return { tag: node.tagName.toLowerCase(), attrs, children: [...node.childNodes].map(treeOf) }
}

export function fileName(title, extension) {
  const clean = String(title || '').replace(/[\\/:*?"<>|\u0000-\u001f]/g, '').trim().slice(0, FILE_NAME_LIMIT)
  return `${clean || 'rabisco'}.${extension}`
}

const isText = (node) => typeof node === 'string'
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
    if (node.tag === 'img') {
      const url = imageUrl(node, options.origin)
      if (!url) return ''
      return options.markdown ? `![image](${url})` : url
    }
    const text = inline(node.children, options)
    if (!options.markdown) return text
    if (WRAPPERS[node.tag]) return wrap(WRAPPERS[node.tag], text)
    if (node.tag === 'a' && node.attrs.href) return `[${text}](${node.attrs.href})`
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
  if (heading) return `${options.markdown ? heading : ''}${inline(node.children, options)}`
  if (node.tag === 'hr') return '---'
  if (node.tag === 'ul' || node.tag === 'ol') return listItems(node, options, depth).join('\n')
  if (node.tag === 'table') return tableRows(node, options)
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
