import { test } from 'node:test'
import assert from 'node:assert/strict'
import { stepEntry } from '../pb_public/js/preview.js'

const files = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]

test('quick look steps to the neighbour file and stops at the ends', () => {
  assert.equal(stepEntry(files, 'a', 1), files[1])
  assert.equal(stepEntry(files, 'c', -1), files[1])
  assert.equal(stepEntry(files, 'c', 1), null)
  assert.equal(stepEntry(files, 'a', -1), null)
})

test('quick look has nowhere to go when the file left the list', () => {
  assert.equal(stepEntry(files, 'zz', 1), null)
  assert.equal(stepEntry([], 'a', 1), null)
})
