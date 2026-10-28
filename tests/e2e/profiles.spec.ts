import AxeBuilder from '@axe-core/playwright'
import { test, expect, login, fillReport } from './fixtures'

test('login envía recuperación de contraseña sin revelar si el correo está registrado', async ({ page, backend }) => {
  await page.goto('/login')
  await page.getByRole('button', { name: '¿Olvidaste tu contraseña?' }).click()
  await expect(page.locator('#login-error')).toContainText('Escribe tu correo electrónico')
  await page.getByLabel('Correo electrónico').fill('member@example.test')
  await page.getByRole('button', { name: '¿Olvidaste tu contraseña?' }).click()
  await expect(page.getByText('Si existe una cuenta asociada', { exact: false })).toBeVisible()
  expect(backend.recovery).toMatchObject({ email: 'member@example.test' })
  expect(new URL(String(backend.recovery?.redirect_to)).pathname).toBe('/update-password')
})

test('el enlace de recuperación permite establecer y confirmar una contraseña nueva', async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel('Correo electrónico').fill('member@example.test')
  await page.getByRole('button', { name: '¿Olvidaste tu contraseña?' }).click()
  await expect(page.getByText('Si existe una cuenta asociada', { exact: false })).toBeVisible()
  await page.goto('/update-password?code=recovery-code')
  await page.getByLabel('Contraseña nueva').fill('updated-password-123')
  await page.getByLabel('Confirma la contraseña').fill('updated-password-123')
  await page.getByRole('button', { name: 'Guardar contraseña nueva' }).click()
  await expect(page.getByRole('heading', { name: 'Contraseña actualizada.' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Volver al inicio de sesión' })).toBeVisible()
})

test('community puede editar y borrar su avistamiento, mientras estudiante solo consulta', async ({ page, backend }) => {
  backend.profileRole = 'community'
  backend.rows[0].species = 'Tiburón gata (Ginglymostoma cirratum)'
  await page.goto('/login')
  await page.getByLabel('Correo electrónico').fill('member@example.test')
  await page.getByLabel('Contraseña', { exact: true }).fill('test-password')
  await page.getByRole('button', { name: 'Iniciar sesión', exact: true }).click()
  await expect(page).toHaveURL(/\/comunidad$/)
  await page.getByRole('link', { name: 'Editar avistamiento de Tiburón gata (Ginglymostoma cirratum)' }).click()
  await expect(page.getByLabel('Nombre de la ubicación')).toHaveValue('Rincón, Puerto Rico')
  await page.getByLabel('Notas adicionales').fill('Editado por su autora.')
  await page.getByRole('button', { name: 'Guardar cambios' }).click()
  await expect(page).toHaveURL(/\/comunidad$/)
  await page.getByRole('button', { name: 'Eliminar avistamiento de Tiburón gata (Ginglymostoma cirratum)' }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Eliminar avistamiento', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Eliminar avistamiento de Tiburón gata (Ginglymostoma cirratum)' })).toHaveCount(0)
  await expect(page.getByText('11 registros · Página 1 de 2')).toBeVisible()

  backend.profileRole = 'student'
  await page.goto('/estudiante')
  await expect(page.getByRole('button', { name: /Eliminar avistamiento/ })).toHaveCount(0)
  await expect(page.getByRole('link', { name: /Editar avistamiento/ })).toHaveCount(0)
})

