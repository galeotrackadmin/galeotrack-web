import AxeBuilder from '@axe-core/playwright'
import { test, expect, login } from './fixtures'

test('mapa de portada compacto: popup accesible, zoom y sin paneles ni filtros', async ({ page, backend }) => {
  backend.rows[0].status = 'verified'
  await page.setViewportSize({ width: 375, height: 812 })
  await page.goto('/')
  const map = page.getByRole('region', { name: 'Mapa interactivo de avistamientos en Puerto Rico' })
  await expect(map).toBeVisible()
  await expect(page.locator('.tracker-sidebar, .tracker-toolbar, .tracker-filters')).toHaveCount(0)
  await expect(map.getByRole('button', { name: 'Acercar mapa' })).toBeVisible()
  await expect(map.getByRole('button', { name: 'Alejar mapa' })).toBeVisible()
  await expect(map.getByRole('button', { name: 'Centrar mapa en Puerto Rico' })).toHaveCount(0)
  const marker = page.getByRole('button', { name: 'Ver avistamiento: Tiburón nodriza', exact: true })
  await expect(marker).toBeVisible()
  await expect(marker.locator('.shark-marker-ring')).toHaveCSS('border-radius', '50%')
  await expect(marker.locator('.shark-map-glyph')).toHaveJSProperty('offsetWidth', 13)
  await expect(page.getByRole('button', { name: 'Satélite' })).toHaveAttribute('aria-pressed', 'true')
  await marker.focus()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('heading', { name: 'Tiburón nodriza', exact: true })).toBeVisible()
  await expect(page.getByText('Rincón, Puerto Rico')).toBeVisible()
  await expect(page.getByText('18.3400, -67.2500')).toBeVisible()
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  const accessibility = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).exclude('nextjs-portal').analyze()
  expect(accessibility.violations).toEqual([])
})

test('mapa oceánico se conserva al cambiar de página y está disponible en todos los mapas', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Oceánico' }).click()
  await expect(page.getByRole('button', { name: 'Oceánico' })).toHaveAttribute('aria-pressed', 'true')
  await page.goto('/patrones-de-distribucion')
  await expect(page.getByRole('button', { name: 'Oceánico' })).toHaveAttribute('aria-pressed', 'true')
  await login(page)
  await page.goto('/report')
  await expect(page.getByRole('button', { name: 'Oceánico' })).toHaveAttribute('aria-pressed', 'true')
})

test('mapa compacto: error recuperable y estado sin avistamientos', async ({ page }) => {
  let failing = true
  await page.route('**/rest/v1/rpc/public_map_sightings', (route) => route.fulfill({ status: failing ? 503 : 200, contentType: 'application/json', body: JSON.stringify(failing ? { message: 'Unavailable' } : []) }))
  await page.goto('/')
  await expect(page.getByText('No se pudieron cargar los avistamientos.', { exact: false })).toBeVisible()
  failing = false
  await page.getByRole('button', { name: 'Reintentar' }).click()
  await expect(page.getByText('No hay avistamientos activos con coordenadas para mostrar.')).toBeVisible()
  await expect(page.locator('.tracker-marker')).toHaveCount(0)
})

test('mapa compacto: texto ampliado sin overflow', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 })
  await page.goto('/')
  await page.addStyleTag({ content: 'html { font-size: 200%; }' })
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})

test('pendiente comunitario: advertencia solo dentro de la tarjeta y estados no públicos ocultos', async ({ page, backend }) => {
  backend.rows[0].status = 'pending'
  backend.rows.push({ ...backend.rows[0], id: 'rejected-public', species: 'Registro rechazado', status: 'rejected' })
  backend.rows.push({ ...backend.rows[0], id: 'deleted-public', species: 'Registro eliminado', deleted_at: '2026-10-16T00:00:00Z' })
  backend.importBatches.push({ id: 'withdrawn-batch', file_name: 'retirado.csv', row_count: 1, duplicate_count: 0, status: 'withdrawn', created_at: '2026-10-16T00:00:00Z', quality_summary: {} })
  backend.rows.push({ ...backend.rows[0], id: 'withdrawn-public', species: 'Registro de lote retirado', import_batch_id: 'withdrawn-batch', source_name: 'OBIS' })
  await page.goto('/')
  await expect(page.getByText('Este avistamiento aún no ha sido verificado.')).toHaveCount(0)
  await page.getByRole('button', { name: 'Ver avistamiento: Tiburón nodriza', exact: true }).click()
  const card = page.locator('.tracker-popup')
  await expect(card.getByRole('note', { name: 'Estado de revisión' })).toContainText('Este avistamiento aún no ha sido verificado.')
  await expect(card.getByText('Verificado', { exact: true })).toHaveCount(0)
  await expect(page.locator('.tracker-marker')).toHaveCount(1)
})

