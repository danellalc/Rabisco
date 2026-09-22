import { test } from 'node:test'
import assert from 'node:assert/strict'
import { KINDS, buildIndex, filterRows, matchingCommands, searchIndex, snippetOf } from '../pb_public/js/search.js'

const translate = (key) => ({ untitled: 'Untitled', myDrive: 'My Drive' })[key]
const index = {
  boards: [
    { id: 'b1', name: 'Projetos', title: '', parent: '', updated: '2026-09-20 10:00:00.000Z', text: 'orçamento fechado' },
    { id: 'b2', name: '', title: 'Compras', parent: 'b1', updated: '2026-09-19 10:00:00.000Z', text: 'leite e pão' }
  ],
  docs: [{ id: 'd1', name: 'Ata', board: 'b2', updated: '2026-09-20 11:00:00.000Z', text: 'reunião de planejamento' }],
  files: [{ id: 'f1', name: 'Relatório-Orçamento.pdf', board: 'b1', kind: 'pdf', size: 10 }]
}

test('the index has one row per folder, document and file, searchable without accents', () => {
  const rows = buildIndex(index, translate)
  assert.deepEqual(rows.map((row) => `${row.kind}:${row.label}`), ['folder:Projetos', 'folder:Compras', 'doc:Ata', 'file:Relatório-Orçamento.pdf'])
  assert.deepEqual(rows.map((row) => row.meta), ['My Drive', 'Projetos', 'Compras', 'Projetos'])
  assert.deepEqual(searchIndex(rows, 'ORCAMENTO').map((row) => row.kind), ['file', 'folder'])
  assert.deepEqual(searchIndex(rows, 'relatorio pdf').map((row) => row.id), ['f1'])
  assert.deepEqual(searchIndex(rows, 'planejamento').map((row) => row.id), ['d1'])
  assert.deepEqual(searchIndex(rows, '').map((row) => row.id), ['b1', 'b2'])
  assert.deepEqual(searchIndex(rows, 'nothing here'), [])
})

test('each row carries the text that made it match', () => {
  const rows = buildIndex(index, translate)
  assert.deepEqual(rows.map((row) => row.text), ['orçamento fechado', 'leite e pão', 'reunião de planejamento', ''])
})

test('the type filter keeps one kind of row and all of them on all', () => {
  const rows = buildIndex(index, translate)
  assert.deepEqual(KINDS, ['all', 'folder', 'doc', 'file'])
  assert.deepEqual(filterRows(rows, 'all').length, 4)
  assert.deepEqual(filterRows(rows, '').length, 4)
  assert.deepEqual(filterRows(rows, 'folder').map((row) => row.id), ['b1', 'b2'])
  assert.deepEqual(filterRows(rows, 'doc').map((row) => row.id), ['d1'])
  assert.deepEqual(filterRows(rows, 'file').map((row) => row.id), ['f1'])
  assert.deepEqual(searchIndex(filterRows(rows, 'folder'), 'ORCAMENTO').map((row) => row.id), ['b1'])
})

test('the snippet shows the matched words in their context, accents and case ignored', () => {
  assert.equal(snippetOf('orçamento fechado', 'ORCAMENTO'), 'orçamento fechado')
  assert.equal(snippetOf('leite e pão', 'pao'), 'leite e pão')
  assert.equal(snippetOf('leite e pão', 'nada'), '')
  assert.equal(snippetOf('', 'leite'), '')
  assert.equal(snippetOf('leite e pão', '  '), '')
  const long = `${'a'.repeat(120)} planejamento ${'b'.repeat(120)}`
  const snippet = snippetOf(long, 'planejamento')
  assert.ok(snippet.length <= 62, snippet)
  assert.ok(snippet.includes('planejamento'))
  assert.ok(snippet.startsWith('…') && snippet.endsWith('…'), snippet)
  assert.ok(snippetOf('planejamento da reunião', 'planejamento').startsWith('planejamento'))
})

test('commands are listed on an empty query and filtered by the words typed', () => {
  const commands = [{ label: 'New folder', run: () => {} }, { label: 'Upload files', run: () => {} }]
  assert.equal(matchingCommands(commands, '').length, 2)
  assert.deepEqual(matchingCommands(commands, 'upl').map((command) => command.label), ['Upload files'])
})
