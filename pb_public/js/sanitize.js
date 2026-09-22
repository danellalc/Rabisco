import { ensureImageWidths, widthValue } from './widths.js'

export const ALLOWED_TAGS = ['div', 'p', 'br', 'b', 'strong', 'i', 'em', 'u', 's', 'h1', 'h2', 'ul', 'ol', 'li', 'mark', 'a', 'img', 'span', 'table', 'tbody', 'tr', 'td', 'hr', 'blockquote', 'pre', 'code']
export const CLASS_TOKENS = { ul: ['ck'], li: ['on'], mark: ['hl1', 'hl2', 'hl3'], span: ['c1', 'c2', 'c3'] }
const DROP_WITH_CONTENT = new Set(['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'TEMPLATE', 'NOSCRIPT', 'SVG', 'MATH', 'TEXTAREA', 'TITLE', 'SELECT', 'svg', 'math'])
const ALLOWED = new Set(ALLOWED_TAGS.map((tag) => tag.toUpperCase()))
const MAX_DIMENSION = 10000

const SERVICE_WORKER = '/sw.js'
const trusted = {
  createHTML: (html) => html,
  createScriptURL: (url) => {
    if (url !== SERVICE_WORKER) throw new TypeError('Only the service worker can be registered')
    return url
  }
}
const policy = typeof trustedTypes === 'undefined' ? trusted : trustedTypes.createPolicy('sanitizer-input', trusted)

export function serviceWorkerUrl() {
  return policy.createScriptURL(SERVICE_WORKER)
}

function cleanUrl(raw) {
  return raw.replace(/[\u0000- \u007f-\u009f\s]/g, '')
}

export function safeHref(raw) {
  const url = cleanUrl(raw)
  return /^(https?:\/\/|mailto:)/i.test(url) ? url : null
}

export function safeImageSource(raw, allowLocal) {
  const url = cleanUrl(raw)
  if (allowLocal && /^blob:/.test(url)) return url
  return /^\/api\/files\/images\/[a-z0-9]+\/[a-z0-9_.-]+$/i.test(url) || /^\/api\/pic\/[a-z0-9]{15}\/[a-z0-9]{16}$/i.test(url) ? url : null
}

export function safeDimension(raw) {
  const value = parseInt(raw, 10)
  return value > 0 && value <= MAX_DIMENSION ? String(value) : null
}

export function safeWidth(raw) {
  const match = /^\s*width\s*:\s*(\d{1,3}(?:\.\d)?)%\s*;?\s*$/i.exec(raw)
  return match ? widthValue(match[1]) : null
}

export function safeClass(tag, raw) {
  const allowed = CLASS_TOKENS[tag] || []
  const tokens = raw.split(/\s+/).filter((token) => allowed.includes(token))
  return tokens.length > 0 ? tokens.join(' ') : null
}

function cleanElement(element, allowLocalImages) {
  const tag = element.tagName.toLowerCase()
  const keep = {}
  for (const { name, value } of [...element.attributes]) {
    if (tag === 'a' && name === 'href') keep.href = safeHref(value)
    else if (tag === 'img' && name === 'src') keep.src = safeImageSource(value, allowLocalImages)
    else if (tag === 'img' && (name === 'width' || name === 'height')) keep[name] = safeDimension(value)
    else if (tag === 'img' && name === 'data-width') keep['data-width'] = widthValue(value)
    else if (tag === 'img' && name === 'style' && keep['data-width'] === undefined) keep['data-width'] = safeWidth(value)
    else if (name === 'class') keep.class = safeClass(tag, value)
    element.removeAttribute(name)
  }
  for (const [name, value] of Object.entries(keep)) {
    if (value !== null) element.setAttribute(name, value)
  }
  if (tag === 'a') {
    element.setAttribute('rel', 'noopener noreferrer')
    element.setAttribute('target', '_blank')
  }
  if (tag === 'img') {
    if (!element.getAttribute('src')) return false
    element.setAttribute('alt', '')
    element.setAttribute('loading', 'lazy')
    element.setAttribute('decoding', 'async')
    element.setAttribute('draggable', 'false')
  }
  return true
}

export function sanitize(html, { allowLocalImages = false } = {}) {
  const parsed = new DOMParser().parseFromString(policy.createHTML(String(html || '')), 'text/html')
  const walker = parsed.createTreeWalker(parsed.body, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_COMMENT)
  const doomed = []
  const unwrapped = []
  let node = walker.nextNode()
  while (node) {
    if (node.nodeType === Node.COMMENT_NODE || DROP_WITH_CONTENT.has(node.tagName)) doomed.push(node)
    else if (!ALLOWED.has(node.tagName) || node.namespaceURI !== 'http://www.w3.org/1999/xhtml') unwrapped.push(node)
    else if (!cleanElement(node, allowLocalImages)) doomed.push(node)
    node = walker.nextNode()
  }
  doomed.forEach((element) => element.remove())
  unwrapped.forEach((element) => element.replaceWith(...element.childNodes))
  return parsed.body
}

export function textOf(html) {
  return new DOMParser().parseFromString(policy.createHTML(String(html || '')), 'text/html').body.textContent
}

export function render(target, html, options) {
  const body = sanitize(html, options)
  target.replaceChildren(...body.childNodes)
  ensureImageWidths(target)
}

export function serialize(root) {
  const body = sanitize(root.innerHTML, { allowLocalImages: true })
  for (const img of body.querySelectorAll('img')) {
    img.removeAttribute('alt')
    img.removeAttribute('loading')
    img.removeAttribute('decoding')
    img.removeAttribute('draggable')
  }
  return body.innerHTML
}
