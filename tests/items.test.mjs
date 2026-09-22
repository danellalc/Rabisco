import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { normalizeBoard, parseItems, readingOrder } = require('../pb_hooks/items.js')
const { sanitizeHtml, safeImageSource } = require('../pb_hooks/sanitize.js')
const { titleOf, coverOf } = require('../pb_hooks/summary.js')

globalThis.BadRequestError = class BadRequestError extends Error {}

const known = { file0001: { name: 'report.pdf', size: 2400000, kind: 'pdf' } }
const docs = { doc00001: { name: 'Meeting notes' } }
const folders = { fold0001: { name: 'Projects' } }
const { cleanLabel } = require('../pb_hooks/drive.js')
const tools = { sanitizeHtml, safeImageSource, titleOf, coverOf, cleanLabel, fileInfo: (id) => known[id] || null, docInfo: (id) => docs[id] || null, folderInfo: (id) => folders[id] || null }
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

test('an image keeps a free height when one is given, and a text block keeps a known color', () => {
  const board = normalize([
    { id: 'img1', type: 'image', x: 0, y: 0, z: 2, w: 320, h: 12, src: '/api/files/images/abc/pic.webp' },
    { id: 'img2', type: 'image', x: 0, y: 0, z: 2, w: 320, h: 'tall', src: '/api/files/images/abc/pic.webp' },
    { id: 'txt1', type: 'text', x: 0, y: 0, z: 1, w: 300, html: 'a', color: 'hl2' },
    { id: 'txt2', type: 'text', x: 0, y: 0, z: 1, w: 300, html: 'b', color: 'red' }
  ])
  const items = JSON.parse(board.content)
  assert.equal(items[0].h, 40)
  assert.equal(items[1].h, undefined)
  assert.equal(items[2].color, 'hl2')
  assert.equal(items[3].color, undefined)
})

test('a text block keeps the six colors, a size and an alignment from the enums, and drops junk and defaults', () => {
  const board = normalize([
    { id: 'txt1', type: 'text', x: 0, y: 0, z: 1, w: 300, html: 'a', color: 'hl6', size: 'large', align: 'center' },
    { id: 'txt2', type: 'text', x: 0, y: 0, z: 1, w: 300, html: 'b', color: 'hl7', size: 'huge', align: 'diagonal' },
    { id: 'txt3', type: 'text', x: 0, y: 0, z: 1, w: 300, html: 'c', size: 'normal', align: 'left' }
  ])
  const items = JSON.parse(board.content)
  assert.deepEqual(items[0], { id: 'txt1', type: 'text', x: 0, y: 0, z: 1, w: 300, html: 'a', color: 'hl6', size: 'large', align: 'center' })
  assert.deepEqual(items[1], { id: 'txt2', type: 'text', x: 0, y: 0, z: 1, w: 300, html: 'b' })
  assert.deepEqual(items[2], { id: 'txt3', type: 'text', x: 0, y: 0, z: 1, w: 300, html: 'c' })
})

test('frame items keep a clamped size and a clean short name', () => {
  const board = normalize([
    { id: 'frm1', type: 'frame', x: 10, y: 20, z: 0, w: 5, h: 99999, name: '  Sprint\u0000 1  ' },
    { id: 'frm2', type: 'frame', x: 0, y: 0, z: 0, w: 300, h: 'tall' },
    { id: 'frm3', type: 'frame', x: 0, y: 0, z: 0, w: 300, h: 200, name: 'x'.repeat(200) }
  ])
  const items = JSON.parse(board.content)
  assert.deepEqual(items[0], { id: 'frm1', type: 'frame', x: 10, y: 20, z: 0, w: 40, h: 20000, name: 'Sprint 1' })
  assert.equal(items.length, 2)
  assert.equal(items[1].name.length, 80)
})

