const MIN_TOKEN_LENGTH = 16

function isExpired(record) {
  const expires = record.getString('share_expires')
  return expires !== '' && new Date(expires.replace(' ', 'T')).getTime() < Date.now()
}

function nextShare({ mode, modeGiven, previousMode, previousToken, previousExpired, expiresGiven }, generateToken) {
  if (mode === 'off' || (previousExpired && !modeGiven)) return { mode: 'off', token: '', expires: '' }
  const wasActive = previousMode !== 'off' && previousToken !== '' && !previousExpired
  if (wasActive) return { mode, token: previousToken }
  return expiresGiven ? { mode, token: generateToken() } : { mode, token: generateToken(), expires: '' }
}

function findShared(e) {
  const token = String(e.requestInfo().headers.x_share_token || '')
  if (token.length < MIN_TOKEN_LENGTH) throw new NotFoundError('Link not active.')
  let record
  try {
    record = e.app.findFirstRecordByData('notes', 'share_token', token)
  } catch (error) {
    throw new NotFoundError('Link not active.')
  }
  const stored = record.getString('share_token')
  if (stored === '' || !$security.equal(stored, token)) throw new NotFoundError('Link not active.')
  if (record.getString('share_mode') === 'off' || isExpired(record)) throw new NotFoundError('Link not active.')
  return record
}

function expireShares(app) {
  const records = app.findRecordsByFilter('notes', "share_mode != 'off' && share_expires != '' && share_expires < @now", '', 200, 0)
  for (let index = 0; index < records.length; index++) {
    records[index].set('share_mode', 'off')
    records[index].set('share_token', '')
    records[index].set('share_expires', '')
    app.save(records[index])
  }
}

module.exports = { findShared, isExpired, nextShare, expireShares }
