import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { firstBoardContent } from '../pb_public/js/examples.js'
import { createTranslator } from '../pb_public/js/i18n.js'
import { ALLOWED_TAGS } from '../pb_public/js/sanitize.js'

const require = createRequire(import.meta.url)
const { normalizeBoard } = require('../pb_hooks/items.js')
const { sanitizeHtml, safeImageSource } = require('../pb_hooks/sanitize.js')
const { titleOf, coverOf } = require('../pb_hooks/summary.js')
const { cleanLabel } = require('../pb_hooks/drive.js')

globalThis.BadRequestError = class BadRequestError extends Error {}

const tools = { sanitizeHtml, safeImageSource, titleOf, coverOf, cleanLabel, fileInfo: () => null, docInfo: () => null, folderInfo: () => null }
const itemsIn = (language) => JSON.parse(firstBoardContent(createTranslator(language)))
const tagsOf = (html) => [...html.matchAll(/<([a-z0-9]+)/g)].map((match) => match[1])

test('the example board has a heading, two notes, a frame and a checklist', () => {
  const items = itemsIn('en')
  assert.equal(items.length, 5)
  for (const item of items) {
    assert.match(item.id, /^[A-Za-z0-9_-]{8}$/)
    for (const key of ['x', 'y', 'z', 'w']) assert.equal(typeof item[key], 'number')
    assert.ok(item.x >= 40 && item.x <= 900 && item.y >= 40 && item.y <= 520)
  }
  const texts = items.filter((item) => item.type === 'text')
  assert.match(texts[0].html, /^<h1>Welcome to Trecos<\/h1><div>Every folder is a board: .*<\/div><div>Drop a file here, .*<\/div>$/)
  assert.deepEqual(texts.map((item) => item.color || ''), ['', 'hl1', 'hl2', ''])
  assert.match(texts[3].html, /<ul class="ck"><li class="on">.*<\/li><li>.*<\/li><\/ul>/)
  const frame = items.find((item) => item.type === 'frame')
  assert.equal(frame.z, 0)
  assert.equal(frame.name, 'Frame: groups what is inside')
  const inside = (item) => item.x >= frame.x && item.x <= frame.x + frame.w && item.y >= frame.y && item.y <= frame.y + frame.h
  assert.deepEqual(texts.map(inside), [false, true, true, false])
})

test('the example html only uses allowed tags and both languages produce the same items', () => {
  const unique = new Set(itemsIn('en').map((item) => item.id))
  assert.equal(unique.size, 5)
  for (const language of ['en', 'pt-BR']) {
    const items = itemsIn(language)
    assert.equal(items.length, 5)
    for (const item of items.filter((item) => item.type === 'text')) {
      for (const tag of tagsOf(item.html)) assert.ok(ALLOWED_TAGS.includes(tag), `${tag} is not allowed`)
    }
  }
  assert.equal(itemsIn('pt-BR')[0].html.startsWith('<h1>Bem-vindo ao Trecos</h1>'), true)
})

test('the server keeps every example item unchanged', () => {
  for (const language of ['en', 'pt-BR']) {
    const content = firstBoardContent(createTranslator(language))
    assert.deepEqual(JSON.parse(normalizeBoard(content, tools).content), JSON.parse(content))
  }
})
