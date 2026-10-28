import AxeBuilder from '@axe-core/playwright'
import { readFile } from 'node:fs/promises'
import { test, expect, login } from './fixtures'

for (const width of [320, 375, 430, 768, 1024, 1280, 1440, 1920]) {
  test(`Estudiante: tres figuras OBIS originales de prueba a ${width}px`, async ({ page, backend }, testInfo) => {
    await page.setViewportSize({ width, height: 900 })
    await login(page)
    backend.profileRole = 'student'
    await page.goto('/estudiante')
    await page.getByRole('link', { name: 'Estadísticas', exact: true }).click()
    const section = page.getByRole('region', { name: 'Estadísticas', exact: true })
    await expect(section).toBeVisible()
    await expect(section).not.toContainText('Datos de prueba. Valores fijos del Excel.')
    await expect(section.locator('.obis-test-caption p')).toHaveText(['Cantidad de registros por identificación.', 'Evolución de los registros a lo largo de los años.', 'Profundidad máxima promedio registrada por especie.'])
    await expect(section.getByRole('link', { name: /PDF/ })).toHaveCount(0)
    await expect(section.getByRole('link', { name: /Comparar/ })).toHaveCount(0)
    await expect(section.getByRole('figure')).toHaveCount(3)
    await expect(section.locator('img')).toHaveCount(0)
    await expect(section.locator('.echarts-for-react svg')).toHaveCount(3)
    for (const [index, rows] of [25, 18, 6].entries()) {
      await section.getByText(`Ver tabla de datos de la figura ${index + 1}`, { exact: true }).click()
      await expect(section.getByRole('table').nth(index).getByRole('row')).toHaveCount(rows)
    }
    const table = section.getByRole('table').nth(2)
    await expect(table.getByRole('row')).toHaveCount(6)
    await expect(table.getByRole('row', { name: 'Carcharhinus perezii 26.38461538 13', exact: true })).toBeVisible()
    await expect(table.getByRole('row', { name: 'Ginglymostoma cirratum 23.43605263 38', exact: true })).toBeVisible()
    await expect(table.getByRole('row', { name: 'Squalus cubensis 329 1', exact: true })).toBeVisible()
    await expect(section.getByRole('listitem')).toHaveCount(0)
    await expect(page.locator('.workspace-sections > section:last-child')).toHaveAttribute('id', 'referencias')
    await expect(page.getByRole('region', { name: 'Resumen estadístico', exact: true })).toHaveCount(0)
    if (width === 320 || width === 1440) {
      const axe = await new AxeBuilder({ page }).include('#resultados-obis-prueba').withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze()
      expect(axe.violations).toEqual([])
      await section.screenshot({ path: testInfo.outputPath(`resultados-obis-${width}.png`), animations: 'disabled', style: '.site-header, nextjs-portal { visibility: hidden; }' })
      await page.addStyleTag({ content: 'html { font-size: 200%; }' })
    }
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  })
}

test('figuras de prueba: recursos originales descargables y aislados de los filtros', async ({ page, backend }) => {
  await login(page)
  backend.profileRole = 'student'
  await page.goto('/estudiante')
  const section = page.locator('#resultados-obis-prueba')
  await expect(section.locator('.echarts-for-react svg')).toHaveCount(3)
  const before = await section.locator('table').allTextContents()
  await page.getByLabel('Estado', { exact: true }).selectOption('verified')
  await page.getByRole('button', { name: 'Actualizar avistamientos', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Actualizar avistamientos', exact: true })).toBeEnabled()
  expect(await section.locator('table').allTextContents()).toEqual(before)
  const chart = section.locator('.obis-test-echart--abundance')
  await chart.locator('svg path[fill="#ff00ff"]').first().hover()
  await expect(chart.locator('svg text').filter({ hasText: /^38 registros$/ })).toHaveCount(1)
  for (const path of ['/pdf/obis-resultados-prueba.pdf', '/images/obis-test/figure-1.png', '/images/obis-test/figure-2.png', '/images/obis-test/figure-3.png']) {
    const response = await page.request.get(path)
    expect(response.status()).toBe(200)
    expect(await response.body()).toEqual(await readFile(`public${path}`))
  }
})

for (const [role, route] of [['community', '/comunidad'], ['admin', '/admin']]) {
  test(`figuras de prueba: no se añaden al modo ${role}`, async ({ page, backend }) => {
    await login(page)
    backend.profileRole = role
    await page.goto(route)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await expect(page.locator('#resultados-obis-prueba')).toHaveCount(0)
    await expect(page.getByRole('link', { name: 'Estadísticas', exact: true })).toHaveCount(0)
  })
}
