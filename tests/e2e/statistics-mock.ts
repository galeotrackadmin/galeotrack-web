import type { Observation } from '../../lib/types'
import type { SightingStatistics } from '../../lib/sightings/statistics'
import type { ImportBatch } from '../../lib/sightings/obis-import'

export function statisticsMock(rows: Observation[], input: Record<string, unknown>, userId: string, isAdmin: boolean, batches: ImportBatch[]): SightingStatistics {
  const base = rows.filter((row) => !row.deleted_at && (!input.own_only || row.reporter_id === userId) && !batches.some((batch) => batch.id === row.import_batch_id && batch.status === 'withdrawn')).map((row) => ({
    row,
    year: row.sighting_date ? Number(row.sighting_date.slice(0, 4)) : ['month', 'year'].includes(row.date_precision ?? '') && row.source_year ? row.source_year : null,
    source: row.source_name?.toUpperCase() === 'OBIS' ? 'obis' : row.import_batch_id || row.source_name ? 'other' : row.reporter_id ? 'community' : 'unknown',
    taxon: (row.species === 'Otro' && row.species_other?.trim()) || row.species?.trim() || 'Sin identificar',
  }))
  const filtered = base.filter((item) => (input.selected_status === 'all' || item.row.status === input.selected_status) &&
    (input.selected_source === 'all' || item.source === input.selected_source) &&
    (input.selected_year == null || (input.selected_year === 0 ? item.year === null : item.year === input.selected_year)) &&
    (!input.selected_taxon || input.selected_taxon === item.taxon) &&
    (!input.exclude_duplicates || !item.row.quality_flags?.includes('possible_duplicate')))
  const count = (predicate: (item: typeof filtered[number]) => boolean) => filtered.filter(predicate).length
  const healthKey = (row: Observation) => {
    const conditions = row.health_conditions ?? []
    if (conditions.length === 1 && conditions[0] === 'Sano / sin marcas visibles') return 'without_marks'
    if (conditions.length && conditions.every((value) => ['Ectoparásitos visibles', 'Heridas o cicatrices', 'Anzuelo / red / basura enganchada', 'Otro'].includes(value)) &&
      (!conditions.includes('Otro') || (row.health_other?.trim().length ?? 0) >= 2)) return 'with_signs'
    return 'unknown'
  }
  const signCount = (condition: string) => count(({ row }) => healthKey(row) === 'with_signs' && Boolean(row.health_conditions?.includes(condition)))
  const byYear = new Map<number | null, number>(); const byTaxon = new Map<string, number>(); const bySource = new Map<string, number>()
  for (const item of filtered) {
    byYear.set(item.year, (byYear.get(item.year) ?? 0) + 1)
    byTaxon.set(item.taxon, (byTaxon.get(item.taxon) ?? 0) + 1)
    bySource.set(item.source, (bySource.get(item.source) ?? 0) + 1)
  }
  const identified = (name: string) => !['sin identificar', 'no identificado', 'especie desconocida', 'otro'].includes(name.toLowerCase())
  const missingCoordinates = (row: Observation) => row.latitude === null || row.longitude === null || !Number.isFinite(row.latitude) || !Number.isFinite(row.longitude) || Math.abs(row.latitude) > 90 || Math.abs(row.longitude) > 180
  const ranked = [...byTaxon].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
  const taxa = ranked.slice(0, 8).map(([label, value]) => ({ label, count: value }))
  if (ranked.length > 8) taxa.push({ label: 'Otros grupos', count: ranked.slice(8).reduce((sum, [, value]) => sum + value, 0) })
  return {
    total: filtered.length, pending: count(({ row }) => row.status === 'pending'), verified: count(({ row }) => row.status === 'verified'), rejected: count(({ row }) => row.status === 'rejected'),
    distinct_taxa: new Set(filtered.filter((item) => identified(item.taxon)).map((item) => item.taxon)).size,
    years_with_records: byYear.size - Number(byYear.has(null)),
    quality: {
      without_year: count((item) => item.year === null), incomplete_date: count(({ row }) => !row.sighting_date),
      partial_date: count(({ row }) => !row.sighting_date && ['month', 'year'].includes(row.date_precision ?? '') && Boolean(row.source_year)),
      missing_coordinates: count(({ row }) => missingCoordinates(row)), possible_duplicates: count(({ row }) => Boolean(row.quality_flags?.includes('possible_duplicate'))),
      taxonomy_unreviewed: count(({ row }) => Boolean(row.quality_flags?.includes('taxonomy_unreviewed'))), unidentified: count((item) => !identified(item.taxon)),
      with_warnings: count((item) => Boolean(item.row.quality_flags?.length) || !item.row.sighting_date || missingCoordinates(item.row) || !identified(item.taxon)),
    },
    by_year: [...byYear].sort((a, b) => (a[0] ?? Infinity) - (b[0] ?? Infinity)).map(([year, value]) => ({ year, count: value })),
    by_taxon: taxa, by_source: [...bySource].map(([source, value]) => ({ source: source as SightingStatistics['by_source'][number]['source'], count: value })),
    visual_health: {
      without_marks: count(({ row }) => healthKey(row) === 'without_marks'),
      with_signs: count(({ row }) => healthKey(row) === 'with_signs'), unknown: count(({ row }) => healthKey(row) === 'unknown'),
      signs: { wounds: signCount('Heridas o cicatrices'), entanglement: signCount('Anzuelo / red / basura enganchada'), parasites: signCount('Ectoparásitos visibles'), other: signCount('Otro') },
    },
    options: { years: [...new Set(base.map((item) => item.year).filter((year): year is number => year !== null))].sort((a, b) => b - a), taxa: [...new Set(base.map((item) => item.taxon))].sort() },
    batches: isAdmin ? { active: batches.filter((batch) => batch.status === 'pending').length, withdrawn: batches.filter((batch) => batch.status === 'withdrawn').length } : null,
    generated_at: new Date().toISOString(),
  }
}
