import { test } from 'node:test'
import assert from 'node:assert/strict'
import { defaults, readSettings, sanitizeSettings, writeSettings } from '../pb_public/js/settings.js'

const memoryStorage = () => {
  const data = new Map()
  return { getItem: (key) => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) }
}

test('unknown values fall back to the defaults', () => {
  assert.deepEqual(sanitizeSettings({ theme: 'neon', width: 'huge' }), defaults)
  assert.deepEqual(sanitizeSettings(null), defaults)
  assert.deepEqual(sanitizeSettings('junk'), defaults)
})

test('known values are kept and forgotten ones are dropped', () => {
  assert.deepEqual(sanitizeSettings({ theme: 'dark', width: 'wide', sidebar: 'closed' }), { theme: 'dark', sidebar: 'closed' })
})

test('settings survive a round trip through storage', () => {
  const storage = memoryStorage()
  writeSettings(storage, { theme: 'light', sidebar: 'open' })
  assert.deepEqual(readSettings(storage), { theme: 'light', sidebar: 'open' })
})

test('broken or missing storage yields the defaults', () => {
  assert.deepEqual(readSettings({ getItem: () => '{not json' }), defaults)
  assert.deepEqual(readSettings({ getItem: () => { throw new Error('blocked') } }), defaults)
})
