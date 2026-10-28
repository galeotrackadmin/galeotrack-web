'use client'

import { useCallback, useState, type ReactNode } from 'react'
import { useProfile } from '@/components/auth/access-gate'
import { loadDashboard } from '@/lib/admin'
import { supabase } from '@/lib/supabase-client'
import { useResource } from '@/lib/use-resource'
import type { SightingFilter } from '@/lib/types'
import { SightingList } from '@/components/sightings/sighting-list'
import { StatisticsDashboard } from '@/components/sightings/statistics-dashboard'
import type { Mode } from '@/lib/access'
import { Select } from '@/components/ui/form-field'
import { Button } from '@/components/ui/button'
import { ResourceState, Pagination } from './resource-state'
import { SightingsExplorer } from '@/components/sightings/sightings-explorer'

export function SightingsBrowser({ allowMine = false, mode = 'student', beforeList, children }: { allowMine?: boolean; mode?: Exclude<Mode, 'admin'>; beforeList?: ReactNode; children?: ReactNode }) {
  const profile = useProfile()
  const [filter, setFilter] = useState<SightingFilter>('all')
  const [page, setPage] = useState(1)
  const [mine, setMine] = useState(false)
  const [mapRevision, setMapRevision] = useState(0)
  const [expandedFilter, setExpandedFilter] = useState<SightingFilter | null>(null)
  const preview = mode === 'student' && expandedFilter !== filter
  const load = useCallback(() => loadDashboard(supabase, filter, page, mine ? profile.id : undefined), [filter, page, mine, profile.id])
  const resource = useResource(load)
  function refresh() { resource.refresh(); setMapRevision((current) => current + 1) }
  return <>
    <SightingsExplorer key={mapRevision} id="mapa-avistamientos" headingLevel={2} filter={filter} reporterId={mine ? profile.id : undefined} showSummary={mode !== 'student'} />
    {beforeList}
    <section id="avistamientos" aria-labelledby="sightings-title" className="space-y-6">
    <div><h2 id="sightings-title" className="text-2xl font-semibold text-ocean">Avistamientos y estadísticas</h2><p className="mt-2 text-muted">Registros de la comunidad. Los pendientes y rechazados no son datos verificados.</p></div>
    <div className="workspace-controls"><div><label htmlFor="sighting-status" className="mb-2 block text-sm font-semibold">Estado</label><Select id="sighting-status" value={filter} onChange={(e) => { setFilter(e.target.value as SightingFilter); setPage(1); setExpandedFilter(null) }}><option value="all">Todos los estados</option><option value="pending">Pendientes</option><option value="verified">Verificados</option><option value="rejected">Rechazados</option></Select></div>{allowMine && <div><label htmlFor="sighting-scope" className="mb-2 block text-sm font-semibold">Mostrar</label><Select id="sighting-scope" value={mine ? 'mine' : 'all'} onChange={(e) => { setMine(e.target.value === 'mine'); setPage(1) }}><option value="all">Toda la comunidad</option><option value="mine">Mis avistamientos</option></Select></div>}<Button variant="secondary" onClick={refresh} disabled={resource.loading}>Actualizar avistamientos</Button></div>
    <ResourceState {...resource} retry={refresh} layout="list" />
    {mode === 'community' && <StatisticsDashboard mode={mode} revision={mapRevision} />}
    {resource.data && <><div id="module-sightings-list">{resource.data.sightings.length ? <SightingList sightings={preview ? resource.data.sightings.slice(0, 3) : resource.data.sightings} role={profile.role} currentUserId={profile.id} onDeleted={refresh} /> : <p className="ui-card p-8" role="status">No hay avistamientos con estos criterios.</p>}</div>{mode === 'student' && <div className="flex flex-wrap items-center gap-4"><p role="status" className="text-sm text-muted">Mostrando {preview ? Math.min(3, resource.data.sightings.length) : resource.data.sightings.length} de {resource.data.total} avistamientos</p>{resource.data.total > 3 && <Button variant="secondary" aria-controls="module-sightings-list" aria-expanded={!preview} onClick={() => { setExpandedFilter(preview ? filter : null); if (!preview) setPage(1) }}>{preview ? 'Ver más avistamientos' : 'Ver menos avistamientos'}</Button>}</div>}{!preview && <Pagination page={resource.data.page} total={resource.data.total} pageSize={10} onPage={setPage} label="Paginación de avistamientos" />}</>}
    {children}
  </section></>
}
