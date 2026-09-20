const FREE_QUOTA = 2 * 1024 * 1024 * 1024
const PRO_QUOTA = 100 * 1024 * 1024 * 1024
const NAME_LIMIT = 200
const LINK_SECONDS = 600
const BLOCKED = ['exe', 'msi', 'bat', 'cmd', 'com', 'scr', 'pif', 'vbs', 'js', 'jse', 'wsf', 'ps1', 'jar', 'hta', 'dll', 'lnk']
const KINDS = {
  pdf: ['pdf'],
  doc: ['doc', 'docx', 'odt', 'rtf', 'txt', 'md', 'pages'],
  sheet: ['xls', 'xlsx', 'ods', 'csv', 'numbers'],
  slides: ['ppt', 'pptx', 'odp', 'key'],
  zip: ['zip', 'rar', '7z', 'tar', 'gz', 'tgz'],
  video: ['mp4', 'webm', 'mov', 'm4v', 'mkv'],
  audio: ['mp3', 'm4a', 'wav', 'ogg', 'aac', 'flac'],
  code: ['json', 'xml', 'html', 'css', 'py', 'go', 'ts', 'sql', 'sh', 'yml', 'yaml', 'toml']
}

function extensionOf(name) {
  const match = /\.([A-Za-z0-9]{1,10})$/.exec(String(name || ''))
  return match ? match[1].toLowerCase() : ''
}

function kindOf(name) {
  const extension = extensionOf(name)
  const kinds = Object.keys(KINDS)
  for (let index = 0; index < kinds.length; index++) {
    if (KINDS[kinds[index]].indexOf(extension) >= 0) return kinds[index]
  }
  return 'generic'
}

function isBlocked(name) {
  return BLOCKED.indexOf(extensionOf(name)) >= 0
}

function cleanName(name) {
  const base = String(name || '').split(/[\\/]/).pop().replace(/[\u0000-\u001f]/g, '').trim().replace(/[.\s]+$/, '')
  return (base || 'file').slice(0, NAME_LIMIT)
}

function quotaOf(user) {
  const custom = Number(user.get('quota_bytes')) || 0
  if (custom > 0) return custom
  return user.getString('plan') === 'pro' ? PRO_QUOTA : FREE_QUOTA
}

function usedBytes(app, userId) {
  const result = new DynamicModel({ total: 0 })
  app.db()
    .newQuery("SELECT COALESCE((SELECT SUM(size) FROM files WHERE user = {:user} AND orphaned = ''), 0) + COALESCE((SELECT SUM(size) FROM images WHERE user = {:user} AND orphaned = ''), 0) AS total")
    .bind({ user: userId })
    .one(result)
  return Number(result.total) || 0
}

function storageIds(content) {
  const files = []
  const images = []
  let items = []
  try {
    items = JSON.parse(String(content || '[]'))
  } catch (error) {
    items = []
  }
  for (let index = 0; index < items.length; index++) {
    const item = items[index]
    if (item && item.type === 'file' && typeof item.file === 'string' && files.indexOf(item.file) < 0) files.push(item.file)
  }
  const pattern = /\/api\/files\/images\/([a-z0-9]{15})\//g
  let match = pattern.exec(String(content || ''))
  while (match !== null) {
    if (images.indexOf(match[1]) < 0) images.push(match[1])
    match = pattern.exec(String(content || ''))
  }
  return { files, images }
}

function markCollection(app, name, boardId, ids) {
  const params = { board: boardId }
  const placeholders = []
  for (let index = 0; index < ids.length; index++) {
    params['id' + index] = ids[index]
    placeholders.push('{:id' + index + '}')
  }
  const list = placeholders.join(',')
  app.db()
    .newQuery('UPDATE ' + name + " SET orphaned = strftime('%Y-%m-%d %H:%M:%fZ', 'now') WHERE board = {:board} AND orphaned = ''" + (list ? ' AND id NOT IN (' + list + ')' : ''))
    .bind(params)
    .execute()
  if (!list) return
  app.db()
    .newQuery('UPDATE ' + name + " SET orphaned = '' WHERE board = {:board} AND orphaned != '' AND id IN (" + list + ')')
    .bind(params)
    .execute()
}

