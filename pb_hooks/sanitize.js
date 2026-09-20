const ALLOWED_TAGS = ['div', 'p', 'br', 'b', 'strong', 'i', 'em', 'u', 's', 'h1', 'h2', 'ul', 'ol', 'li', 'mark', 'a', 'img', 'span', 'table', 'tbody', 'tr', 'td', 'hr']
const VOID_TAGS = ['br', 'hr', 'img']
const DROP_WITH_CONTENT = ['script', 'style', 'iframe', 'object', 'embed', 'template', 'noscript', 'svg', 'math', 'textarea', 'title', 'select']
const CLASS_TOKENS = { ul: ['ck'], li: ['on'], mark: ['hl1', 'hl2', 'hl3'], span: ['c1', 'c2', 'c3'] }
const NAMED_ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' }
const MAX_DIMENSION = 10000

function has(list, value) {
  return list.indexOf(value) >= 0
}

function decodeEntities(text) {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, body) => {
    if (body[0] === '#') {
      const code = body[1].toLowerCase() === 'x' ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10)
      return isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : ''
    }
    const named = NAMED_ENTITIES[body.toLowerCase()]
    return named === undefined ? match : named
  })
}

function escapeText(text) {
  return text.replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function escapeAttribute(value) {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function cleanUrl(raw) {
  return decodeEntities(raw).replace(/[\u0000- \u007f-\u009f\s]/g, '')
}

function safeHref(raw) {
  const url = cleanUrl(raw)
  return /^(https?:\/\/|mailto:)/i.test(url) ? url : null
}

function safeImageSource(raw) {
  const url = cleanUrl(raw)
  return /^\/api\/files\/images\/[a-z0-9]+\/[a-z0-9_.-]+$/i.test(url) ? url : null
}

function safeDimension(raw) {
  const value = parseInt(decodeEntities(raw), 10)
  return value > 0 && value <= MAX_DIMENSION ? String(value) : null
}

function safeWidthValue(raw) {
  const match = /^\s*(\d{1,3}(?:\.\d)?)%?\s*$/.exec(decodeEntities(raw))
  if (!match) return null
  const width = parseFloat(match[1])
  return width >= 5 && width <= 100 ? match[1] : null
}

function safeWidthStyle(raw) {
  const match = /^\s*width\s*:\s*(\d{1,3}(?:\.\d)?)%\s*;?\s*$/i.exec(decodeEntities(raw))
  return match ? safeWidthValue(match[1]) : null
}

function safeClass(tag, raw) {
  const allowed = CLASS_TOKENS[tag] || []
  const tokens = decodeEntities(raw).split(/\s+/).filter((token) => has(allowed, token))
  return tokens.length > 0 ? tokens.join(' ') : null
}

function keptAttributes(tag, attributes) {
  const kept = []
  const seen = {}
  const push = (name, value) => {
    if (value === null || seen[name]) return
    seen[name] = true
    kept.push(' ' + name + '="' + escapeAttribute(value) + '"')
  }
  for (let index = 0; index < attributes.length; index++) {
    const name = attributes[index][0]
    const value = attributes[index][1]
    if (tag === 'a' && name === 'href') push('href', safeHref(value))
    else if (tag === 'img' && name === 'src') push('src', safeImageSource(value))
    else if (tag === 'img' && (name === 'width' || name === 'height')) push(name, safeDimension(value))
    else if (tag === 'img' && name === 'data-width') push('data-width', safeWidthValue(value))
    else if (tag === 'img' && name === 'style') push('data-width', safeWidthStyle(value))
    else if (name === 'class') push('class', safeClass(tag, value))
  }
  if (tag === 'a') {
    push('rel', 'noopener noreferrer')
    push('target', '_blank')
  }
  if (tag === 'img' && !seen.src) return null
  return kept.join('')
}

function readAttributes(input, start) {
  const attributes = []
  const length = input.length
  let index = start
  while (index < length && input[index] !== '>') {
    const char = input[index]
    if (char === '/' || /\s/.test(char)) {
      index++
      continue
    }
    const nameStart = index
    while (index < length && !/[\s=\/>]/.test(input[index])) index++
    const name = input.slice(nameStart, index).toLowerCase()
    let value = ''
    let cursor = index
    while (cursor < length && /\s/.test(input[cursor])) cursor++
    if (input[cursor] === '=') {
      cursor++
      while (cursor < length && /\s/.test(input[cursor])) cursor++
      const quote = input[cursor]
      if (quote === '"' || quote === "'") {
        const end = input.indexOf(quote, cursor + 1)
        value = input.slice(cursor + 1, end < 0 ? length : end)
        index = end < 0 ? length : end + 1
      } else {
        const valueStart = cursor
        while (cursor < length && !/[\s>]/.test(input[cursor])) cursor++
        value = input.slice(valueStart, cursor)
        index = cursor
      }
    }
    if (name) attributes.push([name, value])
  }
  return { attributes, end: index < length ? index + 1 : length }
}

function skipDroppedContent(input, lower, tag, from) {
  let search = from
  while (search < input.length) {
    const closing = lower.indexOf('</' + tag, search)
    if (closing < 0) return input.length
    const end = input.indexOf('>', closing)
    if (end < 0) return input.length
    const between = lower.slice(closing + 2 + tag.length, end).trim()
    if (between === '' || between === '/') return end + 1
    search = end + 1
  }
  return input.length
}

function sanitizeHtml(input) {
  const source = String(input || '')
  const lower = source.toLowerCase()
  const length = source.length
  const output = []
  const open = []
  let index = 0
  while (index < length) {
    const lt = source.indexOf('<', index)
    if (lt < 0) {
      output.push(escapeText(source.slice(index)))
      break
    }
    if (lt > index) output.push(escapeText(source.slice(index, lt)))
    index = lt
    if (source.startsWith('<!--', index)) {
      const end = source.indexOf('-->', index + 4)
      index = end < 0 ? length : end + 3
      continue
    }
    const next = source[index + 1]
    if (next === '!' || next === '?') {
      const end = source.indexOf('>', index)
      index = end < 0 ? length : end + 1
      continue
    }
    const closing = next === '/'
    let cursor = index + (closing ? 2 : 1)
    const nameStart = cursor
    while (cursor < length && /[A-Za-z0-9]/.test(source[cursor])) cursor++
    const tag = source.slice(nameStart, cursor).toLowerCase()
    if (!tag) {
      output.push('&lt;')
      index += 1
      continue
    }
    const read = readAttributes(source, cursor)
    index = read.end
    if (closing) {
      const position = open.lastIndexOf(tag)
      if (position >= 0) while (open.length > position) output.push('</' + open.pop() + '>')
      continue
    }
    if (has(DROP_WITH_CONTENT, tag)) {
      index = skipDroppedContent(source, lower, tag, index)
      continue
    }
    if (!has(ALLOWED_TAGS, tag)) continue
    const attributes = keptAttributes(tag, read.attributes)
    if (attributes === null) continue
    output.push('<' + tag + attributes + '>')
    if (!has(VOID_TAGS, tag)) open.push(tag)
  }
  while (open.length > 0) output.push('</' + open.pop() + '>')
  return output.join('')
}

module.exports = { sanitizeHtml, safeHref, safeImageSource, ALLOWED_TAGS, CLASS_TOKENS }
