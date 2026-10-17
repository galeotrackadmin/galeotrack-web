import type { Metadata } from 'next'
import { RequireMode } from '@/components/auth/access-gate'
import { PageHeading } from '@/components/layout/page-heading'
import { ScientistRequests } from '@/components/community/scientist-requests'
import { Publications } from '@/components/community/publications'
import { SpeciesCatalog } from '@/components/community/species-catalog'
import { SectionLinks } from '@/components/layout/section-links'
import { ObisImports } from '@/components/community/obis-imports'

export const metadata: Metadata = { title: 'Gestionar comunidad' }
export default function ManagementPage() {
  return (
    <RequireMode mode="admin">
      <PageHeading eyebrow="Administración" title="Una comunidad que crece." description="Valida científicos, gestiona las publicaciones y mantén el catálogo educativo." image="coral" />
      <SectionLinks label="Herramientas de gestión" items={[
        { href: '#solicitudes', title: 'Solicitudes científicas', description: 'Conecta nuevas miradas con la investigación.', image: 'scientist' },
        { href: '#especies', title: 'Catálogo educativo', description: 'Acerca la vida marina a nuestra comunidad.', image: 'coral' },
        { href: '#publicaciones', title: 'Publicaciones', description: 'Cuida el conocimiento que compartimos.', image: 'student' },
        { href: '#importaciones', title: 'Importar datos OBIS', description: 'Carga y retira registros históricos por lote.', image: 'geomapa' },
      ]} />
      <div className="workspace-sections space-y-16"><div id="solicitudes" className="scroll-mt-6"><ScientistRequests /></div><ObisImports /><SpeciesCatalog editable /><Publications editable manageAll /></div>
    </RequireMode>
  )
}
