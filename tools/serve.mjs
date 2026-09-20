import { createServer, request as httpRequest } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { extname, join, normalize, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL(`../${process.env.SERVE_DIR || 'pb_public'}/`, import.meta.url))
const port = Number(process.env.PORT) || 8090
const backend = { host: '127.0.0.1', port: Number(process.env.PB_PORT) || 8091 }

const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webmanifest': 'application/manifest+json'
}

const securityHeaders = {
  'Content-Security-Policy': "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' blob: data:; media-src 'self' blob:; connect-src 'self'; manifest-src 'self'; worker-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'; object-src 'none'; require-trusted-types-for 'script'; trusted-types sanitizer-input",
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

function proxyToBackend(request, response) {
  const upstream = httpRequest({ ...backend, path: request.url, method: request.method, headers: { ...request.headers, host: `${backend.host}:${backend.port}` } }, (result) => {
    response.writeHead(result.statusCode, result.headers)
    result.pipe(response)
  })
  upstream.on('error', () => {
    response.writeHead(502, securityHeaders).end('backend unavailable')
  })
  request.pipe(upstream)
}

createServer((request, response) => {
  if (request.url.startsWith('/api/') || request.url.startsWith('/_/')) {
    proxyToBackend(request, response)
    return
  }
  respond(request, response).catch(() => {
    response.writeHead(500, securityHeaders).end('server error')
  })
}).listen(port, () => {
  console.log(`serving ${root.split(sep).slice(-1)[0]} at http://localhost:${port}, proxying /api and /_ to ${backend.host}:${backend.port}`)
})
