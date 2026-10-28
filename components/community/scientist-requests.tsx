'use client'

import { useCallback, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase-client'
import { useResource } from '@/lib/use-resource'
import { Button } from '@/components/ui/button'
import { Alert } from '@/components/ui/alert'
import { Textarea } from '@/components/ui/form-field'
import { ResourceState, Pagination } from './resource-state'
import { useUpdateGuard } from '@/lib/pwa/use-update-guard'

type Request = { id: string; full_name: string | null; affiliation: string | null }

export function ScientistRequests() {
  const [page, setPage] = useState(1)
  const [busy, setBusy] = useState<string | null>(null)
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [notice, setNotice] = useState<{ kind: 'success' | 'error'; message: string } | null>(null)
  const inFlight = useRef(false)
  useUpdateGuard(Boolean(busy || Object.values(notes).some(Boolean)))
  const load = useCallback(async () => {
    const { data, error, count } = await supabase.from('profiles').select('id, full_name, affiliation', { count: 'exact' }).eq('role', 'pending_scientist').eq('science_status', 'pending').order('id').range((page - 1) * 6, page * 6 - 1).returns<Request[]>()
    if (error) throw new Error('No se pudieron cargar las solicitudes científicas.')
    return { rows: data ?? [], total: count ?? 0 }
  }, [page])
  const resource = useResource(load)
  async function review(id: string, approve: boolean) {
    if (inFlight.current) return
    inFlight.current = true; setBusy(id); setNotice(null)
    try {
      const { error } = await supabase.rpc('review_scientist', { profile_id: id, approve, note: notes[id] ?? '' })
      if (error) throw new Error('No se pudo revisar la solicitud. Puede que otro administrador ya la haya atendido.')
      setNotes((current) => { const next = { ...current }; delete next[id]; return next })
      setNotice({ kind: 'success', message: approve ? 'Cuenta científica habilitada.' : 'Solicitud rechazada. El usuario podrá consultar el resultado.' })
      if (resource.data?.rows.length === 1 && page > 1) setPage(page - 1)
      resource.refresh()
    } catch (error) { setNotice({ kind: 'error', message: error instanceof Error ? error.message : 'No se pudo guardar la revisión.' }) }
    finally { inFlight.current = false; setBusy(null) }
  }
  return <section aria-labelledby="requests-title" className="space-y-6"><div className="flex flex-wrap items-center justify-between gap-4"><div><h2 id="requests-title" className="text-2xl font-semibold text-ocean">Solicitudes de científicos</h2><p className="mt-2 text-muted">Valida el perfil antes de habilitar la publicación de investigaciones.</p></div><Button variant="secondary" onClick={resource.refresh} disabled={resource.loading || busy !== null}>Actualizar solicitudes</Button></div>{notice && <Alert kind={notice.kind}>{notice.message}</Alert>}<ResourceState {...resource} retry={resource.refresh} />{resource.data && <>{resource.data.rows.length ? <div className="grid gap-5 md:grid-cols-2">{resource.data.rows.map((request) => <article key={request.id} className="ui-card space-y-4 p-6"><h3 className="break-words text-xl font-semibold text-ocean">{request.full_name || 'Nombre no indicado'}</h3><p className="break-words text-muted">{request.affiliation || 'Actividad investigadora no indicada'}</p><div><label htmlFor={`note-${request.id}`} className="mb-2 block text-sm font-semibold">Nota de la revisión (opcional)</label><Textarea id={`note-${request.id}`} maxLength={1000} rows={3} value={notes[request.id] ?? ''} disabled={busy !== null} onChange={(e) => setNotes({ ...notes, [request.id]: e.target.value })} /></div><div className="flex flex-wrap gap-3"><Button disabled={busy !== null} loading={busy === request.id} onClick={() => review(request.id, true)}>Habilitar científico<span className="sr-only"> {request.full_name}</span></Button><Button variant="danger" disabled={busy !== null} onClick={() => review(request.id, false)}>Rechazar solicitud<span className="sr-only"> {request.full_name}</span></Button></div></article>)}</div> : <p className="ui-card p-8" role="status">No hay solicitudes pendientes.</p>}<Pagination page={page} total={resource.data.total} onPage={setPage} label="Paginación de solicitudes" /></>}</section>
}
