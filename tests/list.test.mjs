import { test } from 'node:test'
import assert from 'node:assert/strict'
import { matches, normalize, parseDate, relativeTime, sortNotes } from '../pb_public/js/list.js'

const texts = { now: 'now', minutesAgo: '{n} min ago', hoursAgo: '{n} h ago', yesterday: 'yesterday' }
const translate = (key) => texts[key]
const now = new Date(2026, 8, 19, 15, 0, 0).getTime()

test('search ignores case and accents', () => {
  assert.equal(normalize('Reunião de PLANEJAMENTO'), 'reuniao de planejamento')
  assert.equal(matches({ title: 'Reunião de planejamento' }, '', 'reuniao'), true)
  assert.equal(matches({ title: 'Compras' }, 'leite e pão', 'PAO'), true)
  assert.equal(matches({ title: 'Compras' }, '', 'leite'), false)
  assert.equal(matches({ title: 'x' }, '', '   '), true)
})

test('pinned notes come first, then the most recent', () => {
  const sorted = sortNotes([
    { id: 'a', pinned: false, updated: '2026-09-19 10:00:00.000Z' },
    { id: 'b', pinned: true, updated: '2026-09-01 10:00:00.000Z' },
    { id: 'c', pinned: false, updated: '2026-09-19 12:00:00.000Z' }
  ])
  assert.deepEqual(sorted.map((item) => item.id), ['b', 'c', 'a'])
})

test('relative time uses the short forms of the spec', () => {
  assert.equal(relativeTime(now - 10000, now, translate, 'en'), 'now')
  assert.equal(relativeTime(now - 5 * 60000, now, translate, 'en'), '5 min ago')
  assert.equal(relativeTime(now - 2 * 3600000, now, translate, 'en'), '2 h ago')
  assert.equal(relativeTime(new Date(2026, 8, 18, 9, 0).getTime(), now, translate, 'en'), 'yesterday')
  assert.equal(relativeTime(new Date(2026, 8, 12, 9, 0).getTime(), now, translate, 'en'), 'Sep 12')
  assert.match(relativeTime(new Date(2025, 8, 12, 9, 0).getTime(), now, translate, 'en'), /Sep 12, 25|Sep 12 25/)
})

test('pocketbase dates parse', () => {
  assert.equal(parseDate('2026-09-19 22:30:00.123Z').toISOString(), '2026-09-19T22:30:00.123Z')
})
