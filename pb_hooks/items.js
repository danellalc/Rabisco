const MAX_ITEMS = 2000
const MAX_CONTENT_LENGTH = 2000000
const MAX_COORDINATE = 1000000
const MAX_WIDTH = 4000
const MAX_URL_LENGTH = 2000
const TEXT_MIN_WIDTH = 160
const IMAGE_MIN_WIDTH = 60
const ID_PATTERN = /^[A-Za-z0-9_-]{4,16}$/

function has(list, value) {
  return list.indexOf(value) >= 0
}

function finiteNumber(value, min, max) {
  const number = Number(value)
  if (!isFinite(number)) return null
  return Math.round(Math.min(max, Math.max(min, number)))
}

function safeUrl(raw) {
  const url = String(raw || '').trim()
  return url.length <= MAX_URL_LENGTH && /^https?:\/\/[^\s<>"']+$/i.test(url) ? url : null
}

function parseItems(content) {
  try {
    const parsed = JSON.parse(String(content || '[]'))
    return Array.isArray(parsed) ? parsed : null
  } catch (error) {
    return null
  }
}

function normalizeItem(raw, tools) {
  if (!raw || typeof raw !== 'object' || !ID_PATTERN.test(String(raw.id || ''))) return null
  const x = finiteNumber(raw.x, -MAX_COORDINATE, MAX_COORDINATE)
  const y = finiteNumber(raw.y, -MAX_COORDINATE, MAX_COORDINATE)
  const z = finiteNumber(raw.z, 0, MAX_COORDINATE)
  if (x === null || y === null || z === null) return null
  const item = { id: String(raw.id), type: String(raw.type || ''), x, y, z }
  if (item.type === 'text') {
    item.w = finiteNumber(raw.w, TEXT_MIN_WIDTH, MAX_WIDTH)
    if (item.w === null) return null
    item.html = tools.sanitizeHtml(String(raw.html || ''))
    return item
  }
  if (item.type === 'image') {
    item.w = finiteNumber(raw.w, IMAGE_MIN_WIDTH, MAX_WIDTH)
    const src = tools.safeImageSource(String(raw.src || ''))
    if (item.w === null || src === null) return null
    item.src = src
    const width = finiteNumber(raw.width, 1, 10000)
    const height = finiteNumber(raw.height, 1, 10000)
    if (width !== null && height !== null) {
      item.width = width
      item.height = height
    }
    return item
  }
  if (item.type === 'link') {
    const url = safeUrl(raw.url)
    if (url === null) return null
    item.url = url
    return item
  }
  if (item.type === 'file') {
    const info = tools.fileInfo(String(raw.file || ''))
    if (info === null) return null
    item.file = String(raw.file)
    item.name = info.name
    item.size = info.size
    item.kind = info.kind
    return item
  }
  return null
}

function readingOrder(items) {
  return items.slice().sort((a, b) => a.y - b.y || a.x - b.x)
}

function normalizeBoard(content, tools) {
  if (String(content || '').length > MAX_CONTENT_LENGTH) throw new BadRequestError('The board is too big.')
  const parsed = parseItems(content)
  if (parsed === null) throw new BadRequestError('The board content is not valid.')
  if (parsed.length > MAX_ITEMS) throw new BadRequestError('Too many items on the board.')
  const items = []
  const seen = Object.create(null)
  for (let index = 0; index < parsed.length; index++) {
    const item = normalizeItem(parsed[index], tools)
    if (item === null || seen[item.id]) continue
    seen[item.id] = true
    items.push(item)
  }
  const ordered = readingOrder(items)
  let title = ''
  let cover = ''
  for (let index = 0; index < ordered.length; index++) {
    const item = ordered[index]
    if (item.type === 'text' && title === '') title = tools.titleOf(item.html)
    if (cover === '' && item.type === 'image') cover = item.src
    if (cover === '' && item.type === 'text') cover = tools.coverOf(item.html)
  }
  if (title === '') {
    const firstFile = ordered.find((item) => item.type === 'file')
    if (firstFile) title = firstFile.name
  }
  return { content: JSON.stringify(items), title, cover }
}

function boardTools(app, record) {
  const { sanitizeHtml, safeImageSource } = require(`${__hooks}/sanitize.js`)
  const { titleOf, coverOf } = require(`${__hooks}/summary.js`)
  const { fileItemInfo } = require(`${__hooks}/files.js`)
  return { sanitizeHtml, safeImageSource, titleOf, coverOf, fileInfo: fileItemInfo(app, record.id, record.getString('user')) }
}

function applyBoard(app, record, content) {
  const board = normalizeBoard(content, boardTools(app, record))
  record.set('content', board.content)
  record.set('title', board.title)
  record.set('cover', board.cover)
  return board.content
}

module.exports = { applyBoard, normalizeBoard, parseItems, readingOrder, MAX_ITEMS }