test('document and folder items only survive when they belong to the user, and carry the stored name', () => {
  const board = normalize([
    { id: 'doc1', type: 'doc', x: 0, y: 0, z: 1, doc: 'doc00001', name: 'spoofed' },
    { id: 'doc2', type: 'doc', x: 0, y: 0, z: 1, doc: 'nope' },
    { id: 'fol1', type: 'folder', x: 0, y: 100, z: 1, folder: 'fold0001', name: 'spoofed' },
    { id: 'fol2', type: 'folder', x: 0, y: 100, z: 1, folder: 'nope' }
  ])
  assert.deepEqual(JSON.parse(board.content), [
    { id: 'doc1', type: 'doc', x: 0, y: 0, z: 1, doc: 'doc00001', name: 'Meeting notes' },
    { id: 'fol1', type: 'folder', x: 0, y: 100, z: 1, folder: 'fold0001', name: 'Projects' }
  ])
  assert.equal(board.title, 'Meeting notes')
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

test('file items only survive when the file belongs to the board, and carry the stored name, size and kind', () => {
  const board = normalize([
    { id: 'fil1', type: 'file', x: 0, y: 0, z: 1, file: 'file0001', name: 'spoofed.exe', size: 1, kind: 'code' },
    { id: 'fil2', type: 'file', x: 0, y: 0, z: 1, file: 'someone-elses' }
  ])
  assert.deepEqual(JSON.parse(board.content), [{ id: 'fil1', type: 'file', x: 0, y: 0, z: 1, file: 'file0001', name: 'report.pdf', size: 2400000, kind: 'pdf' }])
  assert.equal(board.title, 'report.pdf')
})

test('file helpers classify names and block executables', () => {
  const { cleanName, extensionOf, isBlocked, kindOf, imageIds } = require('../pb_hooks/files.js')
  assert.deepEqual(imageIds(JSON.stringify([
    { id: 'i1', type: 'image', src: '/api/files/images/aaaaaaaaaaaaaaa/x_1234567890.webp' },
    { id: 't1', type: 'text', html: '<div><img src="/api/files/images/bbbbbbbbbbbbbbb/y_1234567890.webp"><img src="/api/files/images/aaaaaaaaaaaaaaa/x_1234567890.webp"></div>' }
  ]) + '\n<img src="/api/files/images/ccccccccccccccc/z_1234567890.webp">'), ['aaaaaaaaaaaaaaa', 'bbbbbbbbbbbbbbb', 'ccccccccccccccc'])
  assert.deepEqual(imageIds(''), [])
  assert.equal(kindOf('Relatorio.PDF'), 'pdf')
  assert.equal(kindOf('foto.JPG'), 'image')
  assert.equal(kindOf('print.webp'), 'image')
  assert.equal(kindOf('site-v2.zip'), 'zip')
  assert.equal(kindOf('teaser.mp4'), 'video')
  assert.equal(kindOf('trilha.mp3'), 'audio')
  assert.equal(kindOf('planilha.xlsx'), 'sheet')
  assert.equal(kindOf('deck.pptx'), 'slides')
  assert.equal(kindOf('notes.docx'), 'doc')
  assert.equal(kindOf('main.go'), 'code')
  assert.equal(kindOf('mystery'), 'generic')
  assert.equal(extensionOf('a.b.TAR'), 'tar')
  assert.equal(isBlocked('setup.exe'), true)
  assert.equal(isBlocked('script.PS1'), true)
  assert.equal(isBlocked('archive.zip'), false)
  assert.equal(cleanName('C:\\Users\\x\\..\\evil\u0000.pdf'), 'evil.pdf')
  assert.equal(cleanName('payload.exe.'), 'payload.exe')
  assert.equal(isBlocked(cleanName('evil.bat. .')), true)
  assert.equal(cleanName(''), 'file')
  assert.equal(cleanName('x'.repeat(300)).length, 200)
})

test('ids that collide with object prototype names still count as items', () => {
  const board = normalize([{ id: 'constructor', type: 'text', x: 0, y: 0, z: 1, w: 300, html: 'kept' }, { id: '__proto__', type: 'text', x: 0, y: 0, z: 1, w: 300, html: 'also' }])
  assert.deepEqual(JSON.parse(board.content).map((item) => item.id), ['constructor', '__proto__'])
})

test('broken content is rejected instead of wiping the board', () => {
  assert.throws(() => normalizeBoard('{not json', tools), globalThis.BadRequestError)
  assert.throws(() => normalizeBoard('{"a":1}', tools), globalThis.BadRequestError)
  assert.throws(() => normalizeBoard('[' + 'x'.repeat(2000001) + ']', tools), globalThis.BadRequestError)
  assert.deepEqual(parseItems(''), [])
  assert.deepEqual(parseItems('[]'), [])
})
