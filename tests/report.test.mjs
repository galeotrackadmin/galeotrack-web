import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createClient } from '@supabase/supabase-js'
import { sightingSchema, coordinateValue, REPORT_DEFAULTS, SPECIES } from '../lib/sightings/schema.ts'
import { createSighting } from '../lib/sightings/create-sighting.ts'
import { evidencePath, validateEvidence, MAX_EVIDENCE_BYTES } from '../lib/sightings/media.ts'
import { loadMapSightings, groupMapSightings } from '../lib/sightings/map-data.ts'

const valid = { ...REPORT_DEFAULTS, species: SPECIES[0], location_name: ' Rincón ', sighting_date: '2026-09-24', sighting_time: '10:30', quantity: '2', latitude: '18.34', longitude: '-67.25', behavior: 'Nadando tranquilamente', health_conditions: ['Sano / sin marcas visibles'] }
const user = { id: 'f686f330-5f9e-43e4-924a-99872c0f819a', email: 'diver@example.test', aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-09-01T00:00:00Z' }
function backend({ role = 'community', denied = false, failUpload = false } = {}) {
  const requests = []
  const client = createClient('https://report.example.test', 'public-anon-key', {
    auth: { autoRefreshToken: false, detectSessionInUrl: false, storage: {
      getItem: () => JSON.stringify({ user, access_token: 'test-token', refresh_token: 'test-refresh', token_type: 'bearer', expires_at: Math.floor(Date.now() / 1000) + 3600 }), setItem: () => {}, removeItem: () => {},
    } },
    global: { fetch: async (input, init) => {
      const url = new URL(String(input))
      const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } })
      if (url.pathname === '/auth/v1/user') return json(user)
      if (url.pathname === '/rest/v1/profiles') return json([{ role, full_name: 'Buzo de prueba', science_status: null }])
      const body = typeof init.body === 'string' ? JSON.parse(init.body) : init.body
      requests.push({ url, method: init.method, body, headers: new Headers(init.headers) })
      if (url.pathname.startsWith('/storage/v1/')) return failUpload && init.method === 'POST' ? json({ statusCode: 500, message: 'upload failed' }, 500) : json({ Key: 'uploaded', data: [] })
      assert.equal(url.pathname, '/rest/v1/rpc/submit_sighting')
      return denied ? json({ code: '42501', message: 'private database detail' }, 403) : json(body.report_id)
    } },
  })
  return { client, requests }
}

