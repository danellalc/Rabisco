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
}, 'boards', 'images', 'files', 'shares', 'docs')

onRecordCreateRequest((e) => {
  const { assertQuota } = require(`${__hooks}/files.js`)
  const uploaded = e.findUploadedFiles('file')
  const size = uploaded.length > 0 ? Number(uploaded[0].size) : 0
  assertQuota(e.app, e.auth, size)
  e.record.set('size', size)
  e.next()
}, 'images')

onRecordCreateRequest((e) => {
  const { assertQuota, cleanName, isBlocked, kindOf, pictureKey } = require(`${__hooks}/files.js`)
  const uploaded = e.findUploadedFiles('file')
  if (uploaded.length === 0) throw new BadRequestError('Missing file.')
  const name = cleanName(uploaded[0].originalName)
  if (isBlocked(name)) throw new ApiError(415, 'That file type is not allowed.', {})
  assertQuota(e.app, e.auth, Number(uploaded[0].size))
  const kind = kindOf(name)
  e.record.set('name', name)
  e.record.set('size', Number(uploaded[0].size))
  e.record.set('kind', kind)
  e.record.set('pic', pictureKey(kind))
  e.next()
}, 'files')

onRecordUpdateRequest((e) => {
  const { cleanName, isBlocked, kindOf, pictureKey } = require(`${__hooks}/files.js`)
  const { openBoard } = require(`${__hooks}/drive.js`)
  const name = cleanName(e.record.getString('name'))
  if (isBlocked(name)) throw new ApiError(415, 'That file type is not allowed.', {})
  const kind = kindOf(name)
  e.record.set('name', name)
  e.record.set('kind', kind)
  if (kind !== 'image') e.record.set('pic', '')
  else if (e.record.getString('pic') === '') e.record.set('pic', pictureKey(kind))
  const board = e.record.getString('board')
  if (board !== e.record.original().getString('board') && !openBoard(e.app, e.auth.id, board)) throw new BadRequestError('That folder does not exist.')
  e.next()
}, 'files')

onRecordCreateRequest((e) => {
  const { parseBoard, sharedItemIds, isScoped, shareMode } = require(`${__hooks}/share.js`)
  const ownTarget = (collection, id) => {
    let record
    try {
      record = e.app.findRecordById(collection, id)
    } catch (error) {
      throw new BadRequestError('Nothing to share.')
    }
    if (record.getString('user') !== e.auth.id || record.getString('trashed') !== '') throw new BadRequestError('Nothing to share.')
    return record
  }
  const docId = e.record.getString('doc')
  const fileId = e.record.getString('file')
  if (docId !== '') {
    e.record.set('board', ownTarget('docs', docId).getString('board'))
    e.record.set('file', '')
    e.record.set('items', '[]')
    e.record.set('mode', shareMode(e.record.getString('mode'), false))
  } else if (fileId !== '') {
    e.record.set('board', ownTarget('files', fileId).getString('board'))
    e.record.set('items', '[]')
    e.record.set('mode', 'view')
  } else {
    const board = e.app.findRecordById('boards', e.record.getString('board'))
    const requested = e.record.getString('items')
    const itemIds = sharedItemIds(parseBoard(board.getString('content')), requested)
    if (isScoped(requested) && itemIds.length === 0) throw new BadRequestError('Nothing to share.')
    e.record.set('items', JSON.stringify(itemIds))
    e.record.set('mode', shareMode(e.record.getString('mode'), itemIds.length > 0))
  }
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
  const { assertParent, cleanLabel } = require(`${__hooks}/drive.js`)
  assertParent(e.app, e.record, e.record.getString('parent'))
  e.record.set('name', cleanLabel(e.record.getString('name')))
  applyBoard(e.app, e.record, e.record.getString('content'))
  e.record.set('revision', nextRevision())
  e.next()
}, 'boards')

