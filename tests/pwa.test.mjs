import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import vm from 'node:vm'
import { installPlatform } from '../lib/pwa/platform.ts'
import { addUpdateGuard, hasUpdateGuard } from '../lib/pwa/update-safety.ts'
import { APPLE_SCREENS, appleStartupImages } from '../lib/pwa/config.ts'

const source = await readFile(new URL('../lib/pwa/worker.js', import.meta.url), 'utf8')

function workerContext(overrides = {}) {
  const listeners = new Map()
  const { self: customSelf, ...globals } = overrides
  const context = vm.createContext({
    URL, Request, Response, console,
    self: { location: { origin: 'https://galeotrack.test' }, addEventListener: (name, handler) => listeners.set(name, handler), ...customSelf },
    ...globals,
  })
  vm.runInContext(source, context)
  return { context, listeners, run: (code) => vm.runInContext(code, context) }
}

test('installation hints distinguish iPad desktop UA, Safari, Edge, Android, and unknown browsers', () => {
  assert.equal(installPlatform('Mozilla Macintosh Safari', 'MacIntel', 5), 'ios')
  assert.equal(installPlatform('iPhone CriOS', 'iPhone', 5), 'ios')
  assert.equal(installPlatform('Macintosh Safari', 'MacIntel', 0), 'mac-safari')
  assert.equal(installPlatform('Windows Chrome Edg/130', 'Win32', 0), 'edge')
  assert.equal(installPlatform('Android Chrome', 'Linux', 5), 'android')
  assert.equal(installPlatform('Linux Firefox', 'Linux', 0), 'other')
})

test('update guards are independent, clean up, and store no form data', () => {
  const first = addUpdateGuard(), second = addUpdateGuard()
  assert.equal(hasUpdateGuard(), true)
  first(); assert.equal(hasUpdateGuard(), true)
  second(); assert.equal(hasUpdateGuard(), false)
})

test('worker rejects sensitive requests before choosing a caching strategy', () => {
  const { context, run } = workerContext()
  const cases = [
    ['/api/places?q=rincon', 'GET', {}], ['/auth/callback?code=private', 'GET', {}],
    ['/login', 'GET', {}], ['/register', 'GET', {}], ['/update-password', 'GET', {}],
    ['/admin?_rsc=token', 'GET', {}], ['/admin', 'GET', { RSC: '1' }],
    ['/_next/static/chunk.js', 'GET', { Authorization: 'Bearer private' }],
    ['/_next/static/chunk.js', 'GET', { Range: 'bytes=0-10' }],
    ['/report', 'POST', {}], ['https://project.supabase.co/storage/v1/object/sign/private', 'GET', {}],
  ]
  for (const [path, method, headers] of cases) {
    context.url = new URL(path, 'https://galeotrack.test')
    context.request = new Request(context.url, { method, headers })
    assert.equal(run('isSensitive(url, request)'), true, path)
  }
  context.url = new URL('https://galeotrack.test/comunidad')
  context.request = new Request(context.url)
  assert.equal(run('isSensitive(url, request)'), false)
  context.request = new Request(context.url, { cache: 'no-store' })
  assert.equal(run('isSensitive(url, request)'), true)
})

test('static cache uses a strict path, destination, extension and query allowlist', () => {
  const { context, run } = workerContext()
  const cases = [
    ['/_next/static/chunks/app-123.js', 'script', true], ['/_next/static/media/a.woff2', 'font', true],
    ['/_next/static/css/a.css?dpl=123', 'style', true], ['/_next/static/a.js?token=private', 'script', false],
    ['/_next/image?url=private', 'image', false], ['/images/private.jpg', 'image', false],
    ['/_next/static/page.html', 'document', false], ['/_next/static/a.js', 'document', false],
  ]
  for (const [path, destination, expected] of cases) {
    context.url = new URL(path, 'https://galeotrack.test')
    context.request = { destination }
    assert.equal(run('isStatic(url, request)'), expected, path)
  }
})

test('private, no-store, redirected, opaque, and error responses are not cacheable', () => {
  const { context, run } = workerContext()
  for (const headers of [{ 'cache-control': 'private, max-age=60' }, { 'cache-control': 'no-store' }, { vary: '*' }]) {
    context.response = { ok: true, status: 200, type: 'basic', redirected: false, headers: new Headers(headers) }
    assert.equal(run('cacheable(response)'), false)
  }
  for (const extra of [{ ok: false, status: 500 }, { type: 'opaque' }, { redirected: true }]) {
    context.response = { ok: true, status: 200, type: 'basic', redirected: false, headers: new Headers(), ...extra }
    assert.equal(run('cacheable(response)'), false)
  }
})

