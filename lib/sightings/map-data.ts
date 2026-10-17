import type { SupabaseClient } from '@supabase/supabase-js'
import type { MapSighting, SightingFilter } from '../types'

export const MAP_PAGE_SIZE = 500
export async function loadMapSightings(client: SupabaseClient, filter: SightingFilter, reporterId?: string, signal?: AbortSignal): Promise<MapSighting[]> {
  const rows: MapSighting[] = []
  // Paginación independiente del listado y del límite de filas de PostgREST.
  for (let offset = 0; ; offset += MAP_PAGE_SIZE) {
    signal?.throwIfAborted()
    let query = client.from('sightings').select('id, species, location_name, sighting_date, sighting_time, photo_path, quantity, latitude, longitude, status, source_name, source_year, source_month, date_precision')
      .is('deleted_at', null).not('latitude', 'is', null).not('longitude', 'is', null).order('id').range(offset, offset + MAP_PAGE_SIZE - 1)
    if (filter !== 'all') query = query.eq('status', filter)
    if (reporterId) query = query.eq('reporter_id', reporterId)
    if (signal) query = query.abortSignal(signal)
    const { data, error } = await query.returns<MapSighting[]>()
    if (error) throw new Error('No se pudieron cargar los puntos del mapa. Inténtalo de nuevo.')
    if (!data?.length) break
    rows.push(...data.filter((row) => Number.isFinite(row.latitude) && Number.isFinite(row.longitude) && Math.abs(row.latitude) <= 90 && Math.abs(row.longitude) <= 180))
    if (data.length < MAP_PAGE_SIZE) break
  }
  return Array.from(new Map(rows.map((row) => [row.id, row])).values())
}

export function groupMapSightings<T extends MapSighting>(rows: T[], zoom: number) {
  const scale = 256 * 2 ** zoom
  const groups = new Map<string, T[]>()
  for (const row of rows) {
    const sin = Math.sin(Math.max(-85, Math.min(85, row.latitude)) * Math.PI / 180)
    const x = (row.longitude + 180) / 360 * scale
    const y = (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * scale
    const key = `${Math.floor(x / 48)}:${Math.floor(y / 48)}`
    const group = groups.get(key) ?? []
    group.push(row); groups.set(key, group)
  }
  return Array.from(groups, ([key, sightings]) => ({
    key, sightings,
    latitude: sightings.reduce((total, row) => total + row.latitude, 0) / sightings.length,
    longitude: sightings.reduce((total, row) => total + row.longitude, 0) / sightings.length,
  }))
}
