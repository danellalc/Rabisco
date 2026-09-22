import { test } from 'node:test'
import assert from 'node:assert/strict'
import { itemText, matchesIn } from '../pb_public/js/find.js'

const elements = {
  a: { querySelector: () => ({ textContent: 'Orçamento do trimestre' }) },
  b: { querySelector: () => ({ textContent: 'notas soltas' }) },
  c: { querySelector: () => ({ textContent: 'relatorio.pdf' }) }
}
const items = [
  { id: 'b', type: 'text', x: 0, y: 100 },
  { id: 'a', type: 'text', x: 0, y: 0 },
  { id: 'c', type: 'file', name: 'relatorio.pdf', x: 200, y: 0 },
  { id: 'f', type: 'frame', name: 'Budget', x: 0, y: 300 },
  { id: 'l', type: 'link', url: 'https://example.com/orcamento', x: 0, y: 400 }
]
const textOf = (item) => itemText(item, elements[item.id] || null)

test('matches ignore case and accents and come in reading order', () => {
  assert.deepEqual(matchesIn(items, 'ORCAMENTO', textOf), ['a', 'l'])
  assert.deepEqual(matchesIn(items, 'budget', textOf), ['f'])
  assert.deepEqual(matchesIn(items, 'Relatório', textOf), ['c'])
  assert.deepEqual(matchesIn(items, 'notas', textOf), ['b'])
  assert.deepEqual(matchesIn(items, '   ', textOf), [])
  assert.deepEqual(matchesIn(items, 'nothing', textOf), [])
})

test('the text of an item comes from its element, its name or its url', () => {
  assert.equal(itemText({ type: 'frame', name: 'Budget' }, null), 'Budget')
  assert.equal(itemText({ type: 'frame' }, null), '')
  assert.equal(itemText({ type: 'link', url: 'https://a.b' }, null), 'https://a.b')
  assert.equal(itemText({ type: 'file', name: 'x.pdf' }, null), 'x.pdf')
  assert.equal(itemText({ type: 'text' }, { querySelector: () => null }), '')
  assert.equal(itemText({ type: 'text' }, { querySelector: () => ({ textContent: 'live text' }) }), 'live text')
})
