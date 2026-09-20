import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readdir, readFile } from 'node:fs/promises'
import { Script } from 'node:vm'

const publicDir = new URL('../pb_public/', import.meta.url)
const workerSource = await readFile(new URL('sw.js', publicDir), 'utf8')

test('the service worker parses and precaches the shell plus every module', async () => {
  assert.doesNotThrow(() => new Script(workerSource))
  const match = /const ASSETS = (\[[^\]]*\])/.exec(workerSource)
  const assets = JSON.parse(match[1].replace(/'/g, '"').replace(/,\s*\]/, ']'))
  const modules = (await readdir(new URL('js/', publicDir))).filter((name) => name.endsWith('.js')).map((name) => `/js/${name}`)
  assert.deepEqual(assets.sort(), ['/', '/style.css', '/manifest.json', '/icon.svg', ...modules].sort())
  assert.match(workerSource, /const VERSION = 'dev'/)
})

test('the manifest is installable and declares the share target', async () => {
  const manifest = JSON.parse(await readFile(new URL('manifest.json', publicDir), 'utf8'))
  assert.equal(manifest.display, 'standalone')
  assert.equal(manifest.start_url, '/')
  const sizes = manifest.icons.map((icon) => icon.sizes)
  assert.ok(sizes.includes('192x192') && sizes.includes('512x512'))
  for (const icon of manifest.icons) await readFile(new URL(`.${icon.src}`, publicDir))
  assert.equal(manifest.share_target.action, '/share-target')
  assert.equal(manifest.share_target.method, 'POST')
  assert.equal(manifest.share_target.enctype, 'multipart/form-data')
  assert.deepEqual(manifest.share_target.params.files, [{ name: 'images', accept: ['image/*'] }])
})

test('the page links the manifest and the icons', async () => {
  const html = await readFile(new URL('index.html', publicDir), 'utf8')
  assert.match(html, /<link rel="manifest" href="\/manifest.json">/)
  assert.match(html, /<link rel="icon" href="\/icon.svg"/)
  assert.match(html, /<link rel="apple-touch-icon" href="\/icon-180.png">/)
  await readFile(new URL('icon-180.png', publicDir))
})
