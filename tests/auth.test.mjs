import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { test } from 'node:test'
import { createClient } from '@supabase/supabase-js'
import { completeOAuthSignIn, getOAuthSignInUrl } from '../lib/auth.ts'

function createAuthBackend({ rejectExchange = false } = {}) {
  const storage = new Map()
  const requests = []
  const client = createClient('https://auth.example.test', 'test-public-key', {
    auth: {
      flowType: 'pkce',
      detectSessionInUrl: false,
      autoRefreshToken: false,
      storage: {
        getItem: (key) => storage.get(key) ?? null,
        setItem: (key, value) => { storage.set(key, value) },
        removeItem: (key) => { storage.delete(key) },
      },
    },
    global: {
      fetch: async (input, init) => {
        const url = new URL(String(input))
        const body = JSON.parse(init.body)
        requests.push({ url, body })
        assert.equal(url.pathname, '/auth/v1/token')
        assert.equal(url.searchParams.get('grant_type'), 'pkce')
        return new Response(JSON.stringify(rejectExchange ? {
          error_code: 'flow_state_expired', message: 'Internal provider details',
        } : {
          access_token: 'test-access-token', refresh_token: 'test-refresh-token',
          expires_in: 3600, token_type: 'bearer',
          user: { id: 'test-user', email: 'researcher@example.test', aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-09-24T00:00:00Z' },
        }), { status: rejectExchange ? 400 : 200, headers: { 'content-type': 'application/json' } })
      },
    },
  })
  return { client, requests }
}

for (const provider of ['google', 'azure']) {
  test(`${provider}: genera autorización PKCE con callback local y selector de cuenta`, async () => {
    const { client, requests } = createAuthBackend()
    const url = new URL(await getOAuthSignInUrl(client, provider, 'https://app.example.test'))
    assert.equal(url.origin, 'https://auth.example.test')
    assert.equal(url.pathname, '/auth/v1/authorize')
    assert.equal(url.searchParams.get('provider'), provider)
    assert.equal(url.searchParams.get('prompt'), 'select_account')
    assert.equal(url.searchParams.get('code_challenge_method'), 's256')
    assert.ok(url.searchParams.get('code_challenge'))
    const callback = new URL(url.searchParams.get('redirect_to'))
    assert.equal(callback.origin, 'https://app.example.test')
    assert.equal(callback.pathname, '/auth/callback')
    assert.equal(url.searchParams.get('scopes'), provider === 'azure' ? 'email' : null)
    assert.equal(requests.length, 0)
  })
}

test('intercambia el código con el verificador correcto y persiste la sesión', async () => {
  const { client, requests } = createAuthBackend()
  const authorization = new URL(await getOAuthSignInUrl(client, 'google', 'https://app.example.test'))
  const callback = new URL(authorization.searchParams.get('redirect_to'))
  callback.searchParams.set('code', 'one-use-code')
  await completeOAuthSignIn(client, callback.href)

  assert.equal(requests.length, 1)
  assert.equal(requests[0].body.auth_code, 'one-use-code')
  const challenge = createHash('sha256').update(requests[0].body.code_verifier).digest('base64url')
  assert.equal(challenge, authorization.searchParams.get('code_challenge'))
  const { data: { session } } = await client.auth.getSession()
  assert.equal(session.user.email, 'researcher@example.test')
})

test('mantiene el verificador de cada flujo cuando se abren dos accesos', async () => {
  const { client, requests } = createAuthBackend()
  const first = new URL(await getOAuthSignInUrl(client, 'google', 'https://app.example.test'))
  await getOAuthSignInUrl(client, 'azure', 'https://app.example.test')
  const callback = new URL(first.searchParams.get('redirect_to'))
  callback.searchParams.set('code', 'first-flow-code')
  await completeOAuthSignIn(client, callback.href)
  assert.equal(createHash('sha256').update(requests[0].body.code_verifier).digest('base64url'), first.searchParams.get('code_challenge'))
})

for (const suffix of ['?error=access_denied', '#error=access_denied']) {
  test(`muestra una cancelación comprensible desde ${suffix}`, async () => {
    const { client, requests } = createAuthBackend()
    await assert.rejects(completeOAuthSignIn(client, `https://app.example.test/auth/callback${suffix}`), /cancelado/)
    assert.equal(requests.length, 0)
  })
}

test('no expone mensajes arbitrarios del proveedor ni acepta un código junto a un error', async () => {
  const { client, requests } = createAuthBackend()
  await assert.rejects(completeOAuthSignIn(client, 'https://app.example.test/auth/callback?code=unused&error=server_error&error_description=private-details'), (error) => {
    assert.match(error.message, /proveedor/)
    assert.doesNotMatch(error.message, /private-details/)
    return true
  })
  assert.equal(requests.length, 0)
})

test('un callback vacío no reutiliza una sesión previa', async () => {
  const { client, requests } = createAuthBackend()
  await assert.rejects(completeOAuthSignIn(client, 'https://app.example.test/auth/callback'), /no es válido/)
  assert.equal(requests.length, 0)
})

test('un código caducado muestra cómo volver a iniciar sesión', async () => {
  const { client } = createAuthBackend({ rejectExchange: true })
  const authorization = new URL(await getOAuthSignInUrl(client, 'google', 'https://app.example.test'))
  const callback = new URL(authorization.searchParams.get('redirect_to'))
  callback.searchParams.set('code', 'expired-code')
  await assert.rejects(completeOAuthSignIn(client, callback.href), /ha caducado/)
  assert.equal((await client.auth.getSession()).data.session, null)
})

test('rechaza un callback abierto en un navegador sin verificador PKCE', async () => {
  const { client, requests } = createAuthBackend()
  await assert.rejects(completeOAuthSignIn(client, 'https://app.example.test/auth/callback?code=orphan-code'), /este navegador/)
  assert.equal(requests.length, 0)
})
