import AxeBuilder from '@axe-core/playwright'
import { test, expect, login, fillReport } from './fixtures'

for (const width of [375, 768, 1024, 1440]) {
  test(`identidad y accesibilidad en login, reporte y panel a ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 })
    for (const route of ['/login', '/report', '/admin']) {
      if (route === '/admin') await login(page)
      else if (route === '/report') { await login(page); await page.goto(route) }
      else await page.goto(route)
      await expect(page.locator('h1')).toBeVisible()
      await expect.poll(() => page.getByRole('img', { name: 'GaleoTrack', exact: true }).first().evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true)
      if (route === '/report') await expect(page.locator('.leaflet-container')).toBeVisible()
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
      const accessibility = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).exclude('nextjs-portal').analyze()
      expect(accessibility.violations).toEqual([])
      await page.screenshot({ path: testInfo.outputPath(`${route.slice(1)}-${width}.png`), fullPage: true })
    }
  })
}

test('reporte autenticado: valida, conserva datos tras error y envía una sola vez', async ({ page, backend }) => {
  await login(page)
  await page.goto('/report')
  await page.getByRole('button', { name: 'Enviar avistamiento' }).click()
  await expect(page.getByLabel('Fecha del avistamiento')).toBeFocused()
  await expect(page.getByText('Selecciona una especie o indica que no la conoces.')).toBeVisible()
  expect(backend.reports).toHaveLength(0)
  await fillReport(page)
  await page.getByRole('spinbutton', { name: 'Longitud', exact: true }).fill('')
  await page.getByLabel('Latitud').fill('18.34')
  await page.getByRole('button', { name: 'Enviar avistamiento' }).click()
  await expect(page.getByText('Selecciona la ubicación o escribe la longitud.')).toBeVisible()
  expect(backend.reports).toHaveLength(0)
  await page.getByRole('spinbutton', { name: 'Longitud', exact: true }).fill('-67.25')
  await expect(page.getByRole('button', { name: 'Ubicación del avistamiento', exact: true })).toBeVisible()
  backend.denyReport = true
  await page.getByRole('button', { name: 'Enviar avistamiento' }).click()
  await expect(page.getByRole('main').getByRole('alert')).toContainText('Tus datos siguen aquí')
  await expect(page.getByLabel('Nombre de la ubicación')).toHaveValue('Rincón, Puerto Rico')
  backend.denyReport = false
  backend.delayReport = 600
  await page.getByRole('button', { name: 'Enviar avistamiento' }).click()
  await expect(page.getByRole('button', { name: 'Enviando avistamiento' })).toBeDisabled()
  await expect(page.getByLabel('Nombre de la ubicación')).toBeDisabled()
  await expect(page.getByText(/¡Gracias por contribuir!/)).toBeVisible()
  expect(backend.reports).toHaveLength(2)
  expect(backend.reports[1]).toMatchObject({ latitude: 18.34, longitude: -67.25, status: 'pending' })
  await expect(page.getByLabel('Nombre de la ubicación')).toHaveValue('')
  await expect(page.getByRole('button', { name: 'Ubicación del avistamiento', exact: true })).toHaveCount(0)
})

test('GPS denegado permite continuar y GPS correcto sincroniza los campos', async ({ page, context }) => {
  await login(page)
  await page.goto('/report')
  await page.getByRole('button', { name: 'Usar mi ubicación' }).click()
  await expect(page.getByRole('main').getByRole('alert')).toContainText('Puedes reintentar')
  await context.grantPermissions(['geolocation'])
  await context.setGeolocation({ latitude: 18.34, longitude: -67.25 })
  await page.getByRole('button', { name: 'Usar mi ubicación' }).click()
  await expect(page.getByLabel('Latitud')).toHaveValue('18.34')
  await expect(page.getByRole('spinbutton', { name: 'Longitud', exact: true })).toHaveValue('-67.25')
  await page.getByRole('button', { name: 'Quitar coordenadas' }).click()
  await expect(page.getByLabel('Latitud')).toHaveValue('')
})

test('panel: filtros y páginas sobreviven a recarga y Atrás; permite revisar y salir', async ({ page, backend }) => {
  await login(page)
  await page.getByLabel('Estado', { exact: true }).selectOption('pending')
  await expect(page).toHaveURL(/status=pending/)
  await page.getByRole('button', { name: 'Siguiente' }).click()
  await expect(page).toHaveURL(/page=2/)
  await page.reload()
  await expect(page.getByText('Página 2 de 2')).toBeVisible()
  await expect(page.getByLabel('Estado', { exact: true })).toHaveValue('pending')
  await page.goBack()
  await expect(page.getByText('Página 1 de 2')).toBeVisible()
  await page.getByRole('button', { name: 'Aprobar avistamiento de Tiburón nodriza' }).click()
  await expect(page.getByText('Avistamiento aprobado.', { exact: true })).toBeVisible()
  expect(backend.reviews).toBe(1)
  await page.getByRole('button', { name: /Cuenta de María Rivera/ }).click()
  await page.getByRole('button', { name: 'Cerrar sesión', exact: true }).click()
  await expect(page).toHaveURL(/\/login$/)
})

test('callback inválido, ruta inexistente y acceso sin rol tienen salidas claras', async ({ page, backend }) => {
  await page.goto('/auth/callback')
  await expect(page.getByRole('main').getByRole('alert')).toContainText('enlace de acceso no es válido')
  await page.getByRole('link', { name: 'Volver al inicio de sesión' }).click()
  await expect(page).toHaveURL(/\/login$/)
  backend.profileRole = 'observer'
  await page.getByLabel('Correo electrónico').fill('reviewer@example.test')
  await page.getByLabel('Contraseña', { exact: true }).fill('test-password')
  await page.getByRole('button', { name: 'Iniciar sesión', exact: true }).click()
  await expect(page.getByRole('main').getByRole('alert')).toContainText('no tiene acceso al panel')
  await page.goto('/pagina-inexistente')
  await expect(page.getByRole('heading', { name: 'Este rumbo no lleva a ninguna página.' })).toBeVisible()
  await expect(page.getByRole('main').getByRole('link', { name: 'Reportar un avistamiento' })).toHaveAttribute('href', '/report')
})

test('detalles de revisión accesibles por teclado, con coordenadas cero y datos opcionales ausentes', async ({ page, backend }, testInfo) => {
  backend.rows[0].latitude = 0
  backend.rows[0].longitude = 0
  backend.rows[0].estimated_size = 0
  backend.rows[0].notes = 'Observación realizada desde la costa.'
  await page.setViewportSize({ width: 375, height: 900 })
  await login(page)
  const first = page.getByRole('article').first()
  const summary = first.locator('summary').first()
  await summary.focus()
  await page.keyboard.press('Enter')
  await expect(first.locator('details').first()).toHaveAttribute('open', '')
  await expect(first.getByText('0.000000, 0.000000', { exact: true })).toBeVisible()
  await expect(first.getByText('0 pies', { exact: true })).toBeVisible()
  await expect(first.getByText('Observación realizada desde la costa.')).toBeVisible()
  const second = page.getByRole('article').nth(1)
  await second.locator('summary').first().click()
  await expect(second.getByText('No indicadas', { exact: true })).toBeVisible()
  await expect(second.getByText('No indicado', { exact: true })).toBeVisible()
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  const accessibility = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).exclude('nextjs-portal').analyze()
  expect(accessibility.violations).toEqual([])
  await page.screenshot({ path: testInfo.outputPath('admin-details-375.png'), fullPage: true })
})

test('teclado, movimiento reducido y texto ampliado en horizontal', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.setViewportSize({ width: 812, height: 375 })
  await page.goto('/login')
  await page.keyboard.press('Tab')
  await expect(page.getByRole('link', { name: 'Ir al contenido principal' })).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page.locator('#main-content')).toBeFocused()
  await page.getByLabel('Contraseña', { exact: true }).fill('example-password')
  await page.getByRole('button', { name: 'Mostrar contraseña' }).click()
  await expect(page.getByLabel('Contraseña', { exact: true })).toHaveAttribute('type', 'text')
  await login(page)
  await page.goto('/report')
  await page.addStyleTag({ content: 'html { font-size: 200%; }' })
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await expect(page.getByRole('button', { name: 'Enviar avistamiento' })).toBeEnabled()
})
