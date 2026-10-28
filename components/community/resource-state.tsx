import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { CardsSkeleton, ListSkeleton } from '@/components/ui/loading-state'

export function ResourceState({ loading, error, retry, layout = 'cards' }: { loading: boolean; error?: string; retry: () => void; layout?: 'cards' | 'list' }) {
  if (loading) return layout === 'list' ? <ListSkeleton /> : <CardsSkeleton />
  if (error) return <Alert kind="error"><p>{error}</p><Button variant="secondary" onClick={retry} className="mt-3">Reintentar</Button></Alert>
  return null
}

export function Pagination({ page, total, pageSize = 6, onPage, label }: { page: number; total: number; pageSize?: number; onPage: (page: number) => void; label: string }) {
  const pages = Math.max(1, Math.ceil(total / pageSize))
  return <nav aria-label={label} className="workspace-pagination"><p className="text-sm text-muted" role="status">{total} registros · Página {page} de {pages}</p><div><Button variant="secondary" disabled={page === 1} onClick={() => onPage(page - 1)}>Anterior</Button><Button variant="secondary" disabled={page >= pages} onClick={() => onPage(page + 1)}>Siguiente</Button></div></nav>
}
