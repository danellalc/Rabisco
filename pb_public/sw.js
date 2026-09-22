const VERSION = 'dev'
const CACHE = `trecos-${VERSION}`
const SHARE_CACHE = 'trecos-share'
const SHARE_PATH = '/share-target'
const MAX_SHARE_BYTES = 25 * 1024 * 1024
const ASSETS = [
  '/',
  '/style.css',
  '/manifest.json',
  '/icon.svg',
  '/js/api.js',
  '/js/auth.js',
  '/js/board.js',
  '/js/boards.js',
  '/js/camera.js',
  '/js/docx.js',
  '/js/document.js',
  '/js/dom.js',
  '/js/drive.js',
  '/js/duplicate.js',
  '/js/editor.js',
  '/js/export.js',
  '/js/file-card.js',
  '/js/format.js',
  '/js/history.js',
  '/js/i18n.js',
  '/js/images.js',
  '/js/items.js',
  '/js/lightbox.js',
  '/js/links.js',
  '/js/list.js',
  '/js/main.js',
  '/js/menu.js',
  '/js/move.js',
  '/js/panel.js',
  '/js/paste.js',
  '/js/picker.js',
  '/js/recent.js',
  '/js/resize.js',
  '/js/resources.js',
  '/js/router.js',
  '/js/sanitize.js',
  '/js/search.js',
  '/js/settings.js',
  '/js/share-target.js',
  '/js/share.js',
  '/js/shortcuts.js',
  '/js/slash.js',
  '/js/snap.js',
  '/js/store.js',
  '/js/table.js',
  '/js/toolbar.js',
  '/js/visitor.js',
  '/js/widths.js',
  '/js/zip.js'
]

const shellFor = (path) => (path === '/' || path === '/index.html' || /^\/[sfd](\/|$)/.test(path) ? '/' : '')
const isSharedImage = (file) => typeof file !== 'string' && file.type.startsWith('image/') && file.size > 0 && file.size <= MAX_SHARE_BYTES

async function receiveShare(request) {
  const data = await request.formData()
  await caches.delete(SHARE_CACHE)
  const cache = await caches.open(SHARE_CACHE)
  const text = ['title', 'text', 'url'].map((name) => data.get(name)).filter((value) => typeof value === 'string' && value !== '').join('\n')
  const files = data.getAll('images').filter(isSharedImage)
  if (text !== '') await cache.put(`${SHARE_PATH}/text`, new Response(text))
  await Promise.all(files.map((file, index) => cache.put(`${SHARE_PATH}/${index}`, new Response(file, { headers: { 'Content-Type': file.type } }))))
  return Response.redirect('/#share-target', 303)
}

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE)
    .then((cache) => cache.addAll(ASSETS.map((path) => new Request(path, { cache: 'reload' }))))
    .then(() => self.skipWaiting()))
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
