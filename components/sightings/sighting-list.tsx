'use client'

import { useId, useState } from 'react'
import Link from 'next/link'
import type { ReviewStatus, Sighting } from '@/lib/types'
import type { UserRole } from '@/lib/access'
import { deleteSighting } from '@/lib/admin'
import { supabase } from '@/lib/supabase-client'
import { Button } from '@/components/ui/button'
import { Alert } from '@/components/ui/alert'
import { IconCalendarEvent, IconCheck, IconCircleCheck, IconCircleX, IconClock, IconInfoCircle, IconMapPin, IconMapPinExclamation, IconPencil, IconTrash, IconUsers, IconX } from '@tabler/icons-react'
import { Tooltip } from '@base-ui/react/tooltip'
import { ActionTooltip, IconPopover } from '@/components/ui/icon-hint'
import { ExpandObservation } from './observation-details'
import { metersToFeet } from '@/lib/sightings/schema'
import { formatImportedDate } from '@/lib/sightings/import-date'
import { useConfirmation } from '@/components/ui/confirmation-provider'
import './sighting-list.css'

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
  const confirm = useConfirmation()
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState('')
  async function removeSighting(id: string) {
    if (deletingId || !await confirm({ title: '¿Eliminar este avistamiento?', description: `${sightings.find((sighting) => sighting.id === id)?.species || 'Especie desconocida'}. Se ocultará del listado y los mapas, pero se conservará para el historial y los análisis.`, action: 'Eliminar avistamiento', danger: true })) return
    setDeletingId(id); setDeleteError('')
    try { await deleteSighting(supabase, id); onDeleted?.() }
    catch (error) { setDeleteError(error instanceof Error ? error.message : 'No se pudo eliminar el avistamiento.') }
    finally { setDeletingId(null) }
  }
  return (
    <>
    {deleteError && <Alert kind="error">{deleteError}</Alert>}
    <Tooltip.Provider delay={200} closeDelay={100}><ul className="workspace-list ui-card divide-y divide-border overflow-hidden">
      {sightings.map((sighting) => <CompactSighting key={sighting.id} sighting={sighting} canManage={role === 'admin' || (['community', 'researcher'].includes(role ?? '') && sighting.reporter_id === currentUserId)} reviewing={reviewingId === sighting.id} disabled={disabled || deletingId !== null} onReview={role === 'admin' ? onReview : undefined} deleting={deletingId === sighting.id} deleteDisabled={deletingId !== null} onDelete={() => void removeSighting(sighting.id)} />)}
    </ul></Tooltip.Provider>
    </>
  )
}

const states = {
  verified: { label: 'Verificado', description: 'Este avistamiento tiene una revisión aprobada.', icon: IconCircleCheck },
  pending: { label: 'Pendiente', description: 'Este avistamiento está pendiente de revisión. No es un dato verificado.', icon: IconClock },
  rejected: { label: 'Rechazado', description: 'Este avistamiento fue rechazado. No es un dato verificado.', icon: IconCircleX },
}

