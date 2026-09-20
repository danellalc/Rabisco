import { readdir, readFile, stat } from 'node:fs/promises'
import { join, relative, resolve } from 'node:path'
import { gzipSync } from 'node:zlib'
import { fileURLToPath } from 'node:url'

const root = resolve(fileURLToPath(new URL('../', import.meta.url)), process.argv[2] || 'build')
const budgets = { css: 24 * 1024, js: 128 * 1024, raw: 160 * 1024, gzip: 48 * 1024 }
const counted = new Set(['.html', '.css', '.js'])

async function walk(dir) {
  const entries = await readdir(dir)
  const files = []
  for (const entry of entries) {
    const path = join(dir, entry)
    if ((await stat(path)).isDirectory()) files.push(...await walk(path))
    else files.push(path)
  }
  return files
}

const rows = []
for (const path of await walk(root)) {
  const extension = path.slice(path.lastIndexOf('.'))
  if (!counted.has(extension)) continue
  const content = await readFile(path)
  rows.push({ file: relative(root, path).replaceAll('\\', '/'), extension, raw: content.length, gzip: gzipSync(content, { level: 9 }).length })
}

const sum = (predicate, key) => rows.filter(predicate).reduce((total, row) => total + row[key], 0)
const totals = {
  css: sum((row) => row.extension === '.css', 'raw'),
  js: sum((row) => row.extension === '.js', 'raw'),
  raw: sum(() => true, 'raw'),
  gzip: sum(() => true, 'gzip')
}

console.log(`measuring ${root}`)
const width = Math.max(...rows.map((row) => row.file.length), 12)
console.log(`${'file'.padEnd(width)}  ${'raw'.padStart(7)}  ${'gzip'.padStart(7)}`)
for (const row of rows) console.log(`${row.file.padEnd(width)}  ${String(row.raw).padStart(7)}  ${String(row.gzip).padStart(7)}`)
console.log(`${'total'.padEnd(width)}  ${String(totals.raw).padStart(7)}  ${String(totals.gzip).padStart(7)}`)

let failed = false
for (const [key, limit] of Object.entries(budgets)) {
  const value = totals[key]
  const status = value <= limit ? 'ok' : 'OVER'
  if (value > limit) failed = true
  console.log(`${key.padEnd(6)} ${String(value).padStart(7)} / ${limit}  ${status}`)
}
process.exit(failed ? 1 : 0)
