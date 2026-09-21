const LABEL_LIMIT = 200
const TEXT_LIMIT = 20000
const MAX_DEPTH = 64
const ROOT = ''

function cleanLabel(raw) {
  return String(raw || '').replace(/[\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, LABEL_LIMIT)
}

function plainText(html, limit) {
  const text = String(html || '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim()
  return text.slice(0, limit || TEXT_LIMIT)
}

function boardText(content) {
  let items = []
  try {
    items = JSON.parse(String(content || '[]'))
  } catch (error) {
    items = []
  }
  if (!Array.isArray(items)) return ''
  const parts = []
  for (let index = 0; index < items.length; index++) {
    const item = items[index]
    if (!item) continue
    if (item.type === 'text') parts.push(plainText(item.html, TEXT_LIMIT))
    else if (item.type === 'link') parts.push(String(item.url || ''))
    else if (typeof item.name === 'string') parts.push(item.name)
  }
  return parts.join(' ').slice(0, TEXT_LIMIT)
}

function ownBoard(app, userId, id) {
  if (!id) return null
  try {
    const board = app.findRecordById('boards', id)
    return board.getString('user') === userId ? board : null
  } catch (error) {
    return null
  }
}

function ancestors(app, board) {
  const chain = []
  let current = board
  let depth = 0
  while (current && depth < MAX_DEPTH) {
    const parentId = current.getString('parent')
    if (parentId === ROOT) break
    let parent
    try {
      parent = app.findRecordById('boards', parentId)
    } catch (error) {
      break
    }
    chain.unshift(parent)
    current = parent
    depth++
  }
  return chain
}

function isInside(app, candidateId, boardId) {
  if (candidateId === boardId) return true
  let current
  try {
    current = app.findRecordById('boards', candidateId)
  } catch (error) {
    return false
  }
  let depth = 0
  while (depth < MAX_DEPTH) {
    const parentId = current.getString('parent')
    if (parentId === ROOT) return false
    if (parentId === boardId) return true
    try {
      current = app.findRecordById('boards', parentId)
    } catch (error) {
      return false
    }
    depth++
  }
  return true
}

function assertParent(app, record, parentId) {
  if (parentId === ROOT) return
  const parent = ownBoard(app, record.getString('user'), parentId)
  if (!parent) throw new BadRequestError('That folder does not exist.')
  if (record.id && isInside(app, parentId, record.id)) throw new BadRequestError('A folder cannot be moved inside itself.')
}

function summaryOf(board) {
  return {
    id: board.id,
    name: board.getString('name'),
    title: board.getString('title'),
    cover: board.getString('cover'),
    pinned: Boolean(board.get('pinned')),
    parent: board.getString('parent'),
    updated: board.getString('updated'),
    revision: board.getString('revision')
  }
}

function listFolder(app, userId, folderId) {
  const folder = folderId === ROOT ? null : ownBoard(app, userId, folderId)
  if (folderId !== ROOT && !folder) throw new NotFoundError('Folder not found.')
  const filter = folderId === ROOT ? "user = {:user} && parent = ''" : 'user = {:user} && parent = {:folder}'
  const params = { user: userId, folder: folderId }
  const folders = app.findRecordsByFilter('boards', filter, '-pinned,-updated', 500, 0, params).map(summaryOf)
  const docs = folderId === ROOT ? [] : app.findRecordsByFilter('docs', 'user = {:user} && board = {:folder}', '-updated', 500, 0, params).map((doc) => ({
    id: doc.id,
    name: doc.getString('name'),
    updated: doc.getString('updated'),
    revision: doc.getString('revision')
  }))
  const files = folderId === ROOT ? [] : app.findRecordsByFilter('files', 'user = {:user} && board = {:folder}', '-created', 500, 0, params).map((file) => ({
    id: file.id,
    name: file.getString('name'),
    size: Number(file.get('size')) || 0,
    kind: file.getString('kind'),
    updated: file.getString('created')
  }))
  const path = folder ? ancestors(app, folder).concat([folder]).map((board) => ({ id: board.id, name: board.getString('name'), title: board.getString('title') })) : []
  return { folder: folder ? summaryOf(folder) : null, path, folders, docs, files }
}

function searchIndex(app, userId) {
  const params = { user: userId }
  const boards = app.findRecordsByFilter('boards', 'user = {:user}', '-updated', 2000, 0, params).map((board) => ({
    id: board.id,
    name: board.getString('name'),
    title: board.getString('title'),
    parent: board.getString('parent'),
    updated: board.getString('updated'),
    text: boardText(board.getString('content'))
  }))
  const docs = app.findRecordsByFilter('docs', 'user = {:user}', '-updated', 2000, 0, params).map((doc) => ({
    id: doc.id,
    name: doc.getString('name'),
    board: doc.getString('board'),
    updated: doc.getString('updated'),
    text: plainText(doc.getString('content'), TEXT_LIMIT)
  }))
  const files = app.findRecordsByFilter('files', 'user = {:user}', '-created', 5000, 0, params).map((file) => ({
    id: file.id,
    name: file.getString('name'),
    board: file.getString('board'),
    kind: file.getString('kind'),
    size: Number(file.get('size')) || 0
  }))
  return { boards, docs, files }
}

module.exports = { ROOT, cleanLabel, plainText, boardText, ownBoard, ancestors, isInside, assertParent, listFolder, searchIndex }