function CompactSighting({ sighting, canManage, reviewing, disabled, onReview, deleting, deleteDisabled, onDelete }: { sighting: Sighting; canManage: boolean; reviewing: boolean; disabled?: boolean; onReview?: Props['onReview']; deleting: boolean; deleteDisabled: boolean; onDelete: () => void }) {
  const [detailsOpen, setDetailsOpen] = useState(false)
  const detailsId = useId()
  const species = sighting.species || 'Especie desconocida'
  const status = states[sighting.status]
  const StateIcon = status.icon
  const location = sighting.location_name?.trim()
  const date = sighting.sighting_date ? formatDate(sighting.sighting_date) : sighting.import_batch_id ? formatImportedDate(sighting) ?? 'No indicada en la fuente' : null
  const approveLabel = sighting.status === 'pending' ? 'Aprobar avistamiento' : 'Marcar como verificado el avistamiento'
  const rejectLabel = sighting.status === 'pending' ? 'Rechazar avistamiento' : 'Marcar como rechazado el avistamiento'
  return <li className="sighting-record"><article aria-labelledby={`sighting-${sighting.id}`}>
    <div className="sighting-record-header">
      <div className="sighting-record-heading"><h3 id={`sighting-${sighting.id}`}>{species}</h3>{sighting.source_name && <p className="sighting-record-source">Registro histórico · {sighting.source_name}</p>}</div>
      <div className="sighting-record-actions">
        <IconPopover label={`Estado: ${status.label}`} description={status.description} className={`sighting-status--${sighting.status}`}><StateIcon size={20} stroke={1.8} aria-hidden="true" /></IconPopover>
        {canManage && <>
          {!sighting.import_batch_id && <ActionTooltip label="Editar avistamiento"><Link href={`/report?edit=${encodeURIComponent(sighting.id)}`} className="sighting-icon-button" aria-label={`Editar avistamiento de ${species}`}><IconPencil size={20} stroke={1.8} aria-hidden="true" /></Link></ActionTooltip>}
          <ActionTooltip label="Eliminar avistamiento"><Button variant="danger" className="sighting-icon-button sighting-icon-button--danger" disabled={disabled || deleteDisabled} loading={deleting} onClick={onDelete} aria-label={`Eliminar avistamiento de ${species}`}><IconTrash size={20} stroke={1.8} aria-hidden="true" /></Button></ActionTooltip>
        </>}
        {onReview && <>
          {sighting.status !== 'verified' && <ActionTooltip label={approveLabel}><Button className="sighting-icon-button sighting-icon-button--approve" disabled={disabled} onClick={() => void onReview(sighting.id, 'verified')} aria-label={`${approveLabel} de ${species}`}><IconCheck size={20} stroke={1.8} aria-hidden="true" /></Button></ActionTooltip>}
          {sighting.status !== 'rejected' && <ActionTooltip label={rejectLabel}><Button variant="danger" className="sighting-icon-button sighting-icon-button--danger" disabled={disabled} onClick={() => void onReview(sighting.id, 'rejected')} aria-label={`${rejectLabel} de ${species}`}><IconX size={20} stroke={1.8} aria-hidden="true" /></Button></ActionTooltip>}
        </>}
      </div>
    </div>
    <div className="sighting-record-info">
      {location && <p className="sighting-record-place"><IconMapPin size={16} stroke={1.8} aria-hidden="true" />{location}</p>}
      <dl className="sighting-record-meta">
        {!location && <div><dt className="sr-only">Ubicación</dt><dd><IconPopover label="Ubicación no especificada" description="No se indicó el nombre de la ubicación en este registro. Puedes consultar las coordenadas disponibles en los detalles."><IconMapPinExclamation size={20} stroke={1.8} aria-hidden="true" /></IconPopover></dd></div>}
        {date && <div><dt className="sr-only">Fecha</dt><dd><IconCalendarEvent size={16} stroke={1.8} aria-hidden="true" />{sighting.sighting_date ? <time dateTime={sighting.sighting_date}>{date}</time> : date}</dd></div>}
        {sighting.quantity != null && <div><dt className="sr-only">Cantidad</dt><dd><IconUsers size={16} stroke={1.8} aria-hidden="true" />{sighting.quantity.toLocaleString('es-PR')}</dd></div>}
      </dl>
      <ActionTooltip label={detailsOpen ? 'Ocultar detalles' : 'Ver detalles y evidencia'}><Button className="sighting-icon-button" aria-label={`Detalles del avistamiento de ${species}`} aria-expanded={detailsOpen} aria-controls={detailsId} onClick={() => setDetailsOpen((value) => !value)}><IconInfoCircle size={20} stroke={1.8} aria-hidden="true" /></Button></ActionTooltip>
    </div>
    {reviewing && <p role="status" className="mt-2 text-sm text-muted">Guardando revisión…</p>}
    <div id={detailsId} hidden={!detailsOpen} className="sighting-record-detail-panel">
      {detailsOpen && <div className="space-y-4"><dl className="grid gap-4 sm:grid-cols-2">
        <div><dt className="text-muted">Tamaño aproximado</dt><dd>{sighting.estimated_size != null ? `${metersToFeet(sighting.estimated_size).toLocaleString('es-PR', { maximumFractionDigits: 2 })} pies` : 'No indicado'}</dd></div>
        <div><dt className="text-muted">Coordenadas</dt><dd>{sighting.latitude != null && sighting.longitude != null ? `${sighting.latitude.toFixed(6)}, ${sighting.longitude.toFixed(6)}` : 'No indicadas'}</dd></div>
      </dl><div><p className="text-muted">Comportamiento observado</p><p className="whitespace-pre-wrap">{sighting.behavior || 'No indicado'}</p></div>{sighting.notes && <div><p className="text-muted">Notas de la observación</p><p className="whitespace-pre-wrap">{sighting.notes}</p></div>}<ExpandObservation id={sighting.id} /></div>}
    </div>
  </article></li>
}
