import Link from 'next/link'
import { SiteHeader } from '@/components/layout/site-header'
import { SiteFooter } from '@/components/layout/site-footer'
import { PageHeading } from '@/components/layout/page-heading'
import { buttonStyles } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

export default function NotFound() {
  return (
    <div className="flex min-h-svh flex-col">
      <SiteHeader />
      <main id="main-content" tabIndex={-1} className="page-container page-container--form flex-1 py-16">
        <Card className="p-6 sm:p-10">
          <PageHeading eyebrow="Página no encontrada · 404" title="Este rumbo no lleva a ninguna página." description="Comprueba la dirección o continúa contribuyendo a la conservación marina." />
          <div className="flex flex-wrap gap-3"><Link href="/report" className={buttonStyles()}>Reportar un avistamiento</Link><Link href="/login" className={buttonStyles('secondary')}>Acceso al panel</Link></div>
        </Card>
      </main>
      <SiteFooter />
    </div>
  )
}
