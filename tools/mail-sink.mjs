import { createServer } from 'node:net'

const port = Number(process.env.PORT) || 2525

function decodeQuotedPrintable(text) {
  return text.replace(/=\r?\n/g, '').replace(/=([0-9A-F]{2})/g, (match, hex) => String.fromCharCode(parseInt(hex, 16)))
}

function report(raw) {
  const decoded = decodeQuotedPrintable(raw)
  const subject = /^Subject: (.*)$/mi.exec(decoded)
  const to = /^To: (.*)$/mi.exec(decoded)
  const code = /\b(\d{6})\b/.exec(decoded.replace(/<[^>]+>/g, ' '))
  console.log('----- mail -----')
  console.log('to:      ' + (to ? to[1] : '?'))
  console.log('subject: ' + (subject ? subject[1] : '?'))
  if (code) console.log('code:    ' + code[1])
  const link = /https?:\/\/\S+otp=\d+&(?:amp;)?id=\w+/.exec(decoded)
  if (link) console.log('link:    ' + link[0].replace('&amp;', '&'))
  console.log('----------------')
}

createServer((socket) => {
  let buffer = ''
  let reading = false
  socket.write('220 mail-sink ready\r\n')
  socket.on('data', (chunk) => {
    buffer += chunk.toString('utf8')
    if (reading) {
      const end = buffer.indexOf('\r\n.\r\n')
      if (end < 0) return
      report(buffer.slice(0, end))
      buffer = buffer.slice(end + 5)
      reading = false
      socket.write('250 OK\r\n')
    }
    let newline = buffer.indexOf('\r\n')
    while (newline >= 0 && !reading) {
      const line = buffer.slice(0, newline)
      buffer = buffer.slice(newline + 2)
      const command = line.slice(0, 4).toUpperCase()
      if (command === 'EHLO' || command === 'HELO') socket.write('250-mail-sink\r\n250 OK\r\n')
      else if (command === 'DATA') {
        reading = true
        socket.write('354 go ahead\r\n')
      } else if (command === 'QUIT') {
        socket.write('221 bye\r\n')
        socket.end()
      } else socket.write('250 OK\r\n')
      newline = buffer.indexOf('\r\n')
    }
  })
  socket.on('error', () => {})
}).listen(port, '127.0.0.1', () => {
  console.log(`mail sink listening on 127.0.0.1:${port}, point PocketBase SMTP here with no auth and no TLS`)
})
