import type { Metadata } from 'next'
import { PageHeading } from '@/components/layout/page-heading'
import { ReportForm } from './_components/report-form'

export const metadata: Metadata = { title: 'Reportar avistamiento' }

export default function ReportPage() {
  return (
    <div className="page-container page-container--form">
      <PageHeading eyebrow="Ciencia que hacemos juntos" title="Galeo Track — Registro de avistamientos" image="diver" description={<p>Comparte tu encuentro con un tiburón en Puerto Rico. Tu observación ayuda a conocer y proteger nuestra vida marina.</p>} />
      <ReportForm />
    </div>
  )
}
