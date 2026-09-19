import { test } from 'node:test'
import assert from 'node:assert/strict'
import { clampWidth, toPercent, MIN_WIDTH } from '../pb_public/js/resize.js'

test('width never goes below the minimum', () => {
  assert.equal(clampWidth(10, MIN_WIDTH, 600), MIN_WIDTH)
})

test('width never exceeds the column', () => {
  assert.equal(clampWidth(900, MIN_WIDTH, 600), 600)
})

test('width inside the range is kept', () => {
  assert.equal(clampWidth(300, MIN_WIDTH, 600), 300)
})

test('percent is relative to the column and rounded to one decimal', () => {
  assert.equal(toPercent(300, 600), 50)
  assert.equal(toPercent(200, 600), 33.3)
  assert.equal(toPercent(600, 600), 100)
})
