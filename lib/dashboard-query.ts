import type { SightingFilter } from './types'

export function parseDashboardQuery(params: Pick<URLSearchParams, 'get'>): { filter: SightingFilter; page: number } {
  const status = params.get('status')
  const filter = status === 'pending' || status === 'verified' || status === 'rejected' ? status : 'all'
  const rawPage = params.get('page') ?? '1'
  const page = /^\d+$/.test(rawPage) ? Number(rawPage) : 1
  return { filter, page: Number.isSafeInteger(page) && page > 0 ? page : 1 }
}

export function dashboardQueryUrl(filter: SightingFilter, page: number) {
  const params = new URLSearchParams()
  if (filter !== 'all') params.set('status', filter)
  if (page > 1) params.set('page', String(page))
  return `/admin${params.size ? `?${params}` : ''}`
}
