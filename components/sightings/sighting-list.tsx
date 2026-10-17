'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { ReviewStatus, Sighting } from '@/lib/types'
import type { UserRole } from '@/lib/access'
import { deleteSighting } from '@/lib/admin'
import { supabase } from '@/lib/supabase-client'
import { Button } from '@/components/ui/button'
import { Alert } from '@/components/ui/alert'
import { StatusBadge } from '@/components/ui/status-badge'
import { Icon } from '@/components/icons'
import { ExpandObservation } from './observation-details'
import { metersToFeet } from '@/lib/sightings/schema'
import { formatImportedDate } from '@/lib/sightings/import-date'

function formatDate(value: string) {
  const date = new Date(`${value.slice(0, 10)}T12:00:00Z`)
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('es-PR', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(date)
}

type Props = {
  sightings: Sighting[]
  reviewingId?: string | null
  disabled?: boolean
  onReview?: (id: string, status: ReviewStatus) => Promise<void>
  currentUserId?: string
  role?: UserRole
  onDeleted?: () => void
}

export function SightingList({ sightings, reviewingId, disabled, onReview, currentUserId, role, onDeleted }: Props) {
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState('')
  async function removeSighting(id: string) {
    if (deletingId || !window.confirm('¿Eliminar este avistamiento? Se ocultará del listado y los mapas, pero se conservará para el historial y los análisis.')) return
    setDeletingId(id); setDeleteError('')
    try { await deleteSighting(supabase, id); onDeleted?.() }
    catch (error) { setDeleteError(error instanceof Error ? error.message : 'No se pudo eliminar el avistamiento.') }
    finally { setDeletingId(null) }
  }
  return (
    <>
    {deleteError && <Alert kind="error">{deleteError}</Alert>}
    <ul className="workspace-list ui-card divide-y divide-border overflow-hidden">
      {sightings.map((sighting) => {
        const reviewing = reviewingId === sighting.id
        const canManage = role === 'admin' || (['community', 'researcher'].includes(role ?? '') && sighting.reporter_id === currentUserId)
        const species = sighting.species || 'Especie desconocida'
        return (
          <li key={sighting.id} className="p-5 sm:p-6">
            <article className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between" aria-labelledby={`sighting-${sighting.id}`}>
              <div className="min-w-0 flex-1 break-words">
                <h3 id={`sighting-${sighting.id}`} className="text-lg font-semibold text-ocean">{species}</h3>
                {sighting.source_name && <p className="mt-1 text-sm font-semibold text-primary">Registro histórico · {sighting.source_name}</p>}
                <p className="sighting-location mt-2 flex items-start gap-2 text-muted"><Icon name="pin" width={16} height={16} className="mt-0.5 shrink-0" />{sighting.location_name || 'Ubicación no especificada'}</p>
                <dl className="sighting-summary mt-3 flex flex-wrap gap-x-6 gap-y-2">
                  {sighting.sighting_date && <div><dt className="inline text-muted">Fecha: </dt><dd className="inline"><time dateTime={sighting.sighting_date}>{formatDate(sighting.sighting_date)}</time></dd></div>}
                  {!sighting.sighting_date && sighting.import_batch_id && <div><dt className="inline text-muted">Fecha: </dt><dd className="inline">{formatImportedDate(sighting) ?? 'No indicada en la fuente'}</dd></div>}
                  {sighting.quantity !== null && <div><dt className="inline text-muted">Cantidad: </dt><dd className="inline tabular-nums">{sighting.quantity.toLocaleString('es-PR')}</dd></div>}
                </dl>
                <details className="sighting-details mt-3">
                  <summary><Icon name="chevron-right" width={16} height={16} />Detalles del avistamiento<span className="sr-only"> de {species}</span></summary>
                  <div className="mt-2 space-y-4 rounded-xl border border-border bg-background p-4 text-sm">
                    <dl className="grid gap-4 sm:grid-cols-2">
                      <div><dt className="text-xs font-medium text-muted">Tamaño aproximado</dt><dd className="mt-1 font-medium">{sighting.estimated_size != null ? `${metersToFeet(sighting.estimated_size).toLocaleString('es-PR', { maximumFractionDigits: 2 })} pies` : 'No indicado'}</dd></div>
                      <div><dt className="text-xs font-medium text-muted">Coordenadas</dt><dd className="mt-1 break-words font-mono text-xs leading-relaxed">{sighting.latitude != null && sighting.longitude != null ? `${sighting.latitude.toFixed(6)}, ${sighting.longitude.toFixed(6)}` : 'No indicadas'}</dd></div>
                    </dl>
                    <div><p className="text-xs font-medium text-muted">Comportamiento observado</p><p className="mt-1 whitespace-pre-wrap">{sighting.behavior || 'No indicado'}</p></div>
                    {sighting.notes && <div><p className="text-xs font-medium text-muted">Notas de la observación</p><p className="mt-1 whitespace-pre-wrap">{sighting.notes}</p></div>}
                  </div>
                </details>
                <ExpandObservation id={sighting.id} />
              </div>
              <div className="sighting-actions flex shrink-0 flex-col items-start gap-4">
                <StatusBadge status={sighting.status} />
                {canManage && <div className="flex flex-wrap gap-2">
                  {!sighting.import_batch_id && <Link href={`/report?edit=${encodeURIComponent(sighting.id)}`} className="button button--secondary">Editar<span className="sr-only"> avistamiento de {species}</span></Link>}
                  <Button variant="danger" disabled={deletingId !== null} loading={deletingId === sighting.id} onClick={() => void removeSighting(sighting.id)}>Eliminar<span className="sr-only"> avistamiento de {species}</span></Button>
                </div>}
                {onReview && sighting.status === 'pending' && <div className="sighting-review-buttons" aria-busy={reviewing}>
                  <Button disabled={disabled} onClick={() => void onReview(sighting.id, 'verified')} aria-label={`Aprobar avistamiento de ${species}`}><Icon name="check" width={16} height={16} />Aprobar</Button>
                  <Button variant="danger" disabled={disabled} onClick={() => void onReview(sighting.id, 'rejected')} aria-label={`Rechazar avistamiento de ${species}`}><Icon name="close" width={16} height={16} />Rechazar</Button>
                </div>}
                {reviewing && <p role="status" className="flex items-center gap-2 text-sm text-muted"><span className="ui-spinner" aria-hidden="true" />Guardando revisión…</p>}
              </div>
            </article>
          </li>
        )
      })}
    </ul>
    </>
  )
}
