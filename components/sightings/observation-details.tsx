'use client'

import { useCallback, useState } from 'react'
import Image from 'next/image'
import { supabase } from '@/lib/supabase-client'
import { useResource } from '@/lib/use-resource'
import type { Observation } from '@/lib/types'
import { MEASUREMENTS, metersToFeet } from '@/lib/sightings/schema'
import { EVIDENCE_BUCKET } from '@/lib/sightings/media'
import { Button } from '@/components/ui/button'
import { Alert } from '@/components/ui/alert'
import { IMPORT_FLAG_LABELS } from '@/lib/sightings/obis-import'
import { formatImportedDate } from '@/lib/sightings/import-date'

type Contact = { name: string; email: string; phone: string | null }
const feet = (value: number) => `${metersToFeet(value).toLocaleString('es-PR', { maximumFractionDigits: 2 })} pies`

export function ObservationDetails({ id }: { id: string }) {
  const load = useCallback(async (signal?: AbortSignal) => {
    let query = supabase.from('sightings').select('*').eq('id', id)
    if (signal) query = query.abortSignal(signal)
    const { data, error } = await query.single<Observation>()
    if (error || !data) throw new Error('No se pudo cargar la ficha del avistamiento.')
    // RLS filtra los datos de contacto; no forman parte de la consulta del mapa.
    const contact = await supabase.from('sighting_contacts').select('name, email, phone').eq('sighting_id', id).maybeSingle<Contact>()
    const sign = async (path?: string | null) => {
      if (!path) return null
      const { data, error } = await supabase.storage.from(EVIDENCE_BUCKET).createSignedUrl(path, 600)
      return error ? null : data.signedUrl
    }
    const [photo, video] = await Promise.all([sign(data.photo_path), sign(data.video_path)])
    return { observation: data, contact: contact.data, contactError: !!contact.error, photo, video }
  }, [id])
  const resource = useResource(load)
  if (resource.loading) return <p role="status" className="py-3 text-sm text-muted">Cargando ficha del avistamiento…</p>
  if (resource.error || !resource.data) return <Alert kind="error">{resource.error}<Button variant="secondary" onClick={resource.refresh} className="mt-3">Reintentar ficha</Button></Alert>
  const { observation: data, contact, contactError, photo, video } = resource.data
  return <div className="observation-details space-y-4 text-sm">
    {data.source_name && <div className="rounded-lg border border-border bg-soft p-4"><p className="font-semibold">Registro histórico · {data.source_name}</p><p>Fecha de la fuente: {formatImportedDate(data) ?? data.sighting_date ?? 'No indicada'}</p>{data.source_date && <p className="break-words">Valor original: {data.source_date}</p>}<p>Registro externo, no atribuido a un usuario de GaleoTrack.</p>{data.quality_flags?.length ? <ul className="mt-2 list-disc space-y-1 pl-5">{data.quality_flags.map((flag) => <li key={flag}>{IMPORT_FLAG_LABELS[flag] ?? flag}</li>)}</ul> : null}</div>}
    <dl className="grid gap-3 sm:grid-cols-2">
      <div><dt className="text-muted">Perfil / actividad del colaborador</dt><dd>{data.collaborator_role ?? 'No indicado (registro anterior)'}</dd></div>
      <div><dt className="text-muted">Hora · Puerto Rico</dt><dd>{data.sighting_time?.slice(0, 5) ?? 'No indicada'}</dd></div>
      <div><dt className="text-muted">Sexo del ejemplar</dt><dd>{data.sex ?? 'No determinado'}</dd></div>
      <div><dt className="text-muted">Coordenadas</dt><dd>{data.latitude != null && data.longitude != null ? `${data.latitude.toFixed(6)}, ${data.longitude.toFixed(6)}` : 'No indicadas'}</dd></div>
      {MEASUREMENTS.map(({ column, label }) => <div key={column}><dt className="text-muted">{label}</dt><dd>{data[column] != null ? feet(data[column]) : 'No indicada'}</dd></div>)}
      {data.estimated_size != null && <div><dt className="text-muted">Tamaño aproximado (registro anterior)</dt><dd>{feet(data.estimated_size)}</dd></div>}
      {data.altitude != null && <div><dt className="text-muted">Altitud</dt><dd>{data.altitude} m</dd></div>}
      {data.accuracy != null && <div><dt className="text-muted">Precisión GPS</dt><dd>{data.accuracy} m</dd></div>}
    </dl>
    {(data.quantity ?? 0) > 1 && <p className="text-muted">Medidas y sexo de un ejemplar de referencia; cantidad total observada: {data.quantity}.</p>}
    {data.species_other && <p><strong>Otra especie: </strong>{data.species_other}</p>}
    <div><p className="text-muted">Comportamiento observado</p><p>{data.behavior || 'No indicado'}{data.behavior_other ? `: ${data.behavior_other}` : ''}</p></div>
    <div><p className="text-muted">Condición de salud visible</p><p>{data.health_conditions?.join(' · ') || 'No indicada'}{data.health_other ? `: ${data.health_other}` : ''}</p></div>
    {data.notes && <p className="whitespace-pre-wrap"><strong>Notas: </strong>{data.notes}</p>}
    {photo && <Image unoptimized src={photo} width={640} height={400} alt={`Evidencia fotográfica de ${data.species || 'tiburón observado'}`} className="max-h-72 w-full rounded-lg object-contain" onError={(event) => { event.currentTarget.hidden = true }} />}
    {video && <div><video src={video} controls preload="metadata" aria-label="Video del avistamiento" className="max-h-72 w-full rounded-lg" /><p className="mt-2 text-xs text-muted">Video aportado por el colaborador. El comportamiento y la salud se describen en la ficha.</p></div>}
    {(data.photo_path || data.video_path) && <div>{((data.photo_path && !photo) || (data.video_path && !video)) && <p className="text-danger">No se pudo abrir parte de la evidencia.</p>}<Button variant="secondary" onClick={resource.refresh}>Renovar enlaces de evidencia</Button></div>}
    {contact && <div className="rounded-lg border border-border bg-soft p-4"><p className="mb-2 font-semibold">Contacto autorizado para seguimiento</p><p>{contact.name}</p><p className="break-all">{contact.email}</p>{contact.phone && <p>{contact.phone}</p>}<p className="mt-2 text-xs text-muted">Uso exclusivo para la verificación del equipo de investigación.</p></div>}
    {contactError && <p className="text-muted">No se pudo comprobar si hay contacto autorizado.</p>}
  </div>
}

export function ExpandObservation({ id }: { id: string }) {
  const [open, setOpen] = useState(false)
  return <details className="sighting-details mt-3" onToggle={(event) => setOpen(event.currentTarget.open)}><summary>Ficha completa y evidencia</summary>{open && <div className="mt-4 rounded-xl border border-border bg-background p-4"><ObservationDetails id={id} /></div>}</details>
}
