import AxeBuilder from '@axe-core/playwright'
import type { Locator } from '@playwright/test'
import { test, expect, login } from './fixtures'

async function expectChartValue(summary: Locator, title: string, label: string) {
  const figure = summary.getByRole('figure', { name: title, exact: true })
  await figure.locator('.statistics-table summary').click()
  await expect(figure.getByRole('rowheader', { name: label, exact: true })).toBeVisible()
}

for (const [role, route, expectedTotal] of [['student', '/estudiante', 3], ['researcher', '/cientifico', 3], ['community', '/comunidad', 7], ['admin', '/admin', 10]] as const) {
  test(`${role}: indicadores, procedencia, fechas parciales y alcance del resumen`, async ({ page, backend }) => {
    backend.importBatches = [
      { id: 'active', file_name: 'obis.csv', row_count: 2, duplicate_count: 1, status: 'pending', created_at: '2026-10-16T00:00:00Z', quality_summary: {} },
      { id: 'withdrawn', file_name: 'retirado.csv', row_count: 1, duplicate_count: 0, status: 'withdrawn', created_at: '2026-10-16T00:00:00Z', quality_summary: {} },
    ]
    backend.rows[0] = { ...backend.rows[0], status: 'verified', sighting_date: '2024-06-10' }
    backend.rows[1] = { ...backend.rows[1], reporter_id: 'another-user', species: 'Carcharhinus', status: 'verified', sighting_date: '2023-02-01' }
    backend.rows[2] = { ...backend.rows[2], reporter_id: null, species: 'Squalus cubensis', status: 'verified', source_name: 'OBIS', import_batch_id: 'active', sighting_date: null, date_precision: 'month', source_year: 2021, source_month: 4, quality_flags: ['possible_duplicate', 'taxonomy_unreviewed'] }
    backend.rows[3] = { ...backend.rows[3], reporter_id: null, species: 'Squalus cubensis', source_name: 'OBIS', import_batch_id: 'active', sighting_date: null, date_precision: 'unknown' }
    backend.rows[4].deleted_at = '2026-10-16T00:00:00Z'
    backend.rows[5] = { ...backend.rows[5], reporter_id: null, status: 'verified', source_name: 'OBIS', import_batch_id: 'withdrawn' }
    await login(page)
    backend.profileRole = role
    await page.goto(route)
    const summary = page.getByRole('region', { name: 'Resumen estadístico', exact: true })
    await expect(summary.locator('.statistics-metric').first().locator('dd strong')).toHaveText(String(expectedTotal))
    await expect(summary.locator('.statistics-metric')).toHaveCount(4)
    await expect(summary.getByText('Se cuentan registros, no abundancia de tiburones.', { exact: false })).toBeVisible()
    if (role === 'community') {
      await expect(summary.getByLabel('Alcance de las estadísticas')).toHaveValue('mine')
      await summary.getByLabel('Alcance de las estadísticas').selectOption('all')
      await expect(summary.locator('.statistics-metric').first().locator('dd strong')).toHaveText('10')
    }
    await summary.getByLabel('Fuente de las estadísticas').selectOption('obis')
    await expect(summary.locator('.statistics-metric').first().locator('dd strong')).toHaveText(role === 'student' || role === 'researcher' ? '1' : '2')
    await expectChartValue(summary, 'Registros por año', '2021')
    if (role === 'researcher' || role === 'admin') {
      await expect(summary.getByRole('heading', { name: 'Calidad de los datos' })).toBeVisible()
      await summary.getByLabel('Excluir posibles duplicados de este resumen', { exact: false }).check()
      await expect(summary.locator('.statistics-metric').first().locator('dd strong')).toHaveText(role === 'researcher' ? '0' : '1')
    } else await expect(summary.getByRole('heading', { name: 'Cómo leer estos datos' })).toBeVisible()
    if (role === 'admin') await expect(summary.getByRole('link', { name: 'Gestionar lotes OBIS' })).toHaveAttribute('href', '/gestion#importaciones')
    else await expect(summary.getByRole('heading', { name: 'Lotes de importación' })).toHaveCount(0)
  })
}

