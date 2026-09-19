import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { extname, join, normalize, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../pb_public/', import.meta.url))
const port = Number(process.env.PORT) || 8090

const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.webmanifest': 'application/manifest+json'
}

const securityHeaders = {
  'Content-Security-Policy': "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' blob: data:; connect-src 'self'; manifest-src 'self'; worker-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'; object-src 'none'; require-trusted-types-for 'script'",
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cache-Control': 'no-cache'
}

function decodePath(urlPath) {
  try {
    return decodeURIComponent(urlPath)
  } catch {
    return null
  }
}

async function resolveFile(urlPath) {
  const decoded = decodePath(urlPath)
  if (decoded === null) return null
  const candidate = join(root, normalize(decoded))
  if (!candidate.startsWith(root)) return null
  try {
    const info = await stat(candidate)
    return info.isDirectory() ? join(candidate, 'index.html') : candidate
  } catch {
    return join(root, 'index.html')
  }
}

async function respond(request, response) {
  const file = await resolveFile(new URL(request.url, 'http://localhost').pathname)
  if (!file) {
    response.writeHead(400, securityHeaders).end('bad request')
    return
  }
  try {
    const body = await readFile(file)
    response.writeHead(200, { ...securityHeaders, 'Content-Type': contentTypes[extname(file)] || 'application/octet-stream' })
    response.end(body)
  } catch {
    response.writeHead(404, securityHeaders).end('not found')
  }
}

createServer((request, response) => {
  respond(request, response).catch(() => {
    response.writeHead(500, securityHeaders).end('server error')
  })
}).listen(port, () => {
  console.log(`serving ${root.split(sep).slice(-1)[0]} at http://localhost:${port}`)
})
