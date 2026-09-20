routerUse((e) => {
  if (e.request.url.path.startsWith('/_/')) return e.next()
  const header = e.response.header()
  header.set('Content-Security-Policy', "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' blob: data:; media-src 'self' blob:; connect-src 'self'; manifest-src 'self'; worker-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'; object-src 'none'; require-trusted-types-for 'script'; trusted-types sanitizer-input")
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
}, 'boards', 'images', 'files', 'shares')

onRecordCreateRequest((e) => {
  const { assertQuota } = require(`${__hooks}/files.js`)
  const uploaded = e.findUploadedFiles('file')
  const size = uploaded.length > 0 ? Number(uploaded[0].size) : 0
  assertQuota(e.app, e.auth, size)
  e.record.set('size', size)
  e.next()
}, 'images')

onRecordCreateRequest((e) => {
  const { assertQuota, cleanName, isBlocked, kindOf } = require(`${__hooks}/files.js`)
  const uploaded = e.findUploadedFiles('file')
  if (uploaded.length === 0) throw new BadRequestError('Missing file.')
  const name = cleanName(uploaded[0].originalName)
  if (isBlocked(name)) throw new ApiError(415, 'That file type is not allowed.', {})
  assertQuota(e.app, e.auth, Number(uploaded[0].size))
  e.record.set('name', name)
  e.record.set('size', Number(uploaded[0].size))
  e.record.set('kind', kindOf(name))
  e.next()
}, 'files')

onRecordUpdateRequest((e) => {
  const { cleanName, isBlocked } = require(`${__hooks}/files.js`)
  const name = cleanName(e.record.getString('name'))
  if (isBlocked(name)) throw new ApiError(415, 'That file type is not allowed.', {})
  e.record.set('name', name)
  e.next()
}, 'files')

onRecordCreateRequest((e) => {
  const { parseBoard, sharedItemIds, isScoped, shareMode } = require(`${__hooks}/share.js`)
  const board = e.app.findRecordById('boards', e.record.getString('board'))
  const requested = e.record.getString('items')
  const itemIds = sharedItemIds(parseBoard(board.getString('content')), requested)
  if (isScoped(requested) && itemIds.length === 0) throw new BadRequestError('Nothing to share.')
  e.record.set('items', JSON.stringify(itemIds))
  e.record.set('mode', shareMode(e.record.getString('mode'), itemIds.length > 0))
  e.record.set('token', $security.randomString(22))
  e.next()
}, 'shares')

onRecordUpdateRequest((e) => {
  const { isScoped, shareMode } = require(`${__hooks}/share.js`)
  e.record.set('mode', shareMode(e.record.getString('mode'), isScoped(e.record.getString('items'))))
  e.next()
}, 'shares')

onRecordCreateRequest((e) => {
  const { nextRevision } = require(`${__hooks}/revision.js`)
  const { applyBoard } = require(`${__hooks}/items.js`)
  applyBoard(e.app, e.record, e.record.getString('content'))
  e.record.set('revision', nextRevision())
  e.next()
}, 'boards')

routerAdd('GET', '/api/quota', (e) => {
  if (!e.auth) throw new UnauthorizedError()
  const { quotaOf, usedBytes } = require(`${__hooks}/files.js`)
  return e.json(200, { used: usedBytes(e.app, e.auth.id), quota: quotaOf(e.auth) })
})

routerAdd('POST', '/api/files/{id}/link', (e) => {
  if (!e.auth) throw new UnauthorizedError()
  const { downloadLink } = require(`${__hooks}/files.js`)
  const id = e.request.pathValue('id')
  let record
  try {
    record = e.app.findRecordById('files', id)
  } catch (error) {
    try {
      record = e.app.findRecordById('images', id)
    } catch (again) {
      throw new NotFoundError('File not found.')
    }
  }
  if (record.getString('user') !== e.auth.id) throw new NotFoundError('File not found.')
  return e.json(200, downloadLink(e.app, record))
})

