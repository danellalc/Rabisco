import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createTranslator, dictionaries, pickLanguage } from '../pb_public/js/i18n.js'

test('portuguese browsers get pt-BR', () => {
  assert.equal(pickLanguage(['pt-BR', 'en']), 'pt-BR')
  assert.equal(pickLanguage(['pt']), 'pt-BR')
  assert.equal(pickLanguage(['PT-PT']), 'pt-BR')
})

test('everything else gets english', () => {
  assert.equal(pickLanguage(['en-US', 'pt-BR']), 'en')
  assert.equal(pickLanguage(['es']), 'en')
  assert.equal(pickLanguage([]), 'en')
})

test('both dictionaries have exactly the same keys', () => {
  assert.deepEqual(Object.keys(dictionaries['pt-BR']).sort(), Object.keys(dictionaries.en).sort())
})

test('translator returns the string of the picked language', () => {
  assert.equal(createTranslator('pt-BR')('share'), 'Compartilhar')
  assert.equal(createTranslator('en')('share'), 'Share')
})
