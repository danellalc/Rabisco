migrate((app) => {
  const files = app.findCollectionByNameOrId('files')
  files.fields.add(new DateField({ name: 'orphaned' }))
  files.indexes = files.indexes.concat(['CREATE INDEX idx_files_orphaned ON files (orphaned)'])
  app.save(files)

  const images = app.findCollectionByNameOrId('images')
  images.fields.add(new DateField({ name: 'orphaned' }))
  images.indexes = images.indexes.concat(['CREATE INDEX idx_images_orphaned ON images (orphaned)'])
  app.save(images)
}, (app) => {
  const files = app.findCollectionByNameOrId('files')
  files.fields.removeByName('orphaned')
  files.indexes = files.indexes.filter((index) => index.indexOf('idx_files_orphaned') < 0)
  app.save(files)

  const images = app.findCollectionByNameOrId('images')
  images.fields.removeByName('orphaned')
  images.indexes = images.indexes.filter((index) => index.indexOf('idx_images_orphaned') < 0)
  app.save(images)
})
