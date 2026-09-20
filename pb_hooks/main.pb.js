routerUse((e) => {
  if (e.request.url.path.startsWith('/_/')) return e.next()
  const header = e.response.header()
  header.set('Content-Security-Policy', "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' blob: data:; connect-src 'self'; manifest-src 'self'; worker-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'; object-src 'none'; require-trusted-types-for 'script'; trusted-types sanitizer-input")
  header.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains')
  header.set('X-Content-Type-Options', 'nosniff')
  header.set('Referrer-Policy', 'no-referrer')
  header.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
  header.set('Cross-Origin-Opener-Policy', 'same-origin')
  return e.next()
})

onRecordRequestOTPRequest((e) => {
  const collection = e.app.findCollectionByNameOrId('users')
  if (e.record) {
    const decoy = new Record(collection)
    decoy.setPassword($security.randomString(40))
  } else {
    const record = new Record(collection)
    record.setEmail(e.requestInfo().body.email)
    record.setPassword($security.randomString(40))
    e.app.save(record)
    e.record = record
  }
  e.next()
}, 'users')

onRecordCreateRequest((e) => {
  e.record.set('user', e.auth ? e.auth.id : '')
  e.next()
}, 'boards', 'images')

onRecordCreateRequest((e) => {
  const { nextRevision } = require(`${__hooks}/revision.js`)
  const { applyBoard } = require(`${__hooks}/items.js`)
  applyBoard(e.record, e.record.getString('content'))
  e.record.set('revision', nextRevision())
  e.record.set('share_mode', 'off')
  e.record.set('share_token', '')
  e.next()
}, 'boards')

routerAdd('GET', '/api/shared', (e) => {
  const { findShared } = require(`${__hooks}/share.js`)
  const record = findShared(e)
  return e.json(200, {
    content: record.getString('content'),
    revision: record.getString('revision'),
    mode: record.getString('share_mode'),
    title: record.getString('title')
  })
})

routerAdd('PATCH', '/api/shared', (e) => {
  const { findShared } = require(`${__hooks}/share.js`)
  const { claimRevision, nextRevision } = require(`${__hooks}/revision.js`)
  const { applyBoard } = require(`${__hooks}/items.js`)
  const record = findShared(e)
  if (record.getString('share_mode') !== 'edit') throw new ForbiddenError('This link is view only.')
  const info = e.requestInfo()
  const expected = String(info.headers.x_note_rev || '')
  if (expected !== '' && expected !== record.getString('revision')) {
    throw new ApiError(409, 'The board changed elsewhere.', { revision: record.getString('revision') })
  }
  const previous = record.getString('content')
  const content = applyBoard(record, String(info.body.content || '[]'))
  if (content !== previous) {
    record.set('revision', expected === '' ? nextRevision() : claimRevision(e.app, record.id, expected))
  }
  e.app.save(record)
  return e.json(200, { revision: record.getString('revision') })
})

routerAdd('POST', '/share-target', (e) => e.redirect(303, '/'))

cronAdd('expire-shares', '*/15 * * * *', () => {
  const { expireShares } = require(`${__hooks}/share.js`)
  expireShares($app)
})

onRecordUpdateRequest((e) => {
  const { isExpired, nextShare } = require(`${__hooks}/share.js`)
  const { claimRevision, nextRevision } = require(`${__hooks}/revision.js`)
  const { applyBoard } = require(`${__hooks}/items.js`)
  const info = e.requestInfo()
  const original = e.record.original()
  const expected = String(info.headers.x_note_rev || '')
  if (expected !== '' && expected !== original.getString('revision')) {
    throw new ApiError(409, 'The board changed elsewhere.', { revision: original.getString('revision') })
  }
  const content = applyBoard(e.record, e.record.getString('content'))
  if (content !== original.getString('content')) {
    e.record.set('revision', expected === '' ? nextRevision() : claimRevision(e.app, e.record.id, expected))
  }
  const share = nextShare({
    mode: e.record.getString('share_mode'),
    modeGiven: info.body.share_mode !== undefined,
    previousMode: original.getString('share_mode'),
    previousToken: original.getString('share_token'),
    previousExpired: isExpired(original),
    expiresGiven: info.body.share_expires !== undefined
  }, () => $security.randomString(22))
  e.record.set('share_mode', share.mode)
  e.record.set('share_token', share.token)
  if (share.expires !== undefined) e.record.set('share_expires', share.expires)
  e.next()
}, 'boards')
