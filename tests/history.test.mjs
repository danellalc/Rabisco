import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isNewGroup, TYPING_GAP } from '../pb_public/js/history.js'

test('consecutive typing within the gap stays in one undo step', () => {
  assert.equal(isNewGroup({ type: 'insertText', at: 1000 }, 'insertText', 1500), false)
})

test('a pause longer than the gap starts a new undo step', () => {
  assert.equal(isNewGroup({ type: 'insertText', at: 1000 }, 'insertText', 1000 + TYPING_GAP + 1), true)
})

test('a different kind of edit always starts a new undo step', () => {
  assert.equal(isNewGroup({ type: 'insertText', at: 1000 }, 'deleteContentBackward', 1100), true)
  assert.equal(isNewGroup({ type: 'insertText', at: 1000 }, 'insertParagraph', 1100), true)
})
