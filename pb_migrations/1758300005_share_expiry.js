migrate((app) => {
  const notes = app.findCollectionByNameOrId('notes')
  notes.fields.add(new DateField({ name: 'share_expires' }))
  app.save(notes)

  const settings = app.settings()
  settings.rateLimits.rules = settings.rateLimits.rules.concat([
    { label: 'GET /api/shared', maxRequests: 60, duration: 10 },
    { label: 'PATCH /api/shared', maxRequests: 30, duration: 10 }
  ])
  app.save(settings)
}, (app) => {
  const notes = app.findCollectionByNameOrId('notes')
  notes.fields.removeByName('share_expires')
  app.save(notes)

  const settings = app.settings()
  settings.rateLimits.rules = settings.rateLimits.rules.filter((rule) => !rule.label.endsWith('/api/shared'))
  app.save(settings)
})
