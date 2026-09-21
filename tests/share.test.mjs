import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { expiryDate, shareTarget, shareUrl, tokenFromHash } from '../pb_public/js/share.js'

const require = createRequire(import.meta.url)
const { filterContent, isExpired, isScoped, parseBoard, parseIds, shareMode, sharedItemIds } = require('../pb_hooks/share.js')

const record = (expires) => ({ getString: () => expires })
const content = JSON.stringify([
  { id: 'txt00001', type: 'text', x: 0, y: 0, z: 1, w: 640, html: 'a' },
  { id: 'fil00001', type: 'file', x: 0, y: 0, z: 2, file: 'f1', name: 'r.pdf', size: 1, kind: 'pdf' },
  { id: 'img00001', type: 'image', x: 0, y: 0, z: 3, w: 100, src: '/api/files/images/a/b.webp' }
])
const items = parseBoard(content)

test('expiry is detected on the server', () => {
  assert.equal(isExpired(record('')), false)
  assert.equal(isExpired(record('2020-01-01 00:00:00.000Z')), true)
  assert.equal(isExpired(record('2999-01-01 00:00:00.000Z')), false)
})

test('shared item ids are validated against the board and deduplicated', () => {
  assert.deepEqual(parseIds('["txt00001", 3, "bad id", "fil00001"]'), ['txt00001', 'fil00001'])
  assert.deepEqual(parseIds('{nope'), [])
  assert.deepEqual(sharedItemIds(items, '["fil00001","ghost001","fil00001"]'), ['fil00001'])
  assert.deepEqual(sharedItemIds(items, '[]'), [])
  assert.deepEqual(sharedItemIds(items, ''), [])
  assert.deepEqual(parseBoard('{broken'), [])
})

test('a scoped share whose items vanished never widens to the whole board', () => {
  assert.equal(isScoped('["ghost001"]'), true)
  assert.equal(isScoped('[]'), false)
  assert.equal(isScoped(''), false)
  assert.deepEqual(sharedItemIds(items, '["ghost001"]'), [])
})

test('a selection or file share is always view only, a board share can edit', () => {
  assert.equal(shareMode('edit', false), 'edit')
  assert.equal(shareMode('view', false), 'view')
  assert.equal(shareMode('anything', false), 'view')
  assert.equal(shareMode('edit', true), 'view')
})

test('the visitor only receives the shared items', () => {
  assert.equal(filterContent(content, items, []), content)
  assert.deepEqual(JSON.parse(filterContent(content, items, ['fil00001', 'img00001'])).map((item) => item.id), ['fil00001', 'img00001'])
})

test('expiry choices become dates from now', () => {
  const now = new Date('2026-09-20T12:00:00.000Z').getTime()
  assert.equal(expiryDate('never', now), '')
  assert.equal(expiryDate('1h', now), '2026-09-20T13:00:00.000Z')
  assert.equal(expiryDate('1d', now), '2026-09-21T12:00:00.000Z')
  assert.equal(expiryDate('7d', now), '2026-09-27T12:00:00.000Z')
})

test('share links carry the token in the fragment only', () => {
  const token = 'abcDEF123abcDEF123abcD'
  assert.equal(shareUrl('https://notes.example.com', token), `https://notes.example.com/s/#${token}`)
  assert.equal(tokenFromHash(`#${token}`), token)
  assert.equal(tokenFromHash('#short'), '')
  assert.equal(tokenFromHash(''), '')
  assert.equal(tokenFromHash('#<script>alert(1)</script>xx'), '')
})

test('the share target is the board, a selection or a single file', () => {
  const items = JSON.parse(content)
  assert.deepEqual(shareTarget([], items), { kind: 'board', ids: [] })
  assert.deepEqual(shareTarget(['fil00001'], items), { kind: 'file', ids: [], file: 'f1', name: 'r.pdf' })
  assert.deepEqual(shareTarget(['txt00001', 'fil00001'], items), { kind: 'selection', ids: ['txt00001', 'fil00001'] })
  assert.deepEqual(shareTarget(['ghost'], items), { kind: 'board', ids: [] })
})
