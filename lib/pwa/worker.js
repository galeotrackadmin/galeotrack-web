/* Service worker source. scripts/build-pwa.mjs injects a unique production revision. */
const VERSION = '__GALEOTRACK_BUILD__'
const PREFIX = 'galeotrack-pwa-'
const OFFLINE_CACHE = `${PREFIX}offline-${VERSION}`
const STATIC_CACHE = `${PREFIX}static-${VERSION}`
const OFFLINE_URLS = ['/offline.html', '/pwa/offline.css', '/pwa/offline.js', '/pwa/icon-192.png']
const MAX_STATIC_ENTRIES = 64
const MAX_STATIC_BYTES = 2 * 1024 * 1024

function isSensitive(url, request) {
  return url.origin !== self.location.origin || request.method !== 'GET' || request.cache === 'no-store' ||
    request.headers.has('authorization') || request.headers.has('range') ||
    request.headers.has('rsc') || request.headers.has('next-router-prefetch') ||
    url.searchParams.has('_rsc') ||
    /^\/(?:api|auth)(?:\/|$)/.test(url.pathname) ||
    /^\/(?:login|register|update-password)(?:\/|$)/.test(url.pathname)
}

function isStatic(url, request) {
  // No public/** wildcard, image optimizer, arbitrary query strings, or remote resources.
  return url.pathname.startsWith('/_next/static/') &&
    ['script', 'style', 'font'].includes(request.destination) &&
    /\.(?:js|css|woff2?)$/.test(url.pathname) &&
    [...url.searchParams.keys()].every((key) => key === 'dpl')
}

function cacheable(response) {
  return response.ok && response.status === 200 && response.type === 'basic' && !response.redirected &&
    !/(?:private|no-store)/i.test(response.headers.get('cache-control') || '') &&
    !/\*/.test(response.headers.get('vary') || '')
}

self.addEventListener('install', (event) => {
  // Failure leaves the previous worker active. Never skipWaiting during install.
  event.waitUntil((async () => {
    const cache = await caches.open(OFFLINE_CACHE)
    try {
      for (const path of OFFLINE_URLS) {
        const response = await fetch(new Request(path, { cache: 'reload', credentials: 'omit' }))
        const expected = path.endsWith('.html') ? 'text/html' : path.endsWith('.css') ? 'text/css' : path.endsWith('.js') ? '(?:javascript|ecmascript)' : 'image/png'
        if (!cacheable(response) || !new RegExp(expected).test(response.headers.get('content-type') || '')) throw new Error('Invalid offline asset')
        await cache.put(path, response)
      }
    } catch (error) {
      await caches.delete(OFFLINE_CACHE)
      throw error
    }
  })())
})

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys()
    await Promise.all(names.filter((name) => name.startsWith(PREFIX) && ![OFFLINE_CACHE, STATIC_CACHE].includes(name)).map((name) => caches.delete(name)))
    // No automatic reload. Non-caching document/API behavior is identical across versions.
    await self.clients.claim()
  })())
})

async function staticResponse(request, event) {
  const cache = await caches.open(STATIC_CACHE)
  const cached = await cache.match(request)
  if (cached) return cached
  const response = await fetch(request)
  if (cacheable(response)) {
    const copy = response.clone()
    event.waitUntil((async () => {
      // A per-resource cap also bounds responses without a Content-Length header.
      const bytes = await copy.clone().arrayBuffer()
      if (bytes.byteLength > MAX_STATIC_BYTES) return
      // Preserve the native response's encoding metadata and response type.
      await cache.put(request, copy)
      const keys = await cache.keys()
      await Promise.all(keys.slice(0, Math.max(0, keys.length - MAX_STATIC_ENTRIES)).map((key) => cache.delete(key)))
    })().catch(() => { /* Quota errors must not break an online response. */ }))
  }
  return response
}

self.addEventListener('fetch', (event) => {
  const request = event.request
  const url = new URL(request.url)
  if (isSensitive(url, request)) return
  if (OFFLINE_URLS.includes(url.pathname) && !url.search) {
    event.respondWith(caches.open(OFFLINE_CACHE).then(async (cache) => (await cache.match(url.pathname)) || fetch(request)))
    return
  }
  if (isStatic(url, request)) {
    event.respondWith(staticResponse(request, event))
    return
  }
  if (request.mode === 'navigate' && request.destination === 'document') {
    // Never persist HTML, session state, HTTP errors, or tokens from navigation URLs.
    event.respondWith(fetch(request).catch(async () => {
      const cache = await caches.open(OFFLINE_CACHE)
      return (await cache.match('/offline.html')) || Response.error()
    }))
  }
})

self.addEventListener('message', (event) => {
  if (event.data?.type !== 'GALEOTRACK_ACTIVATE' || !event.ports[0] || !event.source) return
  event.waitUntil((async () => {
    const source = await self.clients.get(event.source.id)
    if (!source || new URL(source.url).origin !== self.location.origin) return
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    // Activating a worker affects its entire scope, not just the consenting tab.
    if (windows.some((client) => client.id !== source.id && client.url.startsWith(self.registration.scope))) {
      event.ports[0].postMessage({ status: 'other-windows' })
      return
    }
    event.ports[0].postMessage({ status: 'activating' })
    await self.skipWaiting()
  })())
})
