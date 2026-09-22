const RECORD_LIMIT = 500
const BYTES_LIMIT = 200 * 1024 * 1024
const MAX_DEPTH = 64
const ID_ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789'
const PICTURE_PATTERN = /^\/api\/pic\/([a-z0-9]{15})\/[A-Za-z0-9]{16}$/
const IMAGE_URL_PATTERN = /\/api\/files\/images\/([a-z0-9]{15})\//g

function newId() {
  return $security.randomStringWithAlphabet(15, ID_ALPHABET)
}

function ownReachable(app, userId, collection, kind, id, message) {
  const { isReachable } = require(`${__hooks}/trash.js`)
  let record
  try {
    record = app.findRecordById(collection, String(id || ''))
  } catch (error) {
    throw new NotFoundError(message)
  }
  if (record.getString('user') !== userId || !isReachable(app, kind, record)) throw new NotFoundError(message)
  return record
}

function childrenOf(app, userId, collection, field, id) {
  return app.findRecordsByFilter(collection, field + " = {:id} && user = {:user} && trashed = ''", 'created', RECORD_LIMIT + 1, 0, { id, user: userId })
}

function tooMuch() {
  return new ApiError(413, 'This folder is too big to duplicate.', {})
}

function imagesIn(app, userId, contents, seen) {
  const { imageIds } = require(`${__hooks}/files.js`)
  const ids = imageIds(contents.join('\n'))
  const records = []
  for (let index = 0; index < ids.length; index++) {
    if (seen[ids[index]]) continue
    seen[ids[index]] = true
    try {
      const image = app.findRecordById('images', ids[index])
      if (image.getString('user') === userId) records.push(image)
    } catch (error) {
      continue
    }
  }
  return records
}

function sizeOf(record) {
  return Number(record.get('size')) || 0
}

function planFolder(app, userId, board, depth, totals) {
  if (depth > MAX_DEPTH) throw new BadRequestError('The folder is too deep.')
  const docs = childrenOf(app, userId, 'docs', 'board', board.id)
  const files = childrenOf(app, userId, 'files', 'board', board.id)
  const images = imagesIn(app, userId, [board.getString('content')].concat(docs.map((doc) => doc.getString('content'))), totals.seenImages)
  totals.records += 1 + docs.length + files.length + images.length
  for (let index = 0; index < files.length; index++) totals.bytes += sizeOf(files[index])
  for (let index = 0; index < images.length; index++) totals.bytes += sizeOf(images[index])
  if (totals.records > RECORD_LIMIT || totals.bytes > BYTES_LIMIT) throw tooMuch()
  const subfolders = childrenOf(app, userId, 'boards', 'parent', board.id)
  const children = []
  for (let index = 0; index < subfolders.length; index++) children.push(planFolder(app, userId, subfolders[index], depth + 1, totals))
  return { board, docs, files, images, children }
}

function rewriteImageUrls(html, ids) {
  return String(html || '').replace(IMAGE_URL_PATTERN, (match, id) => (ids[id] ? '/api/files/images/' + ids[id] + '/' : match))
}

function rewriteItems(content, ids, pics) {
  const { parseItems } = require(`${__hooks}/items.js`)
  const items = parseItems(content) || []
  for (let index = 0; index < items.length; index++) {
    const item = items[index]
    if (!item || typeof item !== 'object') continue
    if (item.type === 'text') item.html = rewriteImageUrls(item.html, ids)
    else if (item.type === 'image') rewriteImage(item, ids, pics)
    else if (typeof item[item.type] === 'string' && ids[item[item.type]]) item[item.type] = ids[item[item.type]]
  }
  return JSON.stringify(items)
}

function rewriteImage(item, ids, pics) {
  const picture = PICTURE_PATTERN.exec(String(item.src || ''))
  if (picture && ids[picture[1]]) {
    item.file = ids[picture[1]]
    item.src = '/api/pic/' + item.file + '/' + pics[item.file]
    return
  }
  item.src = rewriteImageUrls(item.src, ids)
  if (typeof item.file === 'string' && ids[item.file]) item.file = ids[item.file]
}

function copyBlob(context, source, copy) {
  const name = source.getString('file')
  const from = source.baseFilesPath() + '/' + name
  if (!context.fsys.exists(from)) return false
  copy.set('file', name)
  context.fsys.copy(from, copy.baseFilesPath() + '/' + name)
  context.blobs.push(copy.baseFilesPath())
  return true
}

