import AxeBuilder from '@axe-core/playwright'
import { test, expect, login, fillReport } from './fixtures'

test('registro completo: pies, opciones condicionales, contacto, archivos y reintento', async ({ page, backend }) => {
  await login(page)
  await page.goto('/report')
  await expect(page.getByRole('group', { name: 'Rol del colaborador' })).toHaveCount(0)
  await expect(page.getByText('El rol del colaborador se obtiene automáticamente de tu cuenta al guardar el avistamiento.')).toBeVisible()
  await page.route('**/rest/v1/rpc/submit_sighting', async (route) => {
    expect(route.request().postDataJSON().payload).not.toHaveProperty('collaborator_role')
    await route.fallback()
  })
  await fillReport(page)
  await page.getByLabel('Longitud total (pies)', { exact: false }).fill('6.5')
  await page.getByLabel('Longitud de horquilla (pies)', { exact: false }).fill('5')
  await page.getByRole('combobox', { name: 'Especie de tiburón observada' }).selectOption('Otro')
  await page.getByLabel('Otra especie observada').fill('Tiburón de identificación pendiente')
  await page.getByRole('group', { name: 'Comportamiento observado', exact: false }).getByRole('radio', { name: 'Otro', exact: true }).check()
  await page.getByLabel('Describe el comportamiento').fill('Moviéndose cerca de una embarcación')
  await page.getByRole('checkbox', { name: 'Sano / sin marcas visibles' }).uncheck()
  await page.getByRole('checkbox', { name: 'Heridas o cicatrices' }).check()
  await page.getByRole('checkbox', { name: 'Otro (describe lo que observas)', exact: true }).check()
  await page.getByLabel('Describe la condición de salud').fill('Una marca visible en el costado')
  await page.getByRole('radio', { name: 'Sí', exact: true }).check()
  await page.getByLabel('Nombre de contacto').fill('Ana del Mar')
  await page.getByLabel('Correo de contacto').fill('ana@example.test')
  const image = { name: 'tiburon.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aP1cAAAAASUVORK5CYII=', 'base64') }
  await page.getByLabel('Evidencia fotográfica', { exact: false }).setInputFiles(image)
  await expect(page.getByRole('img', { name: 'Vista previa de la fotografía seleccionada' })).toBeVisible()
  backend.denyReport = true
  await page.getByRole('button', { name: 'Enviar avistamiento', exact: true }).click()
  await expect(page.getByRole('main').getByRole('alert')).toContainText('Tus datos siguen aquí')
  await expect(page.getByLabel('Longitud total (pies)', { exact: false })).toHaveValue('6.5')
  backend.denyReport = false
  await page.getByRole('button', { name: 'Enviar avistamiento', exact: true }).click()
  await expect(page.getByText(/¡Gracias por contribuir!/)).toBeVisible()
  expect(backend.reports).toHaveLength(2)
  expect(backend.reports[1]).toMatchObject({ id: backend.reports[0].id, collaborator_role: 'Administrador', total_length_m: 1.9812, fork_length_m: 1.524, standard_length_m: null, quantity: 2, contact: { name: 'Ana del Mar', email: 'ana@example.test' }, health_conditions: ['Heridas o cicatrices', 'Otro'], video_path: null })
  expect(backend.reports[1].photo_path).toEqual(backend.reports[0].photo_path)
  await expect(page.getByRole('img', { name: 'Vista previa de la fotografía seleccionada' })).toHaveCount(0)
})

test('buscador de lugares, contacto omitido y reporte sin evidencia', async ({ page, backend }) => {
  await login(page)
  await page.goto('/report')
  await fillReport(page)
  await page.getByLabel('Buscar lugar o dirección').fill('Crash Boat')
  await page.getByRole('button', { name: 'Buscar lugar', exact: true }).click()
  await page.getByRole('button', { name: 'Playa Crash Boat, Aguadilla, Puerto Rico', exact: true }).click()
  await expect(page.getByRole('spinbutton', { name: 'Latitud', exact: true })).toHaveValue('18.458')
  await expect(page.getByRole('spinbutton', { name: 'Longitud', exact: true })).toHaveValue('-67.164')
  await page.getByRole('radio', { name: 'Sí', exact: true }).check()
  await page.getByLabel('Nombre de contacto').fill('Dato descartado')
  await page.getByLabel('Correo de contacto').fill('descartado@example.test')
  await page.getByRole('radio', { name: 'No', exact: true }).check()
  await page.getByRole('button', { name: 'Enviar avistamiento', exact: true }).click()
  await expect(page.getByText(/¡Gracias por contribuir!/)).toBeVisible()
  expect(backend.reports[0]).toMatchObject({ latitude: 18.458, longitude: -67.164, altitude: null, accuracy: null, contact: null, photo_path: null, video_path: null })
})

