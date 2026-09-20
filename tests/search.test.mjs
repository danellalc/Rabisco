import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildIndex, searchIndex } from '../pb_public/js/search.js'

const textOf = (html) => html.replace(/<[^>]+>/g, '')
const boards = [
  { id: 'b1', title: 'Lançamento do site', updated: '2026-09-20 10:00:00.000Z' },
  { id: 'b2', title: 'Compras', updated: '2026-09-19 10:00:00.000Z' }
]
const contents = new Map([
  ['b1', JSON.stringify([{ id: 'txt1', type: 'text', x: 0, y: 0, html: '<b>orçamento</b> fechado' }, { id: 'fil1', type: 'file', x: 0, y: 100, file: 'f', name: 'Relatório-Orçamento.pdf', size: 1, kind: 'pdf' }])],
  ['b2', JSON.stringify([{ id: 'txt2', type: 'text', x: 0, y: 0, html: 'leite e pão' }])]
])

test('the index has one row per board and one per file, searchable without accents', () => {
  const index = buildIndex(boards, contents, textOf)
  assert.deepEqual(index.map((row) => `${row.kind}:${row.label}`), ['board:Lançamento do site', 'file:Relatório-Orçamento.pdf', 'board:Compras'])
  assert.deepEqual(searchIndex(index, 'ORCAMENTO').map((row) => row.kind), ['board', 'file'])
  assert.deepEqual(searchIndex(index, 'relatorio pdf').map((row) => row.kind + ':' + (row.itemId || row.boardId)), ['board:b1', 'file:fil1'])
  assert.deepEqual(searchIndex(index, 'pao').map((row) => row.boardId), ['b2'])
  assert.deepEqual(searchIndex(index, '').map((row) => row.kind), ['board', 'board'])
  assert.deepEqual(searchIndex(index, 'nothing here'), [])
})
