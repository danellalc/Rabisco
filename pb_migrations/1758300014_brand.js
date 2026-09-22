migrate((app) => {
  const settings = app.settings()
  settings.meta.appName = 'Trecos'
  app.save(settings)
  const users = app.findCollectionByNameOrId('users')
  users.otp.emailTemplate.subject = 'Trecos: {OTP}'
  users.otp.emailTemplate.body = '<p>Seu código pra entrar no Trecos / Your code to sign in to Trecos:</p><p><strong style="font-size:28px;letter-spacing:.1em">{OTP}</strong></p><p>Ou abra este link / Or open this link: <a href="{APP_URL}/#otp={OTP}&amp;id={OTP_ID}">{APP_URL}/#otp={OTP}&amp;id={OTP_ID}</a></p><p>Vale por 10 minutos. Se não foi você, ignore este e-mail.<br>It expires in 10 minutes. If it was not you, ignore this email.</p>'
  app.save(users)
}, (app) => {
  const settings = app.settings()
  settings.meta.appName = 'Rabisco'
  app.save(settings)
  const users = app.findCollectionByNameOrId('users')
  users.otp.emailTemplate.subject = '{APP_NAME}: {OTP}'
  users.otp.emailTemplate.body = '<p>Your code for {APP_NAME} is <strong style="font-size:24px">{OTP}</strong>.</p><p>Or open this link to sign in: <a href="{APP_URL}/#otp={OTP}&amp;id={OTP_ID}">{APP_URL}/#otp={OTP}&amp;id={OTP_ID}</a></p><p>It expires in 10 minutes. If you did not ask for it, ignore this email.</p>'
  app.save(users)
})
