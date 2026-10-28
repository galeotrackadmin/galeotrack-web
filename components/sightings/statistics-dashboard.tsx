'use client'

import { useCallback, useId, useState } from 'react'
import Link from 'next/link'
import type { Mode } from '@/lib/access'
import { supabase } from '@/lib/supabase-client'
import { useResource } from '@/lib/use-resource'
import { defaultStatisticsFilters, loadSightingStatistics, SOURCE_LABELS, type StatisticsFilters } from '@/lib/sightings/statistics'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/form-field'
import { Alert } from '@/components/ui/alert'
import { Icon, type IconName } from '@/components/icons'
import { StatisticsChart } from './statistics-chart'
import { VisualHealthChart } from './visual-health-chart'
import { RefreshCw } from 'lucide-react'
import { ChartSkeleton } from '@/components/ui/loading-state'
import './statistics-dashboard.css'

const number = (value: number) => value.toLocaleString('es-PR')

export function StatisticsDashboard({ mode, revision = '' }: { mode: Mode; revision?: string | number }) {
  const id = useId()
  const [filters, setFilters] = useState(() => defaultStatisticsFilters(mode))
  const load = useCallback((signal?: AbortSignal) => {
    // Cambiar la revisión vuelve a consultar tras editar, eliminar o revisar registros.
    void revision
    return loadSightingStatistics(supabase, filters, signal)
  }, [filters, revision])
  const resource = useResource(load, { retainOnRefresh: true })
  const stats = resource.data
  const advanced = mode === 'researcher' || mode === 'admin'
  const ownLabel = filters.ownOnly ? 'Mis reportes' : 'Registros analizados'
  const metric = (label: string, value: number | undefined, caption: string, icon: IconName) => ({ label, value, caption, icon })
  const metrics = mode === 'community' ? [
    metric(ownLabel, stats?.total, 'Según los filtros de este resumen', 'list'),
    metric('Pendientes', stats?.pending, 'Todavía sin validar', 'clock'),
    metric('Verificados', stats?.verified, 'Con revisión aprobada', 'check'),
    metric('Rechazados', stats?.rejected, 'No son datos verificados', 'close'),
  ] : [
    metric(ownLabel, stats?.total, 'Registros, no individuos', 'list'),
    metric(mode === 'admin' ? 'Pendientes' : 'Verificados', mode === 'admin' ? stats?.pending : stats?.verified, mode === 'admin' ? 'Dentro de los filtros del resumen' : 'Con revisión aprobada', mode === 'admin' ? 'clock' : 'check'),
    metric(mode === 'admin' ? 'Verificados' : 'Identificaciones distintas', mode === 'admin' ? stats?.verified : stats?.distinct_taxa, mode === 'admin' ? 'Con revisión aprobada' : 'Nombres o grupos; no especies confirmadas', mode === 'admin' ? 'check' : 'compass'),
    metric(mode === 'student' ? 'Años con registros' : 'Con advertencias', mode === 'student' ? stats?.years_with_records : stats?.quality.with_warnings, mode === 'student' ? 'Las fechas desconocidas van aparte' : 'Requieren cotejo o datos adicionales', mode === 'student' ? 'clock' : 'alert'),
  ]

  function choose<K extends keyof StatisticsFilters>(key: K, value: StatisticsFilters[K]) { setFilters((current) => ({ ...current, [key]: value })) }

  return <section id="estadisticas" className="statistics-dashboard" aria-labelledby={`${id}-title`}>
    <div className="statistics-heading"><div><p className="section-eyebrow">{mode === 'student' ? 'EXPLORA LOS DATOS' : mode === 'community' ? 'TU APORTACIÓN AL PROYECTO' : mode === 'researcher' ? 'ANÁLISIS DE REGISTROS' : 'PANORAMA ADMINISTRATIVO'}</p><h3 id={`${id}-title`}>Resumen estadístico</h3><p>Todos los registros de estos filtros, independientemente de la página del listado. Estos controles no alteran el mapa ni el listado.</p></div><Button variant="secondary" className="statistics-refresh" aria-label="Actualizar estadísticas" aria-busy={resource.loading} disabled={resource.loading} onClick={resource.refresh}><RefreshCw size={20} strokeWidth={1.75} aria-hidden="true" className={resource.loading ? 'refresh-icon refresh-icon--busy' : 'refresh-icon'} /><span>{resource.loading ? 'Actualizando…' : 'Actualizar estadísticas'}</span></Button></div>

    <div className="statistics-controls">
      <div><label htmlFor={`${id}-status`}>Estado de las estadísticas</label><Select id={`${id}-status`} value={filters.status} onChange={(event) => choose('status', event.target.value as StatisticsFilters['status'])}><option value="all">Todos los estados</option><option value="verified">Verificados</option><option value="pending">Pendientes</option><option value="rejected">Rechazados</option></Select></div>
      <div><label htmlFor={`${id}-source`}>Fuente de las estadísticas</label><Select id={`${id}-source`} value={filters.source} onChange={(event) => choose('source', event.target.value as StatisticsFilters['source'])}>{Object.entries(SOURCE_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</Select></div>
      <div><label htmlFor={`${id}-year`}>Año de las estadísticas</label><Select id={`${id}-year`} value={filters.year === null ? 'all' : String(filters.year)} onChange={(event) => choose('year', event.target.value === 'all' ? null : Number(event.target.value))}><option value="all">Todos los años</option><option value="0">Sin año conocido</option>{stats?.options.years.map((year) => <option key={year} value={year}>{year}</option>)}{filters.year !== null && filters.year !== 0 && !stats?.options.years.includes(filters.year) && <option value={filters.year}>{filters.year}</option>}</Select></div>
      {mode !== 'student' && <div><label htmlFor={`${id}-scope`}>Alcance de las estadísticas</label><Select id={`${id}-scope`} value={filters.ownOnly ? 'mine' : 'all'} onChange={(event) => setFilters((current) => ({ ...current, ownOnly: event.target.value === 'mine', year: null, taxon: '' }))}><option value="all">Toda la comunidad y fuentes históricas</option><option value="mine">Solo mis reportes</option></Select></div>}
      {advanced && <div className="statistics-taxon-control"><label htmlFor={`${id}-taxon`}>Identificación o grupo</label><Select id={`${id}-taxon`} value={filters.taxon} onChange={(event) => choose('taxon', event.target.value)}><option value="">Todas las identificaciones</option>{stats?.options.taxa.map((taxon) => <option key={taxon} value={taxon}>{taxon}</option>)}{filters.taxon && !stats?.options.taxa.includes(filters.taxon) && <option value={filters.taxon}>{filters.taxon}</option>}</Select></div>}
      <Button variant="secondary" onClick={() => setFilters(defaultStatisticsFilters(mode))}>Restablecer estadísticas</Button>
    </div>
    {advanced && <label className="statistics-checkbox"><input type="checkbox" checked={filters.excludeDuplicates} onChange={(event) => choose('excludeDuplicates', event.target.checked)} /><span>Excluir posibles duplicados de este resumen (sin borrar registros)</span></label>}
    <p className="statistics-method">Se cuentan registros, no abundancia de tiburones. {filters.excludeDuplicates ? 'Las filas marcadas como posibles duplicados están excluidas.' : 'Los posibles duplicados se incluyen y se señalan; no se eliminan automáticamente.'} Los géneros, grupos y nombres sin normalizar no se presentan como especies confirmadas.</p>

    <p role="status" className="sr-only">{resource.loading ? stats ? 'Actualizando estadísticas. Se mantienen los últimos datos hasta completar la consulta.' : 'Calculando estadísticas…' : ''}</p>
    {resource.error && <Alert kind="error">{resource.error}<Button variant="secondary" className="mt-3" onClick={resource.refresh}>Reintentar estadísticas</Button></Alert>}
    <dl className="statistics-metrics" aria-label="Indicadores del resumen" aria-busy={resource.loading}>{metrics.map((item) => <div key={item.label} className="ui-card statistics-metric"><dt><Icon name={item.icon} />{item.label}</dt><dd>{resource.loading && !stats ? <span className="ui-skeleton statistics-value-skeleton" aria-hidden="true" /> : <strong>{item.value === undefined ? '—' : number(item.value)}</strong>}<span>{item.caption}</span></dd></div>)}</dl>
    {resource.loading && !stats && <div className="statistics-charts" aria-hidden="true">{Array.from({ length: mode === 'admin' ? 4 : 5 }, (_, item) => <div key={item} className="ui-card statistics-chart"><div className="ui-skeleton h-5 w-2/3" /><div className="ui-skeleton mt-3 h-4 w-full" /><ChartSkeleton /></div>)}</div>}
    {stats && <>
      <p className="statistics-result" role="status">{number(stats.total)} registros analizados · {filters.ownOnly ? 'Solo mis reportes' : 'Registros de las fuentes autorizadas'} · {SOURCE_LABELS[filters.source]}. {number(stats.quality.without_year)} sin año conocido; {number(stats.quality.partial_date)} con fecha parcial.</p>
      <div className="statistics-charts">
        <StatisticsChart title="Registros por año" description="Años conocidos en orden cronológico; sin inventar días ni meses. Sin año se muestra por separado." chronological points={stats.by_year.map((point) => ({ label: point.year === null ? 'Sin año conocido' : String(point.year), count: point.count }))} />
        <StatisticsChart title={mode === 'admin' ? 'Principales identificaciones' : 'Composición de especies'} description={mode === 'admin' ? 'Hasta ocho nombres o grupos; el resto se suma en Otros grupos. No equivale a un conteo de especies confirmadas.' : 'Hasta ocho especies, nombres o grupos documentados; el resto se suma en Otros grupos. Los porcentajes incluyen los registros sin identificar y no estiman abundancia poblacional ni confirman la identificación.'} points={stats.by_taxon} percentageTotal={mode === 'admin' ? undefined : stats.total} />
        <StatisticsChart title="Procedencia de los registros" description="OBIS y comunidad se distinguen. Los registros sin fuente documentada no se atribuyen a la comunidad." points={stats.by_source.map((point) => ({ label: SOURCE_LABELS[point.source], count: point.count }))} />
        {mode !== 'admin' && <VisualHealthChart health={stats.visual_health} total={stats.total} />}
        {advanced ? <div className="ui-card statistics-quality"><h4>Calidad de los datos</h4><p>Las categorías pueden coincidir en un mismo registro; no se deben sumar como registros distintos.</p><dl>{[
          ['Sin fecha completa', stats.quality.incomplete_date], ['Con fecha parcial', stats.quality.partial_date], ['Sin año conocido', stats.quality.without_year], ['Sin coordenadas válidas', stats.quality.missing_coordinates], ['Posibles duplicados incluidos', stats.quality.possible_duplicates], ['Taxonomía sin revisar', stats.quality.taxonomy_unreviewed], ['Sin identificación', stats.quality.unidentified],
        ].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{number(Number(value))}</dd></div>)}</dl></div> : <div className="ui-card statistics-quality"><h4>Cómo leer estos datos</h4><p>Un registro es una observación documentada: varios registros pueden corresponder al mismo encuentro. Más reportes no significan más tiburones.</p><p>{number(stats.verified)} verificados, {number(stats.pending)} pendientes y {number(stats.rejected)} rechazados dentro de estos filtros.</p><p>Las fechas desconocidas no se sustituyen por el año de importación. Las identificaciones a nivel de género o grupo se conservan como tales.</p></div>}
      </div>
      {mode === 'admin' && stats.batches && <div className="ui-card statistics-batches"><div><h4>Lotes de importación</h4><p>Resumen global de lotes; no depende de los filtros de registros.</p></div><dl><div><dt>Activos</dt><dd>{number(stats.batches.active)}</dd></div><div><dt>Retirados</dt><dd>{number(stats.batches.withdrawn)}</dd></div></dl><Link href="/gestion#importaciones" className="button button--secondary">Gestionar lotes OBIS</Link></div>}
    </>}
  </section>
}