test('OBIS pendiente sin fecha completa aparece con aviso en su tarjeta y conserva el mes documentado', async ({ page, backend }) => {
  backend.importBatches.push({ id: 'obis-active', file_name: 'obis.csv', row_count: 1, duplicate_count: 0, status: 'pending', created_at: '2026-10-16T00:00:00Z', quality_summary: {} })
  backend.rows[0] = { ...backend.rows[0], species: 'Squalus cubensis', status: 'pending', reporter_id: null, source_name: 'OBIS', import_batch_id: 'obis-active', sighting_date: null, sighting_time: null, source_year: 2021, source_month: 4, date_precision: 'month' }
  await page.setViewportSize({ width: 375, height: 812 })
  await page.goto('/')
  await expect(page.getByText('Registro histórico de OBIS. Pendiente de revisión por GaleoTrack.')).toHaveCount(0)
  await page.getByRole('button', { name: 'Ver avistamiento: Squalus cubensis', exact: true }).click()
  const card = page.locator('.tracker-popup')
  await expect(card.getByRole('note', { name: 'Estado de revisión' })).toContainText('Registro histórico de OBIS. Pendiente de revisión por GaleoTrack.')
  await expect(card.getByText('abril de 2021', { exact: true })).toBeVisible()
  await expect(card.getByText('2021-04-01')).toHaveCount(0)
  await expect(card.getByText('Verificado', { exact: true })).toHaveCount(0)
  const accessibility = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).exclude('nextjs-portal').analyze()
  expect(accessibility.violations).toEqual([])
})

test('grupo mixto: cambiar de registro actualiza la advertencia sin verificar el pendiente', async ({ page, backend }) => {
  backend.rows[0].status = 'verified'
  backend.rows.push({ ...backend.rows[0], id: 'pending-overlap', species: 'Tiburón pendiente', status: 'pending' })
  await page.goto('/')
  await page.getByRole('button', { name: '2 avistamientos; consultar registros', exact: true }).click()
  const card = page.locator('.tracker-popup')
  await expect(card.getByText('Verificado', { exact: true })).toBeVisible()
  await expect(card.getByRole('note', { name: 'Estado de revisión' })).toHaveCount(0)
  await page.getByLabel('Avistamientos en este punto').selectOption('pending-overlap')
  await expect(card.getByText('Este avistamiento aún no ha sido verificado.')).toBeVisible()
  await expect(card.getByText('Verificado', { exact: true })).toHaveCount(0)
  await page.getByLabel('Avistamientos en este punto').selectOption(backend.rows[0].id)
  await expect(card.getByText('Verificado', { exact: true })).toBeVisible()
  await expect(card.getByRole('note', { name: 'Estado de revisión' })).toHaveCount(0)
})

test('mapa compacto: consulta y cierre de avistamientos en coordenadas idénticas', async ({ page, backend }) => {
  backend.rows[0].status = 'verified'
  backend.rows.push({ ...backend.rows[0], id: 'overlapping', species: 'Tiburón martillo', quantity: 3 })
  await page.setViewportSize({ width: 360, height: 800 })
  await page.goto('/')
  await page.getByRole('button', { name: '2 avistamientos; consultar registros', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Tiburón nodriza', exact: true })).toBeVisible()
  await page.getByLabel('Avistamientos en este punto').selectOption('overlapping')
  await expect(page.getByRole('heading', { name: 'Tiburón martillo', exact: true })).toBeVisible()
  await page.addStyleTag({ content: 'html { font-size: 200%; }' })
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.getByRole('button', { name: 'Cerrar ficha del avistamiento', exact: true }).click()
  await expect(page.locator('.leaflet-popup')).toHaveCount(0)
})

test.describe('mapa en pantalla táctil', () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } })
  test('permite desplazar la página sobre el mapa y consultar un punto por toque', async ({ page, backend }) => {
    backend.rows[0].status = 'verified'
    await page.goto('/')
    const marker = page.getByRole('button', { name: 'Ver avistamiento: Tiburón nodriza', exact: true })
    await marker.tap()
    await expect(page.getByRole('heading', { name: 'Tiburón nodriza', exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Cerrar ficha del avistamiento', exact: true }).tap()
    const map = page.locator('.tracker-map')
    await expect(map).toHaveCSS('touch-action', 'pan-y pinch-zoom')
    const bounds = await map.boundingBox()
    const before = await page.evaluate(() => scrollY)
    const session = await page.context().newCDPSession(page)
    const x = bounds!.x + bounds!.width / 2
    const y = bounds!.y + bounds!.height / 2
    await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] })
    for (let step = 1; step <= 5; step++) {
      await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y - step * 20 }] })
    }
    await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(before)
    await session.detach()
  })
})
