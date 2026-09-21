import { test } from 'node:test'
import assert from 'node:assert/strict'
import { keyShortcut, lineShortcut } from '../pb_public/js/shortcuts.js'
import { isUrl, lastWord, toHref } from '../pb_public/js/links.js'

test('line start triggers map to commands', () => {
  assert.equal(lineShortcut('#'), 'heading1')
  assert.equal(lineShortcut('##'), 'heading2')
  assert.equal(lineShortcut('-'), 'bulletList')
  assert.equal(lineShortcut('1.'), 'numberedList')
  assert.equal(lineShortcut('[]'), 'checklist')
  assert.equal(lineShortcut('>'), 'quote')
  assert.equal(lineShortcut('hello'), null)
  assert.equal(lineShortcut(''), null)
})

const key = (overrides) => ({ ctrlKey: false, metaKey: false, altKey: false, shiftKey: false, key: '', ...overrides })

test('keyboard shortcuts', () => {
  assert.equal(keyShortcut(key({ ctrlKey: true, key: 'b' })), 'bold')
  assert.equal(keyShortcut(key({ metaKey: true, key: 'I' })), 'italic')
  assert.equal(keyShortcut(key({ ctrlKey: true, key: 'u' })), 'underline')
  assert.equal(keyShortcut(key({ ctrlKey: true, shiftKey: true, key: 'X' })), 'strike')
  assert.equal(keyShortcut(key({ ctrlKey: true, key: ';' })), 'date')
  assert.equal(keyShortcut(key({ ctrlKey: true, key: 'e' })), 'code')
  assert.equal(keyShortcut(key({ ctrlKey: true, altKey: true, key: 'b' })), null)
  assert.equal(keyShortcut(key({ key: 'b' })), null)
})

test('urls are recognized and completed', () => {
  assert.equal(isUrl('https://example.com/a?b=1'), true)
  assert.equal(isUrl('www.example.com'), true)
  assert.equal(isUrl('example.com'), false)
  assert.equal(isUrl('http://a b'), false)
  assert.equal(toHref('www.example.com'), 'https://www.example.com')
  assert.equal(toHref('https://x.io'), 'https://x.io')
})

test('only http and https survive as link targets', () => {
  assert.equal(toHref('javascript:alert(1)'), null)
  assert.equal(toHref('data:text/html,hi'), null)
  assert.equal(toHref('not a url'), null)
})

test('the last word before the caret is what gets linked', () => {
  assert.equal(lastWord('veja isso https://x.io'), 'https://x.io')
  assert.equal(lastWord(''), '')
})