onRecordUpdateRequest((e) => {
  const { applyRevision } = require(`${__hooks}/revision.js`)
  const { applyBoard } = require(`${__hooks}/items.js`)
  const { markImages } = require(`${__hooks}/files.js`)
  const { assertParent, cleanLabel } = require(`${__hooks}/drive.js`)
  const original = e.record.original()
  if (e.record.getString('parent') !== original.getString('parent')) assertParent(e.app, e.record, e.record.getString('parent'))
  e.record.set('name', cleanLabel(e.record.getString('name')))
  const content = applyBoard(e.app, e.record, e.record.getString('content'))
  const changed = content !== original.getString('content')
  applyRevision(e.app, 'boards', e.record, String(e.requestInfo().headers.x_note_rev || ''), changed)
  e.next()
  if (changed) markImages(e.app, e.record.id)
}, 'boards')

onRecordCreateRequest((e) => {
  const { nextRevision } = require(`${__hooks}/revision.js`)
  const { cleanLabel } = require(`${__hooks}/drive.js`)
  const { sanitizeDoc } = require(`${__hooks}/docs.js`)
  e.record.set('name', cleanLabel(e.record.getString('name')))
  e.record.set('content', sanitizeDoc(e.record.getString('content')))
  e.record.set('revision', nextRevision())
  e.next()
}, 'docs')

onRecordUpdateRequest((e) => {
  const { applyRevision } = require(`${__hooks}/revision.js`)
  const { markImages } = require(`${__hooks}/files.js`)
  const { cleanLabel, openBoard } = require(`${__hooks}/drive.js`)
  const { sanitizeDoc } = require(`${__hooks}/docs.js`)
  const original = e.record.original()
  const board = e.record.getString('board')
  if (board !== original.getString('board') && !openBoard(e.app, e.auth.id, board)) throw new BadRequestError('That folder does not exist.')
  e.record.set('name', cleanLabel(e.record.getString('name')))
  const content = sanitizeDoc(e.record.getString('content'))
  e.record.set('content', content)
  const changed = content !== original.getString('content')
  applyRevision(e.app, 'docs', e.record, String(e.requestInfo().headers.x_note_rev || ''), changed)
  e.next()
  if (changed) markImages(e.app, board)
  if (board !== original.getString('board')) markImages(e.app, original.getString('board'))
}, 'docs')

routerAdd('GET', '/api/quota', (e) => {
  if (!e.auth) throw new UnauthorizedError()
  const { quotaOf, usedBytes } = require(`${__hooks}/files.js`)
  return e.json(200, { used: usedBytes(e.app, e.auth.id), quota: quotaOf(e.auth) })
})

routerAdd('GET', '/api/drive/{id}', (e) => {
  if (!e.auth) throw new UnauthorizedError()
  const { listFolder, ROOT } = require(`${__hooks}/drive.js`)
  const id = e.request.pathValue('id')
  return e.json(200, listFolder(e.app, e.auth.id, id === 'root' ? ROOT : id))
})

routerAdd('GET', '/api/search-index', (e) => {
  if (!e.auth) throw new UnauthorizedError()
  const { searchIndex } = require(`${__hooks}/drive.js`)
  return e.json(200, searchIndex(e.app, e.auth.id))
})

routerAdd('GET', '/api/trash', (e) => {
  if (!e.auth) throw new UnauthorizedError()
  const { listTrash } = require(`${__hooks}/trash.js`)
  return e.json(200, listTrash(e.app, e.auth.id))
})

routerAdd('POST', '/api/trash', (e) => {
  if (!e.auth) throw new UnauthorizedError()
  const { moveToTrash } = require(`${__hooks}/trash.js`)
  const body = e.requestInfo().body
  moveToTrash(e.app, e.auth.id, String(body.kind || ''), String(body.id || ''))
  return e.noContent(204)
})

routerAdd('POST', '/api/trash/restore', (e) => {
  if (!e.auth) throw new UnauthorizedError()
  const { restore } = require(`${__hooks}/trash.js`)
  const body = e.requestInfo().body
  return e.json(200, restore(e.app, e.auth.id, String(body.kind || ''), String(body.id || '')))
})

