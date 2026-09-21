import { test } from 'node:test'
import assert from 'node:assert/strict'
import { normalize, parseDate, relativeTime } from '../pb_public/js/list.js'
import { entriesOf, labelOf, sortEntries } from '../pb_public/js/resources.js'
import { parseResources, resourceText } from '../pb_public/js/drive.js'

const translate = (key) => ({ now: 'now', minutesAgo: '{n} min ago', hoursAgo: '{n} h ago', yesterday: 'yesterday' })[key]

test('normalize ignores case and accents', () => {
  assert.equal(normalize('Reunião de PLANEJAMENTO'), 'reuniao de planejamento')
})

test('relative time picks the right bucket', () => {
  const now = Date.UTC(2026, 8, 20, 12, 0, 0)
  assert.equal(relativeTime(now - 10000, now, translate, 'en'), 'now')
  assert.equal(relativeTime(now - 5 * 60000, now, translate, 'en'), '5 min ago')
  assert.equal(relativeTime(now - 3 * 3600000, now, translate, 'en'), '3 h ago')
  assert.equal(relativeTime(now - 26 * 3600000, now, translate, 'en'), 'yesterday')
  assert.equal(parseDate('2026-09-20 12:00:00.000Z').getTime(), now)
})

test('a folder listing becomes entries with folders first, pinned first, then by date or name', () => {
  const listing = {
    folders: [
      { id: 'f1', name: '', title: 'From text', pinned: false, updated: '2026-09-20 10:00:00.000Z' },
      { id: 'f2', name: 'Alpha', title: '', pinned: true, updated: '2026-09-19 10:00:00.000Z' }
    ],
    docs: [{ id: 'd1', name: 'Zeta doc', updated: '2026-09-20 11:00:00.000Z', revision: 'r' }],
    files: [{ id: 'x1', name: 'beta.pdf', size: 10, kind: 'pdf', updated: '2026-09-20 09:00:00.000Z' }]
  }
  const entries = entriesOf(listing)
  assert.equal(labelOf(listing.folders[0]), 'From text')
  assert.deepEqual(sortEntries(entries, 'updated').map((entry) => entry.id), ['f2', 'f1', 'd1', 'x1'])
  assert.deepEqual(sortEntries(entries, 'name').map((entry) => entry.id), ['f2', 'f1', 'x1', 'd1'])
})

test('dragged resources round trip through the clipboard text and junk is ignored', () => {
  const text = resourceText([{ kind: 'file', id: 'abc', name: 'a.pdf', size: 1 }, { kind: 'rocket', id: 'zzz' }], 'folder1')
  assert.deepEqual(parseResources(text), { folder: 'folder1', entries: [{ kind: 'file', id: 'abc', name: 'a.pdf' }] })
  assert.equal(parseResources('hello'), null)
  assert.equal(parseResources('trecos-resources:{broken'), null)
})
