import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { expiryDate, shareUrl, tokenFromHash } from '../pb_public/js/share.js'

const require = createRequire(import.meta.url)
const { isExpired, nextShare } = require('../pb_hooks/share.js')

const record = (expires) => ({ getString: () => expires })
const generate = () => 'fresh'

test('expiry is detected on the server', () => {
  assert.equal(isExpired(record('')), false)
  assert.equal(isExpired(record('2020-01-01 00:00:00.000Z')), true)
  assert.equal(isExpired(record('2999-01-01 00:00:00.000Z')), false)
})

test('the token only changes when a link is turned off or on', () => {
  const active = { previousMode: 'view', previousToken: 'old', previousExpired: false, modeGiven: true }
  assert.deepEqual(nextShare({ ...active, mode: 'edit', expiresGiven: false }, generate), { mode: 'edit', token: 'old' })
  assert.deepEqual(nextShare({ ...active, mode: 'view', expiresGiven: true }, generate), { mode: 'view', token: 'old' })
  assert.deepEqual(nextShare({ ...active, mode: 'view', modeGiven: false, expiresGiven: false }, generate), { mode: 'view', token: 'old' })
  assert.deepEqual(nextShare({ ...active, mode: 'off', expiresGiven: false }, generate), { mode: 'off', token: '', expires: '' })
  const off = { previousMode: 'off', previousToken: '', previousExpired: false, modeGiven: true }
  assert.deepEqual(nextShare({ ...off, mode: 'view', expiresGiven: false }, generate), { mode: 'view', token: 'fresh', expires: '' })
  assert.deepEqual(nextShare({ ...off, mode: 'view', expiresGiven: true }, generate), { mode: 'view', token: 'fresh' })
})

test('an expired link gets a new token and a clean expiry only when enabled again on purpose', () => {
  const expired = { previousMode: 'view', previousToken: 'old', previousExpired: true }
  assert.deepEqual(nextShare({ ...expired, mode: 'view', modeGiven: true, expiresGiven: false }, generate), { mode: 'view', token: 'fresh', expires: '' })
  assert.deepEqual(nextShare({ ...expired, mode: 'edit', modeGiven: true, expiresGiven: true }, generate), { mode: 'edit', token: 'fresh' })
  assert.deepEqual(nextShare({ ...expired, mode: 'view', modeGiven: false, expiresGiven: false }, generate), { mode: 'off', token: '', expires: '' })
  assert.deepEqual(nextShare({ ...expired, mode: 'view', modeGiven: false, expiresGiven: true }, generate), { mode: 'off', token: '', expires: '' })
})

test('expiry choices become dates from now', () => {
  const now = new Date('2026-09-20T12:00:00.000Z').getTime()
  assert.equal(expiryDate('never', now), '')
  assert.equal(expiryDate('1h', now), '2026-09-20T13:00:00.000Z')
  assert.equal(expiryDate('1d', now), '2026-09-21T12:00:00.000Z')
  assert.equal(expiryDate('7d', now), '2026-09-27T12:00:00.000Z')
})

test('share links carry the token in the fragment only', () => {
  const token = 'abcDEF123abcDEF123abcD'
  assert.equal(shareUrl('https://notes.example.com', token), `https://notes.example.com/s/#${token}`)
  assert.equal(tokenFromHash(`#${token}`), token)
  assert.equal(tokenFromHash('#short'), '')
  assert.equal(tokenFromHash(''), '')
  assert.equal(tokenFromHash('#<script>alert(1)</script>xx'), '')
})
