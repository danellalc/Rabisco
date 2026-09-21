migrate((app) => {
  const files = app.findCollectionByNameOrId('files')
  const shares = app.findCollectionByNameOrId('shares')
  shares.fields.add(new RelationField({ name: 'file', collectionId: files.id, maxSelect: 1, cascadeDelete: true }))
  shares.indexes = shares.indexes.concat(['CREATE INDEX idx_shares_file ON shares (file)'])
  app.save(shares)
}, (app) => {
  const shares = app.findCollectionByNameOrId('shares')
  shares.fields.removeByName('file')
  shares.indexes = shares.indexes.filter((index) => index.indexOf('idx_shares_file') < 0)
  app.save(shares)
})
