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
}, 'notes', 'images')

onRecordCreateRequest((e) => {
  const { sanitizeHtml } = require(`${__hooks}/sanitize.js`)
  const { titleOf, coverOf } = require(`${__hooks}/summary.js`)
  const content = sanitizeHtml(e.record.getString('content'))
  e.record.set('content', content)
  e.record.set('title', titleOf(content))
  e.record.set('cover', coverOf(content))
  e.record.set('share_mode', 'off')
  e.record.set('share_token', '')
  e.next()
}, 'notes')

onRecordUpdateRequest((e) => {
  const { sanitizeHtml } = require(`${__hooks}/sanitize.js`)
  const original = e.record.original()
  const expected = e.requestInfo().headers.x_note_rev || ''
  if (expected !== '' && expected !== original.getString('updated')) {
    throw new ApiError(409, 'The note changed elsewhere.', { updated: original.getString('updated') })
  }
  const { titleOf, coverOf } = require(`${__hooks}/summary.js`)
  const content = sanitizeHtml(e.record.getString('content'))
  e.record.set('content', content)
  e.record.set('title', titleOf(content))
  e.record.set('cover', coverOf(content))
  const mode = e.record.getString('share_mode')
  if (mode === original.getString('share_mode')) {
    e.record.set('share_token', original.getString('share_token'))
  } else {
    e.record.set('share_token', mode === 'off' ? '' : $security.randomString(22))
  }
  e.next()
}, 'notes')
