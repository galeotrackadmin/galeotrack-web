'use client'

import { useCallback } from 'react'
import dynamic from 'next/dynamic'
import { supabase } from '@/lib/supabase-client'
import { loadMapSightings } from '@/lib/sightings/map-data'
import { useResource } from '@/lib/use-resource'
import type { SightingFilter } from '@/lib/types'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/ui/status-badge'
import { LoadingState } from '@/components/ui/loading-state'

const SightingsMap = dynamic(() => import('./sightings-map'), { ssr: false, loading: () => <LoadingState label="Preparando el mapa…" className="sightings-map-frame" /> })

export function SightingsExplorer({ filter = 'all', reporterId }: { filter?: SightingFilter; reporterId?: string }) {
  const load = useCallback((signal?: AbortSignal) => loadMapSightings(supabase, filter, reporterId, signal), [filter, reporterId])
  const resource = useResource(load)
  return <section aria-label="Mapa de avistamientos" className="space-y-4">
    <div className="workspace-section-head"><div><h3 className="text-xl font-semibold">Encuentros en el mapa</h3><p className="mt-2 text-muted">Selecciona un punto por toque o teclado para consultar su ficha.</p></div><Button variant="secondary" onClick={resource.refresh} disabled={resource.loading}>Actualizar mapa</Button></div>
    <div className="flex flex-wrap gap-3" aria-label="Leyenda del mapa">{(['pending', 'verified', 'rejected'] as const).map((status) => <StatusBadge key={status} status={status} />)}<span className="text-sm text-muted">Los números agrupan avistamientos cercanos.</span></div>
    {resource.loading && <LoadingState label="Cargando puntos del mapa…" className="sightings-map-frame" />}
    {resource.error && <Alert kind="error">{resource.error}<Button variant="secondary" onClick={resource.refresh} className="mt-3">Reintentar mapa</Button></Alert>}
    {resource.data && <>
      <div className="sightings-map-frame relative isolate overflow-hidden rounded-2xl border border-border"><SightingsMap rows={resource.data} /></div>
      <p role="status" className="text-sm text-muted">{resource.data.length ? `${resource.data.length} avistamientos con coordenadas para estos filtros, independientemente de la página del listado.` : 'No hay avistamientos con coordenadas para estos filtros.'} Los registros sin coordenadas se consultan en el listado.</p>
    </>}
  </section>
}
