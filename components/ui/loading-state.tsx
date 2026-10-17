import { Card } from './card'

export function LoadingState({ label = 'Cargando…', className = '' }: { label?: string; className?: string }) {
  return <div role="status" className={`flex min-h-32 items-center justify-center gap-3 p-6 text-sm text-muted ${className}`}><span className="ui-spinner text-primary" aria-hidden="true" />{label}</div>
}

export function ListSkeleton() {
  return (
    <Card className="overflow-hidden" role="status">
      <span className="sr-only">Cargando avistamientos…</span>
      <div aria-hidden="true" className="divide-y divide-border">
        {[0, 1, 2].map((item) => <div key={item} className="space-y-4 p-6"><div className="ui-skeleton h-5 w-2/5" /><div className="ui-skeleton h-4 w-3/5" /><div className="ui-skeleton h-4 w-1/4" /></div>)}
      </div>
    </Card>
  )
}
