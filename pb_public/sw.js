const VERSION = 'dev'
const CACHE = `rabisco-${VERSION}`
const SHARE_CACHE = 'rabisco-share'
const SHARE_PATH = '/share-target'
const ASSETS = [
  '/',
  '/style.css',
  '/manifest.json',
  '/icon.svg',
  '/js/api.js',
  '/js/auth.js',
  '/js/dom.js',
  '/js/duplicate.js',
  '/js/editor.js',
  '/js/export.js',
  '/js/format.js',
  '/js/history.js',
  '/js/i18n.js',
  '/js/images.js',
  '/js/lightbox.js',
  '/js/links.js',
  '/js/list.js',
  '/js/main.js',
  '/js/menu.js',
  '/js/move.js',
  '/js/notes.js',
  '/js/paste.js',
  '/js/resize.js',
  '/js/sanitize.js',
  '/js/settings.js',
  '/js/share-target.js',
  '/js/share.js',
  '/js/shortcuts.js',
  '/js/store.js',
  '/js/table.js',
  '/js/toolbar.js',
  '/js/visitor.js',
  '/js/widths.js'
]

const shellFor = (path) => (path === '/' || path === '/index.html' || path === '/s' || path.startsWith('/s/') ? '/' : '')

async function receiveShare(request) {
  const data = await request.formData()
  const cache = await caches.open(SHARE_CACHE)
  const text = ['title', 'text', 'url'].map((name) => data.get(name)).filter((value) => typeof value === 'string' && value !== '').join('\n')
  const files = data.getAll('images').filter((file) => typeof file !== 'string' && file.size > 0)
  await cache.put(`${SHARE_PATH}/text`, new Response(text))
  await Promise.all(files.map((file, index) => cache.put(`${SHARE_PATH}/${index}`, new Response(file, { headers: { 'Content-Type': file.type } }))))
  return Response.redirect('/#share-target', 303)
}

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting()))
})

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((key) => key !== CACHE && key !== SHARE_CACHE).map((key) => caches.delete(key))))
    .then(() => self.clients.claim()))
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  const url = new URL(request.url)
  if (request.method === 'POST' && url.pathname === SHARE_PATH) {
    event.respondWith(receiveShare(request))
    return
  }
  if (VERSION === 'dev' || request.method !== 'GET' || url.origin !== self.location.origin) return
  const key = request.mode === 'navigate' ? shellFor(url.pathname) : ASSETS.includes(url.pathname) ? url.pathname : ''
  if (!key) return
  event.respondWith(caches.match(key).then((cached) => cached || fetch(request)))
})
