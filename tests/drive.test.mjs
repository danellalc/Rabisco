import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { cleanLabel, plainText, boardText, ROOT } = require('../pb_hooks/drive.js')

test('labels lose control characters, extra spaces and length', () => {
  assert.equal(cleanLabel('  Projeto\u0000  X \n'), 'Projeto X')
  assert.equal(cleanLabel(''), '')
  assert.equal(cleanLabel(null), '')
  assert.equal(cleanLabel('a'.repeat(300)).length, 200)
  assert.equal(ROOT, '')
})

test('plain text strips tags and decodes the basic entities', () => {
  assert.equal(plainText('<h1>Hi &amp; bye</h1><p>two&nbsp;words</p>'), 'Hi & bye two words')
  assert.equal(plainText('<b>' + 'x'.repeat(30000) + '</b>', 100).length, 100)
})

test('board text joins text blocks, link urls and names of referenced things', () => {
  const content = JSON.stringify([
    { id: 'a', type: 'text', html: '<div>hello <b>world</b></div>' },
    { id: 'b', type: 'link', url: 'https://x.test' },
    { id: 'c', type: 'file', file: 'f', name: 'report.pdf' },
    { id: 'd', type: 'folder', folder: 'g', name: 'Projects' }
  ])
  assert.equal(boardText(content), 'hello world https://x.test report.pdf Projects')
  assert.equal(boardText('{broken'), '')
})
