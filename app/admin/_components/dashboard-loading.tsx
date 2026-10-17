import { WorkspaceHeader } from '@/components/layout/workspace-header'
import { LoadingState, ListSkeleton } from '@/components/ui/loading-state'
import { SightingStats } from '@/components/sightings/sighting-stats'
import { PageHeading } from '@/components/layout/page-heading'

export function DashboardLoading() {
  return <><WorkspaceHeader /><main id="main-content" tabIndex={-1} className="page-container workspace-main flex-1"><PageHeading compact eyebrow="ADMINISTRACIÓN" title="Panel de revisión" description="Preparando los avistamientos de nuestra comunidad." /><LoadingState label="Preparando tu espacio de revisión…" /><SightingStats counts={undefined} /><div className="mt-10"><ListSkeleton /></div></main></>
}
