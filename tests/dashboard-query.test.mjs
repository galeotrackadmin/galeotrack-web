import assert from 'node:assert/strict'
import { test } from 'node:test'
import { dashboardQueryUrl, parseDashboardQuery } from '../lib/dashboard-query.ts'

test('normaliza filtros y páginas inválidos sin introducir destinos de redirección', () => {
  for (const query of ['status=unknown&page=-1', 'page=1.5', 'page=Infinity', 'page=abc', 'page=9007199254740992', 'page=0', 'status=https://example.com']) {
    assert.deepEqual(parseDashboardQuery(new URLSearchParams(query)), { filter: 'all', page: 1 })
  }
})

test('filtro y paginación sobreviven a compartir o recargar la URL', () => {
  for (const filter of ['all', 'pending', 'verified', 'rejected']) {
    const url = new URL(dashboardQueryUrl(filter, 3), 'https://app.example.test')
    assert.equal(url.pathname, '/admin')
    assert.deepEqual(parseDashboardQuery(url.searchParams), { filter, page: 3 })
  }
  assert.equal(dashboardQueryUrl('all', 1), '/admin')
  assert.equal(dashboardQueryUrl('pending', 1), '/admin?status=pending')
})
