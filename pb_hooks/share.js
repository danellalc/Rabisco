const MIN_TOKEN_LENGTH = 16
const MAX_SHARED_ITEMS = 2000

function isExpired(record) {
  const expires = record.getString('expires')
  return expires !== '' && new Date(expires.replace(' ', 'T')).getTime() < Date.now()
}

function parseIds(raw) {
  try {
    const parsed = JSON.parse(String(raw || '[]'))
    return Array.isArray(parsed) ? parsed.filter((id) => typeof id === 'string' && /^[A-Za-z0-9_-]{4,16}$/.test(id)) : []
  } catch (error) {
    return []
  }
}

function parseBoard(content) {
  try {
    const parsed = JSON.parse(String(content || '[]'))
    return Array.isArray(parsed) ? parsed : []
  } catch (error) {
    return []
  }
}

function sharedItemIds(items, requested) {
  const ids = parseIds(requested).slice(0, MAX_SHARED_ITEMS)
  if (ids.length === 0) return []
  const present = new Set(items.map((item) => item.id))
  const kept = new Set()
  for (let index = 0; index < ids.length; index++) {
    if (present.has(ids[index])) kept.add(ids[index])
  }
  return Array.from(kept)
}

function isInsideFrame(item, frame) {
  if (item.id === frame.id || item.type === 'frame') return false
  return item.x >= frame.x && item.y >= frame.y && item.x <= frame.x + frame.w && item.y <= frame.y + frame.h
}

function expandFrames(items, ids) {
  const wanted = new Set(ids)
  const frames = items.filter((item) => item.type === 'frame' && wanted.has(item.id))
  for (let index = 0; index < frames.length; index++) {
    for (let other = 0; other < items.length; other++) {
      if (isInsideFrame(items[other], frames[index])) wanted.add(items[other].id)
    }
  }
  return Array.from(wanted)
}

function isScoped(requested) {
  return parseIds(requested).length > 0
}

function shareMode(mode, scoped) {
  if (scoped) return 'view'
  return mode === 'edit' ? 'edit' : 'view'
}

function filterContent(content, items, itemIds) {
  if (itemIds.length === 0) return content
  const wanted = new Set(itemIds)
  return JSON.stringify(items.filter((item) => wanted.has(item.id)))
}

function loadShare(e) {
  const token = String(e.requestInfo().headers.x_share_token || '')
  if (token.length < MIN_TOKEN_LENGTH) throw new NotFoundError('Link not active.')
  let share
  try {
    share = e.app.findFirstRecordByData('shares', 'token', token)
  } catch (error) {
    throw new NotFoundError('Link not active.')
  }
  const stored = share.getString('token')
  if (stored === '' || !$security.equal(stored, token) || isExpired(share)) throw new NotFoundError('Link not active.')
  return share
}

function loadTarget(app, kind, collection, id) {
  const { isReachable } = require(`${__hooks}/trash.js`)
  let record
  try {
    record = app.findRecordById(collection, id)
  } catch (error) {
    throw new NotFoundError('Link not active.')
  }
  if (!isReachable(app, kind, record)) throw new NotFoundError('Link not active.')
  return record
}

function findShared(e) {
  const share = loadShare(e)
  const docId = share.getString('doc')
  if (docId !== '') return { kind: 'doc', share, doc: loadTarget(e.app, 'doc', 'docs', docId), mode: shareMode(share.getString('mode'), false) }
  const fileId = share.getString('file')
  if (fileId !== '') return { kind: 'file', share, file: loadTarget(e.app, 'file', 'files', fileId), mode: 'view' }
  const board = loadTarget(e.app, 'folder', 'boards', share.getString('board'))
  const content = board.getString('content')
  const items = parseBoard(content)
  const scoped = isScoped(share.getString('items'))
  const itemIds = expandFrames(items, sharedItemIds(items, share.getString('items')))
  if (scoped && itemIds.length === 0) throw new NotFoundError('Link not active.')
  return { kind: 'board', share, board, scoped, itemIds, mode: shareMode(share.getString('mode'), scoped), content: filterContent(content, items, itemIds) }
}

function folderContents(app, boardId) {
  const docs = app.findRecordsByFilter('docs', "board = {:board} && trashed = ''", '-updated', 500, 0, { board: boardId }).map((doc) => ({
    id: doc.id,
    name: doc.getString('name'),
    updated: doc.getString('updated')
  }))
  const files = app.findRecordsByFilter('files', "board = {:board} && trashed = ''", '-created', 500, 0, { board: boardId }).map((file) => ({
    id: file.id,
    name: file.getString('name'),
    size: Number(file.get('size')) || 0,
    kind: file.getString('kind'),
    pic: file.getString('pic')
  }))
  return { docs, files }
}

function sharedFileOf(app, shared, id) {
  if (shared.kind === 'file') return id === shared.file.id ? shared.file : null
  if (shared.kind !== 'board' || id === '') return null
  if (shared.scoped && shared.content.indexOf('"file":"' + id + '"') < 0 && shared.content.indexOf('/api/pic/' + id + '/') < 0) return null
  let file
  try {
    file = app.findRecordById('files', id)
  } catch (error) {
    return null
  }
  return file.getString('board') === shared.board.id && file.getString('trashed') === '' ? file : null
}

function sharedDocOf(app, shared, id) {
  if (shared.kind !== 'board' || shared.scoped || id === '') return null
  let doc
  try {
    doc = app.findRecordById('docs', id)
  } catch (error) {
    return null
  }
  return doc.getString('board') === shared.board.id && doc.getString('trashed') === '' ? doc : null
}

function expireShares(app) {
  const records = app.findRecordsByFilter('shares', "expires != '' && expires < @now", '', 200, 0)
  for (let index = 0; index < records.length; index++) app.delete(records[index])
}

module.exports = { findShared, isExpired, parseIds, parseBoard, sharedItemIds, expandFrames, isScoped, shareMode, filterContent, folderContents, sharedFileOf, sharedDocOf, expireShares }
