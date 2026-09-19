migrate((app) => {
  const settings = app.settings()
  settings.meta.appName = 'Rabisco'
  settings.rateLimits.enabled = true
  settings.rateLimits.rules = [
    { label: '*:auth', maxRequests: 6, duration: 60 },
    { label: 'users:requestOTP', maxRequests: 3, duration: 60 },
    { label: '*:create', maxRequests: 20, duration: 10 },
    { label: '/api/', maxRequests: 300, duration: 10 }
  ]
  settings.trustedProxy.headers = ['X-Forwarded-For']
  settings.trustedProxy.useLeftmostIP = false
  settings.backups.cron = '0 3 * * *'
  settings.backups.cronMaxKeep = 7
  settings.batch.enabled = false
  app.save(settings)
}, (app) => {
  const settings = app.settings()
  settings.rateLimits.enabled = false
  settings.rateLimits.rules = []
  settings.trustedProxy.headers = []
  settings.backups.cron = ''
  app.save(settings)
})
