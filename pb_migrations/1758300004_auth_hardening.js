migrate((app) => {
  const users = app.findCollectionByNameOrId('users')
  users.authToken.duration = 86400
  users.otp.emailTemplate.body = '<p>Your code for {APP_NAME} is <strong style="font-size:24px">{OTP}</strong>.</p><p>Or open this link to sign in: <a href="{APP_URL}/#otp={OTP}&amp;id={OTP_ID}">{APP_URL}/#otp={OTP}&amp;id={OTP_ID}</a></p><p>It expires in 10 minutes. If you did not ask for it, ignore this email.</p>'
  app.save(users)
}, (app) => {
  const users = app.findCollectionByNameOrId('users')
  users.authToken.duration = 604800
  users.otp.emailTemplate.body = '<p>Your code for {APP_NAME} is <strong style="font-size:24px">{OTP}</strong>.</p><p>Or open this link to sign in: <a href="{APP_URL}/?otp={OTP}&amp;id={OTP_ID}">{APP_URL}/?otp={OTP}&amp;id={OTP_ID}</a></p><p>It expires in 10 minutes. If you did not ask for it, ignore this email.</p>'
  app.save(users)
})
