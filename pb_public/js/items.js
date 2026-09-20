export const TEXT_WIDTH = 640
export const TEXT_MIN_WIDTH = 160
export const IMAGE_MIN_WIDTH = 60
export const CARD_WIDTH = 230
export const CARD_HEIGHT = 64
const ID_ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789'

export function newId() {
  const bytes = new Uint8Array(8)
  crypto.getRandomValues(bytes)
  return [...bytes].map((byte) => ID_ALPHABET[byte % ID_ALPHABET.length]).join('')
}

export function parseContent(content) {
  try {
    const parsed = JSON.parse(String(content || '[]'))
    return Array.isArray(parsed) ? parsed.filter((item) => item && typeof item === 'object' && typeof item.id === 'string') : []
  } catch {
    return []
  }
}

export function readingOrder(items) {
  return items.slice().sort((a, b) => a.y - b.y || a.x - b.x)
}

export function nextZ(items) {
  return items.reduce((top, item) => Math.max(top, item.z || 0), 0) + 1
}

export function boundsOf(rects) {
  if (rects.length === 0) return null
  return {
    x0: Math.min(...rects.map((rect) => rect.x)),
    y0: Math.min(...rects.map((rect) => rect.y)),
    x1: Math.max(...rects.map((rect) => rect.x + rect.w)),
    y1: Math.max(...rects.map((rect) => rect.y + rect.h))
  }
}

export function overlaps(rect, box) {
  return rect.x < box.x1 && rect.x + rect.w > box.x0 && rect.y < box.y1 && rect.y + rect.h > box.y0
}

export function textOfItems(items, textOf) {
  return readingOrder(items).map((item) => {
    if (item.type === 'text') return textOf(item.html)
    if (item.type === 'link') return item.url
    return item.name || ''
  }).join(' ')
}

export function linkLabel(url) {
  return String(url || '').replace(/^https?:\/\//i, '').replace(/\/$/, '')
}
