const MAX_ITEMS = 2000
const MAX_CONTENT_LENGTH = 2000000
const MAX_COORDINATE = 1000000
const MAX_WIDTH = 4000
const MAX_URL_LENGTH = 2000
const TEXT_MIN_WIDTH = 160
const IMAGE_MIN_WIDTH = 60
const IMAGE_MIN_HEIGHT = 40
const FRAME_MIN = 40
const FRAME_MAX = 20000
const FRAME_NAME_LIMIT = 80
const ID_PATTERN = /^[A-Za-z0-9_-]{4,16}$/
const TEXT_COLORS = ['hl1', 'hl2', 'hl3']

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

function withReference(item, raw, key, info) {
  if (info === null) return null
  item[key] = String(raw[key])
  item.name = info.name
  if (info.size !== undefined) item.size = info.size
  if (info.kind !== undefined) item.kind = info.kind
  return item
}

const SHAPES = {
  text: (item, raw, tools) => {
    item.w = finiteNumber(raw.w, TEXT_MIN_WIDTH, MAX_WIDTH)
    if (item.w === null) return null
    item.html = tools.sanitizeHtml(String(raw.html || ''))
    if (has(TEXT_COLORS, raw.color)) item.color = raw.color
    return item
  },
  image: (item, raw, tools) => {
    item.w = finiteNumber(raw.w, IMAGE_MIN_WIDTH, MAX_WIDTH)
    const src = tools.safeImageSource(String(raw.src || ''))
    if (item.w === null || src === null) return null
    item.src = src
    const h = finiteNumber(raw.h, IMAGE_MIN_HEIGHT, MAX_WIDTH)
    if (raw.h !== undefined && h !== null) item.h = h
    const width = finiteNumber(raw.width, 1, 10000)
    const height = finiteNumber(raw.height, 1, 10000)
    if (width !== null && height !== null) {
      item.width = width
      item.height = height
    }
    return item
  },
  link: (item, raw) => {
    const url = safeUrl(raw.url)
    if (url === null) return null
    item.url = url
    return item
  },
  frame: (item, raw, tools) => {
    item.w = finiteNumber(raw.w, FRAME_MIN, FRAME_MAX)
    item.h = finiteNumber(raw.h, FRAME_MIN, FRAME_MAX)
    if (item.w === null || item.h === null) return null
    const name = tools.cleanLabel(String(raw.name || '')).slice(0, FRAME_NAME_LIMIT)
    if (name !== '') item.name = name
    return item
  },
  file: (item, raw, tools) => withReference(item, raw, 'file', tools.fileInfo(String(raw.file || ''))),
  doc: (item, raw, tools) => withReference(item, raw, 'doc', tools.docInfo(String(raw.doc || ''))),
  folder: (item, raw, tools) => withReference(item, raw, 'folder', tools.folderInfo(String(raw.folder || '')))
}

function normalizeItem(raw, tools) {
  if (!raw || typeof raw !== 'object' || !ID_PATTERN.test(String(raw.id || ''))) return null
  const shape = SHAPES[String(raw.type || '')]
  if (!shape) return null
  const x = finiteNumber(raw.x, -MAX_COORDINATE, MAX_COORDINATE)
  const y = finiteNumber(raw.y, -MAX_COORDINATE, MAX_COORDINATE)
  const z = finiteNumber(raw.z, 0, MAX_COORDINATE)
  if (x === null || y === null || z === null) return null
  return shape({ id: String(raw.id), type: String(raw.type), x, y, z }, raw, tools)
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
    const named = ordered.find((item) => typeof item.name === 'string' && item.name !== '')
    if (named) title = named.name
  }
  return { content: JSON.stringify(items), title, cover }
}

function referenceInfo(app, collection, boardId, userId) {
  return (id) => {
    try {
      const record = app.findRecordById(collection, id)
      if (record.getString('board') !== boardId || record.getString('user') !== userId) return null
      return { name: record.getString('name'), size: Number(record.get('size')) || 0, kind: record.getString('kind') }
    } catch (error) {
      return null
    }
  }
}

function boardTools(app, record) {
  const { sanitizeHtml, safeImageSource } = require(`${__hooks}/sanitize.js`)
  const { titleOf, coverOf } = require(`${__hooks}/summary.js`)
  const { ownBoard, cleanLabel } = require(`${__hooks}/drive.js`)
  const userId = record.getString('user')
  return {
    sanitizeHtml,
    safeImageSource,
    titleOf,
    coverOf,
    cleanLabel,
    fileInfo: referenceInfo(app, 'files', record.id, userId),
    docInfo: (id) => {
      const info = referenceInfo(app, 'docs', record.id, userId)(id)
      return info === null ? null : { name: info.name }
    },
    folderInfo: (id) => {
      const folder = id === record.id ? null : ownBoard(app, userId, id)
      return folder === null ? null : { name: folder.getString('name') || folder.getString('title') }
    }
  }
}

function applyBoard(app, record, content) {
  const board = normalizeBoard(content, boardTools(app, record))
  record.set('content', board.content)
  record.set('title', board.title)
  record.set('cover', board.cover)
  return board.content
}

module.exports = { applyBoard, normalizeBoard, parseItems, readingOrder, MAX_ITEMS }
