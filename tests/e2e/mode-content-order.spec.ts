import AxeBuilder from '@axe-core/playwright'
import { test, expect, login } from './fixtures'

for (const width of [320, 1440]) {
  for (const [role, route] of [['student', '/estudiante'], ['researcher', '/cientifico'], ['community', '/comunidad'], ['admin', '/admin']]) {
    test(`${role}: mapa primero y estadísticas correctas a ${width}px`, async ({ page, backend }, testInfo) => {
      await page.setViewportSize({ width, height: 900 })
      await page.emulateMedia({ reducedMotion: 'reduce' })
      await login(page)
      await expect(page.locator('#estadisticas .statistics-metric').first().locator('dd strong')).toHaveText('12')
      const requests = backend.statisticsRequests
      backend.profileRole = role
      await page.goto(route)
      const map = page.getByRole('region', { name: 'Mapa de avistamientos', exact: true })
      await expect(map).toHaveCount(1)
      await expect(map.locator('.sightings-map')).toBeVisible()
      const sections = await page.locator('main section[id]').evaluateAll((elements) => elements.map((element) => element.id))
      expect(sections[0]).toBe('mapa-avistamientos')
      await expect(page.getByRole('link', { name: 'Mapa de avistamientos', exact: true }).first()).toHaveAttribute('href', '#mapa-avistamientos')
      if (role === 'student') {
        expect(sections.indexOf('especies')).toBeGreaterThan(sections.indexOf('mapa-avistamientos'))
        expect(sections.indexOf('avistamientos')).toBeGreaterThan(sections.indexOf('especies'))
        await expect(page.locator('#module-sightings-list .workspace-list > li')).toHaveCount(3)
        await expect(map.getByText(/avistamientos con coordenadas para estos filtros/)).toHaveCount(0)
        await expect(map.getByText('Los registros sin coordenadas se consultan en el listado.', { exact: false })).toHaveCount(0)
      } else {
        await expect(map.getByText(/avistamientos con coordenadas para estos filtros/)).toBeVisible()
      }
      if (role === 'student' || role === 'researcher') {
        const charts = page.locator('#resultados-obis-prueba')
        await expect(page.locator('#avistamientos #resultados-obis-prueba')).toHaveCount(1)
        await expect(charts.locator('.echarts-for-react svg')).toHaveCount(3)
        await expect(charts.getByRole('heading', { name: 'Estadísticas', exact: true })).toBeVisible()
        await expect(page.getByRole('link', { name: 'Estadísticas', exact: true })).toHaveAttribute('href', '#resultados-obis-prueba')
        await expect(charts.locator('.obis-test-caption p')).toHaveText(['Cantidad de registros por identificación.', 'Evolución de los registros a lo largo de los años.', 'Profundidad máxima promedio registrada por especie.'])
        await expect(charts).not.toContainText('Datos de prueba.')
        await expect(charts.getByRole('link', { name: /PDF/ })).toHaveCount(0)
        await expect(charts.getByRole('link', { name: /Comparar/ })).toHaveCount(0)
        await expect(page.locator('#estadisticas')).toHaveCount(0)
        await expect(page.getByRole('link', { name: 'Resumen estadístico', exact: true })).toHaveCount(0)
        expect(backend.statisticsRequests).toBe(requests)
        await expect(page.locator('#referencias li')).toHaveCount(16)
        await expect(page.locator('#referencias')).toContainText('OBIS Mapper.')
        await expect(page.locator('#referencias')).toContainText('Carrier, J. C.')
        await expect(page.getByRole('heading', { name: 'Referencias del documento', exact: true })).toHaveCount(0)
      } else {
        await expect(page.getByRole('region', { name: 'Resumen estadístico', exact: true })).toBeVisible()
        await expect(page.locator('#resultados-obis-prueba')).toHaveCount(0)
      }
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
      const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).exclude('nextjs-portal').analyze()
      expect(axe.violations).toEqual([])
      await page.screenshot({ path: testInfo.outputPath(`${role}-mapa-primero-${width}.png`), animations: 'disabled', style: 'nextjs-portal { visibility: hidden; }' })
    })
  }
}

test('Estudiante: ocultar el conteo del mapa conserva el mensaje de mapa vacío', async ({ page, backend }) => {
  await login(page)
  backend.profileRole = 'student'
  for (const row of backend.rows) { row.latitude = null; row.longitude = null }
  await page.goto('/estudiante')
  const map = page.getByRole('region', { name: 'Mapa de avistamientos', exact: true })
  await expect(map.getByText('No hay avistamientos con coordenadas para estos filtros.', { exact: true })).toBeVisible()
  await expect(page.locator('#module-sightings-list .workspace-list > li')).toHaveCount(3)
  await expect(map.getByText('Los registros sin coordenadas se consultan en el listado.', { exact: false })).toHaveCount(0)
})
