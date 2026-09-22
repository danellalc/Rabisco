migrate((app) => {
  const guard = ' && @request.body.trashed:isset = false'
  for (const name of ['boards', 'docs', 'files']) {
    const collection = app.findCollectionByNameOrId(name)
    collection.fields.add(new DateField({ name: 'trashed' }))
    collection.indexes = collection.indexes.concat([`CREATE INDEX idx_${name}_trashed ON ${name} (user, trashed)`])
    collection.updateRule = collection.updateRule + guard
    app.save(collection)
  }

  const settings = app.settings()
  settings.rateLimits.rules = settings.rateLimits.rules.concat([{ label: '/api/trash', maxRequests: 120, duration: 10 }])
  app.save(settings)
}, (app) => {
  const guard = ' && @request.body.trashed:isset = false'
  const settings = app.settings()
  settings.rateLimits.rules = settings.rateLimits.rules.filter((rule) => rule.label !== '/api/trash')
  app.save(settings)

  for (const name of ['boards', 'docs', 'files']) {
    const collection = app.findCollectionByNameOrId(name)
    collection.fields.removeByName('trashed')
    collection.indexes = collection.indexes.filter((index) => index.indexOf(`idx_${name}_trashed`) < 0)
    collection.updateRule = collection.updateRule.split(guard).join('')
    app.save(collection)
  }
})
