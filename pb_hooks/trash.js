const TABLES = { folder: 'boards', doc: 'docs', file: 'files' }
const KINDS = ['file', 'doc', 'folder']
const KEEP_DAYS = 30
const MAX_DEPTH = 64
const LIST_LIMIT = 500

function tableOf(kind) {
  const table = TABLES[kind]
  if (!table) throw new BadRequestError('Unknown kind.')
  return table
}

function isTrashed(record) {
  return record.getString('trashed') !== ''
}

function homeOf(kind, record) {
  return record.getString(kind === 'folder' ? 'parent' : 'board')
}

function isInTrash(app, boardId, known) {
  const seen = known || Object.create(null)
  const visited = []
  let currentId = boardId
  let answer = false
  let depth = 0
  while (currentId !== '' && depth < MAX_DEPTH) {
    if (seen[currentId] !== undefined) {
      answer = seen[currentId]
      break
    }
    visited.push(currentId)
    let board
    try {
      board = app.findRecordById('boards', currentId)
    } catch (error) {
      answer = true
      break
    }
    if (isTrashed(board)) {
      answer = true
      break
    }
    currentId = board.getString('parent')
    depth++
  }
  for (let index = 0; index < visited.length; index++) seen[visited[index]] = answer
  return answer
}

function isReachable(app, kind, record) {
  return !isTrashed(record) && !isInTrash(app, homeOf(kind, record))
}

function ownRecord(app, userId, kind, id) {
  const table = tableOf(kind)
  let record
  try {
    record = app.findRecordById(table, String(id || ''))
  } catch (error) {
    throw new NotFoundError('Not found.')
  }
  if (record.getString('user') !== userId) throw new NotFoundError('Not found.')
  return record
}

function setTrashed(app, kind, id, value) {
  app.db()
    .newQuery('UPDATE ' + tableOf(kind) + ' SET trashed = ' + (value ? "strftime('%Y-%m-%d %H:%M:%fZ', 'now')" : "''") + ' WHERE id = {:id}')
    .bind({ id })
    .execute()
}

function moveToTrash(app, userId, kind, id) {
  const record = ownRecord(app, userId, kind, id)
  if (!isTrashed(record)) setTrashed(app, kind, record.id, true)
}

function restore(app, userId, kind, id) {
  const record = ownRecord(app, userId, kind, id)
  if (isInTrash(app, homeOf(kind, record))) throw new ApiError(409, 'Restore the folder first.', {})
  if (isTrashed(record)) setTrashed(app, kind, record.id, false)
  return { home: homeOf(kind, record) }
}

function nameOfBoard(app, id) {
  if (id === '') return ''
  try {
    const board = app.findRecordById('boards', id)
    return board.getString('name') || board.getString('title')
  } catch (error) {
    return ''
  }
}

function entryOf(app, kind, record) {
  const home = homeOf(kind, record)
  const entry = { kind, id: record.id, name: kind === 'folder' ? record.getString('name') || record.getString('title') : record.getString('name'), trashed: record.getString('trashed'), home, homeName: nameOfBoard(app, home) }
  if (kind === 'file') {
    entry.size = Number(record.get('size')) || 0
    entry.fileKind = record.getString('kind')
  }
  return entry
}

function listTrash(app, userId) {
  const known = Object.create(null)
  const entries = []
  for (let kindIndex = 0; kindIndex < KINDS.length; kindIndex++) {
    const kind = KINDS[kindIndex]
    const records = app.findRecordsByFilter(tableOf(kind), "user = {:user} && trashed != ''", '-trashed', LIST_LIMIT, 0, { user: userId })
    for (let index = 0; index < records.length; index++) {
      if (!isInTrash(app, homeOf(kind, records[index]), known)) entries.push(entryOf(app, kind, records[index]))
    }
  }
  entries.sort((a, b) => (a.trashed < b.trashed ? 1 : a.trashed > b.trashed ? -1 : 0))
  return { entries, keepDays: KEEP_DAYS }
}

function deleteWhere(app, condition, params) {
  let deleted = 0
  for (let kindIndex = 0; kindIndex < KINDS.length; kindIndex++) {
    const table = tableOf(KINDS[kindIndex])
    const rows = arrayOf(new DynamicModel({ id: '' }))
    app.db().newQuery('SELECT id FROM ' + table + " WHERE trashed != '' AND " + condition).bind(params).all(rows)
    for (let row = 0; row < rows.length; row++) {
      try {
        app.delete(app.findRecordById(table, rows[row].id))
        deleted++
      } catch (error) {
        continue
      }
    }
  }
  return deleted
}

function emptyTrash(app, userId) {
  return deleteWhere(app, 'user = {:user}', { user: userId })
}

function purgeOld(app) {
  return deleteWhere(app, "trashed < datetime('now', '-" + KEEP_DAYS + " days')", {})
}

module.exports = { KEEP_DAYS, isTrashed, isInTrash, isReachable, moveToTrash, restore, listTrash, emptyTrash, purgeOld }
