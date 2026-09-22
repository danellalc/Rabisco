import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createQuotaAlerts, createUploads, dropTree, quotaLevel } from '../pb_public/js/uploads.js'

const fakeNode = () => {
  const node = { children: [], style: {}, dataset: {}, hidden: false, textContent: '', listeners: {} }
  node.append = (...items) => node.children.push(...items)
  node.remove = () => {}
  node.addEventListener = (name, listener) => { node.listeners[name] = listener }
  return node
}
globalThis.document = { createElement: fakeNode }

const tick = () => new Promise((resolve) => setTimeout(resolve, 0))
const translate = (key) => (key === 'uploadsHead' ? '{done} of {total}' : key)

test('the queue runs two at a time, cancels, retries and settles a target when it drains', async () => {
  const settled = []
  const panel = fakeNode()
  const uploads = createUploads({ element: panel, translate, formatBytes: (bytes) => `${bytes} B`, onSettled: (target) => settled.push(target) })
  const started = []
  const pending = new Map()
  const run = (file, onProgress, signal) => new Promise((resolve, reject) => {
    started.push(file.name)
    pending.set(file.name, { resolve, reject, onProgress })
    signal.addEventListener('abort', () => reject(new Error('aborted')))
  })
  uploads.add(['a', 'b', 'c', 'd'].map((name) => ({ name, size: 10 })), 'folder1', run)
  const [head, ...rows] = panel.children
  const states = () => rows.map((row) => row.dataset.state)
  assert.deepEqual(started, ['a', 'b'])
  assert.deepEqual(states(), ['uploading', 'uploading', 'waiting', 'waiting'])
  assert.equal(panel.hidden, false)
  assert.equal(head.children[0].textContent, '0 of 4')
  assert.equal(head.children[1].hidden, true)
  assert.equal(rows[0].children[1].textContent, '10 B')

  pending.get('a').onProgress(0.5)
  assert.equal(rows[0].children[2].children[0].style.width, '50%')
  pending.get('a').resolve({ id: 'ra' })
  await tick()
  assert.deepEqual(started, ['a', 'b', 'c'])
  assert.deepEqual(states(), ['done', 'uploading', 'uploading', 'waiting'])
  assert.equal(rows[0].children[4].hidden, true)

  uploads.cancel(4)
  assert.equal(states()[3], 'cancelled')
  assert.deepEqual(started, ['a', 'b', 'c'])

  pending.get('b').reject(new Error('boom'))
  await tick()
  assert.equal(states()[1], 'failed')
  assert.equal(rows[1].children[4].textContent, 'retry')
  assert.deepEqual(settled, [])

  uploads.retry(2)
  assert.deepEqual(started, ['a', 'b', 'c', 'b'])
  assert.equal(states()[1], 'uploading')
  assert.equal(rows[1].children[4].textContent, 'cancel')

  uploads.cancel(3)
  await tick()
  assert.equal(states()[2], 'cancelled')
  assert.deepEqual(settled, [])

  pending.get('b').resolve({ id: 'rb' })
  await tick()
  assert.deepEqual(states(), ['done', 'done', 'cancelled', 'cancelled'])
  assert.deepEqual(settled, ['folder1'])
  assert.equal(head.children[0].textContent, '2 of 4')
  assert.equal(head.children[1].hidden, false)

  head.children[1].listeners.click()
  assert.equal(panel.hidden, true)
  uploads.add([{ name: 'e', size: 1 }], 'folder2', run)
  assert.equal(head.children[0].textContent, '0 of 1')
  assert.equal(panel.hidden, false)
})

const fileEntry = (name) => ({ isFile: true, isDirectory: false, name, file: (done) => done({ name }) })
const dirEntry = (name, children, batch = children.length) => ({
  isFile: false,
  isDirectory: true,
  name,
  createReader: () => {
    let index = 0
    return { readEntries: (done) => {
      const slice = children.slice(index, index + batch)
      index += slice.length
      done(slice)
    } }
  }
})

test('a dropped tree lists folders before their children and files with their folder path', async () => {
  const { folders, files } = await dropTree([dirEntry('Client', [fileEntry('brief.txt'), dirEntry('assets', [fileEntry('logo.png'), fileEntry('icon.png'), fileEntry('font.woff2')], 2)]), fileEntry('loose.pdf')])
  assert.deepEqual(folders, [{ path: 'Client', name: 'Client' }, { path: 'Client/assets', name: 'assets' }])
  assert.deepEqual(files.map((entry) => [entry.path, entry.file.name]), [['Client', 'brief.txt'], ['Client/assets', 'logo.png'], ['Client/assets', 'icon.png'], ['Client/assets', 'font.woff2'], ['', 'loose.pdf']])
  assert.deepEqual(await dropTree([dirEntry('Empty', [])]), { folders: [{ path: 'Empty', name: 'Empty' }], files: [] })
})

test('quota levels start at 80% and alerts fire once per crossing', () => {
  assert.equal(quotaLevel(0, 100), '')
  assert.equal(quotaLevel(79, 100), '')
  assert.equal(quotaLevel(80, 100), 'warn')
  assert.equal(quotaLevel(100, 100), 'full')
  assert.equal(quotaLevel(5, 0), '')
  const fired = []
  const watch = createQuotaAlerts((level, used, quota) => fired.push(`${level}:${used}/${quota}`))
  assert.equal(watch(10, 100), '')
  assert.equal(watch(85, 100), 'warn')
  watch(90, 100)
  assert.deepEqual(fired, ['warn:85/100'])
  watch(100, 100)
  watch(120, 100)
  assert.deepEqual(fired, ['warn:85/100', 'full:100/100'])
  watch(90, 100)
  assert.equal(fired.length, 2)
  watch(100, 100)
  assert.equal(fired.length, 3)
  watch(10, 100)
  watch(80, 100)
  assert.equal(fired.length, 4)
})
