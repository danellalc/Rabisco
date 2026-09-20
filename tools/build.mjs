import { build, transform } from 'esbuild'
import { cp, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const source = fileURLToPath(new URL('../pb_public/', import.meta.url))
const target = fileURLToPath(new URL('../build/', import.meta.url))

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

const serviceWorker = join(source, 'sw.js')
try {
  const { code } = await transform(await readFile(serviceWorker, 'utf8'), { loader: 'js', minify: true, target: 'es2020' })
  await writeFile(join(target, 'sw.js'), code)
} catch (error) {
  if (error.code !== 'ENOENT') throw error
}

console.log(`built ${target}`)
