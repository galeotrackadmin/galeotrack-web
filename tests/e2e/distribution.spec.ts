import AxeBuilder from '@axe-core/playwright'
import { test, expect, openSiteMenu } from './fixtures'

for (const width of [360, 375, 390, 412, 430, 768, 1024, 1366, 1440, 1920]) {
  test(`distribución pública: mapa compacto, recursos y accesibilidad a ${width}px`, async ({ page, backend }, testInfo) => {
    backend.rows[0].status = 'verified'
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/patrones-de-distribucion')
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Patrones de distribución')
    await openSiteMenu(page)
    const navigation = page.getByRole('navigation', { name: 'Navegación principal' })
    await expect(navigation.getByRole('link', { name: 'Patrones de distribución', exact: true })).toHaveAttribute('aria-current', 'page')
    await expect(navigation.getByRole('link', { name: 'Inicio', exact: true })).toHaveAttribute('href', '/#inicio')
    await expect(page.getByRole('navigation', { name: 'Herramientas de revisión' })).toHaveCount(0)
    await expect(page.locator('.site-header-sections')).toHaveCount(0)
    const close = page.getByRole('button', { name: 'Cerrar menú', exact: true })
    if (await close.isVisible()) await close.click()

    const map = page.getByRole('region', { name: 'Mapa interactivo de avistamientos en Puerto Rico' })
    await expect(map.getByRole('button', { name: 'Ver avistamiento: Tiburón nodriza', exact: true })).toBeVisible()
    await expect(page.locator('.tracker-sidebar, .tracker-toolbar, .tracker-filters, .tracker-map-layers')).toHaveCount(0)
    await expect(map.getByRole('button', { name: 'Acercar mapa' })).toBeVisible()
    await expect(map.getByRole('button', { name: 'Alejar mapa' })).toBeVisible()
    const mapHeight = await page.locator('.tracker-canvas').evaluate((element) => element.getBoundingClientRect().height)
    expect(mapHeight).toBe(width < 768 ? 320 : width < 1200 ? 400 : 480)
    await expect(page.getByText(/Los datos históricos de OBIS se gestionan por lotes/)).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Cómo interpretar los registros' })).toBeVisible()
    const guide = page.getByRole('link', { name: /Abrir guía de tiburones del Caribe/ })
    await expect(guide).toHaveAttribute('href', 'https://www.fisheries.noaa.gov/s3/2021-09/Caribbean%20Shark%20Placard_Spanish.pdf')
    expect(await guide.evaluate((element) => element.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44)
    await expect(page.getByRole('link', { name: 'Reportar un avistamiento', exact: true })).toHaveAttribute('href', '/report')
    await expect(page.getByRole('contentinfo').locator('.site-footer-founder')).toContainText('Alexandra Marrero Zambrana')
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    const accessibility = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).exclude('nextjs-portal').analyze()
    expect(accessibility.violations).toEqual([])
    await page.evaluate(() => window.scrollTo(0, 0))
    await page.screenshot({ path: testInfo.outputPath(`distribution-${width}.png`), fullPage: true, animations: 'disabled' })

    const references = page.locator('.distribution-reference-list')
    await references.locator('summary').click()
    await expect(references).toHaveAttribute('open', '')
    await expect(references.getByText('Credille, K. M.', { exact: false })).toBeVisible()
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  })
}

test('distribución: fichas superpuestas, bibliografía por teclado y texto ampliado', async ({ page, backend }) => {
  backend.rows[0].status = 'verified'
  backend.rows.push({ ...backend.rows[0], id: 'distribution-overlap', species: 'Tiburón martillo' })
  await page.setViewportSize({ width: 375, height: 812 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/patrones-de-distribucion')
  const marker = page.getByRole('button', { name: '2 avistamientos; consultar registros', exact: true })
  await marker.focus()
  await page.keyboard.press('Enter')
  await page.getByLabel('Avistamientos en este punto').selectOption('distribution-overlap')
  await expect(page.getByRole('heading', { name: 'Tiburón martillo', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Cerrar ficha del avistamiento', exact: true }).click()
  const summary = page.locator('.distribution-reference-list summary')
  await summary.focus()
  await page.keyboard.press('Enter')
  await expect(page.locator('.distribution-reference-list')).toHaveAttribute('open', '')
  await page.setViewportSize({ width: 812, height: 375 })
  await page.addStyleTag({ content: 'html { font-size: 200%; }' })
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  const accessibility = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).exclude('nextjs-portal').analyze()
  expect(accessibility.violations).toEqual([])
})

test('distribución: reintento de datos y mensaje sin avistamientos', async ({ page }) => {
  let failing = true
  await page.route('**/rest/v1/rpc/public_map_sightings', (route) => route.fulfill({ status: failing ? 503 : 200, contentType: 'application/json', body: JSON.stringify(failing ? { message: 'Unavailable' } : []) }))
  await page.goto('/patrones-de-distribucion')
  await expect(page.getByText('No se pudieron cargar los avistamientos.', { exact: false })).toBeVisible()
  failing = false
  await page.getByRole('button', { name: 'Reintentar' }).click()
  await expect(page.getByText('No hay avistamientos activos con coordenadas para mostrar.')).toBeVisible()
  await expect(page.locator('.tracker-marker')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Acercar mapa' })).toBeVisible()
})
