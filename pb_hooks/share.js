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

function sharedItemIds(content, requested) {
  const ids = parseIds(requested).slice(0, MAX_SHARED_ITEMS)
  if (ids.length === 0) return []
  const present = ids.filter((id) => content.indexOf('"id":"' + id + '"') >= 0)
  return present.filter((id, index) => present.indexOf(id) === index)
}

function shareMode(mode, itemIds) {
  if (itemIds.length > 0) return 'view'
  return mode === 'edit' ? 'edit' : 'view'
}

function filterContent(content, itemIds) {
  if (itemIds.length === 0) return content
  const items = JSON.parse(content)
  return JSON.stringify(items.filter((item) => itemIds.indexOf(item.id) >= 0))
}

function findShared(e) {
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
  let board
  try {
    board = e.app.findRecordById('boards', share.getString('board'))
  } catch (error) {
    throw new NotFoundError('Link not active.')
  }
  const itemIds = sharedItemIds(board.getString('content'), share.getString('items'))
  return { share, board, itemIds, mode: shareMode(share.getString('mode'), itemIds) }
}

function expireShares(app) {
  const records = app.findRecordsByFilter('shares', "expires != '' && expires < @now", '', 200, 0)
  for (let index = 0; index < records.length; index++) app.delete(records[index])
}

module.exports = { findShared, isExpired, parseIds, sharedItemIds, shareMode, filterContent, expireShares }
