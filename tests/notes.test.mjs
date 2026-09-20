import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isSuspiciousShrink, readDraft, writeDraft } from '../pb_public/js/notes.js'
import { errorKey, magicLinkFrom, readAuth, writeAuth } from '../pb_public/js/auth.js'

const memoryStorage = () => {
  const data = new Map()
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, value),
    removeItem: (key) => data.delete(key)
  }
}

test('a big note that suddenly shrinks is suspicious, small notes are not', () => {
  assert.equal(isSuspiciousShrink(5000, 1000), true)
  assert.equal(isSuspiciousShrink(5000, 4000), false)
  assert.equal(isSuspiciousShrink(500, 10), false)
})

test('drafts round trip and reject junk', () => {
  const storage = memoryStorage()
  writeDraft(storage, 'n1', { html: '<div>x</div>', revision: 'r1', at: 1 })
  assert.deepEqual(readDraft(storage, 'n1'), { html: '<div>x</div>', revision: 'r1', at: 1 })
  writeDraft(storage, 'n1', null)
  assert.equal(readDraft(storage, 'n1'), null)
  storage.setItem('rabisco.draft:n2', '{bad')
  assert.equal(readDraft(storage, 'n2'), null)
})

test('auth round trip and validation', () => {
  const storage = memoryStorage()
  writeAuth(storage, { token: 't', userId: 'u' })
  assert.deepEqual(readAuth(storage), { token: 't', userId: 'u' })
  writeAuth(storage, null)
  assert.equal(readAuth(storage), null)
  storage.setItem('rabisco.auth', '{"token":1}')
  assert.equal(readAuth(storage), null)
})

test('api errors map to user facing messages', () => {
  assert.equal(errorKey({ status: 429 }), 'tooMany')
  assert.equal(errorKey({ status: 400 }), 'codeInvalid')
  assert.equal(errorKey({ status: 500 }), 'sendFailed')
  assert.equal(errorKey(new TypeError('network')), 'sendFailed')
})

test('magic link parameters are read from the query string', () => {
  assert.deepEqual(magicLinkFrom('?otp=123456&id=abc'), { code: '123456', id: 'abc' })
  assert.equal(magicLinkFrom('?otp=123456'), null)
  assert.equal(magicLinkFrom(''), null)
})