test('envío en pies, sin archivos ni contacto: normaliza unidades y evita campos de permisos inyectados', async () => {
  const { client, requests } = backend()
  await createSighting(client, { ...valid, total_length_ft: '6.5', fork_length_ft: '5', status: 'verified', reporter_id: 'other', collaborator_role: 'Administrador', contact_email: 'ignored@example.test' })
  assert.equal(requests.length, 1)
  const payload = requests[0].body.payload
  assert.equal(requests[0].headers.get('apikey'), 'public-anon-key')
  assert.equal(payload.total_length_m, 1.9812)
  assert.equal(payload.fork_length_m, 1.524)
  assert.equal(payload.standard_length_m, null)
  assert.equal(payload.altitude, null)
  assert.equal(payload.photo_path, null)
  assert.equal(payload.contact, null)
  assert.equal(payload.location_name, 'Rincón')
  assert.equal(payload.status, undefined)
  assert.equal(payload.reporter_id, undefined)
  assert.equal(payload.collaborator_role, undefined, 'el navegador no asigna el rol; lo deriva Supabase')
})
test('científico aprobado y administrador pueden reportar', async () => {
  for (const role of ['researcher', 'admin']) { const { client, requests } = backend({ role }); await createSighting(client, valid); assert.equal(requests.length, 1) }
})
for (const role of ['student', 'pending_scientist', 'unassigned']) test(`${role} no crea avistamientos`, async () => {
  const { client, requests } = backend({ role }); await assert.rejects(createSighting(client, valid)); assert.equal(requests.length, 0)
})
test('solo envía datos de contacto cuando hay consentimiento y detalles de Otro cuando corresponden', async () => {
  const { client, requests } = backend()
  await createSighting(client, { ...valid, contact_consent: 'yes', contact_name: ' Ana ', contact_email: 'ana@example.test', species_other: 'dato obsoleto' })
  assert.deepEqual(requests[0].body.payload.contact, { name: 'Ana', email: 'ana@example.test', phone: null })
  assert.equal(requests[0].body.payload.species_other, null)
})
for (const [field, value] of [
  ['species', ''], ['location_name', ' '], ['sighting_date', '2026-02-30'], ['sighting_date', '2099-01-01'],
  ['sighting_time', '24:00'], ['sighting_time', ''], ['quantity', 0], ['quantity', 1.5], ['quantity', Infinity],
  ['total_length_ft', -1], ['total_length_ft', 'abc'], ['fork_length_ft', 0], ['latitude', 91], ['longitude', -181], ['latitude', ''],
  ['accuracy', -1], ['sex', 'unknown'], ['behavior', 'otro inventado'], ['health_conditions', []], ['notes', 'x'.repeat(3001)],
]) test(`rechaza ${field} inválido (${String(value).slice(0, 20)}) antes de enviar`, async () => {
  const { client, requests } = backend(); await assert.rejects(createSighting(client, { ...valid, [field]: value })); assert.equal(requests.length, 0)
})
test('valida Otro, contacto condicional y condiciones de salud incompatibles', () => {
  for (const patch of [{ species: 'Otro' }, { behavior: 'Otro' }, { health_conditions: ['Otro'] }, { contact_consent: 'yes' }, { health_conditions: ['Sano / sin marcas visibles', 'Heridas o cicatrices'] }]) assert.equal(sightingSchema.safeParse({ ...valid, ...patch }).success, false)
  assert.equal(sightingSchema.safeParse({ ...valid, health_conditions: ['Heridas o cicatrices', 'Anzuelo / red / basura enganchada'] }).success, true)
})
test('cero es una coordenada válida; los opcionales vacíos no se guardan como cero', () => {
  const data = sightingSchema.parse({ ...valid, latitude: '0', longitude: '0', altitude: ' ', accuracy: '0' })
  assert.equal(data.latitude, 0); assert.equal(data.longitude, 0); assert.equal(data.altitude, undefined); assert.equal(data.accuracy, 0); assert.equal(data.total_length_ft, undefined)
  assert.equal(coordinateValue('abc', -90, 90), undefined)
})
test('validación de tipos y tamaños; rutas estables según contenido, sin nombres de archivo privados', async () => {
  const file = new File(['photo'], 'private-name.jpg', { type: 'image/jpeg' })
  const path = await evidencePath(file, 'photo', user.id, 'report-id')
  assert.equal(path, await evidencePath(file, 'photo', user.id, 'report-id'))
  assert.doesNotMatch(path, /private-name/)
  assert.throws(() => validateEvidence(new File(['<svg/>'], 'x.svg', { type: 'image/svg+xml' }), 'photo'))
  assert.throws(() => validateEvidence(new File([], 'x.png', { type: 'image/png' }), 'photo'))
  assert.throws(() => validateEvidence({ type: 'video/mp4', size: MAX_EVIDENCE_BYTES + 1 }, 'video'))
})
test('sube la evidencia antes de guardar, mantiene el id de reintento y limpia tras rechazo', async () => {
  const { client, requests } = backend({ denied: true })
  const file = new File(['photo'], 'x.jpg', { type: 'image/jpeg' })
  await assert.rejects(createSighting(client, valid, { photo: file }, 'fixed-request'), /Tus datos siguen aquí/)
  assert.equal(requests[0].method, 'POST')
  assert.equal(requests[1].body.report_id, 'fixed-request')
  assert.match(requests[1].body.payload.photo_path, /fixed-request\/photo-/)
  assert.equal(requests[2].method, 'DELETE')
})
test('un fallo al subir no crea un registro incompleto', async () => {
  const { client, requests } = backend({ failUpload: true })
  await assert.rejects(createSighting(client, valid, { photo: new File(['x'], 'x.jpg', { type: 'image/jpeg' }) }))
  assert.equal(requests.some(({ url }) => url.pathname.includes('/rpc/')), false)
})
test('el mapa carga más de 1000 registros con paginación propia y conserva filtros', async () => {
  const requests = []
  const client = createClient('https://map.example.test', 'public-key', { auth: { persistSession: false }, global: { fetch: async (input) => {
    const url = new URL(String(input)); requests.push(url)
    const offset = Number(url.searchParams.get('offset'))
    const rows = Array.from({ length: Math.min(500, 1101 - offset) }, (_, i) => ({ id: String(offset + i), latitude: 18.34, longitude: -67.25, status: 'pending' }))
    return new Response(JSON.stringify(rows), { headers: { 'content-type': 'application/json' } })
  } } })
  const rows = await loadMapSightings(client, 'pending', user.id)
  assert.equal(rows.length, 1101)
  assert.equal(requests.length, 3)
  for (const url of requests) { assert.equal(url.searchParams.get('status'), 'eq.pending'); assert.equal(url.searchParams.get('reporter_id'), `eq.${user.id}`); assert.equal(url.searchParams.get('latitude'), 'not.is.null') }
  assert.equal(groupMapSightings(rows, 10)[0].sightings.length, 1101)
})