function copyFileRecord(context, source, boardId) {
  const { pictureKey } = require(`${__hooks}/files.js`)
  const copy = new Record(context.app.findCollectionByNameOrId('files'))
  copy.set('id', newId())
  copy.set('user', context.userId)
  copy.set('board', boardId)
  copy.set('name', source.getString('name'))
  copy.set('size', sizeOf(source))
  copy.set('kind', source.getString('kind'))
  copy.set('pic', pictureKey(source.getString('kind')))
  if (!copyBlob(context, source, copy)) return
  context.app.saveNoValidate(copy)
  context.ids[source.id] = copy.id
  context.pics[copy.id] = copy.getString('pic')
}

function copyImageRecord(context, source, boardId) {
  const copy = new Record(context.app.findCollectionByNameOrId('images'))
  copy.set('id', newId())
  copy.set('user', context.userId)
  copy.set('board', boardId)
  copy.set('size', sizeOf(source))
  if (!copyBlob(context, source, copy)) return
  context.app.saveNoValidate(copy)
  context.ids[source.id] = copy.id
}

function copyDocRecord(context, source, boardId) {
  const { nextRevision } = require(`${__hooks}/revision.js`)
  const copy = new Record(context.app.findCollectionByNameOrId('docs'))
  copy.set('user', context.userId)
  copy.set('board', boardId)
  copy.set('name', source.getString('name'))
  copy.set('content', rewriteImageUrls(source.getString('content'), context.ids))
  copy.set('revision', nextRevision())
  context.app.save(copy)
  context.ids[source.id] = copy.id
}

function copyTree(context, node, parentId, name) {
  const { nextRevision } = require(`${__hooks}/revision.js`)
  const copy = new Record(context.app.findCollectionByNameOrId('boards'))
  copy.set('user', context.userId)
  copy.set('parent', parentId)
  copy.set('name', name)
  copy.set('content', '[]')
  copy.set('revision', nextRevision())
  context.app.save(copy)
  context.ids[node.board.id] = copy.id
  node.copy = copy
  for (let index = 0; index < node.images.length; index++) copyImageRecord(context, node.images[index], copy.id)
  for (let index = 0; index < node.docs.length; index++) copyDocRecord(context, node.docs[index], copy.id)
  for (let index = 0; index < node.files.length; index++) copyFileRecord(context, node.files[index], copy.id)
  for (let index = 0; index < node.children.length; index++) copyTree(context, node.children[index], copy.id, node.children[index].board.getString('name'))
}

function fillBoards(context, node) {
  const { applyBoard } = require(`${__hooks}/items.js`)
  applyBoard(context.app, node.copy, rewriteItems(node.board.getString('content'), context.ids, context.pics))
  context.app.save(node.copy)
  for (let index = 0; index < node.children.length; index++) fillBoards(context, node.children[index])
}

function duplicateFolder(app, user, id, name) {
  const { assertQuota } = require(`${__hooks}/files.js`)
  const { cleanLabel } = require(`${__hooks}/drive.js`)
  const source = ownReachable(app, user.id, 'boards', 'folder', id, 'Folder not found.')
  const totals = { records: 0, bytes: 0, seenImages: Object.create(null) }
  const plan = planFolder(app, user.id, source, 0, totals)
  assertQuota(app, user, totals.bytes)
  const label = cleanLabel(name) || source.getString('name') || source.getString('title')
  const fsys = app.newFilesystem()
  const context = { app, fsys, userId: user.id, ids: Object.create(null), pics: Object.create(null), blobs: [] }
  try {
    app.runInTransaction((tx) => {
      context.app = tx
      copyTree(context, plan, source.getString('parent'), label)
      fillBoards(context, plan)
    })
  } catch (error) {
    for (let index = 0; index < context.blobs.length; index++) fsys.deletePrefix(context.blobs[index])
    throw error
  } finally {
    fsys.close()
  }
  return { id: plan.copy.id }
}

function replaceFile(app, user, id, uploaded) {
  const { assertQuota, cleanName, isBlocked, kindOf, pictureKey } = require(`${__hooks}/files.js`)
  const record = ownReachable(app, user.id, 'files', 'file', id, 'File not found.')
  if (uploaded.length === 0) throw new BadRequestError('Missing file.')
  const name = cleanName(uploaded[0].originalName)
  if (isBlocked(name)) throw new ApiError(415, 'That file type is not allowed.', {})
  const size = Number(uploaded[0].size)
  assertQuota(app, user, size - sizeOf(record))
  const kind = kindOf(name)
  record.set('file', uploaded[0])
  record.set('name', name)
  record.set('size', size)
  record.set('kind', kind)
  record.set('pic', pictureKey(kind))
  app.save(record)
  return { id: record.id, name, size, kind, pic: record.getString('pic') }
}

module.exports = { rewriteItems, rewriteImageUrls, duplicateFolder, replaceFile }
