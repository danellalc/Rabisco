import { test } from 'node:test'
import assert from 'node:assert/strict'
import { looksTabular, parseTable } from '../pb_public/js/table.js'

test('text with tabs is treated as a spreadsheet', () => {
  assert.equal(looksTabular('a\tb'), true)
  assert.equal(looksTabular('plain sentence'), false)
  assert.equal(looksTabular(''), false)
})

test('rows split on newlines and cells on tabs', () => {
  assert.deepEqual(parseTable('a\tb\nc\td'), [['a', 'b'], ['c', 'd']])
})

test('windows line endings and the trailing newline from excel are handled', () => {
  assert.deepEqual(parseTable('a\tb\r\nc\td\r\n'), [['a', 'b'], ['c', 'd']])
})

test('empty cells are kept so columns stay aligned', () => {
  assert.deepEqual(parseTable('a\t\tc\n\tb\t'), [['a', '', 'c'], ['', 'b', '']])
})
