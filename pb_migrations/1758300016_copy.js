migrate((app) => {
  const settings = app.settings()
  settings.rateLimits.rules = settings.rateLimits.rules.concat([{ label: 'POST /api/folders/', maxRequests: 10, duration: 60 }])
  app.save(settings)
}, (app) => {
  const settings = app.settings()
  settings.rateLimits.rules = settings.rateLimits.rules.filter((rule) => rule.label !== 'POST /api/folders/')
  app.save(settings)
})
