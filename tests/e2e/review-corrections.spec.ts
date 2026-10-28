import AxeBuilder from '@axe-core/playwright'
import { test, expect, login } from './fixtures'

for (const width of [320, 1440]) {
  test(`administración corrige rechazado ↔ verificado con confirmación a ${width}px`, async ({ page, backend }, testInfo) => {
    backend.rows[0].status = 'rejected'
    await page.setViewportSize({ width, height: 900 })
    await login(page)
    const first = page.locator('.workspace-list article').first()
    const verify = first.getByRole('button', { name: /^Marcar como verificado el avistamiento de/ })
    const summary = page.getByRole('region', { name: 'Resumen estadístico', exact: true })
    await expect(verify).toBeVisible()
    await expect(first.getByRole('button', { name: /^Marcar como rechazado/ })).toHaveCount(0)
    await verify.click()
    const dialog = page.getByRole('alertdialog')
    await expect(dialog).toContainText('Rechazado a Verificado')
    await expect(dialog.getByRole('button', { name: 'Cancelar', exact: true })).toBeFocused()
    expect((await new AxeBuilder({ page }).include('[role="alertdialog"]').analyze()).violations).toEqual([])
    await page.screenshot({ path: testInfo.outputPath(`corregir-revision-${width}.png`) })
    await dialog.getByRole('button', { name: 'Cancelar', exact: true }).click()
    expect(backend.reviews).toBe(0)
    expect(backend.rows[0].status).toBe('rejected')

    await verify.click()
    await dialog.getByRole('button', { name: 'Marcar como verificado', exact: true }).click()
    await expect(first.getByRole('button', { name: 'Estado: Verificado', exact: true })).toBeVisible()
    await expect(page.getByText('Estado corregido a verificado.', { exact: true })).toBeVisible()
    const verifiedMetric = summary.locator('.statistics-metric').filter({ has: page.locator('dt', { hasText: /^Verificados$/ }) }).locator('dd strong')
    const totalMetric = summary.locator('.statistics-metric').filter({ has: page.locator('dt', { hasText: /^Registros analizados$/ }) }).locator('dd strong')
    await expect(verifiedMetric).toHaveText('1')
    await summary.getByLabel('Estado de las estadísticas', { exact: true }).selectOption('rejected')
    await expect(totalMetric).toHaveText('0')
    expect(backend.reviews).toBe(1)
    expect(backend.rows[0]).toMatchObject({ status: 'verified', verified_by: 'f686f330-5f9e-43e4-924a-99872c0f819a', notes: null })
    await expect(verify).toHaveCount(0)

    await first.getByRole('button', { name: /^Marcar como rechazado el avistamiento de/ }).click()
    await expect(dialog).toContainText('Verificado a Rechazado')
    await dialog.getByRole('button', { name: 'Marcar como rechazado', exact: true }).click()
    await expect(first.getByRole('button', { name: 'Estado: Rechazado', exact: true })).toBeVisible()
    await expect(verifiedMetric).toHaveText('0')
    await expect(totalMetric).toHaveText('1')
    expect(backend.reviews).toBe(2)
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  })
}

for (const changedStatus of ['rejected', 'verified'] as const) {
  test(`una revisión obsoleta no sobrescribe otro cambio aunque el estado actual sea ${changedStatus}`, async ({ page, backend }) => {
    backend.rows[0].status = 'rejected'
    await login(page)
    await page.getByRole('button', { name: /^Marcar como verificado el avistamiento de Tiburón nodriza/ }).click()
    const dialog = page.getByRole('alertdialog')
    await expect(dialog).toBeVisible()
    // Another administrator updates the record while the confirmation is open.
    backend.rows[0].status = changedStatus
    backend.rows[0].updated_at = '2026-09-25T12:00:00.000Z'
    await dialog.getByRole('button', { name: 'Marcar como verificado', exact: true }).click()
    await expect(page.getByText(/No se modificó el registro: cambió desde que lo abriste/)).toBeVisible()
    expect(backend.rows[0].status).toBe(changedStatus)
    expect(backend.rows[0].updated_at).toBe('2026-09-25T12:00:00.000Z')
    expect(backend.reviews).toBe(0)
  })
}

test('corregir el último verificado de una página conserva el filtro y ajusta la paginación', async ({ page, backend }) => {
  backend.rows.slice(0, 11).forEach((row) => { row.status = 'verified' })
  await login(page)
  await page.getByLabel('Estado', { exact: true }).selectOption('verified')
  await expect(page).toHaveURL(/status=verified/)
  await expect(page.getByLabel('Estado', { exact: true })).toHaveValue('verified')
  await expect(page.getByText('Página 1 de 2', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Siguiente', exact: true }).click()
  await expect(page).toHaveURL(/status=verified&page=2/)
  await expect(page.getByText('Página 2 de 2', { exact: true })).toBeVisible()
  await page.locator('.workspace-list article').getByRole('button', { name: /^Marcar como rechazado/ }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Marcar como rechazado', exact: true }).click()
  await expect(page.getByLabel('Estado', { exact: true })).toHaveValue('verified')
  await expect(page.getByText('Página 1 de 1', { exact: true })).toBeVisible()
  expect(backend.rows.filter((row) => row.status === 'verified')).toHaveLength(10)
  expect(backend.rows.filter((row) => row.status === 'rejected')).toHaveLength(1)
})

test('un error al corregir conserva el estado original y permite reintentar', async ({ page, backend }) => {
  backend.rows[0].status = 'rejected'
  await login(page)
  await page.route('**/rest/v1/sightings*', async (route) => {
    if (route.request().method() === 'PATCH') return route.fulfill({ status: 403, contentType: 'application/json', body: JSON.stringify({ message: 'Denied', code: '42501' }) })
    return route.fallback()
  })
  const verify = page.getByRole('button', { name: /^Marcar como verificado el avistamiento de Tiburón nodriza/ })
  await verify.click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Marcar como verificado', exact: true }).click()
  await expect(page.getByRole('alert').filter({ hasText: 'No se pudo actualizar el avistamiento' })).toBeVisible()
  await expect(verify).toBeEnabled()
  expect(backend.rows[0].status).toBe('rejected')
  expect(backend.reviews).toBe(0)
})
