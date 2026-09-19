import { test } from 'node:test'
import assert from 'node:assert/strict'
import { imageFiles, isImageType } from '../pb_public/js/paste.js'

const item = (kind, type, file) => ({ kind, type, getAsFile: () => file })
const png = { name: 'shot.png', type: 'image/png' }
const jpg = { name: 'photo.jpg', type: 'image/jpeg' }

test('recognizes image mime types only', () => {
  assert.equal(isImageType('image/png'), true)
  assert.equal(isImageType('image/webp'), true)
  assert.equal(isImageType('text/html'), false)
  assert.equal(isImageType(undefined), false)
})

test('image wins over html when both are on the clipboard', () => {
  const transfer = { items: [item('string', 'text/html'), item('file', 'image/png', png)], files: [png] }
  assert.deepEqual(imageFiles(transfer), [png])
})

test('several images keep their order', () => {
  const transfer = { items: [item('file', 'image/png', png), item('file', 'image/jpeg', jpg)], files: [png, jpg] }
  assert.deepEqual(imageFiles(transfer), [png, jpg])
})

test('falls back to files when items carry nothing usable', () => {
  const transfer = { items: [], files: [jpg, { name: 'notes.txt', type: 'text/plain' }] }
  assert.deepEqual(imageFiles(transfer), [jpg])
})

test('plain text paste yields no images', () => {
  const transfer = { items: [item('string', 'text/plain')], files: [] }
  assert.deepEqual(imageFiles(transfer), [])
})