test('failed RSC and API requests never receive the offline document', () => {
  const { listeners } = workerContext()
  for (const path of ['/api/places', '/auth/callback?code=secret', '/admin?_rsc=abc']) {
    let intercepted = false
    listeners.get('fetch')({ request: new Request(`https://galeotrack.test${path}`), respondWith() { intercepted = true } })
    assert.equal(intercepted, false)
  }
})

test('activation cleans only its own caches and does not reload windows', async () => {
  const deleted = []
  let claimed = false
  const { listeners } = workerContext({
    caches: { keys: async () => ['unrelated-cache', 'galeotrack-pwa-offline-old', 'galeotrack-pwa-static-old'], delete: async (name) => { deleted.push(name) } },
    self: { clients: { claim: async () => { claimed = true } } },
  })
  let completion
  listeners.get('activate')({ waitUntil: (promise) => { completion = promise } })
  await completion
  assert.deepEqual(deleted, ['galeotrack-pwa-offline-old', 'galeotrack-pwa-static-old'])
  assert.equal(claimed, true)
})

test('document network failures receive the public fallback without storing the original URL', async () => {
  let writes = 0
  const { listeners } = workerContext({
    fetch: async () => { throw new TypeError('Failed to fetch') },
    caches: { open: async () => ({ match: async (key) => { assert.equal(key, '/offline.html'); return new Response('public offline') }, put: async () => { writes += 1 } }) },
  })
  let response
  listeners.get('fetch')({ request: { url: 'https://galeotrack.test/report?edit=private-id', method: 'GET', headers: new Headers(), mode: 'navigate', destination: 'document' }, respondWith: (promise) => { response = promise } })
  assert.equal(await (await response).text(), 'public offline')
  assert.equal(writes, 0)
})

test('HTTP server errors are not replaced by an offline success', async () => {
  const { listeners } = workerContext({ fetch: async () => new Response('server error', { status: 503 }) })
  let response
  listeners.get('fetch')({ request: { url: 'https://galeotrack.test/comunidad', method: 'GET', headers: new Headers(), mode: 'navigate', destination: 'document' }, respondWith: (promise) => { response = promise } })
  assert.equal((await response).status, 503)
})

test('a consent message cannot activate across other windows or originate outside this origin', async () => {
  for (const [sourceUrl, windows, expected, skipped] of [
    ['https://galeotrack.test/', [{ id: 'other', url: 'https://galeotrack.test/report' }], 'other-windows', false],
    ['https://galeotrack.test/', [{ id: 'source', url: 'https://galeotrack.test/' }], 'activating', true],
    ['https://unrelated.test/', [], undefined, false],
  ]) {
    let didSkip = false, status, completion
    const { listeners } = workerContext({ self: {
      registration: { scope: 'https://galeotrack.test/' },
      clients: { get: async () => ({ id: 'source', url: sourceUrl }), matchAll: async () => windows },
      skipWaiting: async () => { didSkip = true },
    } })
    listeners.get('message')({ data: { type: 'GALEOTRACK_ACTIVATE' }, source: { id: 'source' }, ports: [{ postMessage: (message) => { status = message.status } }], waitUntil: (promise) => { completion = promise } })
    await completion
    assert.equal(status, expected)
    assert.equal(didSkip, skipped)
  }
})

test('all manifest icons and conditional Apple launch images exist with correct PNG dimensions', async () => {
  for (const size of [192, 512]) for (const name of ['icon', 'maskable']) {
    const image = await readFile(new URL(`../public/pwa/${name}-${size}.png`, import.meta.url))
    assert.equal(image.readUInt32BE(16), size); assert.equal(image.readUInt32BE(20), size)
  }
  assert.equal(appleStartupImages().length, APPLE_SCREENS.length * 2)
  for (const [w, h, ratio] of APPLE_SCREENS) for (const orientation of ['portrait', 'landscape']) {
    const image = await readFile(new URL(`../public/pwa/startup/${w}x${h}@${ratio}-${orientation}.png`, import.meta.url))
    assert.equal(image.readUInt32BE(16), (orientation === 'portrait' ? w : h) * ratio)
    assert.equal(image.readUInt32BE(20), (orientation === 'portrait' ? h : w) * ratio)
  }
})
