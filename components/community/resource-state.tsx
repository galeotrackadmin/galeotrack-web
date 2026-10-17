import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'

export function ResourceState({ loading, error, retry }: { loading: boolean; error?: string; retry: () => void }) {
  if (loading) return <p role="status" className="rounded-2xl bg-soft p-6 text-muted">Cargando datos…</p>
  if (error) return <Alert kind="error"><p>{error}</p><Button variant="secondary" onClick={retry} className="mt-3">Reintentar</Button></Alert>
  return null
}

export function Pagination({ page, total, pageSize = 6, onPage, label }: { page: number; total: number; pageSize?: number; onPage: (page: number) => void; label: string }) {
  const pages = Math.max(1, Math.ceil(total / pageSize))
  return <nav aria-label={label} className="workspace-pagination"><p className="text-sm text-muted" role="status">{total} registros · Página {page} de {pages}</p><div><Button variant="secondary" disabled={page === 1} onClick={() => onPage(page - 1)}>Anterior</Button><Button variant="secondary" disabled={page >= pages} onClick={() => onPage(page + 1)}>Siguiente</Button></div></nav>
}