test('estadísticas completas: paginar no cambia totales y una revisión sí actualiza el resumen', async ({ page, backend }) => {
  await login(page)
  const summary = page.getByRole('region', { name: 'Resumen estadístico', exact: true })
  await expect(summary.locator('.statistics-metric').first().locator('dd strong')).toHaveText('12')
  const requestsBeforePaging = backend.statisticsRequests
  await page.getByRole('button', { name: 'Siguiente', exact: true }).click()
  await expect(page.getByText('Página 2 de 2', { exact: true })).toBeVisible()
  await expect(summary.locator('.statistics-metric').first().locator('dd strong')).toHaveText('12')
  expect(backend.statisticsRequests).toBe(requestsBeforePaging)
  await page.getByRole('button', { name: 'Anterior', exact: true }).click()
  await page.getByRole('button', { name: 'Aprobar avistamiento de Tiburón nodriza' }).click()
  await expect(summary.locator('.statistics-metric').nth(2).locator('dd strong')).toHaveText('1')
  await expect(summary.locator('.statistics-metric').nth(1).locator('dd strong')).toHaveText('11')
})

test('estadísticas: un error no se muestra como ceros y el resumen se puede reintentar', async ({ page, backend }) => {
  backend.failStatistics = true
  await login(page)
  const summary = page.getByRole('region', { name: 'Resumen estadístico', exact: true })
  await expect(summary.getByRole('alert')).toContainText('No se pudieron cargar las estadísticas')
  await expect(summary.locator('.statistics-metric').first().locator('dd strong')).toHaveText('—')
  await expect(summary.getByRole('figure')).toHaveCount(0)
  backend.failStatistics = false
  await summary.getByRole('button', { name: 'Reintentar estadísticas' }).click()
  await expect(summary.locator('.statistics-metric').first().locator('dd strong')).toHaveText('12')
})

test('filtros de análisis: año desconocido, grupo y restablecimiento sin alterar el listado', async ({ page, backend }) => {
  backend.rows[0] = { ...backend.rows[0], species: 'Carcharhinus', sighting_date: null, source_name: 'OBIS', import_batch_id: 'active', reporter_id: null, date_precision: 'unknown' }
  backend.rows[1] = { ...backend.rows[1], species: 'Carcharhinus', sighting_date: null, source_name: 'OBIS', import_batch_id: 'active', reporter_id: null, date_precision: 'month', source_year: 2021, source_month: 4 }
  await login(page)
  const summary = page.getByRole('region', { name: 'Resumen estadístico', exact: true })
  await expect(summary.locator('.statistics-metric').first().locator('dd strong')).toHaveText('12')
  await summary.getByLabel('Fuente de las estadísticas').selectOption('obis')
  await expect(summary.locator('.statistics-metric').first().locator('dd strong')).toHaveText('2')
  await summary.getByLabel('Año de las estadísticas').selectOption('0')
  await expect(summary.locator('.statistics-metric').first().locator('dd strong')).toHaveText('1')
  await expectChartValue(summary, 'Registros por año', 'Sin año conocido')
  await summary.getByLabel('Año de las estadísticas').selectOption('2021')
  await expectChartValue(summary, 'Registros por año', '2021')
  await summary.getByLabel('Identificación o grupo', { exact: true }).selectOption('Carcharhinus')
  await expectChartValue(summary, 'Principales identificaciones', 'Carcharhinus')
  await expect(page.getByText('Página 1 de 2', { exact: true })).toBeVisible()
  await summary.getByRole('button', { name: 'Restablecer estadísticas' }).click()
  await expect(summary.locator('.statistics-metric').first().locator('dd strong')).toHaveText('12')
})

