migrate((app) => {
  const users = app.findCollectionByNameOrId('users')
  users.otp.emailTemplate.subject = '{APP_NAME}: {OTP}'
  users.otp.emailTemplate.body = '<p>Your code for {APP_NAME} is <strong style="font-size:24px">{OTP}</strong>.</p><p>Or open this link to sign in: <a href="{APP_URL}/?otp={OTP}&amp;id={OTP_ID}">{APP_URL}/?otp={OTP}&amp;id={OTP_ID}</a></p><p>It expires in 10 minutes. If you did not ask for it, ignore this email.</p>'
  app.save(users)
}, (app) => {
  const users = app.findCollectionByNameOrId('users')
  users.otp.emailTemplate.subject = 'OTP for {APP_NAME}'
  users.otp.emailTemplate.body = '<p>Hello,</p><p>Your one-time password is: <strong>{OTP}</strong></p><p>Thanks,<br/>{APP_NAME} team</p>'
  app.save(users)
})
