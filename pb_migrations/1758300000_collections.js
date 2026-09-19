migrate((app) => {
  const users = app.findCollectionByNameOrId('users')
  users.listRule = 'id = @request.auth.id'
  users.viewRule = 'id = @request.auth.id'
  users.createRule = null
  users.updateRule = null
  users.deleteRule = null
  users.passwordAuth.enabled = false
  users.otp.enabled = true
  users.otp.length = 6
  users.otp.duration = 600
  users.authAlert.enabled = false
  users.authToken.duration = 604800
  app.save(users)

  const notes = new Collection({
    type: 'base',
    name: 'notes',
    listRule: 'user = @request.auth.id',
    viewRule: 'user = @request.auth.id',
    createRule: '@request.auth.id != "" && user = @request.auth.id',
    updateRule: 'user = @request.auth.id && @request.body.user:isset = false && @request.body.share_token:isset = false',
    deleteRule: 'user = @request.auth.id',
    fields: [
      { name: 'user', type: 'relation', collectionId: users.id, maxSelect: 1, cascadeDelete: true, required: true },
      { name: 'content', type: 'text', max: 200000 },
      { name: 'pinned', type: 'bool' },
      { name: 'share_mode', type: 'select', maxSelect: 1, values: ['off', 'view', 'edit'] },
      { name: 'share_token', type: 'text', max: 32 },
      { name: 'created', type: 'autodate', onCreate: true },
      { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true }
    ],
    indexes: [
      'CREATE INDEX idx_notes_user_updated ON notes (user, updated)',
      'CREATE UNIQUE INDEX idx_notes_share_token ON notes (share_token) WHERE share_token != \'\''
    ]
  })
  app.save(notes)

  const images = new Collection({
    type: 'base',
    name: 'images',
    listRule: 'user = @request.auth.id',
    viewRule: 'user = @request.auth.id',
    createRule: '@request.auth.id != "" && user = @request.auth.id && note.user = @request.auth.id',
    updateRule: null,
    deleteRule: 'user = @request.auth.id',
    fields: [
      { name: 'user', type: 'relation', collectionId: users.id, maxSelect: 1, cascadeDelete: true, required: true },
      { name: 'note', type: 'relation', collectionId: notes.id, maxSelect: 1, cascadeDelete: true, required: true },
      { name: 'file', type: 'file', maxSelect: 1, maxSize: 5242880, mimeTypes: ['image/webp', 'image/png', 'image/jpeg', 'image/gif'], thumbs: ['100x100'], protected: false, required: true },
      { name: 'created', type: 'autodate', onCreate: true }
    ],
    indexes: ['CREATE INDEX idx_images_note ON images (note)']
  })
  app.save(images)
}, (app) => {
  app.delete(app.findCollectionByNameOrId('images'))
  app.delete(app.findCollectionByNameOrId('notes'))
})
