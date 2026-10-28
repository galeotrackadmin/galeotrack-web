'use client'

import { useCallback, useRef, useState, type FormEvent } from 'react'
import { useProfile } from '@/components/auth/access-gate'
import { loadPublications, savePublication, type Publication } from '@/lib/community'
import { supabase } from '@/lib/supabase-client'
import { useResource } from '@/lib/use-resource'
import { Button } from '@/components/ui/button'
import { FormField, Input, Select, Textarea } from '@/components/ui/form-field'
import { Alert } from '@/components/ui/alert'
import { ResourceState, Pagination } from './resource-state'
import { useUpdateGuard } from '@/lib/pwa/use-update-guard'

function PublicationEditor({ publication, onSaved, onCancel }: { publication: Publication | null; onSaved: () => void; onCancel: () => void }) {
  // An open editor is intentionally conservative, even before its first keystroke.
  useUpdateGuard(true)
  const profile = useProfile()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const sending = useRef(false)
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (sending.current) return
    sending.current = true; setBusy(true); setError('')
    const fields = Object.fromEntries(new FormData(event.currentTarget))
    try { await savePublication(supabase, fields, profile.id, publication?.id); onSaved() }
    catch (error) { setError(error instanceof Error ? error.message : 'No se pudo guardar.') }
    finally { sending.current = false; setBusy(false) }
  }
  return <form onSubmit={submit} className="workspace-form ui-card space-y-5" aria-busy={busy}>
    <h3 className="text-xl font-semibold text-ocean">{publication ? 'Editar publicación' : 'Nueva publicación científica'}</h3>
    <fieldset disabled={busy} className="space-y-5">
      <FormField id="post-title" label="Título" required><Input id="post-title" name="title" defaultValue={publication?.title} minLength={3} maxLength={180} required /></FormField>
      <FormField id="post-summary" label="Resumen" required hint="Entre 10 y 500 caracteres."><Textarea id="post-summary" name="summary" defaultValue={publication?.summary} minLength={10} maxLength={500} rows={3} aria-describedby="post-summary-hint" required /></FormField>
      <FormField id="post-content" label="Contenido" required hint="Texto de 20 a 30 000 caracteres. Los saltos de línea se conservan."><Textarea id="post-content" name="content" defaultValue={publication?.content} minLength={20} maxLength={30000} rows={6} aria-describedby="post-content-hint" required /></FormField>
      <FormField id="post-references" label="Referencias y fuentes"><Textarea id="post-references" name="references_text" defaultValue={publication?.references_text} maxLength={4000} rows={3} /></FormField>
      <FormField id="post-status" label="Visibilidad" required><Select id="post-status" name="status" defaultValue={publication?.status ?? 'draft'}><option value="draft">Borrador: autor y administrador</option><option value="published">Publicado: visible para la comunidad</option></Select></FormField>
    </fieldset>
    {error && <Alert kind="error">{error}</Alert>}
    <div className="workspace-form-actions"><Button type="submit" disabled={busy} loading={busy}>Guardar publicación</Button><Button variant="secondary" onClick={onCancel} disabled={busy}>Cancelar edición</Button></div>
  </form>
}

export function Publications({ editable = false, manageAll = false }: { editable?: boolean; manageAll?: boolean }) {
  const profile = useProfile()
  const [scope, setScope] = useState<'feed' | 'mine' | 'all'>(manageAll ? 'all' : editable ? 'mine' : 'feed')
  const [page, setPage] = useState(1)
  const [editor, setEditor] = useState<Publication | null | undefined>(undefined)
  const [notice, setNotice] = useState('')
  const load = useCallback(() => loadPublications(supabase, page, scope === 'mine' ? profile.id : undefined, scope === 'all' && manageAll), [page, scope, profile.id, manageAll])
  const resource = useResource(load)
  return <section id="publicaciones" aria-labelledby="publications-title" className="scroll-mt-6 space-y-6">
    <div className="workspace-section-head"><div><h2 id="publications-title" className="text-2xl font-semibold text-ocean">{editable ? 'Publicaciones científicas' : 'Conocimiento compartido'}</h2><p className="mt-2 text-muted">Investigaciones, observaciones y resultados publicados por la comunidad científica.</p></div>{editable && <Button onClick={() => { setEditor(null); setNotice('') }} disabled={editor !== undefined}>Nueva publicación</Button>}</div>
    {notice && <Alert kind="success">{notice}</Alert>}
    {editor !== undefined && <PublicationEditor key={editor?.id ?? 'new'} publication={editor} onCancel={() => setEditor(undefined)} onSaved={() => { setEditor(undefined); setNotice('Publicación guardada. Su visibilidad corresponde al estado seleccionado.'); resource.refresh() }} />}
    {editable && <div className="max-w-sm"><label htmlFor="publication-scope" className="mb-2 block text-sm font-semibold">Publicaciones que quieres consultar</label><Select id="publication-scope" value={scope} onChange={(e) => { setScope(e.target.value as typeof scope); setPage(1) }}><option value="mine">Mis publicaciones y borradores</option><option value="feed">Publicadas por la comunidad</option>{manageAll && <option value="all">Todas, incluidos borradores</option>}</Select></div>}
    <ResourceState {...resource} retry={resource.refresh} />
    {resource.data && <>{resource.data.rows.length === 0 ? <p className="ui-card p-8" role="status">Todavía no hay publicaciones en esta sección.</p> : <div className="grid items-start gap-5 lg:grid-cols-2">{resource.data.rows.map((post) => <article key={post.id} className="ui-card min-w-0 space-y-4 p-6 sm:p-8"><div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted"><span className="rounded-full bg-soft px-3 py-2 font-semibold text-primary">{post.status === 'draft' ? 'Borrador' : 'Publicado'}</span><time dateTime={post.created_at}>{new Date(post.created_at).toLocaleDateString('es-PR', { timeZone: 'UTC' })}</time></div><h3 className="break-words text-xl font-semibold text-ocean">{post.title}</h3><p className="break-words text-muted">{post.summary}</p><details className="sighting-details"><summary>Leer publicación<span className="sr-only">: {post.title}</span></summary><div className="article-body mt-4">{post.content}</div>{post.references_text && <div className="mt-6 border-t border-border pt-4"><h4 className="font-semibold text-ocean">Referencias y fuentes</h4><p className="article-body mt-2 text-sm text-muted">{post.references_text}</p></div>}</details>{editable && (post.author_id === profile.id || profile.role === 'admin') && <Button variant="secondary" disabled={editor !== undefined} onClick={() => { setEditor(post); setNotice(''); document.getElementById('publicaciones')?.scrollIntoView() }}>Editar<span className="sr-only"> {post.title}</span></Button>}</article>)}</div>}<Pagination page={page} total={resource.data.total} onPage={setPage} label="Paginación de publicaciones" /></>}
  </section>
}
