import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { expiryDate, shareUrl, tokenFromHash } from '../pb_public/js/share.js'

const require = createRequire(import.meta.url)
const { isExpired } = require('../pb_hooks/share.js')

const record = (expires) => ({ getString: () => expires })

test('expiry is detected on the server', () => {
  assert.equal(isExpired(record('')), false)
  assert.equal(isExpired(record('2020-01-01 00:00:00.000Z')), true)
  assert.equal(isExpired(record('2999-01-01 00:00:00.000Z')), false)
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
