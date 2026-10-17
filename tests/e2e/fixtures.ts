import { test as base, expect, type Page } from '@playwright/test'
import type { Observation } from '../../lib/types'
import { summarizeObis, type ImportBatch, type ObisRecord } from '../../lib/sightings/obis-import'
import { statisticsMock } from './statistics-mock'

export type SightingRow = Observation
type Post = { id: string; author_id: string; title: string; summary: string; content: string; references_text: string; status: string; created_at: string; updated_at: string }
type Backend = { rows: SightingRow[]; reports: Record<string, unknown>[]; denyReport: boolean; delayReport: number; profileRole: string; profileName: string; roleHistory: Record<string, unknown>[]; reviews: number; posts: Post[]; signup: Record<string, unknown> | null; recovery: Record<string, unknown> | null; scientistPending: boolean; requestsReviewed: number; importBatches: ImportBatch[]; importPayloads: ObisRecord[][]; failStatistics: boolean; statisticsRequests: number }

const user = { id: 'f686f330-5f9e-43e4-924a-99872c0f819a', email: 'reviewer@example.test', aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {}, identities: [{ provider: 'email' }], created_at: '2026-09-01T00:00:00Z' }

export const test = base.extend<{ backend: Backend }>({
  backend: [async ({ context }, use) => {
    const backend: Backend = {
      rows: Array.from({ length: 12 }, (_, i) => ({ id: `sighting-${i + 1}`, reporter_id: user.id, collaborator_role: 'Buzo', species: i === 0 ? 'Tiburón nodriza' : 'Tiburón martillo', location_name: 'Rincón, Puerto Rico', sighting_date: '2026-09-24', sighting_time: '10:30', quantity: 2, estimated_size: i === 0 ? 1.8 : null, total_length_m: null, fork_length_m: null, standard_length_m: null, interdorsal_length_m: null, sex: 'No determinado', species_other: null, behavior: 'Nadando tranquilamente', behavior_other: null, health_conditions: ['Sano / sin marcas visibles'], health_other: null, altitude: null, accuracy: null, photo_path: null, video_path: null, latitude: i === 0 ? 18.34 : null, longitude: i === 0 ? -67.25 : null, notes: null, status: 'pending' })),
       reports: [], denyReport: false, delayReport: 0, profileRole: 'admin', profileName: 'María Rivera', roleHistory: [], reviews: 0,
       posts: [], signup: null, recovery: null, scientistPending: true, requestsReviewed: 0, importBatches: [], importPayloads: [], failStatistics: false, statisticsRequests: 0,
    }
    // Ninguna prueba consulta ni modifica la instancia real de Supabase.
    await context.route('**/*', async (route) => {
      const request = route.request()
      const url = new URL(request.url())
      const json = (body: unknown, status = 200, headers = {}) => route.fulfill({ status, contentType: 'application/json', headers, body: JSON.stringify(body) })
      if (url.pathname === '/api/places') return json({ places: [{ name: 'Playa Crash Boat, Aguadilla, Puerto Rico', latitude: 18.458, longitude: -67.164 }] })
      if (url.pathname.startsWith('/storage/v1/')) {
        if (url.pathname.includes('/object/sign/')) return json({ signedURL: '/object/test-evidence.jpg' })
        return json({ Key: url.pathname, Id: 'mock-file' })
      }
      if (url.pathname.startsWith('/auth/v1/')) {
        if (url.pathname.endsWith('/signup')) { backend.signup = request.postDataJSON(); return json({ user, session: null }) }
        if (url.pathname.endsWith('/recover')) { const body = request.postDataJSON(); backend.recovery = { ...body, redirect_to: body.redirect_to ?? url.searchParams.get('redirect_to') }; return json({}) }
        if (url.pathname.endsWith('/token')) {
          const expires = Math.floor(Date.now() / 1000) + 3600
          const token = `${Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')}.${Buffer.from(JSON.stringify({ sub: user.id, exp: expires, aud: 'authenticated' })).toString('base64url')}.test-signature`
          return json({ access_token: token, refresh_token: 'fake-refresh-token', expires_in: 3600, expires_at: expires, token_type: 'bearer', user })
        }
        if (url.pathname.endsWith('/user')) return json(user)
        if (url.pathname.endsWith('/logout')) return route.fulfill({ status: 204 })
        return json({ message: 'Mocked auth endpoint' }, 400)
      }
      if (url.pathname.startsWith('/rest/v1/')) {
        if (url.pathname.endsWith('/rpc/sighting_statistics')) {
          backend.statisticsRequests += 1
          if (backend.failStatistics) return json({ message: 'Statistics unavailable' }, 503)
          if (!['admin', 'community', 'researcher', 'student'].includes(backend.profileRole)) return json({ message: 'Denied' }, 403)
          return json(statisticsMock(backend.rows, request.postDataJSON(), user.id, backend.profileRole === 'admin', backend.importBatches))
        }
        if (url.pathname.endsWith('/sighting_import_batches')) return json(backend.profileRole === 'admin' ? backend.importBatches : [])
        if (url.pathname.endsWith('/rpc/import_obis_batch')) {
          if (backend.profileRole !== 'admin') return json({ message: 'Denied' }, 403)
          const { file_name, records } = request.postDataJSON() as { file_name: string; records: ObisRecord[] }
          const found = backend.importPayloads.findIndex((previous) => JSON.stringify(previous) === JSON.stringify(records))
          if (found !== -1) return json(backend.importBatches[found].id)
          const summary = summarizeObis(records)
          const batch: ImportBatch = { id: `import-${backend.importBatches.length + 1}`, file_name, row_count: records.length, duplicate_count: summary.duplicates, status: 'pending', created_at: new Date().toISOString(), quality_summary: { missing_dates: summary.missingDates, partial_dates: summary.partialDates, invalid_years: summary.invalidYears } }
          backend.importBatches.push(batch); backend.importPayloads.push(records)
          return json(batch.id)
        }
        if (url.pathname.endsWith('/rpc/set_obis_batch_withdrawn')) {
          if (backend.profileRole !== 'admin') return json({ message: 'Denied' }, 403)
          const { batch_id, withdraw } = request.postDataJSON()
          const batch = backend.importBatches.find((item) => item.id === batch_id)
          if (!batch) return json({ message: 'Missing batch' }, 404)
          batch.status = withdraw ? 'withdrawn' : 'pending'
          return json(batch.row_count)
        }
        if (url.pathname.endsWith('/rpc/public_map_sightings')) {
          const offset = request.postDataJSON().page_offset ?? 0
          const rows = backend.rows.filter((row) => ['pending', 'verified'].includes(row.status) && !row.deleted_at && row.latitude !== null && row.longitude !== null && (!row.import_batch_id || backend.importBatches.some((batch) => batch.id === row.import_batch_id && batch.status !== 'withdrawn')))
          return json(rows.slice(offset, offset + 500).map(({ id, species, location_name, sighting_date, sighting_time, quantity, latitude, longitude, source_name, source_year, source_month, date_precision, status }) => ({ id, species, location_name, sighting_date, sighting_time, quantity, latitude, longitude, source_name, source_year, source_month, date_precision, status })))
        }
        if (url.pathname.endsWith('/rpc/submit_sighting')) {
          const { report_id, payload } = request.postDataJSON()
          const collaboratorRoles: Record<string, string> = { admin: 'Administrador', researcher: 'Científico / Investigador', community: 'Pescador / Buzo' }
          const collaboratorRole = collaboratorRoles[backend.profileRole]
          backend.reports.push({ ...payload, collaborator_role: collaboratorRole, id: report_id, reporter_id: user.id, status: 'pending' })
          if (backend.delayReport) await new Promise((resolve) => setTimeout(resolve, backend.delayReport))
          return backend.denyReport ? json({ message: 'Mock RLS denied', code: '42501' }, 403) : json(report_id)
        }
        if (url.pathname.endsWith('/sighting_contacts')) return json([])
        if (url.pathname.endsWith('/rpc/review_scientist')) {
          if (backend.profileRole !== 'admin' || !backend.scientistPending) return json({ message: 'Denied' }, 403)
          backend.scientistPending = false; backend.requestsReviewed += 1
          return json(null)
        }
        if (url.pathname.endsWith('/rpc/delete_sighting')) {
          const id = request.postDataJSON().report_id
          const row = backend.rows.find((item) => item.id === id)
          if (!row || (backend.profileRole !== 'admin' && row.reporter_id !== user.id)) return json(false)
          row.deleted_at = new Date().toISOString()
          return json(true)
        }
        if (url.pathname.endsWith('/rpc/complete_profile')) {
          const input = request.postDataJSON()
          backend.profileRole = input.selected_role === 'researcher' ? 'pending_scientist' : input.selected_role
          return json(null)
        }
        if (url.pathname.endsWith('/rpc/update_my_profile')) {
          backend.profileName = request.postDataJSON().display_name
          return json(null)
        }
        if (url.pathname.endsWith('/rpc/change_my_role')) {
          const input = request.postDataJSON()
          const previous = backend.profileRole
          backend.profileRole = input.selected_role === 'researcher' ? 'pending_scientist' : input.selected_role
          backend.roleHistory.unshift({ id: `history-${backend.roleHistory.length + 1}`, previous_role: previous, requested_role: input.selected_role, status: input.selected_role === 'researcher' ? 'pending' : 'completed', review_note: null, created_at: new Date().toISOString(), reviewed_at: null })
          return json(null)
        }
        if (url.pathname.endsWith('/profile_role_history')) return json(backend.roleHistory)
        if (url.pathname.endsWith('/profiles')) {
          if (url.searchParams.has('science_status')) {
            const rows = backend.scientistPending ? [{ id: 'scientist-request', role: 'pending_scientist', full_name: 'Ana del Mar', affiliation: 'Instituto Marino', science_status: 'pending' }] : []
            return json(rows, 200, { 'content-range': `0-${rows.length}/${rows.length}` })
          }
          return json([{ id: user.id, role: backend.profileRole, full_name: backend.profileName, science_status: backend.profileRole === 'pending_scientist' ? 'pending' : null, request_note: null }])
        }
        if (url.pathname.endsWith('/species_guides')) return json([{ id: 'guide-1', name: 'Tiburón nodriza', scientific_name: 'Ginglymostoma cirratum', description: 'Una especie de hábitos bentónicos que permite aprender sobre la vida marina.', habitat: 'Aguas costeras.', source_url: '' }], 200, { 'content-range': '0-0/1' })
        if (url.pathname.endsWith('/publications')) {
          if (request.method() === 'HEAD') return route.fulfill({ status: 200, headers: { 'content-range': `*/${backend.posts.filter((post) => post.author_id === user.id && post.status === 'draft').length}` } })
          if (request.method() === 'POST') {
            const post = { ...request.postDataJSON(), id: `post-${backend.posts.length + 1}`, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }
            backend.posts.push(post)
            return json([{ id: post.id }], 201)
          }
          if (request.method() === 'PATCH') {
            const post = backend.posts.find((p) => `eq.${p.id}` === url.searchParams.get('id'))
            if (!post) return json([])
            Object.assign(post, request.postDataJSON())
            return json([{ id: post.id }])
          }
          const rows = backend.posts.filter((post) => (!url.searchParams.has('status') || `eq.${post.status}` === url.searchParams.get('status')) && (!url.searchParams.has('author_id') || `eq.${post.author_id}` === url.searchParams.get('author_id')) && (post.status === 'published' || ['admin', 'researcher'].includes(backend.profileRole)))
          return json(rows, 200, { 'content-range': `0-${rows.length}/${rows.length}` })
        }
        if (!url.pathname.endsWith('/sightings')) return json({ message: 'Unexpected mocked table' }, 400)
        if (request.method() === 'POST') {
          backend.reports.push(request.postDataJSON())
          if (backend.delayReport) await new Promise((resolve) => setTimeout(resolve, backend.delayReport))
          return backend.denyReport ? json({ message: 'Mock RLS denied', code: '42501' }, 403) : route.fulfill({ status: 201 })
        }
        const status = url.searchParams.get('status')?.replace('eq.', '')
        const id = url.searchParams.get('id')?.replace('eq.', '')
        const rows = backend.rows.filter((row) => (!status || row.status === status) && (!id || row.id === id) && (url.searchParams.get('deleted_at') !== 'is.null' || !row.deleted_at) && (!url.searchParams.has('latitude') || (row.latitude !== null && row.longitude !== null)))
        if (request.method() === 'HEAD') return route.fulfill({ status: 200, headers: { 'content-range': `*/${rows.length}`, 'access-control-expose-headers': 'content-range' } })
        if (request.method() === 'PATCH') {
          const changes = request.postDataJSON()
          if ('status' in changes) backend.reviews += 1
          rows.forEach((row) => Object.assign(row, changes))
          if (request.headers()['accept']?.includes('vnd.pgrst.object')) return rows[0] ? json(rows[0]) : json({ message: 'No rows' }, 406)
          return json(rows.map((row) => ({ id: row.id })))
        }
        const offset = Number(url.searchParams.get('offset') ?? 0)
        const limit = Number(url.searchParams.get('limit') ?? 10)
        if (id && (url.searchParams.get('select') === '*' || request.headers()['accept']?.includes('vnd.pgrst.object'))) return rows[0] ? json(rows[0]) : json({ message: 'No rows' }, 406)
        return json(rows.slice(offset, offset + limit))
      }
      if (url.hostname.endsWith('tile.openstreetmap.org') || url.hostname === 'server.arcgisonline.com') {
        return route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" fill="#eaf4fc"/><path d="M0 128H256M128 0V256" stroke="#d6e3ef"/></svg>' })
      }
      return route.continue()
    })
    await use(backend)
  }, { auto: true }],
})

