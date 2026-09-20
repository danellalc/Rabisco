import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildZip, crc32, uniqueName } from '../pb_public/js/zip.js'

test('crc32 matches the reference values', () => {
  assert.equal(crc32(new TextEncoder().encode('123456789')), 0xcbf43926)
  assert.equal(crc32(new Uint8Array(0)), 0)
})

test('the zip has one local header per entry, a central directory and the end record', async () => {
  const blob = buildZip([
    { name: 'board.md', data: new TextEncoder().encode('# Title\n') },
    { name: 'files/relatório.pdf', data: new Uint8Array([1, 2, 3]) }
  ], new Date(2026, 8, 20, 10, 30, 0))
  const bytes = new Uint8Array(await blob.arrayBuffer())
  const view = new DataView(bytes.buffer)
  assert.equal(blob.type, 'application/zip')
  assert.equal(view.getUint32(0, true), 0x04034b50)
  assert.equal(view.getUint16(26, true), 8)
  assert.equal(new TextDecoder().decode(bytes.slice(30, 38)), 'board.md')
  const endOffset = bytes.length - 22
  assert.equal(view.getUint32(endOffset, true), 0x06054b50)
  assert.equal(view.getUint16(endOffset + 10, true), 2)
  const directoryOffset = view.getUint32(endOffset + 16, true)
  assert.equal(view.getUint32(directoryOffset, true), 0x02014b50)
  assert.equal(view.getUint16(directoryOffset + 8, true), 0x0800)
})

test('duplicate names get a counter before the extension', () => {
  const taken = new Set()
  assert.equal(uniqueName('a.pdf', taken), 'a.pdf')
  assert.equal(uniqueName('a.pdf', taken), 'a (2).pdf')
  assert.equal(uniqueName('a.pdf', taken), 'a (3).pdf')
  assert.equal(uniqueName('README', taken), 'README')
  assert.equal(uniqueName('README', taken), 'README (2)')
})
