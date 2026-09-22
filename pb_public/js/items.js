export const TEXT_WIDTH = 640
export const TEXT_MIN_WIDTH = 160
export const IMAGE_MIN_WIDTH = 60
export const IMAGE_MIN_HEIGHT = 40
export const FRAME_MIN = 40
export const FRAME_PADDING = 24
export const CARD_WIDTH = 230
export const CARD_HEIGHT = 64
export const FILE_MAX_BYTES = 500 * 1024 * 1024
export const BLOCKED_EXTENSIONS = ['exe', 'msi', 'bat', 'cmd', 'com', 'scr', 'pif', 'vbs', 'js', 'jse', 'wsf', 'ps1', 'jar', 'hta', 'dll', 'lnk']
export const FILE_KINDS = {
  pdf: ['pdf'],
  image: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'heic', 'avif'],
  doc: ['doc', 'docx', 'odt', 'rtf', 'txt', 'md', 'pages'],
  sheet: ['xls', 'xlsx', 'ods', 'csv', 'numbers'],
  slides: ['ppt', 'pptx', 'odp', 'key'],
  zip: ['zip', 'rar', '7z', 'tar', 'gz', 'tgz'],
  video: ['mp4', 'webm', 'mov', 'm4v', 'mkv'],
  audio: ['mp3', 'm4a', 'wav', 'ogg', 'aac', 'flac'],
  code: ['json', 'xml', 'html', 'css', 'py', 'go', 'ts', 'sql', 'sh', 'yml', 'yaml', 'toml']
}
export const REFERENCE_TYPES = ['file', 'doc', 'folder']
export const TEXT_COLORS = ['hl1', 'hl2', 'hl3', 'hl4', 'hl5', 'hl6']
const ID_ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789'
const SIZE_UNITS = ['B', 'KB', 'MB', 'GB']

export function extensionOf(name) {
  const match = /\.([A-Za-z0-9]{1,10})$/.exec(String(name || ''))
  return match ? match[1].toLowerCase() : ''
}

export function kindOf(name) {
  const extension = extensionOf(name)
  return Object.keys(FILE_KINDS).find((kind) => FILE_KINDS[kind].includes(extension)) || 'generic'
}

export function isBlockedName(name) {
  return BLOCKED_EXTENSIONS.includes(extensionOf(String(name || '').replace(/[.\s]+$/, '')))
}

export function isReference(item) {
  return REFERENCE_TYPES.includes(item.type)
}

export function frameMembers(items, frame) {
  return items.filter((item) => item.id !== frame.id && item.type !== 'frame' && item.x >= frame.x && item.y >= frame.y && item.x <= frame.x + frame.w && item.y <= frame.y + frame.h)
}

export function frameAround(bounds, padding = FRAME_PADDING) {
  return { x: bounds.x0 - padding, y: bounds.y0 - padding, w: bounds.x1 - bounds.x0 + padding * 2, h: bounds.y1 - bounds.y0 + padding * 2 }
}

export function previewable(kind) {
  return ['pdf', 'image', 'video', 'audio'].includes(kind)
}

export function formatSize(bytes, language) {
  let value = Math.max(0, Number(bytes) || 0)
  let unit = 0
  while (value >= 1000 && unit < SIZE_UNITS.length - 1) {
    value /= 1024
    unit++
  }
  const digits = unit === 0 || value >= 10 || Number.isInteger(value) ? 0 : 1
  return `${new Intl.NumberFormat(language, { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value)} ${SIZE_UNITS[unit]}`
}

export function formatTime(seconds) {
  const whole = Math.max(0, Math.floor(Number(seconds) || 0))
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`
}

export function newId() {
  const bytes = new Uint8Array(8)
  crypto.getRandomValues(bytes)
  return [...bytes].map((byte) => ID_ALPHABET[byte % ID_ALPHABET.length]).join('')
}

export function parseContent(content) {
  try {
    const parsed = JSON.parse(String(content || '[]'))
    return Array.isArray(parsed) ? parsed.filter((item) => item && typeof item === 'object' && typeof item.id === 'string') : null
  } catch {
    return null
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

export function isMedia(kind) {
  return kind === 'audio' || kind === 'video'
}

export function linkLabel(url) {
  return String(url || '').replace(/^https?:\/\//i, '').replace(/\/$/, '')
}
