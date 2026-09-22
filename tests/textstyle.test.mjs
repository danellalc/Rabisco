import { test } from 'node:test'
import assert from 'node:assert/strict'
import { STYLE_COMMANDS, TEXT_ALIGNS, TEXT_SIZES, cleanStyle, cycled, isShort, stepped, styleClasses, styleEntries, styleKey, styleOf } from '../pb_public/js/textstyle.js'
import { TEXT_COLORS } from '../pb_public/js/items.js'
import { dictionaries } from '../pb_public/js/i18n.js'

test('six note colors, three sizes and three alignments, each with a name in both dictionaries', () => {
  assert.deepEqual(TEXT_COLORS, ['hl1', 'hl2', 'hl3', 'hl4', 'hl5', 'hl6'])
  assert.deepEqual(TEXT_SIZES, ['small', 'normal', 'large'])
  assert.deepEqual(TEXT_ALIGNS, ['left', 'center', 'right'])
  for (const language of ['en', 'pt-BR']) {
    for (const color of TEXT_COLORS) assert.ok(dictionaries[language][`noteColor_${color}`], `${color} ${language}`)
    for (const size of TEXT_SIZES) assert.ok(dictionaries[language][`textSize_${size}`], `${size} ${language}`)
    for (const align of TEXT_ALIGNS) assert.ok(dictionaries[language][`align_${align}`], `${align} ${language}`)
  }
})

test('cleanStyle keeps known values and drops junk and defaults', () => {
  assert.deepEqual(cleanStyle({ size: 'large', align: 'center' }), { size: 'large', align: 'center' })
  assert.deepEqual(cleanStyle({ size: 'huge', align: 'diagonal' }), {})
  assert.deepEqual(cleanStyle({ size: 'normal', align: 'left' }), {})
  assert.deepEqual(cleanStyle({ size: 12, align: null }), {})
})

test('styleOf fills the defaults and styleClasses maps them to element classes', () => {
  assert.deepEqual(styleOf({}), { color: '', size: 'normal', align: 'left' })
  assert.deepEqual(styleOf({ color: 'hl5', size: 'small', align: 'right' }), { color: 'hl5', size: 'small', align: 'right' })
  assert.deepEqual(styleClasses({ size: 'large', align: 'center' }), [['size-small', false], ['size-large', true], ['align-center', true], ['align-right', false]])
  assert.deepEqual(styleClasses({}).filter(([, on]) => on), [])
})

test('cycling wraps around, stepping stops at the ends', () => {
  assert.equal(cycled(TEXT_ALIGNS, 'left', 1), 'center')
  assert.equal(cycled(TEXT_ALIGNS, 'right', 1), 'left')
  assert.equal(cycled(TEXT_SIZES, 'small', -1), 'large')
  assert.equal(cycled(TEXT_SIZES, 'unknown', 1), 'normal')
  assert.equal(stepped(TEXT_SIZES, 'normal', 1), 'large')
  assert.equal(stepped(TEXT_SIZES, 'large', 1), 'large')
  assert.equal(stepped(TEXT_SIZES, 'small', -1), 'small')
})

test('the toolbar commands step the size and cycle the alignment', () => {
  assert.deepEqual(STYLE_COMMANDS.sizeUp(styleOf({})), { size: 'large' })
  assert.deepEqual(STYLE_COMMANDS.sizeDown(styleOf({})), { size: 'small' })
  assert.deepEqual(STYLE_COMMANDS.sizeDown(styleOf({ size: 'small' })), { size: 'small' })
  assert.deepEqual(STYLE_COMMANDS.alignNext(styleOf({})), { align: 'center' })
  assert.deepEqual(STYLE_COMMANDS.alignNext(styleOf({ align: 'right' })), { align: 'left' })
})

test('short notes are under forty characters', () => {
  assert.equal(isShort('hello'), true)
  assert.equal(isShort('x'.repeat(39)), true)
  assert.equal(isShort('x'.repeat(40)), false)
})

const key = (overrides) => ({ ctrlKey: false, metaKey: false, altKey: false, shiftKey: false, code: '', ...overrides })

test('keyboard: ctrl shift L E R align, ctrl alt C V copy and paste the style', () => {
  assert.deepEqual(styleKey(key({ ctrlKey: true, shiftKey: true, code: 'KeyL' })), { align: 'left' })
  assert.deepEqual(styleKey(key({ metaKey: true, shiftKey: true, code: 'KeyE' })), { align: 'center' })
  assert.deepEqual(styleKey(key({ ctrlKey: true, shiftKey: true, code: 'KeyR' })), { align: 'right' })
  assert.equal(styleKey(key({ ctrlKey: true, altKey: true, code: 'KeyC' })), 'copy')
  assert.equal(styleKey(key({ ctrlKey: true, altKey: true, code: 'KeyV' })), 'paste')
  assert.equal(styleKey(key({ ctrlKey: true, shiftKey: true, altKey: true, code: 'KeyC' })), null)
  assert.equal(styleKey(key({ ctrlKey: true, code: 'KeyL' })), null)
  assert.equal(styleKey(key({ shiftKey: true, code: 'KeyL' })), null)
  assert.equal(styleKey(key({ ctrlKey: true, shiftKey: true, code: 'KeyX' })), null)
})

test('the context menu entries show the current value and cycle it', () => {
  const translate = (name) => dictionaries.en[name]
  const patches = []
  const entries = styleEntries(styleOf({ size: 'large' }), translate, (patch) => patches.push(patch))
  assert.deepEqual(entries.map((entry) => entry.label), ['Text size: large', 'Align: left'])
  entries[0].run()
  entries[1].run()
  assert.deepEqual(patches, [{ size: 'small' }, { align: 'center' }])
})
