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

function findShared(e) {
  const share = loadShare(e)
  const docId = share.getString('doc')
  if (docId !== '') {
    let doc
    try {
      doc = e.app.findRecordById('docs', docId)
    } catch (error) {
      throw new NotFoundError('Link not active.')
    }
    return { kind: 'doc', share, doc, mode: shareMode(share.getString('mode'), false) }
  }
  let board
  try {
    board = e.app.findRecordById('boards', share.getString('board'))
  } catch (error) {
    throw new NotFoundError('Link not active.')
  }
  const content = board.getString('content')
  const items = parseBoard(content)
  const scoped = isScoped(share.getString('items'))
  const itemIds = sharedItemIds(items, share.getString('items'))
  if (scoped && itemIds.length === 0) throw new NotFoundError('Link not active.')
  return { kind: 'board', share, board, scoped, itemIds, mode: shareMode(share.getString('mode'), scoped), content: filterContent(content, items, itemIds) }
}

function expireShares(app) {
  const records = app.findRecordsByFilter('shares', "expires != '' && expires < @now", '', 200, 0)
  for (let index = 0; index < records.length; index++) app.delete(records[index])
}

module.exports = { findShared, isExpired, parseIds, parseBoard, sharedItemIds, isScoped, shareMode, filterContent, expireShares }