export { expect }

export async function openSiteMenu(page: Page) {
  const toggle = page.getByRole('button', { name: 'Abrir menú', exact: true })
  if (await toggle.isVisible()) await toggle.click()
}

export async function login(page: Page) {
  await page.goto('/login')
  await page.getByLabel('Correo electrónico').fill('reviewer@example.test')
  await page.getByLabel('Contraseña', { exact: true }).fill('test-password')
  await page.getByRole('button', { name: 'Iniciar sesión', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Panel de revisión', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Actualizar', exact: true })).toBeEnabled()
  await expect(page.getByRole('navigation', { name: 'Paginación de avistamientos' })).toBeVisible()
}

export async function fillReport(page: Page) {
  await page.getByLabel('Especie de tiburón observada', { exact: false }).selectOption('Tiburón gata (Ginglymostoma cirratum)')
  await page.getByLabel('Fecha del avistamiento').fill('2026-09-24')
  await page.getByLabel('Hora del avistamiento').fill('10:30')
  await page.getByLabel('Cantidad de individuos').fill('2')
  await page.getByLabel('Nombre de la ubicación').fill('Rincón, Puerto Rico')
  await page.getByLabel('Latitud', { exact: false }).fill('18.34')
  await page.getByRole('spinbutton', { name: 'Longitud', exact: true }).fill('-67.25')
  await page.getByRole('radio', { name: 'Nadando tranquilamente' }).check()
  await page.getByRole('checkbox', { name: 'Sano / sin marcas visibles' }).check()
}
