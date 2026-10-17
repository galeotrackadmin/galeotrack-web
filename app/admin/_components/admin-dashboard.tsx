'use client'

import Link from 'next/link'
import { SightingList } from '@/components/sightings/sighting-list'
import { SightingsExplorer } from '@/components/sightings/sightings-explorer'
import { SectionLinks } from '@/components/layout/section-links'
import { SightingPagination } from './sighting-pagination'
import { StatisticsDashboard } from '@/components/sightings/statistics-dashboard'
import { DashboardLoading } from './dashboard-loading'
import { useAdminDashboard } from '../_hooks/use-admin-dashboard'
import { WorkspaceHeader } from '@/components/layout/workspace-header'
import { PageHeading } from '@/components/layout/page-heading'
import { Button } from '@/components/ui/button'
import { Alert } from '@/components/ui/alert'
import { Card } from '@/components/ui/card'
import { Select } from '@/components/ui/form-field'
import { ListSkeleton } from '@/components/ui/loading-state'
import { Icon } from '@/components/icons'
import type { SightingFilter } from '@/lib/types'

export function AdminDashboard() {
  const dashboard = useAdminDashboard()

  if (dashboard.loading) return <DashboardLoading />

  if (!dashboard.reviewer) {
    return <><WorkspaceHeader /><main id="main-content" tabIndex={-1} className="page-container page-container--form workspace-main flex-1"><PageHeading compact eyebrow="Panel de revisión" title="No pudimos comprobar tu acceso." description="Revisa tu conexión y vuelve a intentarlo." /><Alert kind="error">{dashboard.error}</Alert><Button onClick={dashboard.retryAccess} className="mt-6"><Icon name="refresh" />Reintentar</Button></main></>
  }

  const { reviewer, data, notice } = dashboard
  const controlsDisabled = dashboard.busy || dashboard.loadingData

  return (
    <>
      <WorkspaceHeader />
      <main id="main-content" tabIndex={-1} className="page-container workspace-main flex-1">
        <PageHeading compact eyebrow="ADMINISTRACIÓN" title="Panel de revisión" description={<p>Bienvenido{reviewer.fullName ? `, ${reviewer.fullName}` : ''}. Revisa y valida los avistamientos de nuestra comunidad.</p>} />

        <nav aria-label="Modos del administrador" className="workspace-shortcuts">
          <Link href="/report" className="button button--primary">Reportar avistamiento<Icon name="pin" /></Link>
          <a href="#sightings-heading" className="button button--secondary">Revisar avistamientos<Icon name="arrow" /></a>
          <a href="#estadisticas" className="button button--secondary">Resumen estadístico<Icon name="arrow" /></a>
          <a href="#community-tools" className="button button--ghost">Explorar los espacios</a>
        </nav>

        {notice && <Alert kind={notice.kind} className="mb-6">{notice.message}</Alert>}

        <StatisticsDashboard mode="admin" revision={dashboard.revision} />

        <section className="admin-section" aria-labelledby="sightings-heading">
          <div className="workspace-section-head mb-5">
            <div><h2 id="sightings-heading" className="text-xl font-semibold tracking-tight text-ocean">Avistamientos recientes</h2><p className="mt-2 text-muted">Consulta los detalles de cada reporte antes de revisarlo.</p></div>
            <div className="workspace-controls">
              <div><label htmlFor="status-filter" className="mb-2 block text-sm font-semibold">Estado</label><Select id="status-filter" value={dashboard.filter} disabled={controlsDisabled} onChange={(event) => dashboard.changeFilter(event.target.value as SightingFilter)}><option value="all">Todos los estados</option><option value="pending">Pendientes</option><option value="verified">Verificados</option><option value="rejected">Rechazados</option></Select></div>
              <Button variant="secondary" onClick={dashboard.refresh} disabled={controlsDisabled} loading={dashboard.loadingData}>{!dashboard.loadingData && <Icon name="refresh" />}Actualizar</Button>
            </div>
          </div>

          <div aria-busy={dashboard.loadingData}>
            {dashboard.loadingData ? <ListSkeleton /> : dashboard.dataError ? (
              <Alert kind="error"><p>{dashboard.dataError}</p><Button variant="danger" onClick={dashboard.refresh} className="mt-3">Reintentar</Button></Alert>
            ) : data && (
              <>
                {data.sightings.length === 0 ? (
                  <Card className="px-6 py-12 text-center">
                    <Icon name="waves" className="mx-auto mb-4 text-primary" width={32} height={32} />
                    <h3 className="font-semibold">{dashboard.filter === 'all' ? 'Todavía no hay avistamientos' : 'No hay registros con este estado'}</h3>
                    <p role="status" className="mx-auto mt-2 max-w-md text-sm text-muted">{dashboard.filter === 'all' ? 'Los reportes de la comunidad aparecerán aquí para su revisión.' : 'Prueba otro filtro para consultar los avistamientos disponibles.'}</p>
                    {dashboard.filter !== 'all' && <Button variant="secondary" onClick={() => dashboard.changeFilter('all')} className="mt-5">Ver todos los estados</Button>}
                  </Card>
                ) : <SightingList sightings={data.sightings} reviewingId={dashboard.reviewingId} disabled={controlsDisabled} onReview={dashboard.review} role="admin" currentUserId={reviewer.id} onDeleted={dashboard.refresh} />}
                <SightingPagination page={data.page} totalPages={data.totalPages} total={data.total} disabled={controlsDisabled} onPageChange={dashboard.changePage} />
              </>
            )}
          </div>
          <div className="admin-map"><SightingsExplorer key={`${data?.counts.pending}-${data?.counts.verified}-${data?.counts.rejected}`} filter={dashboard.filter} /></div>
        </section>
        <section id="community-tools" className="admin-section" aria-labelledby="community-tools-heading">
          <p className="section-eyebrow">Diferentes miradas · Un mismo océano</p>
          <h2 id="community-tools-heading" className="mt-3 mb-6 text-2xl font-semibold">Los espacios de la comunidad</h2>
          <SectionLinks compact label="Accesos del administrador" items={[
            { href: '/estudiante', title: 'Modo estudiante', description: 'Descubre el espacio educativo.', image: 'student' },
            { href: '/cientifico', title: 'Modo científico', description: 'Explora y comparte conocimiento.', image: 'scientist' },
            { href: '/comunidad', title: 'Modo Pescador Buzo', description: 'Conecta con las observaciones del mar.', image: 'diver' },
            { href: '/gestion', title: 'Gestionar comunidad', description: 'Perfiles científicos, especies y publicaciones.', image: 'coral' },
          ]} />
        </section>
      </main>
    </>
  )
}
