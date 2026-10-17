import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createClient } from '@supabase/supabase-js'
import { AdminAccessError, getReviewer, loadDashboard, reviewSighting } from '../lib/admin.ts'

const user = {
  id: 'f686f330-5f9e-43e4-924a-99872c0f819a',
  email: 'reviewer@example.test',
  aud: 'authenticated',
  role: 'authenticated',
  app_metadata: {},
  user_metadata: {},
  created_at: '2026-09-01T00:00:00.000Z',
}

function sighting(id, status = 'pending') {
  return {
    id: String(id),
    species: 'Especie de prueba',
    location_name: 'Ubicación de prueba',
    sighting_date: '2026-09-24',
    quantity: 1,
    behavior: null,
    notes: null,
    status,
    created_at: '2026-09-24T00:00:00.000Z',
  }
}

// Se usa el SDK real, incluida Auth, contra un transporte HTTP en memoria.
// Solo se simulan respuestas del servidor; no se sustituyen las consultas.
function createBackend(options = {}) {
  const state = {
    authenticated: true,
    profile: { role: 'admin', full_name: 'Revisor de prueba' },
    rows: [],
    authError: false,
    profileError: false,
    countError: false,
    missingCount: false,
    listError: false,
    updateError: false,
    editable: true,
    ...options,
  }
  const requests = []
  let storedSession = state.authenticated ? JSON.stringify({
    access_token: 'test-access-token',
    refresh_token: 'test-refresh-token',
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    user,
  }) : null

  function json(data, status = 200) {
    return new Response(JSON.stringify(data), {
      status,
      headers: { 'content-type': 'application/json' },
    })
  }

  const client = createClient('https://galeotrack.example.test', 'test-anon-key', {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      storage: {
        getItem: () => storedSession,
        setItem: (_key, value) => { storedSession = value },
        removeItem: () => { storedSession = null },
      },
    },
    global: {
      fetch: async (input, init = {}) => {
        const url = new URL(String(input))
        const method = init.method ?? 'GET'
        const headers = new Headers(init.headers)
        const body = init.body ? JSON.parse(init.body) : null
        requests.push({ url, method, headers, body })

        if (url.pathname === '/auth/v1/user') {
          return state.authError
            ? json({ message: 'Invalid token', code: 'bad_jwt' }, 401)
            : json(user)
        }

        if (url.pathname === '/rest/v1/profiles') {
          if (state.profileError) return json({ message: 'Profile unavailable' }, 403)
          return json(state.profile ? [state.profile] : [])
        }

        assert.equal(url.pathname, '/rest/v1/sightings', 'Petición inesperada')
        const statusFilter = url.searchParams.get('status')?.replace(/^eq\./, '')
        const idFilter = url.searchParams.get('id')?.replace(/^eq\./, '')
        const matching = state.rows.filter((row) =>
          (!statusFilter || row.status === statusFilter) && (!idFilter || row.id === idFilter)
        )

        if (method === 'HEAD') {
          if (state.countError) return new Response(null, { status: 403 })
          return new Response(null, {
            headers: state.missingCount ? {} : { 'content-range': `*/${matching.length}` },
          })
        }

        if (method === 'PATCH') {
          if (state.updateError) return json({ message: 'Update denied', code: '42501' }, 403)
          if (!state.editable) return json([])
          // La condición y el cambio se aplican juntos, como un UPDATE de Postgres.
          for (const row of matching) Object.assign(row, body)
          return json(matching.map(({ id }) => ({ id })))
        }

        assert.equal(method, 'GET')
        if (state.listError) return json({ message: 'Read denied' }, 403)
        const offset = Number(url.searchParams.get('offset') ?? 0)
        const limit = Number(url.searchParams.get('limit') ?? 1000)
        return json(matching.slice(offset, offset + limit))
      },
    },
  })

  return { client, state, requests }
}

