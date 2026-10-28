import { readFile, writeFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'

// Native APIs only: independent of webpack/Turbopack and Vercel-specific identifiers.
const root = new URL('../', import.meta.url)
const source = await readFile(new URL('lib/pwa/worker.js', root), 'utf8')
const version = randomUUID()
await writeFile(new URL('public/sw.js', root), source.replace('__GALEOTRACK_BUILD__', version))
console.log(`PWA worker generated: ${version}`)
