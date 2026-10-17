import { PAGE_SIZE } from '@/lib/admin'
import { Button } from '@/components/ui/button'
import { Icon } from '@/components/icons'

type Props = {
  page: number
  totalPages: number
  total: number
  disabled: boolean
  onPageChange: (page: number) => void
}

export function SightingPagination({ page, totalPages, total, disabled, onPageChange }: Props) {
  const first = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1
  const last = Math.min(page * PAGE_SIZE, total)

  return (
    <nav aria-label="Paginación de avistamientos" className="workspace-pagination admin-pagination">
      <p className="text-sm text-muted" role="status">
        {first}–{last} de {total.toLocaleString('es')} avistamientos
      </p>
      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
        <Button
          variant="secondary"
          type="button"
          disabled={disabled || page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          <Icon name="chevron-left" width={16} height={16} />Anterior
        </Button>
        <p className="text-xs text-muted tabular-nums sm:text-sm">Página {page} de {totalPages}</p>
        <Button
          variant="secondary"
          type="button"
          disabled={disabled || page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          Siguiente<Icon name="chevron-right" width={16} height={16} />
        </Button>
      </div>
    </nav>
  )
}
