import { test, expect, login } from './fixtures'

test('Estudiante: tres avistamientos, ver más, paginar y volver a contraer', async ({ page, backend }) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await login(page)
  backend.profileRole = 'student'
  backend.rows[0].status = 'verified'
  backend.rows[1].status = 'verified'
  await page.goto('/estudiante')
  const list = page.locator('#module-sightings-list .workspace-list > li')
  const more = page.getByRole('button', { name: 'Ver más avistamientos', exact: true })
  const less = page.getByRole('button', { name: 'Ver menos avistamientos', exact: true })
  await expect(list).toHaveCount(3)
  await expect(page.locator('.sightings-map .leaflet-control-attribution a').first()).toHaveCSS('text-decoration-line', 'underline')
  await expect(more).toHaveAttribute('aria-expanded', 'false')
  await expect(page.getByRole('navigation', { name: 'Paginación de avistamientos', exact: true })).toHaveCount(0)
  const tables = page.locator('#resultados-obis-prueba table')
  await expect(tables).toHaveCount(3)
  const before = await tables.allTextContents()
  const requests = backend.statisticsRequests
  await more.click()
  await expect(list).toHaveCount(10)
  await expect(less).toHaveAttribute('aria-expanded', 'true')
  await page.getByRole('navigation', { name: 'Paginación de avistamientos', exact: true }).getByRole('button', { name: 'Siguiente', exact: true }).click()
  await expect(list).toHaveCount(2)
  await expect(page.getByText('12 registros · Página 2 de 2')).toBeVisible()
  expect(await tables.allTextContents()).toEqual(before)
  expect(backend.statisticsRequests).toBe(requests)
  await less.click()
  await expect(list).toHaveCount(3)
  await page.getByLabel('Estado', { exact: true }).selectOption('verified')
  await expect(list).toHaveCount(2)
  await expect(more).toHaveCount(0)
  await page.getByLabel('Estado', { exact: true }).selectOption('pending')
  await expect(list).toHaveCount(3)
  await more.click()
  await expect(list).toHaveCount(10)
  await page.getByLabel('Estado', { exact: true }).selectOption('all')
  await expect(list).toHaveCount(3)
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})

for (const [role, route] of [['researcher', '/cientifico'], ['community', '/comunidad']]) {
  test(`listado ${role}: conserva diez registros por página`, async ({ page, backend }) => {
    await login(page)
    backend.profileRole = role
    await page.goto(route)
    await expect(page.locator('#module-sightings-list .workspace-list > li')).toHaveCount(10)
    await expect(page.getByRole('button', { name: 'Ver más avistamientos', exact: true })).toHaveCount(0)
    await expect(page.getByText('12 registros · Página 1 de 2')).toBeVisible()
  })
}

test('gráficas de prueba: desplazamiento horizontal por teclado', async ({ page, backend }) => {
  await page.setViewportSize({ width: 320, height: 812 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await login(page)
  backend.profileRole = 'student'
  await page.goto('/estudiante')
  const section = page.locator('#resultados-obis-prueba')
  await expect(section.locator('.echarts-for-react svg')).toHaveCount(3)
  const scroll = section.getByRole('region', { name: /^Gráfica interactiva: Abundancia/ })
  await scroll.focus()
  await page.keyboard.press('ArrowRight')
  await expect.poll(() => scroll.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0)
})

test.describe('gráficas OBIS táctiles', () => {
  test.use({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true })
  test('toque en una barra muestra el valor exacto del Excel', async ({ page, backend }) => {
    await login(page)
    backend.profileRole = 'student'
    await page.goto('/estudiante')
    const chart = page.locator('.obis-test-echart--abundance')
    await chart.locator('svg path[fill="#ff00ff"]').first().tap()
    await expect(chart.locator('svg text').filter({ hasText: /^38 registros$/ })).toHaveCount(1)
  })
})
