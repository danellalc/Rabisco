import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { normalizeBoard, parseItems, readingOrder } = require('../pb_hooks/items.js')
const { sanitizeHtml, safeImageSource } = require('../pb_hooks/sanitize.js')
const { titleOf, coverOf } = require('../pb_hooks/summary.js')

globalThis.BadRequestError = class BadRequestError extends Error {}

const tools = { sanitizeHtml, safeImageSource, titleOf, coverOf }
const normalize = (items) => normalizeBoard(JSON.stringify(items), tools)

test('text items are sanitized and clamped, junk is dropped', () => {
  const board = normalize([
    { id: 'abcd', type: 'text', x: 10.4, y: -3.6, z: 1, w: 20, html: '<div onclick="x">hi</div><script>1</script>' },
    { id: 'bad id', type: 'text', x: 0, y: 0, z: 0, w: 300, html: 'x' },
    { id: 'efgh', type: 'rocket', x: 0, y: 0, z: 0 },
    { id: 'abcd', type: 'text', x: 0, y: 0, z: 0, w: 300, html: 'duplicate' },
    'nope'
  ])
  assert.deepEqual(JSON.parse(board.content), [{ id: 'abcd', type: 'text', x: 10, y: -4, z: 1, w: 160, html: '<div>hi</div>' }])
  assert.equal(board.title, 'hi')
})

test('image items need our own file url and keep their natural size', () => {
  const board = normalize([
    { id: 'img1', type: 'image', x: 0, y: 0, z: 2, w: 320, src: '/api/files/images/abc/pic.webp', width: 1600, height: 900 },
    { id: 'img2', type: 'image', x: 0, y: 0, z: 2, w: 320, src: 'https://evil.test/x.png' },
    { id: 'img3', type: 'image', x: 0, y: 0, z: 2, w: 320, src: 'blob:https://app/1' }
  ])
  assert.deepEqual(JSON.parse(board.content), [{ id: 'img1', type: 'image', x: 0, y: 0, z: 2, w: 320, src: '/api/files/images/abc/pic.webp', width: 1600, height: 900 }])
  assert.equal(board.cover, '/api/files/images/abc/pic.webp')
})

test('link items accept http and https only', () => {
  const board = normalize([
    { id: 'lnk1', type: 'link', x: 0, y: 0, z: 1, url: 'https://x.test/a?b=1' },
    { id: 'lnk2', type: 'link', x: 0, y: 0, z: 1, url: 'javascript:alert(1)' },
    { id: 'lnk3', type: 'link', x: 0, y: 0, z: 1, url: 'mailto:a@b.c' }
  ])
  assert.deepEqual(JSON.parse(board.content), [{ id: 'lnk1', type: 'link', x: 0, y: 0, z: 1, url: 'https://x.test/a?b=1' }])
})

test('title and cover follow the reading order, top to bottom then left to right', () => {
  const board = normalize([
    { id: 'low1', type: 'text', x: 0, y: 400, z: 1, w: 300, html: '<div>lower</div>' },
    { id: 'rgt1', type: 'text', x: 500, y: 0, z: 1, w: 300, html: '<div>right</div>' },
    { id: 'lft1', type: 'text', x: 0, y: 0, z: 1, w: 300, html: '<div><img src="/api/files/images/abc/inline.webp"></div>' },
    { id: 'pic1', type: 'image', x: 0, y: 200, z: 1, w: 300, src: '/api/files/images/abc/pic.webp' }
  ])
  assert.equal(board.title, 'right')
  assert.equal(board.cover, '/api/files/images/abc/inline.webp')
  assert.deepEqual(readingOrder(parseItems(board.content)).map((item) => item.id), ['lft1', 'rgt1', 'pic1', 'low1'])
})

test('broken content is rejected instead of wiping the board', () => {
  assert.throws(() => normalizeBoard('{not json', tools), globalThis.BadRequestError)
  assert.throws(() => normalizeBoard('{"a":1}', tools), globalThis.BadRequestError)
  assert.deepEqual(parseItems(''), [])
  assert.deepEqual(parseItems('[]'), [])
})
