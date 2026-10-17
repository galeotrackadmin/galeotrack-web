import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  DashboardData,
  Reviewer,
  ReviewerRole,
  ReviewStatus,
  Sighting,
  SightingFilter,
  SightingStatus,
} from './types'

export const PAGE_SIZE = 10

const SIGHTING_COLUMNS =
  'id, reporter_id, species, location_name, sighting_date, quantity, estimated_size, latitude, longitude, behavior, notes, status, import_batch_id, source_name, source_year, source_month, date_precision'

export class AdminAccessError extends Error {
  constructor(message = 'Tu sesión terminó o no tienes acceso al panel.') {
    super(message)
    this.name = 'AdminAccessError'
  }
}

function isReviewerRole(role: unknown): role is ReviewerRole {
  return role === 'admin'
}

export async function getReviewer(client: SupabaseClient): Promise<Reviewer> {
  const { data: { user }, error } = await client.auth.getUser()

  if (error || !user) {
    throw new AdminAccessError()
  }

  const { data: profile, error: profileError } = await client
    .from('profiles')
    .select('role, full_name')
    .eq('id', user.id)
    .maybeSingle<{ role: string | null; full_name: string | null }>()

  if (profileError) {
    throw new Error('No se pudo comprobar tu perfil. Inténtalo de nuevo.')
  }

  if (!profile || !isReviewerRole(profile.role)) {
    throw new AdminAccessError('Tu perfil no tiene acceso al panel.')
  }

  return {
    id: user.id,
    email: user.email ?? '',
    fullName: profile.full_name ?? '',
    role: profile.role,
  }
}

async function countSightings(client: SupabaseClient, status: SightingStatus, reporterId?: string) {
  let query = client
    .from('sightings')
    .select('id', { count: 'exact', head: true })
    .eq('status', status)
    .is('deleted_at', null)
  if (reporterId) query = query.eq('reporter_id', reporterId)
  const { count, error } = await query

  if (error || count === null) {
    throw new Error('No se pudieron cargar los totales de avistamientos.')
  }

  return count
}

export async function loadDashboard(
  client: SupabaseClient,
  filter: SightingFilter,
  requestedPage: number,
  reporterId?: string,
): Promise<DashboardData> {
  const [pending, verified, rejected] = await Promise.all([
    countSightings(client, 'pending', reporterId),
    countSightings(client, 'verified', reporterId),
    countSightings(client, 'rejected', reporterId),
  ])
  const counts = { pending, verified, rejected }
  const total = filter === 'all' ? pending + verified + rejected : counts[filter]
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  // Una revisión puede vaciar la última página del filtro de pendientes.
  const page = Math.min(Math.max(1, requestedPage), totalPages)

  let query = client.from('sightings').select(SIGHTING_COLUMNS).is('deleted_at', null)
  if (reporterId) query = query.eq('reporter_id', reporterId)

  if (filter !== 'all') {
    query = query.eq('status', filter)
  }

  const from = (page - 1) * PAGE_SIZE
  const { data, error } = await query
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .range(from, from + PAGE_SIZE - 1)
    .returns<Sighting[]>()

  if (error) {
    throw new Error('No se pudieron cargar los avistamientos. Inténtalo de nuevo.')
  }

  return { sightings: data ?? [], counts, total, page, totalPages }
}

export async function reviewSighting(
  client: SupabaseClient,
  id: string,
  status: ReviewStatus
): Promise<boolean> {
  const reviewer = await getReviewer(client)
  const reviewedAt = new Date().toISOString()

  const { data, error } = await client
    .from('sightings')
    .update({
      status,
      verified_by: reviewer.id,
      verified_at: reviewedAt,
      updated_at: reviewedAt,
    })
    .eq('id', id)
    .eq('status', 'pending')
    .select('id')
    .maybeSingle<{ id: string }>()

  if (error) {
    throw new Error('No se pudo actualizar el avistamiento. Inténtalo de nuevo.')
  }

  // Cero filas no es un éxito: pudo revisarse en otra sesión o no ser editable.
  return data !== null
}

export async function deleteSighting(client: SupabaseClient, id: string): Promise<void> {
  const { data, error } = await client.rpc('delete_sighting', { report_id: id })
  if (error) throw new Error('No se pudo eliminar el avistamiento. Comprueba tus permisos e inténtalo de nuevo.')
  if (data !== true) throw new Error('El avistamiento ya no existe o no tienes permiso para eliminarlo.')
}
