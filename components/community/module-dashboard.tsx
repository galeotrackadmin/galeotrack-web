import Link from 'next/link'
import { RequireMode } from '@/components/auth/access-gate'
import { PageHeading } from '@/components/layout/page-heading'
import { SectionLinks, type SectionLink } from '@/components/layout/section-links'
import { SpeciesCatalog } from './species-catalog'
import { SightingsBrowser } from './sightings-browser'
import { Publications } from './publications'
import { References } from './references'
import { IdentificationGuides } from './identification-guides'
import { ObisTestResults } from './obis-test-results'
import type { Mode } from '@/lib/access'

const descriptions = {
  student: { eyebrow: 'APRENDE Y EXPLORA', title: 'Modo Estudiante', description: 'Descubre las especies, explora los avistamientos y aprende de la comunidad científica.' },
  researcher: { eyebrow: 'INVESTIGA Y COMPARTE', title: 'Modo Científico', description: 'Consulta los registros y comparte tus investigaciones, publicaciones y borradores.' },
  community: { eyebrow: 'OBSERVA Y CONTRIBUYE', title: 'Modo Pescador Buzo', description: 'Registra tus encuentros en el mar y consulta el estado de tus avistamientos.' },
}

export function ModuleDashboard({ mode }: { mode: Exclude<Mode, 'admin'> }) {
  const copy = descriptions[mode]
  const links: SectionLink[] = [
    { href: '#mapa-avistamientos', title: 'Mapa de avistamientos', description: 'Consulta los encuentros registrados.', image: 'geomapa' },
    ...(mode === 'student' ? [{ href: '#especies', title: 'Guía de especies', description: 'Una nueva forma de conocer la vida marina.', image: 'coral' as const }] : []),
    { href: '#avistamientos', title: 'Avistamientos y estadísticas', description: 'Explora los encuentros de nuestra comunidad.', image: 'diver' },
    ...(mode === 'community' ? [{ href: '#estadisticas', title: 'Resumen estadístico', description: 'Consulta gráficos, fuentes y calidad de los registros.', image: 'geomapa' as const }] : [{ href: '#resultados-obis-prueba', title: 'Estadísticas', description: 'Consulta las tres gráficas del Excel.', image: 'geomapa' as const }]),
    { href: '#publicaciones', title: 'Publicaciones científicas', description: mode === 'researcher' ? 'Da forma a tu próxima investigación.' : 'Conocimiento que nos acerca al océano.', image: 'scientist' },
    { href: '#guias', title: 'Guías de identificación', description: 'Visualiza o descarga las guías de tiburones.', image: 'coral' },
    ...(mode !== 'community' ? [{ href: '#referencias', title: 'Referencias', description: 'Consulta las fuentes bibliográficas.', image: 'coral' as const }] : []),
    ...(mode === 'researcher' ? [{ href: '/report', title: 'Reportar un avistamiento', description: 'Aporta tus encuentros a la comunidad.', image: 'diver' as const }] : []),
  ]
  return (
    <RequireMode mode={mode}>
      <PageHeading {...copy} compact image={mode === 'student' ? 'student' : mode === 'researcher' ? 'scientist' : 'diver'} actions={mode === 'community' ? <Link href="/report" className="button button--primary">Reportar un avistamiento</Link> : mode === 'researcher' ? <a href="#publicaciones" className="button button--primary">Mis publicaciones</a> : undefined} />
      <SectionLinks compact label="Secciones de este espacio" items={links} />
      <div className="workspace-sections">
        <SightingsBrowser allowMine={mode !== 'student'} mode={mode} beforeList={mode === 'student' ? <SpeciesCatalog /> : mode === 'researcher' ? <Publications editable /> : undefined}>
          {mode !== 'community' && <ObisTestResults />}
        </SightingsBrowser>
        {mode !== 'researcher' && <Publications />}
        <IdentificationGuides />
        {(mode === 'student' || mode === 'researcher') && <References />}
      </div>
    </RequireMode>
  )
}
