migrate((app) => {
  const files = app.findCollectionByNameOrId('files')
  files.fields.add(new TextField({ name: 'pic', max: 32 }))
  files.updateRule = files.updateRule + ' && @request.body.pic:isset = false'
  app.save(files)

  const settings = app.settings()
  settings.rateLimits.rules = settings.rateLimits.rules.concat([{ label: '/api/pic/', maxRequests: 300, duration: 10 }])
  app.save(settings)
}, (app) => {
  const settings = app.settings()
  settings.rateLimits.rules = settings.rateLimits.rules.filter((rule) => rule.label !== '/api/pic/')
  app.save(settings)

  const files = app.findCollectionByNameOrId('files')
  files.fields.removeByName('pic')
  files.updateRule = files.updateRule.split(' && @request.body.pic:isset = false').join('')
  app.save(files)
})