for (const role of ['admin']) {
  test(`permite consultar el panel con rol ${role}`, async () => {
    const { client, requests } = createBackend({ profile: { role, full_name: 'María' } })
    const reviewer = await getReviewer(client)

    assert.deepEqual(reviewer, { id: user.id, email: user.email, fullName: 'María', role })
    const profileRequest = requests.find(({ url }) => url.pathname.endsWith('/profiles'))
    assert.equal(profileRequest.url.searchParams.get('id'), `eq.${user.id}`)
  })

  for (const status of ['verified', 'rejected']) {
    test(`${role} puede cambiar un pendiente a ${status} y registrar la revisión`, async () => {
      const row = sighting('one')
      const { client, requests } = createBackend({ profile: { role, full_name: null }, rows: [row] })

      assert.equal(await reviewSighting(client, row.id, status), true)
      assert.equal(row.status, status)
      assert.equal(row.verified_by, user.id)
      assert.equal(row.verified_at, row.updated_at)
      assert.ok(Number.isFinite(Date.parse(row.verified_at)))

      const update = requests.find(({ method }) => method === 'PATCH')
      assert.equal(update.url.searchParams.get('id'), 'eq.one')
      assert.equal(update.url.searchParams.get('status'), 'eq.pending')
      assert.equal(update.url.searchParams.get('select'), 'id')
      assert.match(update.headers.get('prefer'), /return=representation/)
    })
  }
}

test('una sesión ausente no consulta datos ni permite revisar', async () => {
  const { client, requests } = createBackend({ authenticated: false })
  await assert.rejects(getReviewer(client), AdminAccessError)
  await assert.rejects(reviewSighting(client, 'one', 'verified'), AdminAccessError)
  assert.equal(requests.length, 0)
})

test('un token rechazado no consulta el perfil ni actualiza registros', async () => {
  const { client, requests } = createBackend({ authError: true })
  await assert.rejects(reviewSighting(client, 'one', 'verified'), AdminAccessError)
  assert.ok(requests.every(({ url }) => url.pathname === '/auth/v1/user'))
})

for (const role of ['researcher', 'student', 'community', 'pending_scientist', 'unassigned', 'observer', 'ADMIN', '', null]) {
  test(`el rol ${JSON.stringify(role)} no permite acceder ni revisar`, async () => {
    const { client, requests } = createBackend({ profile: { role, full_name: null } })
    await assert.rejects(getReviewer(client), AdminAccessError)
    await assert.rejects(reviewSighting(client, 'one', 'verified'), AdminAccessError)
    assert.equal(requests.some(({ method }) => method === 'PATCH'), false)
  })
}

test('un usuario sin perfil no puede acceder', async () => {
  const { client } = createBackend({ profile: null })
  await assert.rejects(getReviewer(client), AdminAccessError)
})

test('un fallo al consultar el perfil se puede reintentar y no se confunde con un rol denegado', async () => {
  const { client, state } = createBackend({ profileError: true })
  await assert.rejects(getReviewer(client), (error) =>
    !(error instanceof AdminAccessError) && /comprobar tu perfil/.test(error.message)
  )
  state.profileError = false
  assert.equal((await getReviewer(client)).role, 'admin')
})

test('los conteos superan el límite de 1000 filas y no dependen de la página', async () => {
  const rows = [
    ...Array.from({ length: 1205 }, (_, i) => sighting(i)),
    ...Array.from({ length: 20 }, (_, i) => sighting(`v${i}`, 'verified')),
    sighting('r', 'rejected'),
  ]
  const { client, requests } = createBackend({ rows })
  const data = await loadDashboard(client, 'all', 2)

  assert.deepEqual(data.counts, { pending: 1205, verified: 20, rejected: 1 })
  assert.equal(data.total, 1226)
  assert.equal(data.totalPages, 123)
  assert.equal(data.sightings.length, 10)
  assert.equal(data.sightings[0].id, '10')
  assert.equal(data.sightings.at(-1).id, '19')

  const counts = requests.filter(({ method }) => method === 'HEAD')
  assert.equal(counts.length, 3)
  for (const request of counts) assert.match(request.headers.get('prefer'), /count=exact/)
  const list = requests.find(({ method, url }) => method === 'GET' && url.pathname.endsWith('/sightings'))
  assert.equal(list.url.searchParams.get('order'), 'created_at.desc,id.desc')
  assert.equal(list.url.searchParams.get('select').includes('*'), false)
  assert.equal(list.url.searchParams.has('status'), false)
})

