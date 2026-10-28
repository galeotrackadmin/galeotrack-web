import { Card } from './card'

export function LoadingState({ label = 'Cargando…', className = '' }: { label?: string; className?: string }) {
  return <div role="status" className={`flex min-h-32 items-center justify-center gap-3 p-6 text-sm text-muted ${className}`}><span className="ui-spinner text-primary" aria-hidden="true" />{label}</div>
}

export function ListSkeleton({ label = 'Cargando avistamientos…' }: { label?: string }) {
  return (
    <Card className="overflow-hidden" role="status">
      <span className="sr-only">{label}</span>
      <div aria-hidden="true" className="divide-y divide-border">
        {[0, 1, 2].map((item) => <div key={item} className="space-y-4 p-6"><div className="ui-skeleton h-5 w-2/5" /><div className="ui-skeleton h-4 w-3/5" /><div className="ui-skeleton h-4 w-1/4" /></div>)}
      </div>
    </Card>
  )
}

export function CardsSkeleton({ label = 'Cargando datos…' }: { label?: string }) {
  return <div role="status" className="skeleton-cards"><span className="sr-only">{label}</span>{[0, 1, 2].map((item) => <div key={item} className="ui-card skeleton-card" aria-hidden="true"><div className="ui-skeleton h-32 w-full" /><div className="ui-skeleton h-5 w-2/3" /><div className="ui-skeleton h-4 w-full" /><div className="ui-skeleton h-4 w-3/4" /></div>)}</div>
}

export function ChartSkeleton({ label = 'Preparando gráfica…' }: { label?: string }) {
  return <div role="status" className="skeleton-chart"><span className="sr-only">{label}</span><div aria-hidden="true" className="skeleton-bars">{['48%', '76%', '60%', '90%', '68%'].map((height, index) => <span key={index} className="ui-skeleton" style={{ height }} />)}</div></div>
}

export function MapSkeleton({ label = 'Preparando el mapa…', className = '' }: { label?: string; className?: string }) {
  return <div role="status" className={`skeleton-map ${className}`}><span className="sr-only">{label}</span><div className="ui-skeleton skeleton-map-surface" aria-hidden="true" /><div className="skeleton-map-controls" aria-hidden="true"><span className="ui-skeleton" /><span className="ui-skeleton" /></div><span className="skeleton-map-label">{label}</span></div>
}

export function WorkspaceSkeleton() {
  return <div className="page-container py-12" role="status"><span className="sr-only">Comprobando tu acceso…</span><div className="space-y-5 mb-8" aria-hidden="true"><div className="ui-skeleton h-5 w-1/3" /><div className="ui-skeleton h-12 w-2/3" /><div className="ui-skeleton h-5 w-1/2" /></div><CardsSkeleton label="Preparando tu espacio…" /></div>
}
