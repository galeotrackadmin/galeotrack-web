import assert from 'node:assert/strict'
import { test } from 'node:test'
import { GET } from '../app/api/places/route.ts'

test('buscador geográfico: sesión, permiso, cupo global, caché y fallos externos', async () => {
  const originalFetch = globalThis.fetch
  const previous = { url: process.env.NEXT_PUBLIC_SUPABASE_URL, key: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY }
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://places.example.test'
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'public-key'
  let role = 'community', allowed = true, fail = false, calls = 0
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input))
    const json = (value) => new Response(JSON.stringify(value), { headers: { 'content-type': 'application/json' } })
    if (url.hostname === 'places.example.test') {
      if (url.pathname.endsWith('/user')) return json({ id: 'user-1' })
      if (url.pathname.endsWith('/profiles')) return json([{ role }])
      if (url.pathname.endsWith('/rpc/claim_geocoding_request')) return json(allowed)
      throw new Error('Unexpected API')
    }
    assert.equal(url.hostname, 'nominatim.openstreetmap.org')
    assert.match(init.headers['User-Agent'], /GaleoTrack/)
    calls += 1
    if (fail) return new Response(null, { status: 503 })
    return json([{ display_name: 'Rincón, Puerto Rico', lat: '18.34', lon: '-67.25' }, { display_name: 'Invalid', lat: '999', lon: '0' }])
  }
  const request = (q, authenticated = true) => GET(new Request(`http://localhost/api/places?q=${encodeURIComponent(q)}`, { headers: authenticated ? { authorization: 'Bearer test-token' } : {} }))
  try {
    assert.equal((await request('Rincón', false)).status, 401)
    assert.equal((await request('ab')).status, 400)
    role = 'student'; assert.equal((await request('Rincón')).status, 403)
    role = 'community'; allowed = false; assert.equal((await request('Rincón')).status, 429)
    assert.equal(calls, 0)
    allowed = true
    const result = await request('Rincón')
    assert.equal(result.status, 200)
    assert.deepEqual((await result.json()).places, [{ name: 'Rincón, Puerto Rico', latitude: 18.34, longitude: -67.25 }])
    await request('Rincón'); assert.equal(calls, 1, 'search results are cached')
    fail = true; assert.equal((await request('Aguadilla')).status, 502)
  } finally {
    globalThis.fetch = originalFetch
    if (previous.url === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL; else process.env.NEXT_PUBLIC_SUPABASE_URL = previous.url
    if (previous.key === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY; else process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = previous.key
  }
})
