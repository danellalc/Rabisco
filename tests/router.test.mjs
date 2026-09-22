import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createContext, runInContext } from 'node:vm'
import { parsePath, pathFor } from '../pb_public/js/router.js'

const id = 'abc123abc123abc'

test('pathFor builds the root, folder and doc paths', () => {
  assert.equal(pathFor('root'), '/')
  assert.equal(pathFor('folder', ''), '/')
  assert.equal(pathFor('folder', id), `/f/${id}`)
  assert.equal(pathFor('doc', id), `/d/${id}`)
  assert.equal(pathFor('other', id), '/')
})

test('parsePath reads the root, folder and doc paths', () => {
  assert.deepEqual(parsePath('/'), { kind: 'root', id: '' })
  assert.deepEqual(parsePath('/index.html'), { kind: 'root', id: '' })
  assert.deepEqual(parsePath(`/f/${id}`), { kind: 'folder', id })
  assert.deepEqual(parsePath(`/f/${id}/`), { kind: 'folder', id })
  assert.deepEqual(parsePath(`/d/${id}`), { kind: 'doc', id })
})

test('parsePath returns null for unknown paths and bad ids', () => {
  for (const path of ['/s/', '/s/token', '/f', '/f/', '/f/short', `/f/${id}x`, `/f/${id.toUpperCase()}`, '/d/abc-123-abc-12', `/x/${id}`, `/f/${id}/more`, `//f/${id}`, '']) {
    assert.equal(parsePath(path), null, path)
  }
})

test('pathFor and parsePath round trip', () => {
  for (const kind of ['folder', 'doc']) assert.deepEqual(parsePath(pathFor(kind, id)), { kind, id })
  assert.deepEqual(parsePath(pathFor('root')), { kind: 'root', id: '' })
})

test('the service worker answers folder, doc and share navigations with the cached shell', async () => {
  const source = await readFile(new URL('../pb_public/sw.js', import.meta.url), 'utf8')
  const context = createContext({ self: { addEventListener() {}, location: { origin: 'http://localhost' } } })
  runInContext(source, context)
  const shellFor = runInContext('shellFor', context)
  for (const path of ['/', '/index.html', '/s', '/s/', `/f/${id}`, `/d/${id}`, '/f/', '/d']) assert.equal(shellFor(path), '/', path)
  for (const path of ['/style.css', '/js/main.js', '/api/drive/root', '/fx', '/docs', '/share-target']) assert.equal(shellFor(path), '', path)
})
