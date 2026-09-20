migrate((app) => {
  const users = app.findCollectionByNameOrId('users')
  users.fields.add(new SelectField({ name: 'plan', maxSelect: 1, values: ['free', 'pro'] }))
  users.fields.add(new NumberField({ name: 'quota_bytes', min: 0, onlyInt: true }))
  app.save(users)

  const images = app.findCollectionByNameOrId('images')
  images.fields.add(new NumberField({ name: 'size', min: 0, onlyInt: true }))
  app.save(images)

  const boards = app.findCollectionByNameOrId('boards')
  const files = new Collection({
    type: 'base',
    name: 'files',
    listRule: 'user = @request.auth.id',
    viewRule: 'user = @request.auth.id',
    createRule: '@request.auth.id != "" && user = @request.auth.id && board.user = @request.auth.id',
    updateRule: 'user = @request.auth.id && @request.body.file:isset = false && @request.body.user:isset = false && @request.body.board:isset = false && @request.body.size:isset = false && @request.body.kind:isset = false',
    deleteRule: 'user = @request.auth.id',
    fields: [
      { name: 'user', type: 'relation', collectionId: users.id, maxSelect: 1, cascadeDelete: true, required: true },
      { name: 'board', type: 'relation', collectionId: boards.id, maxSelect: 1, cascadeDelete: true, required: true },
      { name: 'file', type: 'file', maxSelect: 1, maxSize: 524288000, protected: true, required: true },
      { name: 'name', type: 'text', max: 200 },
      { name: 'size', type: 'number', min: 0, onlyInt: true },
      { name: 'kind', type: 'text', max: 20 },
      { name: 'created', type: 'autodate', onCreate: true }
    ],
    indexes: ['CREATE INDEX idx_files_board ON files (board)', 'CREATE INDEX idx_files_user ON files (user)']
  })
  app.save(files)

  const secrets = new Collection({
    type: 'base',
    name: 'secrets',
    listRule: null,
    viewRule: null,
    createRule: null,
    updateRule: null,
    deleteRule: null,
    fields: [
      { name: 'name', type: 'text', required: true },
      { name: 'value', type: 'text', required: true }
    ],
    indexes: ['CREATE UNIQUE INDEX idx_secrets_name ON secrets (name)']
  })
  app.save(secrets)
  const signing = new Record(secrets)
  signing.set('name', 'download')
  signing.set('value', $security.randomString(48))
  app.save(signing)

  const settings = app.settings()
  settings.rateLimits.rules = settings.rateLimits.rules.concat([
    { label: 'files:create', maxRequests: 30, duration: 60 },
    { label: '/api/dl/', maxRequests: 120, duration: 10 },
    { label: 'POST /api/shared/file-link', maxRequests: 60, duration: 10 }
  ])
  app.save(settings)
}, (app) => {
  app.delete(app.findCollectionByNameOrId('secrets'))
  app.delete(app.findCollectionByNameOrId('files'))
  const images = app.findCollectionByNameOrId('images')
  images.fields.removeByName('size')
  app.save(images)
  const users = app.findCollectionByNameOrId('users')
  users.fields.removeByName('plan')
  users.fields.removeByName('quota_bytes')
  app.save(users)
  const settings = app.settings()
  settings.rateLimits.rules = settings.rateLimits.rules.filter((rule) => !['files:create', '/api/dl/', 'POST /api/shared/file-link'].includes(rule.label))
  app.save(settings)
})