for (const filter of ['pending', 'verified', 'rejected']) {
  test(`el filtro ${filter} se aplica en la consulta sin alterar los totales globales`, async () => {
    const rows = [sighting('p'), sighting('v', 'verified'), sighting('r', 'rejected')]
    const { client, requests } = createBackend({ rows })
    const data = await loadDashboard(client, filter, 1)

    assert.deepEqual(data.counts, { pending: 1, verified: 1, rejected: 1 })
    assert.equal(data.total, 1)
    assert.equal(data.sightings.length, 1)
    assert.equal(data.sightings[0].status, filter)
    const list = requests.find(({ method, url }) => method === 'GET' && url.pathname.endsWith('/sightings'))
    assert.equal(list.url.searchParams.get('status'), `eq.${filter}`)
  })
}

test('un listado vacío conserva una página válida', async () => {
  const { client } = createBackend()
  const data = await loadDashboard(client, 'pending', 9)
  assert.equal(data.page, 1)
  assert.equal(data.totalPages, 1)
  assert.equal(data.total, 0)
  assert.deepEqual(data.sightings, [])
})

test('revisar el último pendiente de una página vuelve a una página válida', async () => {
  const rows = Array.from({ length: 11 }, (_, i) => sighting(i))
  const { client } = createBackend({ rows })
  const before = await loadDashboard(client, 'pending', 2)
  assert.equal(before.sightings.length, 1)

  await reviewSighting(client, before.sightings[0].id, 'verified')
  const after = await loadDashboard(client, 'pending', 2)
  assert.equal(after.page, 1)
  assert.equal(after.totalPages, 1)
  assert.equal(after.sightings.length, 10)
  assert.deepEqual(after.counts, { pending: 10, verified: 1, rejected: 0 })
})

test('dos revisiones concurrentes no sobrescriben el primer resultado', async () => {
  const row = sighting('one')
  const { client } = createBackend({ rows: [row] })
  const results = await Promise.all([
    reviewSighting(client, row.id, 'verified'),
    reviewSighting(client, row.id, 'rejected'),
  ])

  assert.equal(results.filter(Boolean).length, 1)
  assert.equal(row.status, results[0] ? 'verified' : 'rejected')
})

for (const status of ['verified', 'rejected']) {
  test(`un registro ${status} no se vuelve a revisar`, async () => {
    const row = sighting('one', status)
    const { client } = createBackend({ rows: [row] })
    assert.equal(await reviewSighting(client, row.id, 'verified'), false)
    assert.equal(row.status, status)
    assert.equal(row.verified_by, undefined)
  })
}

test('un registro inexistente no se anuncia como actualizado', async () => {
  const { client } = createBackend()
  assert.equal(await reviewSighting(client, 'missing', 'rejected'), false)
})

test('una actualización sin filas editables no se anuncia como exitosa', async () => {
  const row = sighting('one')
  const { client } = createBackend({ rows: [row], editable: false })
  assert.equal(await reviewSighting(client, row.id, 'verified'), false)
  assert.equal(row.status, 'pending')
})

test('un error de actualización se informa y deja el registro pendiente', async () => {
  const row = sighting('one')
  const { client } = createBackend({ rows: [row], updateError: true })
  await assert.rejects(reviewSighting(client, row.id, 'verified'), /No se pudo actualizar/)
  assert.equal(row.status, 'pending')
})

test('cada revisión vuelve a comprobar el rol aunque el usuario ya entró al panel', async () => {
  const { client, state, requests } = createBackend({ rows: [sighting('one')] })
  await getReviewer(client)
  state.profile.role = 'observer'
  await assert.rejects(reviewSighting(client, 'one', 'verified'), AdminAccessError)
  assert.equal(requests.some(({ method }) => method === 'PATCH'), false)
})

for (const failure of ['countError', 'missingCount', 'listError']) {
  test(`un fallo ${failure} no se presenta como un listado vacío ni como totales cero`, async () => {
    const { client } = createBackend({ [failure]: true })
    await assert.rejects(loadDashboard(client, 'all', 1), /No se pudieron cargar/)
  })
}
