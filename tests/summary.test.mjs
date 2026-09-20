import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { titleOf, coverOf } = require('../pb_hooks/summary.js')

test('the title is the first text of the note without tags', () => {
  assert.equal(titleOf('<h1>Shopping</h1><div>milk</div>'), 'Shopping milk')
  assert.equal(titleOf('<div><b>a</b>&nbsp;&amp;&nbsp;<i>b</i></div>'), 'a & b')
  assert.equal(titleOf(''), '')
})

test('the title is cut at 120 characters', () => {
  assert.equal(titleOf('<div>' + 'x'.repeat(300) + '</div>').length, 120)
})

test('the cover is the first uploaded image', () => {
  assert.equal(coverOf('<div>text</div><div><img src="/api/files/images/abc/pic_1.webp" data-width="50"></div>'), '/api/files/images/abc/pic_1.webp')
  assert.equal(coverOf('<div>no image</div>'), '')
  assert.equal(coverOf('<img src="https://evil.test/x.png">'), '')
})
