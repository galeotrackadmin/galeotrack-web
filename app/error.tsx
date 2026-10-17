'use client'

import Link from 'next/link'
import { SiteHeader } from '@/components/layout/site-header'
import { PageHeading } from '@/components/layout/page-heading'
import { SiteFooter } from '@/components/layout/site-footer'
import { Button, buttonStyles } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

export default function ErrorPage({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <div className="flex min-h-svh flex-col">
      <SiteHeader />
      <main id="main-content" tabIndex={-1} className="page-container page-container--form flex-1 py-16">
        <Card className="p-6 sm:p-10">
          <PageHeading eyebrow="Volvamos a intentarlo" title="No pudimos cargar esta página." description="Ocurrió un error inesperado. Puedes reintentar o volver al formulario de avistamientos." />
          <div className="flex flex-wrap gap-3"><Button onClick={() => retry()}>Reintentar</Button><Link href="/report" className={buttonStyles('secondary')}>Ir a reportar</Link></div>
        </Card>
      </main>
      <SiteFooter />
    </div>
  )
}