for (const [role, route, heading] of [
  ['student', '/estudiante', 'Modo Estudiante'],
  ['researcher', '/cientifico', 'Modo Científico'],
  ['community', '/comunidad', 'Modo Pescador Buzo'],
  ['pending_scientist', '/solicitud', 'Estado de tu solicitud'],
]) {
  test(`${role}: el login llega al espacio correcto y bloquea otros modos`, async ({ page, backend }) => {
    backend.profileRole = role
    await page.goto('/login')
    await page.getByLabel('Correo electrónico').fill('member@example.test')
    await page.getByLabel('Contraseña', { exact: true }).fill('test-password')
    await page.getByRole('button', { name: 'Iniciar sesión', exact: true }).click()
    await expect(page).toHaveURL(new RegExp(`${route}$`))
    await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible()
    if (role !== 'pending_scientist') {
      await expect(page.getByRole('heading', { name: 'Avistamientos y estadísticas', exact: true })).toBeVisible()
      await expect(page.getByText(role === 'student' ? 'Mostrando 3 de 12 avistamientos' : '12 registros · Página 1 de 2')).toBeVisible()
      await expect(page.getByRole('button', { name: /Aprobar avistamiento/ })).toHaveCount(0)
    }
    const accessibility = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).exclude('nextjs-portal').analyze()
    expect(accessibility.violations).toEqual([])
    await page.goto(role === 'community' ? '/cientifico' : role === 'researcher' ? '/estudiante' : '/report')
    await expect(page.getByRole('heading', { name: 'Este espacio no está disponible para tu perfil.' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Enviar avistamiento' })).toHaveCount(0)
  })
}

test('registro científico comunica confirmación y envía la solicitud sin permisos administrativos', async ({ page, backend }) => {
  await page.goto('/register')
  await page.getByLabel('Nombre completo').fill('Ana del Mar')
  await page.getByLabel('Quiero participar como').selectOption('researcher')
  await expect(page.getByText('Un administrador revisará tu solicitud antes de habilitar el modo científico.')).toBeVisible()
  await page.getByLabel('Institución o actividad investigadora').fill('Instituto Marino')
  await page.getByLabel('Correo electrónico').fill('ana@example.test')
  await page.getByLabel('Contraseña').fill('valid-password-123')
  await page.getByRole('button', { name: 'Crear cuenta', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('Revisa tu correo')
  expect(backend.signup).toMatchObject({ data: { requested_role: 'researcher', affiliation: 'Instituto Marino' } })
})

test('científico guarda borrador, publica y un estudiante puede leer el contenido publicado', async ({ page, backend }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 })
  backend.profileRole = 'researcher'
  await page.goto('/login')
  await page.getByLabel('Correo electrónico').fill('science@example.test')
  await page.getByLabel('Contraseña', { exact: true }).fill('test-password')
  await page.getByRole('button', { name: 'Iniciar sesión', exact: true }).click()
  await expect(page).toHaveURL(/\/cientifico$/)
  await page.getByRole('button', { name: 'Nueva publicación', exact: true }).click()
  await page.getByLabel('Título').fill('Observaciones del litoral')
  await page.getByRole('textbox', { name: /^Resumen/ }).fill('Un resumen de los encuentros con la fauna marina.')
  await page.getByLabel('Contenido').fill('La comunidad registró observaciones que aportan información sobre la vida marina.')
  await page.locator('.workspace-form').screenshot({ path: testInfo.outputPath('publication-editor-mobile.png'), style: '.site-header, nextjs-portal { visibility: hidden; }' })
  await page.getByRole('button', { name: 'Guardar publicación' }).click()
  await expect(page.getByRole('heading', { name: 'Observaciones del litoral' })).toBeVisible()
  expect(backend.posts[0].status).toBe('draft')
  await page.getByRole('button', { name: 'Editar Observaciones del litoral' }).click()
  await page.getByLabel('Visibilidad').selectOption('published')
  await page.getByRole('button', { name: 'Guardar publicación' }).click()
  await expect(page.getByText('Publicado', { exact: true })).toBeVisible()
  expect(backend.posts[0].status).toBe('published')
  backend.profileRole = 'student'
  await page.goto('/estudiante')
  await page.getByText('Leer publicación: Observaciones del litoral').click()
  await expect(page.getByText('La comunidad registró observaciones que aportan información sobre la vida marina.', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Nueva publicación', exact: true })).toHaveCount(0)
})

test('administrador habilita científicos y accede a los tres modos', async ({ page, backend }) => {
  await login(page)
  await page.getByRole('link', { name: 'Gestionar comunidad', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Ana del Mar' })).toBeVisible()
  await page.getByRole('button', { name: 'Habilitar científico Ana del Mar' }).click()
  await expect(page.getByText('Cuenta científica habilitada.', { exact: true })).toBeVisible()
  expect(backend.requestsReviewed).toBe(1)
  await expect(page.getByText('No hay solicitudes pendientes.', { exact: true })).toBeVisible()
  for (const [label, route] of [['Modo estudiante', '/estudiante'], ['Modo científico', '/cientifico'], ['Modo Pescador Buzo', '/comunidad']]) {
    await page.getByRole('banner').getByRole('link', { name: 'GaleoTrack, mi espacio' }).click()
    await page.getByRole('navigation', { name: 'Accesos del administrador' }).getByRole('link', { name: label, exact: false }).click()
    await expect(page).toHaveURL(new RegExp(`${route}$`))
    await expect(page.getByRole('heading', { level: 1 })).not.toContainText('no está disponible')
  }
})

test('buzo envía un reporte vinculado a su cuenta desde su módulo', async ({ page, backend }) => {
  backend.profileRole = 'community'
  await page.goto('/login')
  await page.getByLabel('Correo electrónico').fill('diver@example.test')
  await page.getByLabel('Contraseña', { exact: true }).fill('test-password')
  await page.getByRole('button', { name: 'Iniciar sesión', exact: true }).click()
  await expect(page).toHaveURL(/\/comunidad$/)
  await page.getByRole('link', { name: 'Reportar un avistamiento', exact: true }).click()
  await fillReport(page)
  await page.getByRole('button', { name: 'Enviar avistamiento' }).click()
  await expect(page.getByText(/¡Gracias por contribuir!/)).toBeVisible()
  expect(backend.reports[0]).toMatchObject({ reporter_id: 'f686f330-5f9e-43e4-924a-99872c0f819a', collaborator_role: 'Pescador / Buzo', status: 'pending' })
})
