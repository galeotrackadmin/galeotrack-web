import { Icon } from '@/components/icons'
import type { PublicMapSighting } from '@/lib/sightings/public-map'

export function PublicSightingReview({ sighting }: { sighting: Pick<PublicMapSighting, 'status' | 'source_name'> }) {
  if (sighting.status === 'verified') return <span className="tracker-review-badge tracker-review-badge--verified"><Icon name="check" />Verificado</span>
  return <div className="tracker-review-notice" role="note" aria-label="Estado de revisión">
    <span className="tracker-review-badge"><Icon name="alert" />Pendiente de revisión</span>
    <p>{sighting.source_name?.trim().toUpperCase() === 'OBIS'
      ? 'Registro histórico de OBIS. Pendiente de revisión por GaleoTrack.'
      : 'Este avistamiento aún no ha sido verificado.'}</p>
  </div>
}
