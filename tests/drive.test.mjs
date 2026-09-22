import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { cleanLabel, plainText, boardText, ROOT } = require('../pb_hooks/drive.js')

test('labels lose control characters, extra spaces and length', () => {
  assert.equal(cleanLabel('  Projeto\u0000  X \n'), 'Projeto X')
  assert.equal(cleanLabel(''), '')
  assert.equal(cleanLabel(null), '')
  assert.equal(cleanLabel('a'.repeat(300)).length, 200)
  assert.equal(ROOT, '')
})

test('plain text strips tags and decodes the basic entities', () => {
  assert.equal(plainText('<h1>Hi &amp; bye</h1><p>two&nbsp;words</p>'), 'Hi & bye two words')
  assert.equal(plainText('<b>' + 'x'.repeat(30000) + '</b>', 100).length, 100)
})

test('board text joins text blocks, link urls and names of referenced things', () => {
  const content = JSON.stringify([
    { id: 'a', type: 'text', html: '<div>hello <b>world</b></div>' },
    { id: 'b', type: 'link', url: 'https://x.test' },
    { id: 'c', type: 'file', file: 'f', name: 'report.pdf' },
    { id: 'd', type: 'folder', folder: 'g', name: 'Projects' }
  ])
  assert.equal(boardText(content), 'hello world https://x.test report.pdf Projects')
  assert.equal(boardText('{broken'), '')
})

test('the explorer head sums what a folder holds and says empty otherwise', async () => {
  const { folderMeta, rangeBetween, parseResources, resourceText } = await import('../pb_public/js/drive.js')
  const { countOf, createTranslator } = await import('../pb_public/js/i18n.js')
  const translate = createTranslator('en')
  const bytes = (n) => `${n} B`
  assert.equal(folderMeta([], translate, bytes), 'empty')
  assert.equal(folderMeta([{ kind: 'folder' }, { kind: 'folder' }, { kind: 'doc' }, { kind: 'file', size: 30 }, { kind: 'file', size: 12 }], translate, bytes), '2 folders · 1 document · 2 files · 42 B')
  assert.equal(countOf(createTranslator('pt-BR'), 'items', 1), '1 item')
  assert.equal(countOf(createTranslator('pt-BR'), 'items', 4), '4 itens')
  assert.deepEqual(rangeBetween(['a', 'b', 'c', 'd'], 'c', 'a'), ['a', 'b', 'c'])
  assert.deepEqual(rangeBetween(['a', 'b'], 'zz', 'b'), ['b'])
  const parsed = parseResources(resourceText([{ kind: 'file', id: 'f1', name: 'x.pdf' }, { kind: 'doc', id: 'd1', name: 'Doc' }], 'folder1'))
  assert.deepEqual(parsed, { folder: 'folder1', entries: [{ kind: 'file', id: 'f1', name: 'x.pdf' }, { kind: 'doc', id: 'd1', name: 'Doc' }] })
  assert.equal(parseResources('plain text'), null)
})

test('drive entries keep the creation date of every kind', async () => {
  const { entriesOf } = await import('../pb_public/js/resources.js')
  const entries = entriesOf({
    folders: [{ id: 'f', name: 'Work', created: '2026-09-01 10:00:00.000Z', updated: '2026-09-02 10:00:00.000Z' }],
    docs: [{ id: 'd', name: 'Notes', created: '2026-09-03 10:00:00.000Z', updated: '2026-09-04 10:00:00.000Z' }],
    files: [{ id: 'x', name: 'a.pdf', size: 3, kind: 'pdf', created: '2026-09-05 10:00:00.000Z', updated: '2026-09-05 10:00:00.000Z' }]
  })
  assert.deepEqual(entries.map((entry) => [entry.kind, entry.created]), [['folder', '2026-09-01 10:00:00.000Z'], ['doc', '2026-09-03 10:00:00.000Z'], ['file', '2026-09-05 10:00:00.000Z']])
})

test('the trash helpers walk up the folder chain', () => {
  const { isInTrash, KEEP_DAYS } = require('../pb_hooks/trash.js')
  const boards = { a: { parent: '', trashed: '' }, b: { parent: 'a', trashed: '' }, c: { parent: 'b', trashed: '2026-09-21 00:00:00.000Z' }, d: { parent: 'c', trashed: '' } }
  const app = { findRecordById: (table, id) => {
    if (!boards[id]) throw new Error('missing')
    return { id, getString: (field) => boards[id][field] }
  } }
  assert.equal(isInTrash(app, 'a'), false)
  assert.equal(isInTrash(app, 'b'), false)
  assert.equal(isInTrash(app, 'c'), true)
  assert.equal(isInTrash(app, 'd'), true)
  assert.equal(isInTrash(app, 'missing'), true)
  assert.equal(isInTrash(app, ''), false)
  assert.equal(KEEP_DAYS, 30)
})