routerAdd('GET', '/api/dl/{token}', (e) => {
  const { serveDownload } = require(`${__hooks}/files.js`)
  return serveDownload(e)
})

routerAdd('GET', '/api/shared', (e) => {
  const { findShared } = require(`${__hooks}/share.js`)
  const shared = findShared(e)
  return e.json(200, {
    content: shared.content,
    revision: shared.mode === 'edit' ? shared.board.getString('revision') : '',
    mode: shared.mode,
    title: shared.scoped ? '' : shared.board.getString('title'),
    partial: shared.scoped
  })
})

routerAdd('POST', '/api/shared/file-link', (e) => {
  const { findShared } = require(`${__hooks}/share.js`)
  const { downloadLink } = require(`${__hooks}/files.js`)
  const shared = findShared(e)
  const id = String(e.requestInfo().body.file || '')
  if (id === '' || shared.content.indexOf('"file":"' + id + '"') < 0) throw new NotFoundError('File not found.')
  let file
  try {
    file = e.app.findRecordById('files', id)
  } catch (error) {
    throw new NotFoundError('File not found.')
  }
  if (file.getString('board') !== shared.board.id) throw new NotFoundError('File not found.')
  return e.json(200, downloadLink(e.app, file))
})

routerAdd('PATCH', '/api/shared', (e) => {
  const { findShared } = require(`${__hooks}/share.js`)
  const { claimRevision, nextRevision } = require(`${__hooks}/revision.js`)
  const { applyBoard } = require(`${__hooks}/items.js`)
  const { markStorage } = require(`${__hooks}/files.js`)
  const shared = findShared(e)
  if (shared.mode !== 'edit') throw new ForbiddenError('This link is view only.')
  const record = shared.board
  const info = e.requestInfo()
  const expected = String(info.headers.x_note_rev || '')
  if (expected !== '' && expected !== record.getString('revision')) {
    throw new ApiError(409, 'The board changed elsewhere.', { revision: record.getString('revision') })
  }
  const previous = record.getString('content')
  const content = applyBoard(e.app, record, String(info.body.content || '[]'))
  if (content !== previous) {
    record.set('revision', expected === '' ? nextRevision() : claimRevision(e.app, record.id, expected))
  }
  e.app.save(record)
  if (content !== previous) markStorage(e.app, record.id, content)
  return e.json(200, { revision: record.getString('revision') })
})

routerAdd('POST', '/share-target', (e) => e.redirect(303, '/'))

cronAdd('expire-shares', '*/15 * * * *', () => {
  const { expireShares } = require(`${__hooks}/share.js`)
  expireShares($app)
})

cronAdd('clean-files', '30 3 * * *', () => {
  const { deleteNeverPlaced } = require(`${__hooks}/files.js`)
  deleteNeverPlaced($app)
})

cronAdd('free-storage', '*/15 * * * *', () => {
  const { deleteOrphans } = require(`${__hooks}/files.js`)
  deleteOrphans($app)
})

onRecordUpdateRequest((e) => {
  const { claimRevision, nextRevision } = require(`${__hooks}/revision.js`)
  const { applyBoard } = require(`${__hooks}/items.js`)
  const { markStorage } = require(`${__hooks}/files.js`)
  const info = e.requestInfo()
  const original = e.record.original()
  const expected = String(info.headers.x_note_rev || '')
  if (expected !== '' && expected !== original.getString('revision')) {
    throw new ApiError(409, 'The board changed elsewhere.', { revision: original.getString('revision') })
  }
  const content = applyBoard(e.app, e.record, e.record.getString('content'))
  if (content !== original.getString('content')) {
    e.record.set('revision', expected === '' ? nextRevision() : claimRevision(e.app, e.record.id, expected))
  }
  e.next()
  if (content !== original.getString('content')) markStorage(e.app, e.record.id, content)
}, 'boards')
