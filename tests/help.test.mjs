import { test } from 'node:test'
import assert from 'node:assert/strict'
import { SHORTCUTS } from '../pb_public/js/help.js'
import { dictionaries } from '../pb_public/js/i18n.js'

test('every shortcut group and row has a label that exists in both dictionaries', () => {
  assert.equal(SHORTCUTS.length, 4)
  for (const [group, rows] of SHORTCUTS) {
    assert.ok(dictionaries.en[group] && dictionaries['pt-BR'][group], `${group} missing`)
    assert.ok(rows.length > 0)
    for (const [keys, label] of rows) {
      assert.ok(keys.length > 0)
      assert.ok(dictionaries.en[label] && dictionaries['pt-BR'][label], `${label} missing`)
    }
  }
})

test('the shortcut lists describe the real bindings', () => {
  const rowsOf = (index) => SHORTCUTS[index][1].map(([keys]) => keys)
  assert.deepEqual(rowsOf(0).slice(0, 5), ['V', 'H / Space', 'T', 'N', 'F'])
  assert.ok(rowsOf(0).includes('Ctrl Shift A') && rowsOf(0).includes('Ctrl D') && rowsOf(0).includes('Esc'))
  assert.deepEqual(rowsOf(1), ['Enter', 'F2', 'Del', 'Space', '↑ ↓'])
  assert.ok(rowsOf(2).includes('Ctrl E') && rowsOf(2).includes('/') && rowsOf(2).includes('``` Enter'))
  assert.deepEqual(rowsOf(3), ['Ctrl K', 'Ctrl Alt N', '?'])
})
