migrate((app) => {
  const users = app.findCollectionByNameOrId('users')
  const boards = app.findCollectionByNameOrId('boards')
  const shares = new Collection({
    type: 'base',
    name: 'shares',
    listRule: 'user = @request.auth.id',
    viewRule: 'user = @request.auth.id',
    createRule: '@request.auth.id != "" && user = @request.auth.id && board.user = @request.auth.id',
    updateRule: 'user = @request.auth.id && @request.body.user:isset = false && @request.body.board:isset = false && @request.body.token:isset = false && @request.body.items:isset = false',
    deleteRule: 'user = @request.auth.id',
    fields: [
      { name: 'user', type: 'relation', collectionId: users.id, maxSelect: 1, cascadeDelete: true, required: true },
      { name: 'board', type: 'relation', collectionId: boards.id, maxSelect: 1, cascadeDelete: true, required: true },
      { name: 'token', type: 'text', max: 32 },
      { name: 'mode', type: 'select', maxSelect: 1, values: ['view', 'edit'] },
      { name: 'items', type: 'text', max: 20000 },
      { name: 'expires', type: 'date' },
      { name: 'created', type: 'autodate', onCreate: true }
    ],
    indexes: [
      'CREATE UNIQUE INDEX idx_shares_token ON shares (token) WHERE token != \'\'',
      'CREATE INDEX idx_shares_board ON shares (board)'
    ]
  })
  app.save(shares)

  const records = app.findAllRecords('boards')
  for (let index = 0; index < records.length; index++) {
    const record = records[index]
    if (record.getString('share_mode') === 'off' || record.getString('share_token') === '') continue
    const share = new Record(shares)
    share.set('user', record.getString('user'))
    share.set('board', record.id)
    share.set('token', record.getString('share_token'))
    share.set('mode', record.getString('share_mode'))
    share.set('items', '[]')
    share.set('expires', record.getString('share_expires'))
    app.save(share)
  }

  boards.fields.removeByName('share_mode')
  boards.fields.removeByName('share_token')
  boards.fields.removeByName('share_expires')
  boards.indexes = ['CREATE INDEX idx_boards_user_updated ON boards (user, updated)']
  boards.updateRule = 'user = @request.auth.id && @request.body.user:isset = false && @request.body.title:isset = false && @request.body.cover:isset = false && @request.body.revision:isset = false'
  app.save(boards)

  const settings = app.settings()
  settings.rateLimits.rules = settings.rateLimits.rules.concat([{ label: 'shares:create', maxRequests: 30, duration: 60 }])
  app.save(settings)
}, (app) => {
  const boards = app.findCollectionByNameOrId('boards')
  boards.fields.add(new SelectField({ name: 'share_mode', maxSelect: 1, values: ['off', 'view', 'edit'] }))
  boards.fields.add(new TextField({ name: 'share_token', max: 32 }))
  boards.fields.add(new DateField({ name: 'share_expires' }))
  boards.indexes = [
    'CREATE INDEX idx_boards_user_updated ON boards (user, updated)',
    'CREATE UNIQUE INDEX idx_boards_share_token ON boards (share_token) WHERE share_token != \'\''
  ]
  boards.updateRule = 'user = @request.auth.id && @request.body.user:isset = false && @request.body.share_token:isset = false && @request.body.title:isset = false && @request.body.cover:isset = false && @request.body.revision:isset = false'
  app.save(boards)
  app.delete(app.findCollectionByNameOrId('shares'))
  const settings = app.settings()
  settings.rateLimits.rules = settings.rateLimits.rules.filter((rule) => rule.label !== 'shares:create')
  app.save(settings)
})
