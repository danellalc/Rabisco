export const SHARE_CACHE = 'trecos-share'
export const SHARE_HASH = '#share-target'

const hasCaches = () => typeof caches !== 'undefined'

export async function readShareTarget() {
  if (!hasCaches()) return null
  const cache = await caches.open(SHARE_CACHE)
  const keys = await cache.keys()
  if (keys.length === 0) return null
  const shared = { text: '', files: [] }
  for (const key of keys) {
    const response = await cache.match(key)
    if (key.url.endsWith('/text')) shared.text = await response.text()
    else shared.files.push(await response.blob())
  }
  await caches.delete(SHARE_CACHE)
  return shared
}

export function clearShareTarget() {
  if (hasCaches()) return caches.delete(SHARE_CACHE)
  return Promise.resolve(false)
}
