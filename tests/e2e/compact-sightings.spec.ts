import AxeBuilder from '@axe-core/playwright'
import { test, expect, login } from './fixtures'

for (const width of [320, 1440]) {
  test(`listado compacto: iconos, información, foco y popups a ${width}px`, async ({ page, backend }, testInfo) => {
    backend.rows[0].status = 'verified'
    backend.rows[0].location_name = null
    await page.setViewportSize({ width, height: 900 })
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await login(page)
    const first = page.locator('.workspace-list article').first()
    const status = first.getByRole('button', { name: 'Estado: Verificado', exact: true })
    const remove = first.getByRole('button', { name: 'Eliminar avistamiento de Tiburón nodriza', exact: true })
    await expect(remove).toHaveText('')
    await expect(remove.locator('svg')).toHaveClass(/tabler-icon-trash/)
    await expect(status.locator('svg')).toHaveClass(/tabler-icon-circle-check/)
    expect((await first.boundingBox())!.height).toBeLessThan(210)
    const title = await first.getByRole('heading').boundingBox()
    const actions = await first.locator('.sighting-record-actions').boundingBox()
    expect(title!.x + title!.width).toBeLessThanOrEqual(actions!.x)
    for (const control of await first.locator('.sighting-icon-button').all()) {
      const bounds = await control.boundingBox()
      expect(bounds!.width).toBeGreaterThanOrEqual(44)
      expect(bounds!.height).toBeGreaterThanOrEqual(44)
    }
    const missing = first.getByRole('button', { name: 'Ubicación no especificada', exact: true })
    await missing.hover()
    const popup = page.getByRole('dialog', { name: 'Ubicación no especificada', exact: true })
    await expect(popup).toBeVisible()
    await expect(popup).toContainText('No se indicó el nombre de la ubicación')
    await page.keyboard.press('Escape')
    await expect(popup).toBeHidden()
    await status.focus()
    const verification = page.getByRole('dialog', { name: 'Estado: Verificado', exact: true })
    await expect(verification).toContainText('revisión aprobada')
    await page.keyboard.press('Escape')
    await expect(verification).toBeHidden()
    await remove.hover()
    await expect(page.getByRole('tooltip')).toHaveText('Eliminar avistamiento')
    await page.mouse.move(0, 0)
    await page.keyboard.press('Escape')
    await first.screenshot({ path: testInfo.outputPath(`registro-compacto-${width}.png`), animations: 'disabled', style: '.site-header, nextjs-portal { visibility: hidden; }' })
    const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).exclude('nextjs-portal').analyze()
    expect(axe.violations).toEqual([])
    backend.rows[0].status = 'pending'
    await page.goto('/admin')
    await expect(first.getByRole('button', { name: /^Aprobar avistamiento de/ })).toBeVisible()
    expect((await first.boundingBox())!.height).toBeLessThan(210)
    await first.screenshot({ path: testInfo.outputPath(`registro-pendiente-${width}.png`), animations: 'disabled', style: '.site-header, nextjs-portal { visibility: hidden; }' })
    await page.addStyleTag({ content: 'html { font-size: 200%; }' })
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  })
}

for (const [role, route] of [['student', '/estudiante'], ['researcher', '/cientifico'], ['community', '/comunidad']]) {
  test(`permisos ${role}: papelera y edición solo para sus registros autorizados`, async ({ page, backend }) => {
    await login(page)
    backend.profileRole = role
    backend.rows[0].status = 'verified'
    backend.rows[1].status = 'rejected'
    backend.rows[1].reporter_id = 'another-author'
    await page.goto(route)
    const own = page.locator('.workspace-list article').first()
    const other = page.locator('.workspace-list article').nth(1)
    await expect(own.getByRole('button', { name: /^Eliminar avistamiento de/ })).toHaveCount(role === 'student' ? 0 : 1)
    await expect(own.getByRole('link', { name: /^Editar avistamiento de/ })).toHaveCount(role === 'student' ? 0 : 1)
    await expect(other.getByRole('button', { name: /^Eliminar avistamiento de/ })).toHaveCount(0)
    await expect(other.getByRole('link', { name: /^Editar avistamiento de/ })).toHaveCount(0)
    await expect(page.getByRole('button', { name: /^Aprobar avistamiento de/ })).toHaveCount(0)
    await expect(page.getByRole('button', { name: /^Marcar como (verificado|rechazado)/ })).toHaveCount(0)
    await own.getByRole('button', { name: /^Detalles del avistamiento de/ }).click()
    await expect(own.getByText('Tamaño aproximado', { exact: true })).toBeVisible()
  })
}

test('datos extremos y revisión: títulos largos, notas, origen OBIS y controles separados', async ({ page, backend }) => {
  backend.rows[0].species = 'Identificación científica excepcionalmente larga sin verificar '.repeat(5)
  backend.rows[0].location_name = 'Ubicación '.repeat(25)
  backend.rows[0].source_name = 'OBIS'
  backend.rows[0].import_batch_id = 'original-batch'
  backend.rows[0].notes = 'Nota de campo conservada.'
  await page.setViewportSize({ width: 320, height: 900 })
  await login(page)
  const first = page.locator('.workspace-list article').first()
  await expect(first.getByRole('link', { name: /^Editar avistamiento de/ })).toHaveCount(0)
  await expect(first.getByRole('button', { name: /^Eliminar avistamiento de/ })).toHaveCount(1)
  await first.getByRole('button', { name: /^Detalles del avistamiento de/ }).click()
  await expect(first.getByText('Nota de campo conservada.')).toBeVisible()
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await first.getByRole('button', { name: /^Aprobar avistamiento de/ }).click()
  await expect(first.getByRole('button', { name: 'Estado: Verificado', exact: true })).toBeVisible()
  await expect(first.getByRole('button', { name: /^Aprobar avistamiento de/ })).toHaveCount(0)
  expect(backend.reviews).toBe(1)
})

test.describe('registro compacto táctil', () => {
  test.use({ viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true })
  test('ubicación y estado por toque; la papelera mantiene confirmación', async ({ page, backend }) => {
    backend.rows[0].location_name = null
    await login(page)
    const first = page.locator('.workspace-list article').first()
    await first.getByRole('button', { name: 'Ubicación no especificada', exact: true }).tap()
    await expect(page.getByRole('dialog', { name: 'Ubicación no especificada', exact: true })).toBeVisible()
    await first.getByRole('button', { name: 'Ubicación no especificada', exact: true }).tap()
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await first.getByRole('button', { name: 'Estado: Pendiente', exact: true }).tap()
    await expect(page.getByRole('dialog', { name: 'Estado: Pendiente', exact: true })).toContainText('pendiente de revisión')
    await page.touchscreen.tap(2, 200)
    await first.getByRole('button', { name: /^Eliminar avistamiento de/ }).tap()
    await expect(page.getByRole('alertdialog')).toBeVisible()
    expect(backend.rows[0].deleted_at).toBeFalsy()
    await page.getByRole('button', { name: 'Cancelar', exact: true }).tap()
    expect(backend.rows[0].deleted_at).toBeFalsy()
  })
})
