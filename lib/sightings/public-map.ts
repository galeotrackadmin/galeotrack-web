import type { SupabaseClient } from '@supabase/supabase-js'
import type { MapSighting } from '../types'
import { formatImportedDate } from './import-date.ts'

export type PublicMapSighting = Omit<MapSighting, 'status' | 'photo_path'> & { status: 'pending' | 'verified' }

export async function loadPublicMapSightings(client: SupabaseClient, signal?: AbortSignal): Promise<PublicMapSighting[]> {
  const rows: PublicMapSighting[] = []
  for (let offset = 0; ; offset += 500) {
    signal?.throwIfAborted()
    let query = client.rpc('public_map_sightings', { page_offset: offset })
    if (signal) query = query.abortSignal(signal)
    const { data, error } = await query.overrideTypes<PublicMapSighting[], { merge: false }>()
    if (error?.code === 'PGRST202') throw new Error('El mapa público está pendiente de configuración en Supabase. Aún no se pueden cargar los avistamientos.')
    if (error || !Array.isArray(data)) throw new Error('No se pudieron cargar los avistamientos. Vuelve a intentarlo en unos momentos.')
    if (!data.length) break
    if (data.some((row) => !row || row.status === undefined)) throw new Error('Actualiza el mapa público en Supabase: aplica 202610160002_public_map_review_states.sql para mostrar el estado real de cada avistamiento.')
    rows.push(...data.filter((row) => (row.status === 'pending' || row.status === 'verified') && Number.isFinite(row.latitude) && Number.isFinite(row.longitude) && Math.abs(row.latitude) <= 90 && Math.abs(row.longitude) <= 180))
    if (data.length < 500) break
  }
  return Array.from(new Map(rows.map((row) => [row.id, row])).values())
}

export function formatSightingDate(value: string | null, row?: Pick<MapSighting, 'source_year' | 'source_month' | 'date_precision'>) {
  const partial = row && formatImportedDate(row)
  if (partial) return partial
  if (!value) return 'Sin fecha registrada'
  const date = new Date(`${value}T12:00:00`)
  if (Number.isNaN(date.getTime())) return 'Sin fecha registrada'
  return new Intl.DateTimeFormat('es-PR', { day: 'numeric', month: 'short', year: 'numeric' }).format(date)
}
