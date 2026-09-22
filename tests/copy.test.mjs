import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
globalThis.__hooks = join(dirname(fileURLToPath(import.meta.url)), '..', 'pb_hooks')
const { rewriteImageUrls, rewriteItems } = require('../pb_hooks/copy.js')

const ids = { aaaaaaaaaaaaaaa: 'bbbbbbbbbbbbbbb', fil000000000001: 'fil000000000002', doc000000000001: 'doc000000000002', fld000000000001: 'fld000000000002' }
const pics = { fil000000000002: 'newkeynewkeynew1' }

test('inline image urls follow the copied records and unknown ones stay', () => {
  assert.equal(
    rewriteImageUrls('<p><img src="/api/files/images/aaaaaaaaaaaaaaa/pic.webp"><img src="/api/files/images/zzzzzzzzzzzzzzz/other.webp"></p>', ids),
    '<p><img src="/api/files/images/bbbbbbbbbbbbbbb/pic.webp"><img src="/api/files/images/zzzzzzzzzzzzzzz/other.webp"></p>'
  )
})

test('every reference of a copied board points at the new records', () => {
  const items = JSON.parse(rewriteItems(JSON.stringify([
    { id: 'it01', type: 'file', x: 0, y: 0, z: 1, file: 'fil000000000001' },
    { id: 'it02', type: 'doc', x: 0, y: 0, z: 2, doc: 'doc000000000001' },
    { id: 'it03', type: 'folder', x: 0, y: 0, z: 3, folder: 'fld000000000001' },
    { id: 'it04', type: 'image', x: 0, y: 0, z: 4, w: 200, src: '/api/pic/fil000000000001/oldkeyoldkeyold1', file: 'fil000000000001' },
    { id: 'it05', type: 'text', x: 0, y: 0, z: 5, w: 640, html: '<img src="/api/files/images/aaaaaaaaaaaaaaa/pic.webp">' }
  ]), ids, pics))
  assert.equal(items[0].file, 'fil000000000002')
  assert.equal(items[1].doc, 'doc000000000002')
  assert.equal(items[2].folder, 'fld000000000002')
  assert.equal(items[3].src, '/api/pic/fil000000000002/newkeynewkeynew1')
  assert.equal(items[3].file, 'fil000000000002')
  assert.equal(items[4].html, '<img src="/api/files/images/bbbbbbbbbbbbbbb/pic.webp">')
})

test('references outside the copied subtree keep pointing at the originals', () => {
  const items = JSON.parse(rewriteItems(JSON.stringify([
    { id: 'it01', type: 'folder', x: 0, y: 0, z: 1, folder: 'zzzzzzzzzzzzzzz' },
    { id: 'it02', type: 'image', x: 0, y: 0, z: 2, w: 200, src: '/api/pic/zzzzzzzzzzzzzzz/oldkeyoldkeyold1', file: 'zzzzzzzzzzzzzzz' }
  ]), ids, pics))
  assert.equal(items[0].folder, 'zzzzzzzzzzzzzzz')
  assert.equal(items[1].src, '/api/pic/zzzzzzzzzzzzzzz/oldkeyoldkeyold1')
})

test('broken content copies as an empty board', () => {
  assert.equal(rewriteItems('not json', ids, pics), '[]')
})
