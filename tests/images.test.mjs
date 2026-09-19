import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fitWithin, MAX_EDGE } from '../pb_public/js/images.js'

test('keeps small images at their real size', () => {
  assert.deepEqual(fitWithin(800, 600, MAX_EDGE), { width: 800, height: 600 })
})

test('scales the longest edge down to the limit and keeps the ratio', () => {
  assert.deepEqual(fitWithin(3200, 1800, MAX_EDGE), { width: 1600, height: 900 })
  assert.deepEqual(fitWithin(1000, 4000, MAX_EDGE), { width: 400, height: 1600 })
})

test('an image exactly at the limit is untouched', () => {
  assert.deepEqual(fitWithin(1600, 1600, MAX_EDGE), { width: 1600, height: 1600 })
})