function markStorage(app, boardId, content) {
  const ids = storageIds(content)
  markCollection(app, 'files', boardId, ids.files)
  markCollection(app, 'images', boardId, ids.images)
}

function assertQuota(app, user, incoming) {
  const used = usedBytes(app, user.id)
  const quota = quotaOf(user)
  if (used + incoming > quota) throw new ApiError(413, 'Storage full.', { used, quota })
  return { used, quota }
}

function signingKey(app) {
  return app.findFirstRecordByData('secrets', 'name', 'download').getString('value')
}

function downloadLink(app, record) {
  const token = $security.createJWT({ file: record.id, kind: record.collection().name }, signingKey(app), LINK_SECONDS)
  return { url: `/api/dl/${token}`, expires: LINK_SECONDS }
}

function serveDownload(e) {
  let claims
  try {
    claims = $security.parseJWT(e.request.pathValue('token'), signingKey(e.app))
  } catch (error) {
    throw new NotFoundError('Link expired.')
  }
  const collection = claims.kind === 'images' ? 'images' : 'files'
  let record
  try {
    record = e.app.findRecordById(collection, String(claims.file))
  } catch (error) {
    throw new NotFoundError('File not found.')
  }
  const name = collection === 'files' ? record.getString('name') : record.getString('file')
  const header = e.response.header()
  header.set('Content-Disposition', 'attachment; filename="' + name.replace(/["\\]/g, '_').replace(/[^\x20-\x7e]/g, '_') + '"; filename*=UTF-8\'\'' + encodeURIComponent(name))
  header.set('Content-Security-Policy', 'sandbox')
  header.set('X-Content-Type-Options', 'nosniff')
  header.set('Cache-Control', 'private, max-age=600')
  const fsys = e.app.newFilesystem()
  try {
    return fsys.serve(e.response, e.request, record.baseFilesPath() + '/' + record.getString('file'), name)
  } finally {
    fsys.close()
  }
}

function fileItemInfo(app, boardId, userId) {
  return (id) => {
    try {
      const record = app.findRecordById('files', id)
      if (record.getString('board') !== boardId || record.getString('user') !== userId) return null
      return { name: record.getString('name'), size: Number(record.get('size')) || 0, kind: record.getString('kind') }
    } catch (error) {
      return null
    }
  }
}

function deleteUnreferenced(app, condition) {
  const collections = { files: '%"file":"', images: '%/api/files/images/' }
  const names = Object.keys(collections)
  for (let index = 0; index < names.length; index++) {
    const name = names[index]
    const prefix = collections[name]
    const rows = arrayOf(new DynamicModel({ id: '' }))
    app.db()
      .newQuery('SELECT id FROM ' + name + ' WHERE ' + condition + ' AND NOT EXISTS (SELECT 1 FROM boards WHERE boards.content LIKE {:prefix} || ' + name + ".id || '%')")
      .bind({ prefix })
      .all(rows)
    for (let row = 0; row < rows.length; row++) {
      try {
        app.delete(app.findRecordById(name, rows[row].id))
      } catch (error) {
        continue
      }
    }
  }
}

function deleteNeverPlaced(app) {
  deleteUnreferenced(app, "orphaned = '' AND created < datetime('now', '-1 day')")
}

function deleteOrphans(app) {
  deleteUnreferenced(app, "orphaned != '' AND orphaned < datetime('now', '-1 hour')")
}

module.exports = { BLOCKED, KINDS, extensionOf, kindOf, isBlocked, cleanName, quotaOf, usedBytes, assertQuota, downloadLink, serveDownload, fileItemInfo, storageIds, markStorage, deleteNeverPlaced, deleteOrphans }