test('gráficos accesibles: tablas exactas, teclado, móvil y texto ampliado', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await login(page)
  const summary = page.getByRole('region', { name: 'Resumen estadístico', exact: true })
  await expect(summary.locator('.statistics-metric').first().locator('dd strong')).toHaveText('12')
  const tableToggle = summary.getByText('Ver tabla de datos: registros por año', { exact: true })
  await tableToggle.focus()
  await page.keyboard.press('Enter')
  await expect(summary.getByRole('table', { name: 'Registros por año: valores exactos' })).toBeVisible()
  await expect(summary.locator('.echarts-for-react svg')).toHaveCount(3)
  const accessibility = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).exclude('nextjs-portal').analyze()
  expect(accessibility.violations).toEqual([])
  await page.addStyleTag({ content: 'html { font-size: 200%; }' })
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await summary.screenshot({ path: testInfo.outputPath('estadisticas-movil.png'), animations: 'disabled' })
})

test('ECharts: series interactivas, cambio de filtros y ajuste al ancho del contenedor', async ({ page }, testInfo) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await login(page)
  const summary = page.getByRole('region', { name: 'Resumen estadístico', exact: true })
  await expect(summary.locator('.echarts-for-react svg')).toHaveCount(3)
  const years = summary.getByRole('figure', { name: 'Registros por año', exact: true })
  await expect(years.locator('svg text').filter({ hasText: /^2026$/ })).toHaveCount(1)
  await expect(years.locator('svg text').filter({ hasText: /^12$/ })).toHaveCount(1)
  // Los tooltips SVG no insertan HTML procedente de etiquetas de registros.
  const chart = years.locator('.echarts-for-react')
  await chart.locator('svg path[fill="#91bfdf"]').first().hover()
  await expect(chart.locator('svg text').filter({ hasText: /^12 registros$/ })).toHaveCount(1)
  await page.mouse.move(0, 0)
  await summary.getByLabel('Estado de las estadísticas').selectOption('verified')
  await expect(summary.locator('.statistics-metric').first().locator('dd strong')).toHaveText('0')
  await expect(summary.locator('.echarts-for-react')).toHaveCount(0)
  await expect(summary.getByText('No hay registros para estos filtros.', { exact: true })).toHaveCount(3)
  await summary.getByLabel('Estado de las estadísticas').selectOption('all')
  await expect(summary.locator('.echarts-for-react svg')).toHaveCount(3)
  for (const width of [375, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    await expect.poll(() => years.locator('.echarts-for-react').evaluate((element) => {
      const svg = element.querySelector('svg')
      return svg ? Math.abs(svg.getBoundingClientRect().width - element.clientWidth) : Infinity
    })).toBeLessThan(2)
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  }
  await summary.screenshot({ path: testInfo.outputPath('estadisticas-echarts-escritorio.png'), animations: 'disabled' })
  expect(errors).toEqual([])
})

test('ECharts: varios años conservan todos los valores y permiten desplazamiento por teclado', async ({ page, backend }) => {
  backend.rows = Array.from({ length: 25 }, (_, i) => ({ ...backend.rows[0], id: `year-${i}`, sighting_date: `${2000 + i}-01-01` }))
  await login(page)
  const years = page.getByRole('figure', { name: 'Registros por año', exact: true })
  await expect(years.locator('.echarts-for-react svg')).toHaveCount(1)
  const visual = years.getByRole('img')
  await expect(visual).toHaveAttribute('tabindex', '0')
  await visual.focus()
  await page.keyboard.press('End')
  await expect.poll(() => visual.evaluate((element) => element.scrollTop)).toBeGreaterThan(0)
  await years.locator('.statistics-table summary').click()
  await expect(years.getByRole('rowheader')).toHaveCount(25)
  await expect(years.getByRole('rowheader').first()).toHaveText('2000')
  await expect(years.getByRole('rowheader').last()).toHaveText('2024')
})
