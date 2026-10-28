import AxeBuilder from '@axe-core/playwright'
import { test, expect, login } from './fixtures'
import { statisticsMock } from './statistics-mock'

for (const [role, route] of [['community', '/comunidad']] as const) {
  for (const width of [375, 1440]) {
    test(`${role}: composición en barras y salud circular con porcentajes por registro a ${width}px`, async ({ page, backend }, testInfo) => {
      const row = backend.rows[0]
      backend.rows = [
        { ...row, id: 'healthy-1', status: 'verified', species: 'Ginglymostoma cirratum', quantity: 1, health_conditions: ['Sano / sin marcas visibles'] },
        { ...row, id: 'healthy-2', status: 'verified', species: 'Ginglymostoma cirratum', quantity: 99, health_conditions: ['Sano / sin marcas visibles'] },
        { ...row, id: 'injured', status: 'verified', species: 'Carcharhinus perezii', quantity: 8, health_conditions: ['Heridas o cicatrices', 'Anzuelo / red / basura enganchada'] },
        { ...row, id: 'unknown', status: 'verified', species: 'No identificado', quantity: 10, health_conditions: null },
        { ...row, id: 'deleted', status: 'verified', deleted_at: '2026-10-17T00:00:00Z', health_conditions: ['Sano / sin marcas visibles'] },
      ]
      await page.setViewportSize({ width, height: 900 })
      await page.emulateMedia({ reducedMotion: 'reduce' })
      await login(page)
      backend.profileRole = role
      await page.goto(route)
      const summary = page.getByRole('region', { name: 'Resumen estadístico', exact: true })
      await expect(summary.locator('.statistics-metric').first().locator('dd strong')).toHaveText('4')
      await expect(summary.locator('.echarts-for-react svg')).toHaveCount(4)
      const composition = summary.getByRole('figure', { name: 'Composición de especies', exact: true })
      await expect(composition.getByRole('img')).toHaveAccessibleName(/^Gráfica de barras:/)
      await composition.locator('.statistics-table summary').click()
      const species = composition.getByRole('row', { name: 'Ginglymostoma cirratum 2 50%', exact: true })
      await expect(species).toBeVisible()
      await expect(composition.getByRole('row', { name: 'No identificado 1 25%', exact: true })).toBeVisible()
      const health = summary.getByRole('figure', { name: 'Salud visual', exact: true })
      await expect(health.getByRole('img')).toHaveAccessibleName(/^Gráfica circular:/)
      await health.locator('.statistics-table').first().locator('summary').click()
      await expect(health.getByRole('row', { name: 'Sin marcas visibles 2 50%', exact: true })).toBeVisible()
      await expect(health.getByRole('row', { name: 'Con signos reportados 1 25%', exact: true })).toBeVisible()
      await expect(health.getByRole('row', { name: 'Sin información concluyente 1 25%', exact: true })).toBeVisible()
      await expect(health.locator('svg text').filter({ hasText: /^50%$/ })).toHaveCount(1)
      await health.getByText('Ver signos reportados', { exact: true }).click()
      await expect(health.locator('dl > div').filter({ hasText: 'Heridas o cicatrices' }).locator('dd')).toHaveText('1')
      await expect(health.locator('dl > div').filter({ hasText: 'Anzuelo, red o basura enganchada' }).locator('dd')).toHaveText('1')
      await expect(health).toContainText('no de ejemplares')
      await expect(health).toContainText('Base: 4 registros')
      await health.screenshot({ path: testInfo.outputPath(`salud-visual-${width}.png`), animations: 'disabled', style: '.site-header, nextjs-portal { visibility: hidden; }' })
      if (width === 375) await page.addStyleTag({ content: 'html { font-size: 200%; }' })
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
      const accessibility = await new AxeBuilder({ page }).include('#estadisticas').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()
      expect(accessibility.violations).toEqual([])
    })
  }
}

test('salud visual: OBIS desconocido al 100%, filtros vacíos y alcance personal sin mezclar registros', async ({ page, backend }) => {
  const row = backend.rows[0]
  backend.importBatches = [
    { id: 'active', file_name: 'obis.csv', row_count: 1, duplicate_count: 0, status: 'pending', created_at: '2026-10-17T00:00:00Z', quality_summary: {} },
    { id: 'withdrawn', file_name: 'retirado.csv', row_count: 1, duplicate_count: 0, status: 'withdrawn', created_at: '2026-10-17T00:00:00Z', quality_summary: {} },
  ]
  backend.rows = [
    { ...row, id: 'mine', status: 'verified', health_conditions: ['Sano / sin marcas visibles'] },
    { ...row, id: 'obis', status: 'verified', reporter_id: null, source_name: 'OBIS', import_batch_id: 'active', health_conditions: null },
    { ...row, id: 'withdrawn-row', status: 'verified', reporter_id: null, source_name: 'OBIS', import_batch_id: 'withdrawn', health_conditions: ['Sano / sin marcas visibles'] },
  ]
  await login(page)
  backend.profileRole = 'community'
  await page.goto('/comunidad')
  const summary = page.getByRole('region', { name: 'Resumen estadístico', exact: true })
  const health = summary.getByRole('figure', { name: 'Salud visual', exact: true })
  await expect(health.locator('.statistics-health-legend li').first()).toContainText('100%')
  await summary.getByLabel('Alcance de las estadísticas').selectOption('all')
  await summary.getByLabel('Fuente de las estadísticas').selectOption('obis')
  await expect(summary.locator('.statistics-metric').first().locator('dd strong')).toHaveText('1')
  await expect(health.locator('.statistics-health-legend li').last()).toContainText('100%')
  await expect(health.locator('.statistics-health-legend li').first()).toContainText('0%')
  await summary.getByLabel('Estado de las estadísticas').selectOption('pending')
  await expect(summary.locator('.statistics-metric').first().locator('dd strong')).toHaveText('0')
  await expect(health.locator('.echarts-for-react')).toHaveCount(0)
  await expect(health.getByText('No hay registros para estos filtros.', { exact: true })).toBeVisible()
  await expect(health.locator('.statistics-health-legend')).toHaveCount(0)
})

test('salud visual: una migración pendiente no inventa porcentajes ni rompe las gráficas anteriores', async ({ page, backend }) => {
  backend.rows[0].status = 'verified'
  await page.route('**/rest/v1/rpc/sighting_statistics', async (route) => {
    const stats = statisticsMock(backend.rows, route.request().postDataJSON(), backend.rows[0].reporter_id!, false, backend.importBatches)
    delete stats.visual_health
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(stats) })
  })
  await login(page)
  backend.profileRole = 'community'
  await page.goto('/comunidad')
  const summary = page.getByRole('region', { name: 'Resumen estadístico', exact: true })
  const health = summary.getByRole('figure', { name: 'Salud visual', exact: true })
  await expect(health.getByRole('note')).toContainText('202610170001_visual_health_statistics.sql')
  await expect(health.locator('.echarts-for-react')).toHaveCount(0)
  await expect(summary.getByRole('figure', { name: 'Composición de especies', exact: true }).locator('.echarts-for-react svg')).toHaveCount(1)
})
