type ImportedDate = { source_year?: number | null; source_month?: number | null; date_precision?: string | null }

export function formatImportedDate(row: ImportedDate): string | null {
  if (row.date_precision === 'month' && row.source_year && row.source_month) {
    return new Intl.DateTimeFormat('es-PR', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(row.source_year, row.source_month - 1, 1)))
  }
  if (row.date_precision === 'year' && row.source_year) return String(row.source_year)
  return null
}
