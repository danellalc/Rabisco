import { test } from 'node:test'
import assert from 'node:assert/strict'
import { SLASH_COMMANDS, filterSlash, slashQuery } from '../pb_public/js/slash.js'

const translate = (key) => ({ slashText: 'Texto', heading1: 'Título', heading2: 'Subtítulo', checklist: 'Checklist', bulletList: 'Lista', numberedList: 'Lista numerada', quote: 'Citação', codeBlock: 'Bloco de código', divider: 'Divisor', asImage: 'Imagem' })[key]

test('a slash at the start of an otherwise empty block opens the menu and the rest is the query', () => {
  assert.equal(slashQuery('/'), '')
  assert.equal(slashQuery('/cit'), 'cit')
  assert.equal(slashQuery('hello /x'), null)
  assert.equal(slashQuery('/ spaced'), null)
  assert.equal(slashQuery(''), null)
})

test('the query filters by translated label or command id, ignoring accents', () => {
  assert.equal(filterSlash(SLASH_COMMANDS, '', translate).length, SLASH_COMMANDS.length)
  assert.deepEqual(filterSlash(SLASH_COMMANDS, 'citacao', translate).map((command) => command.id), ['quote'])
  assert.deepEqual(filterSlash(SLASH_COMMANDS, 'lista', translate).map((command) => command.id), ['bulletList', 'numberedList'])
  assert.deepEqual(filterSlash(SLASH_COMMANDS, 'heading', translate).map((command) => command.id), ['heading1', 'heading2'])
  assert.deepEqual(filterSlash(SLASH_COMMANDS, 'zzz', translate), [])
})
