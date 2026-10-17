import { z } from 'zod'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Mode } from '../access.ts'
import type { SightingFilter } from '../types.ts'

const count = z.number().int().nonnegative()
const sourceKey = z.enum(['community', 'obis', 'other', 'unknown'])
const visualHealthSchema = z.object({
  without_marks: count, with_signs: count, unknown: count,
  signs: z.object({ wounds: count, entanglement: count, parasites: count, other: count }),
})
const statisticsSchema = z.object({
  total: count, pending: count, verified: count, rejected: count, distinct_taxa: count, years_with_records: count,
  quality: z.object({ without_year: count, incomplete_date: count, partial_date: count, missing_coordinates: count, possible_duplicates: count, taxonomy_unreviewed: count, unidentified: count, with_warnings: count }),
  by_year: z.array(z.object({ year: z.number().int().min(1).max(9999).nullable(), count })),
  by_taxon: z.array(z.object({ label: z.string(), count })),
  by_source: z.array(z.object({ source: sourceKey, count })),
  visual_health: visualHealthSchema.optional(),
  options: z.object({ years: z.array(z.number().int().min(1).max(9999)), taxa: z.array(z.string()) }),
  batches: z.object({ active: count, withdrawn: count }).nullable(), generated_at: z.string(),
})

export type SightingStatistics = z.infer<typeof statisticsSchema>
export type VisualHealthStatistics = z.infer<typeof visualHealthSchema>
export const HEALTH_LABELS = { without_marks: 'Sin marcas visibles', with_signs: 'Con signos reportados', unknown: 'Sin información concluyente' } as const
export const HEALTH_SIGN_LABELS = { wounds: 'Heridas o cicatrices', entanglement: 'Anzuelo, red o basura enganchada', parasites: 'Ectoparásitos visibles', other: 'Otras condiciones descritas' } as const
export type StatisticsFilters = {
  status: SightingFilter; source: 'all' | z.infer<typeof sourceKey>; year: number | null;
  taxon: string; ownOnly: boolean; excludeDuplicates: boolean
}
export const SOURCE_LABELS: Record<StatisticsFilters['source'], string> = {
  all: 'Todas las fuentes', community: 'Comunidad GaleoTrack', obis: 'OBIS', other: 'Otras fuentes históricas', unknown: 'Sin fuente documentada',
}

export function defaultStatisticsFilters(mode: Mode): StatisticsFilters {
  return { status: mode === 'student' || mode === 'researcher' ? 'verified' : 'all', source: 'all', year: null, taxon: '', ownOnly: mode === 'community', excludeDuplicates: false }
}

export async function loadSightingStatistics(client: SupabaseClient, filters: StatisticsFilters, signal?: AbortSignal): Promise<SightingStatistics> {
  let query = client.rpc('sighting_statistics', {
    selected_status: filters.status, selected_source: filters.source, selected_year: filters.year,
    selected_taxon: filters.taxon || null, own_only: filters.ownOnly, exclude_duplicates: filters.excludeDuplicates,
  })
  if (signal) query = query.abortSignal(signal)
  const { data, error } = await query
  if (error?.code === 'PGRST202') throw new Error('Las estadísticas están pendientes de configurar: aplica 202610160001_sighting_statistics.sql en Supabase.')
  if (error) throw new Error('No se pudieron cargar las estadísticas. Comprueba tu acceso y vuelve a intentarlo.')
  const parsed = statisticsSchema.safeParse(data)
  if (!parsed.success) throw new Error('Las estadísticas recibidas están incompletas. Actualiza el resumen o comprueba la migración de Supabase.')
  const stats = parsed.data
  if (stats.pending + stats.verified + stats.rejected !== stats.total ||
    [stats.by_year, stats.by_taxon, stats.by_source].some((series) => series.reduce((sum, point) => sum + point.count, 0) !== stats.total)) {
    throw new Error('El resumen no coincide con sus totales. Vuelve a actualizar las estadísticas.')
  }
  const health = stats.visual_health
  if (health && (health.without_marks + health.with_signs + health.unknown !== stats.total ||
    Object.values(health.signs).some((value) => value > health.with_signs) ||
    Object.values(health.signs).reduce((sum, value) => sum + value, 0) < health.with_signs)) {
    throw new Error('El resumen de salud visual no coincide con sus totales. Vuelve a actualizar las estadísticas.')
  }
  return stats
}
