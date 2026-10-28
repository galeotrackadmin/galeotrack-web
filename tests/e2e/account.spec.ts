import { test, expect, login } from './fixtures'

test('el menú de cuenta muestra nombre, iniciales y acceso al perfil', async ({ page }) => {
  await login(page)
  const trigger = page.getByRole('button', { name: /Cuenta de María Rivera/ })
  await expect(trigger).toBeVisible()
  await expect(trigger.locator('.account-avatar')).toHaveText('MR')
  await expect(trigger).toHaveText('MR')
  await expect(page.locator('.account-role')).toHaveText('Administrador')
  await trigger.click()
  await expect(page.getByRole('link', { name: 'Mi cuenta' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Cerrar sesión', exact: true })).toBeVisible()
})

test('se puede editar el nombre y cambiar de perfil conservando reportes', async ({ page, backend }) => {
  await login(page)
  backend.profileRole = 'community'
  await page.goto('/cuenta')
  await page.getByLabel('Nombre completo').fill('María Rivera del Mar')
  await page.getByRole('button', { name: 'Guardar nombre' }).click()
  await expect(page.getByRole('status')).toContainText('Tu nombre se guardó correctamente')
  expect(backend.profileName).toBe('María Rivera del Mar')

  await page.getByLabel('Quiero participar como').selectOption('student')
  await page.getByRole('button', { name: 'Guardar cambio de perfil' }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Cambiar perfil', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('Tu perfil se actualizó. Los reportes existentes se conservaron.')
  expect(backend.profileRole).toBe('student')
  expect(backend.roleHistory).toHaveLength(1)
})
