migrate((app) => {
  const boards = app.findCollectionByNameOrId('notes')
  boards.name = 'boards'
  boards.fields.getByName('content').max = 2000000
  boards.indexes = [
    'CREATE INDEX idx_boards_user_updated ON boards (user, updated)',
    'CREATE UNIQUE INDEX idx_boards_share_token ON boards (share_token) WHERE share_token != \'\''
  ]
  app.save(boards)

  const images = app.findCollectionByNameOrId('images')
  images.fields.getByName('note').name = 'board'
  images.createRule = '@request.auth.id != "" && user = @request.auth.id && board.user = @request.auth.id'
  images.indexes = ['CREATE INDEX idx_images_board ON images (board)']
  app.save(images)

  const records = app.findAllRecords('boards')
  for (let index = 0; index < records.length; index++) {
    const record = records[index]
    const html = record.getString('content')
    let parsed = null
    try {
      parsed = JSON.parse(html)
    } catch (error) {
      parsed = null
    }
    if (Array.isArray(parsed)) continue
    const items = html === '' ? [] : [{ id: $security.randomString(8), type: 'text', x: 0, y: 0, w: 640, z: 1, html }]
    record.set('content', JSON.stringify(items))
    app.save(record)
  }
}, (app) => {
  const boards = app.findCollectionByNameOrId('boards')
  boards.name = 'notes'
  boards.fields.getByName('content').max = 200000
  boards.indexes = [
    'CREATE INDEX idx_notes_user_updated ON notes (user, updated)',
    'CREATE UNIQUE INDEX idx_notes_share_token ON notes (share_token) WHERE share_token != \'\''
  ]
  app.save(boards)

  const images = app.findCollectionByNameOrId('images')
  images.fields.getByName('board').name = 'note'
  images.createRule = '@request.auth.id != "" && user = @request.auth.id && note.user = @request.auth.id'
  images.indexes = ['CREATE INDEX idx_images_note ON images (note)']
  app.save(images)
})
