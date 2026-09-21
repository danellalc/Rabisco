migrate((app) => {
  const users = app.findCollectionByNameOrId('users')
  const boards = app.findCollectionByNameOrId('boards')
  boards.fields.add(new RelationField({ name: 'parent', collectionId: boards.id, maxSelect: 1, cascadeDelete: true }))
  boards.fields.add(new TextField({ name: 'name', max: 200 }))
  boards.indexes = boards.indexes.concat(['CREATE INDEX idx_boards_user_parent ON boards (user, parent)'])
  app.save(boards)

  const docs = new Collection({
    type: 'base',
    name: 'docs',
    listRule: 'user = @request.auth.id',
    viewRule: 'user = @request.auth.id',
    createRule: '@request.auth.id != "" && user = @request.auth.id && board.user = @request.auth.id',
    updateRule: 'user = @request.auth.id && @request.body.user:isset = false && @request.body.revision:isset = false',
    deleteRule: 'user = @request.auth.id',
    fields: [
      { name: 'user', type: 'relation', collectionId: users.id, maxSelect: 1, cascadeDelete: true, required: true },
      { name: 'board', type: 'relation', collectionId: boards.id, maxSelect: 1, cascadeDelete: true, required: true },
      { name: 'name', type: 'text', max: 200 },
      { name: 'content', type: 'text', max: 2000000 },
      { name: 'revision', type: 'text', max: 32 },
      { name: 'created', type: 'autodate', onCreate: true },
      { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true }
    ],
    indexes: ['CREATE INDEX idx_docs_board ON docs (board)', 'CREATE INDEX idx_docs_user ON docs (user)']
  })
  app.save(docs)

  const files = app.findCollectionByNameOrId('files')
  files.updateRule = 'user = @request.auth.id && @request.body.file:isset = false && @request.body.user:isset = false && @request.body.size:isset = false && @request.body.kind:isset = false'
  app.save(files)

  const shares = app.findCollectionByNameOrId('shares')
  shares.fields.add(new RelationField({ name: 'doc', collectionId: docs.id, maxSelect: 1, cascadeDelete: true }))
  shares.indexes = shares.indexes.concat(['CREATE INDEX idx_shares_doc ON shares (doc)'])
  app.save(shares)

  const settings = app.settings()
  settings.rateLimits.rules = settings.rateLimits.rules.concat([
    { label: 'docs:create', maxRequests: 30, duration: 60 },
    { label: '/api/drive/', maxRequests: 120, duration: 10 }
  ])
  app.save(settings)
}, (app) => {
  const settings = app.settings()
  settings.rateLimits.rules = settings.rateLimits.rules.filter((rule) => !['docs:create', '/api/drive/'].includes(rule.label))
  app.save(settings)

  const shares = app.findCollectionByNameOrId('shares')
  shares.fields.removeByName('doc')
  shares.indexes = shares.indexes.filter((index) => index.indexOf('idx_shares_doc') < 0)
  app.save(shares)

  const files = app.findCollectionByNameOrId('files')
  files.updateRule = 'user = @request.auth.id && @request.body.file:isset = false && @request.body.user:isset = false && @request.body.board:isset = false && @request.body.size:isset = false && @request.body.kind:isset = false'
  app.save(files)

  app.delete(app.findCollectionByNameOrId('docs'))

  const boards = app.findCollectionByNameOrId('boards')
  boards.fields.removeByName('parent')
  boards.fields.removeByName('name')
  boards.indexes = boards.indexes.filter((index) => index.indexOf('idx_boards_user_parent') < 0)
  app.save(boards)
})