routerAdd('DELETE', '/api/trash', (e) => {
  if (!e.auth) throw new UnauthorizedError()
  const { emptyTrash } = require(`${__hooks}/trash.js`)
  return e.json(200, { deleted: emptyTrash(e.app, e.auth.id) })
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

routerAdd('GET', '/api/pic/{id}/{key}', (e) => {
  const { servePicture } = require(`${__hooks}/files.js`)
  return servePicture(e)
})

routerAdd('GET', '/api/dl/{token}', (e) => {
  const { serveDownload } = require(`${__hooks}/files.js`)
  return serveDownload(e)
})

routerAdd('GET', '/api/shared', (e) => {
  const { findShared, folderContents } = require(`${__hooks}/share.js`)
  const shared = findShared(e)
  if (shared.kind === 'doc') {
    return e.json(200, {
      kind: 'doc',
      content: shared.doc.getString('content'),
      revision: shared.mode === 'edit' ? shared.doc.getString('revision') : '',
      mode: shared.mode,
      title: shared.doc.getString('name'),
      partial: false
    })
  }
  if (shared.kind === 'file') {
    const file = shared.file
    return e.json(200, {
      kind: 'file',
      file: { id: file.id, name: file.getString('name'), size: Number(file.get('size')) || 0, kind: file.getString('kind') },
      mode: 'view',
      title: file.getString('name'),
      partial: true
    })
  }
  const contents = shared.scoped ? { docs: [], files: [] } : folderContents(e.app, shared.board.id)
  return e.json(200, {
    kind: 'board',
    content: shared.content,
    revision: shared.mode === 'edit' ? shared.board.getString('revision') : '',
    mode: shared.mode,
    title: shared.scoped ? '' : shared.board.getString('name') || shared.board.getString('title'),
    partial: shared.scoped,
    docs: contents.docs,
    files: contents.files
  })
})

routerAdd('POST', '/api/shared/file-link', (e) => {
  const { findShared, sharedFileOf } = require(`${__hooks}/share.js`)
  const { downloadLink } = require(`${__hooks}/files.js`)
  const shared = findShared(e)
  const file = sharedFileOf(e.app, shared, String(e.requestInfo().body.file || ''))
  if (file === null) throw new NotFoundError('File not found.')
  return e.json(200, downloadLink(e.app, file))
})

routerAdd('POST', '/api/shared/doc', (e) => {
  const { findShared, sharedDocOf } = require(`${__hooks}/share.js`)
  const shared = findShared(e)
  const doc = sharedDocOf(e.app, shared, String(e.requestInfo().body.doc || ''))
  if (doc === null) throw new NotFoundError('Document not found.')
  return e.json(200, { id: doc.id, name: doc.getString('name'), content: doc.getString('content') })
})

routerAdd('PATCH', '/api/shared', (e) => {
  const { findShared } = require(`${__hooks}/share.js`)
  const { claimRevision, nextRevision } = require(`${__hooks}/revision.js`)
  const { applyBoard } = require(`${__hooks}/items.js`)
  const { markImages } = require(`${__hooks}/files.js`)
  const { sanitizeDoc } = require(`${__hooks}/docs.js`)
  const shared = findShared(e)
  if (shared.mode !== 'edit') throw new ForbiddenError('This link is view only.')
  const record = shared.kind === 'doc' ? shared.doc : shared.board
  const info = e.requestInfo()
  const expected = String(info.headers.x_note_rev || '')
  if (expected !== '' && expected !== record.getString('revision')) {
    throw new ApiError(409, 'The board changed elsewhere.', { revision: record.getString('revision') })
  }
  const previous = record.getString('content')
  const content = shared.kind === 'doc' ? sanitizeDoc(String(info.body.content || '')) : applyBoard(e.app, record, String(info.body.content || '[]'))
  if (shared.kind === 'doc') record.set('content', content)
  if (content !== previous) {
    record.set('revision', expected === '' ? nextRevision() : claimRevision(e.app, shared.kind === 'doc' ? 'docs' : 'boards', record.id, expected))
  }
  e.app.save(record)
  if (content !== previous) markImages(e.app, shared.kind === 'doc' ? record.getString('board') : record.id)
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

cronAdd('empty-trash', '15 4 * * *', () => {
  const { purgeOld } = require(`${__hooks}/trash.js`)
  purgeOld($app)
})