for (const [role, route] of [['student', '/estudiante'], ['researcher', '/cientifico'], ['community', '/comunidad'], ['admin', '/admin']]) {
  test(`${role}: mapa independiente del listado, hover, teclado y ficha completa`, async ({ page, backend }, testInfo) => {
    backend.profileRole = role
    backend.rows[11] = { ...backend.rows[11], species: 'Tiburón limón del mapa', latitude: 18.05, longitude: -65.5, sighting_time: '14:30:00', total_length_m: 1.9812, sex: 'Hembra', health_conditions: ['Heridas o cicatrices'] }
    await page.goto('/login')
    await page.getByLabel('Correo electrónico').fill('member@example.test')
    await page.getByLabel('Contraseña', { exact: true }).fill('test-password')
    await page.getByRole('button', { name: 'Iniciar sesión', exact: true }).click()
    await expect(page).toHaveURL(new RegExp(`${route}$`))
    const map = page.getByRole('region', { name: 'Mapa de avistamientos', exact: true })
    await expect(map.getByText(/2 avistamientos con coordenadas/)).toBeVisible()
    const point = map.getByRole('button', { name: 'Avistamiento: Tiburón limón del mapa', exact: true })
    await point.hover()
    await expect(map.locator('.sighting-popup')).toContainText('14:30 (PR)')
    await page.keyboard.press('Escape')
    await point.focus()
    await page.keyboard.press('Enter')
    await map.getByRole('button', { name: 'Ver ficha y evidencia', exact: true }).click()
    await expect(map.getByText('6.5 pies', { exact: true })).toBeVisible()
    await expect(map.getByText('Hembra', { exact: true })).toBeVisible()
    await map.screenshot({ path: testInfo.outputPath(`map-${role}.png`) })
    const accessibility = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).exclude('nextjs-portal').analyze()
    expect(accessibility.violations).toEqual([])
  })
}

test('mapa móvil: puntos superpuestos, toque y filtro de estado', async ({ page, backend }, testInfo) => {
  await page.setViewportSize({ width: 375, height: 900 })
  backend.rows[1] = { ...backend.rows[1], latitude: 18.34, longitude: -67.25 }
  await login(page)
  const map = page.getByRole('region', { name: 'Mapa de avistamientos', exact: true })
  await map.getByRole('button', { name: '2 avistamientos en esta zona', exact: true }).click()
  await map.getByRole('combobox', { name: 'Avistamientos en esta zona', exact: false }).selectOption(backend.rows[1].id)
  await expect(map.locator('.sighting-popup')).toContainText('Tiburón martillo')
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await map.screenshot({ path: testInfo.outputPath('map-mobile.png') })
  await map.getByRole('button', { name: 'Cerrar tarjeta' }).click()
  await expect(map.locator('.sighting-popup')).toHaveCount(0)
  await page.getByLabel('Estado', { exact: true }).selectOption('verified')
  await expect(map.getByText(/No hay avistamientos con coordenadas/)).toBeVisible()
})

test.describe('mapa autenticado táctil', () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } })
  test('consulta de evidencia y scroll de la página sobre el mapa', async ({ page, backend }) => {
    backend.profileRole = 'community'
    await page.goto('/login')
    await page.getByLabel('Correo electrónico').fill('diver@example.test')
    await page.getByLabel('Contraseña', { exact: true }).fill('test-password')
    await page.getByRole('button', { name: 'Iniciar sesión', exact: true }).click()
    await expect(page).toHaveURL(/\/comunidad$/)
    const map = page.getByRole('region', { name: 'Mapa de avistamientos', exact: true })
    await map.getByRole('button', { name: 'Avistamiento: Tiburón nodriza', exact: true }).tap()
    await expect(map.getByRole('button', { name: 'Ver ficha y evidencia' })).toBeVisible()
    await map.getByRole('button', { name: 'Cerrar tarjeta' }).tap()
    const frame = await map.locator('.sightings-map').boundingBox()
    const before = await page.evaluate(() => scrollY)
    const session = await page.context().newCDPSession(page)
    const x = frame!.x + frame!.width / 2
    const y = frame!.y + frame!.height / 2
    await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] })
    for (let step = 1; step <= 5; step++) await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y - step * 20 }] })
    await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(before)
    await session.detach()
  })
})
