import { test } from 'node:test'
import assert from 'node:assert/strict'
import { RECENT_LIMIT, dayLabel, forget, groupByDay, readRecent, renameIn, touch, writeRecent } from '../pb_public/js/recent.js'

const translate = (key) => ({ today: 'today', yesterday: 'yesterday' })[key]
const memory = () => {
  const data = new Map()
  return { getItem: (key) => (data.has(key) ? data.get(key) : null), setItem: (key, value) => data.set(key, value) }
}
const entry = (id, at = 0) => ({ kind: 'file', id, name: id, folder: 'f', folderName: 'Folder', at })

test('touching moves the entry to the front and drops the older copy', () => {
  const list = touch([entry('a', 1), entry('b', 2)], entry('b'), 3)
  assert.deepEqual(list.map((item) => item.id), ['b', 'a'])
  assert.equal(list[0].at, 3)
})

test('the list never grows past the limit', () => {
  let list = []
  for (let index = 0; index < RECENT_LIMIT + 10; index++) list = touch(list, entry(`id${index}`), index)
  assert.equal(list.length, RECENT_LIMIT)
  assert.equal(list[0].id, `id${RECENT_LIMIT + 9}`)
})

test('forget removes one entry and rename updates its label', () => {
  const list = [entry('a', 1), entry('b', 2)]
  assert.deepEqual(forget(list, 'file', 'a').map((item) => item.id), ['b'])
  assert.equal(renameIn(list, 'file', 'b', 'renamed')[1].name, 'renamed')
})

test('storage round trip keeps only valid entries', () => {
  const storage = memory()
  writeRecent(storage, [entry('a', 1), { kind: 'weird', id: 'x', name: 'x', at: 1 }, { kind: 'doc', id: 5, name: 'no', at: 1 }])
  assert.deepEqual(readRecent(storage).map((item) => item.id), ['a'])
  storage.setItem('trecos.recent', '{broken')
  assert.deepEqual(readRecent(storage), [])
})

test('day labels say today, yesterday or the date', () => {
  const now = new Date(2026, 8, 21, 15, 0).getTime()
  assert.equal(dayLabel(now - 3600000, now, translate, 'en'), 'today')
  assert.equal(dayLabel(now - 86400000, now, translate, 'en'), 'yesterday')
  assert.equal(dayLabel(new Date(2026, 8, 12).getTime(), now, translate, 'en'), 'Sep 12')
  assert.equal(dayLabel(new Date(2025, 0, 3).getTime(), now, translate, 'en'), 'Jan 3, 25')
})

test('grouping keeps the order and joins entries of the same day', () => {
  const now = new Date(2026, 8, 21, 15, 0).getTime()
  const groups = groupByDay([entry('a', now - 1000), entry('b', now - 2000), entry('c', now - 86400000 - 1000)], now, translate, 'en')
  assert.deepEqual(groups.map((group) => [group.label, group.entries.length]), [['today', 2], ['yesterday', 1]])
})
