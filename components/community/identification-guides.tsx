import { buttonStyles } from '@/components/ui/button'

const guides = [
  {
    title: 'Guía de identificación de tiburones del Caribe',
    language: 'Español',
    description: 'Características distintivas de tiburones y orientación sobre captura y liberación bajo el permiso comercial caribeño de botes pequeños de HMS.',
    filename: 'Caribbean Shark Placard_Spanish.pdf',
  },
  {
    title: 'Identificación de tiburones y regulaciones de pesca recreativa',
    language: 'Inglés',
    description: 'Anatomía, claves de identificación y regulaciones federales para la pesca recreativa en el Atlántico estadounidense, el golfo y el Caribe.',
    filename: 'Rec-Shark-ID-Placard-04-2024.pdf',
  },
]

export function IdentificationGuides() {
  return <section id="guias" aria-labelledby="guides-title" className="space-y-6">
    <div>
      <h2 id="guides-title" className="text-2xl font-semibold text-ocean">Guías de identificación</h2>
      <p className="mt-2 text-muted">Consulta las guías de NOAA Fisheries en línea o descárgalas para usarlas sin conexión.</p>
    </div>
    <div className="grid gap-5 md:grid-cols-2">
      {guides.map((guide) => <article key={guide.filename} className="ui-card flex min-w-0 flex-col gap-4 p-6 sm:p-8">
        <p className="text-sm text-muted">{guide.language} · PDF · 2 páginas</p>
        <h3 className="text-xl font-semibold text-ocean">{guide.title}</h3>
        <p className="text-muted">{guide.description}</p>
        <div className="mt-auto flex flex-wrap gap-3 pt-2">
          <a href={`/pdf/${encodeURIComponent(guide.filename)}`} target="_blank" rel="noopener noreferrer" type="application/pdf" className={buttonStyles('primary')}>Visualizar<span className="sr-only">: {guide.title} (nueva pestaña)</span></a>
          <a href={`/pdf/${encodeURIComponent(guide.filename)}`} download={guide.filename} type="application/pdf" className={buttonStyles('secondary')}>Descargar<span className="sr-only">: {guide.title}</span></a>
        </div>
      </article>)}
    </div>
    <p className="workspace-note">Las guías son material de consulta. Verifica la normativa vigente antes de realizar actividades de pesca.</p>
  </section>
}
