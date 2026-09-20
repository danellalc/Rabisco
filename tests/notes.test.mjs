import { test } from 'node:test'
import assert from 'node:assert/strict'
import { expiryChoice, isShareExpired, isSuspiciousShrink, nextRetryDelay, readCamera, readDraft, writeCamera, writeDraft } from '../pb_public/js/boards.js'
import { errorKey, magicLinkFrom, readAuth, writeAuth } from '../pb_public/js/auth.js'
import { migrateStorage } from '../pb_public/js/store.js'

const memoryStorage = () => {
  const data = new Map()
  const storage = {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => { data.set(key, value); storage[key] = value },
    removeItem: (key) => { data.delete(key); delete storage[key] }
  }
  return storage
}

test('a big board that suddenly shrinks is suspicious, small boards are not', () => {
  assert.equal(isSuspiciousShrink(5000, 1000), true)
  assert.equal(isSuspiciousShrink(5000, 4000), false)
  assert.equal(isSuspiciousShrink(500, 10), false)
})

test('retries back off exponentially up to a ceiling', () => {
  assert.equal(nextRetryDelay(0), 2000)
  assert.equal(nextRetryDelay(2000), 4000)
  assert.equal(nextRetryDelay(16000), 30000)
  assert.equal(nextRetryDelay(30000), 30000)
})

test('share expiry is read from the stored date', () => {
  const now = new Date('2026-09-20T12:00:00.000Z').getTime()
  assert.equal(isShareExpired('', now), false)
  assert.equal(isShareExpired('2026-09-20 11:59:59.000Z', now), true)
  assert.equal(isShareExpired('2026-09-20 12:30:00.000Z', now), false)
  assert.equal(expiryChoice('', now), 'never')
  assert.equal(expiryChoice('2026-09-20 12:30:00.000Z', now), '1h')
  assert.equal(expiryChoice('2026-09-21 06:00:00.000Z', now), '1d')
  assert.equal(expiryChoice('2026-09-26 12:00:00.000Z', now), '7d')
})

test('drafts and cameras round trip and reject junk', () => {
  const storage = memoryStorage()
  writeDraft(storage, 'b1', { content: '[]', revision: 'r1', at: 1 })
  assert.deepEqual(readDraft(storage, 'b1'), { content: '[]', revision: 'r1', at: 1 })
  writeDraft(storage, 'b1', null)
  assert.equal(readDraft(storage, 'b1'), null)
  storage.setItem('trecos.draft:b2', '{bad')
  assert.equal(readDraft(storage, 'b2'), null)
  writeCamera(storage, 'b1', { zoom: 0.5, x: 10, y: -20 })
  assert.deepEqual(readCamera(storage, 'b1'), { zoom: 0.5, x: 10, y: -20 })
  storage.setItem('trecos.camera:b3', '{"zoom":"big"}')
  assert.equal(readCamera(storage, 'b3'), null)
})

test('old storage keys move to the new prefix and old drafts are dropped', () => {
  const storage = memoryStorage()
  storage.setItem('rabisco.auth', '{"token":"t","userId":"u"}')
  storage.setItem('rabisco.settings', '{"theme":"dark"}')
  storage.setItem('rabisco.draft:n1', '{"html":"x"}')
  storage.setItem('trecos.settings', '{"theme":"light"}')
  migrateStorage(storage)
  assert.equal(storage.getItem('trecos.auth'), '{"token":"t","userId":"u"}')
  assert.equal(storage.getItem('trecos.settings'), '{"theme":"light"}')
  assert.equal(storage.getItem('rabisco.auth'), null)
  assert.equal(storage.getItem('rabisco.draft:n1'), null)
  assert.equal(storage.getItem('trecos.draft:n1'), null)
})

test('auth round trip and validation', () => {
  const storage = memoryStorage()
  writeAuth(storage, { token: 't', userId: 'u' })
  assert.deepEqual(readAuth(storage), { token: 't', userId: 'u' })
  writeAuth(storage, null)
  assert.equal(readAuth(storage), null)
  storage.setItem('trecos.auth', '{"token":1}')
  assert.equal(readAuth(storage), null)
})

test('api errors map to user facing messages', () => {
  assert.equal(errorKey({ status: 429 }), 'tooMany')
  assert.equal(errorKey({ status: 400 }), 'codeInvalid')
  assert.equal(errorKey({ status: 500 }), 'sendFailed')
  assert.equal(errorKey(new TypeError('network')), 'sendFailed')
})

test('magic link parameters are read from the fragment', () => {
  assert.deepEqual(magicLinkFrom('#otp=123456&id=abc'), { code: '123456', id: 'abc' })
  assert.equal(magicLinkFrom('#otp=123456'), null)
  assert.equal(magicLinkFrom(''), null)
})

test('token expiry is read from the jwt payload', async () => {
  const { tokenExpiry } = await import('../pb_public/js/api.js')
  const payload = Buffer.from(JSON.stringify({ exp: 1800000000 })).toString('base64url')
  assert.equal(tokenExpiry(`x.${payload}.y`), 1800000000000)
  assert.equal(tokenExpiry('junk'), 0)
})
