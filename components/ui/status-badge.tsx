import { Icon, type IconName } from '@/components/icons'
import type { SightingStatus } from '@/lib/types'

const statuses = {
  pending: { label: 'Pendiente', styles: 'bg-warning-soft text-warning border-warning-border', icon: 'clock' },
  verified: { label: 'Verificado', styles: 'bg-success-soft text-success border-success-border', icon: 'check' },
  rejected: { label: 'Rechazado', styles: 'bg-danger-soft text-danger border-danger-border', icon: 'close' },
} satisfies Record<SightingStatus, { label: string; styles: string; icon: IconName }>

export function StatusBadge({ status }: { status: SightingStatus }) {
  const { label, styles, icon } = statuses[status]
  return <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${styles}`}><Icon name={icon} width={14} height={14} />{label}</span>
}
