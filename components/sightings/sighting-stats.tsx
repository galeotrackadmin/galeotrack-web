import type { SightingCounts } from '@/lib/types'
import { Icon, type IconName } from '@/components/icons'

export function SightingStats({ counts }: { counts: SightingCounts | undefined }) {
  const stats = [
      { label: 'Pendientes de revisión', caption: 'Esperando revisión administrativa', value: counts?.pending, icon: 'clock', style: 'bg-warning-soft text-warning' },
    { label: 'Avistamientos verificados', caption: 'Observaciones validadas', value: counts?.verified, icon: 'check', style: 'bg-success-soft text-success' },
    { label: 'Avistamientos rechazados', caption: 'Registros no verificados', value: counts?.rejected, icon: 'close', style: 'bg-danger-soft text-danger' },
  ] satisfies { label: string; caption: string; value: number | undefined; icon: IconName; style: string }[]

  return (
    <dl className="sighting-stats">
      {stats.map(({ label, caption, value, icon, style }) => (
        <div key={label} className="ui-card sighting-stat">
          <dt><span className={`sighting-stat-icon ${style}`}><Icon name={icon} /></span>{label}</dt>
          <dd>
            <span className="sighting-stat-value">{value === undefined ? '—' : value.toLocaleString('es-PR')}</span>
            <span className="sighting-stat-caption">{caption}</span>
          </dd>
        </div>
      ))}
    </dl>
  )
}
