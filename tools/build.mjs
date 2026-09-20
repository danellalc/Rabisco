import { build, transform } from 'esbuild'
import { createHash } from 'node:crypto'
import { cp, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const source = fileURLToPath(new URL('../pb_public/', import.meta.url))
const target = fileURLToPath(new URL('../build/', import.meta.url))
const shell = ['/', '/style.css', '/manifest.json', '/icon.svg', '/js/main.js']

await rm(target, { recursive: true, force: true })
await mkdir(join(target, 'js'), { recursive: true })

await build({
  entryPoints: [join(source, 'js', 'main.js')],
  bundle: true,
  minify: true,
  format: 'esm',
  target: 'es2020',
  outfile: join(target, 'js', 'main.js'),
  legalComments: 'none',
  logLevel: 'warning'
})

for (const entry of await readdir(source, { withFileTypes: true })) {
  if (entry.isDirectory() || entry.name.endsWith('.js')) continue
  const from = join(source, entry.name)
  if (entry.name.endsWith('.css')) {
    const { code } = await transform(await readFile(from, 'utf8'), { loader: 'css', minify: true })
    await writeFile(join(target, entry.name), code)
  } else {
    await cp(from, join(target, entry.name))
  }
}

const hash = createHash('sha256')
for (const path of shell) hash.update(await readFile(join(target, path === '/' ? 'index.html' : path)))
const version = hash.digest('hex').slice(0, 8)

const worker = (await readFile(join(source, 'sw.js'), 'utf8'))
  .replace(/const VERSION = '[^']*'/, `const VERSION = '${version}'`)
  .replace(/const ASSETS = \[[^\]]*\]/, `const ASSETS = ${JSON.stringify(shell)}`)
const { code } = await transform(worker, { loader: 'js', minify: true, target: 'es2020' })
await writeFile(join(target, 'sw.js'), code)

console.log(`built ${target} version ${version}`)
