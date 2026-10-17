import AxeBuilder from '@axe-core/playwright'
import { test, expect, login, openSiteMenu } from './fixtures'

for (const width of [375, 1366]) {
  test(`logo vuelve al inicio desde navbar, footer y otra página a ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/')
    const headerLogo = page.getByRole('banner').getByRole('link', { name: 'GaleoTrack, inicio', exact: true })
    await page.locator('#colaboradores').scrollIntoViewIfNeeded()
    await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(100)
    await headerLogo.click()
    await expect(page).toHaveURL(/\/#inicio$/)
    await expect.poll(() => page.evaluate(() => scrollY)).toBeLessThan(20)

    // También debe funcionar al pulsar de nuevo con el mismo hash en la URL.
    await page.locator('#colaboradores').scrollIntoViewIfNeeded()
    await headerLogo.click()
    await expect.poll(() => page.evaluate(() => scrollY)).toBeLessThan(20)

    await page.getByRole('contentinfo').getByRole('link', { name: 'GaleoTrack, inicio', exact: true }).click()
    await expect.poll(() => page.evaluate(() => scrollY)).toBeLessThan(20)

    await page.goto('/patrones-de-distribucion')
    await headerLogo.click()
    await expect(page).toHaveURL(/\/#inicio$/)
    await expect(page.getByRole('heading', { level: 1 })).toContainText('tiburones de Puerto Rico')
    await expect.poll(() => page.evaluate(() => scrollY)).toBeLessThan(20)
  })
}

test('menú móvil: apertura, teclado, cierre exterior, anclas y adaptación a escritorio', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await page.goto('/')
  const toggle = page.getByRole('button', { name: 'Abrir menú', exact: true })
  await expect(toggle).toHaveAttribute('aria-expanded', 'false')
  await expect(page.getByRole('navigation', { name: 'Navegación principal' })).toBeHidden()
  await toggle.focus()
  await page.keyboard.press('Enter')
  const navigation = page.getByRole('navigation', { name: 'Navegación principal' })
  await expect(navigation).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath('navbar-mobile-open.png'), animations: 'disabled' })
  const accessibility = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).exclude('nextjs-portal').analyze()
  expect(accessibility.violations).toEqual([])
  const links = await navigation.getByRole('link').evaluateAll((elements) => elements.map((element) => element.getBoundingClientRect().height))
  expect(links.every((height) => height >= 44)).toBe(true)
  await page.keyboard.press('Escape')
  await expect(toggle).toBeFocused()
  await expect(navigation).toBeHidden()
  await openSiteMenu(page)
  await page.mouse.click(4, 300)
  await expect(navigation).toBeHidden()
  await openSiteMenu(page)
  await navigation.getByRole('link', { name: 'Inicio', exact: true }).click()
  await expect(page).toHaveURL(/#inicio$/)
  await expect(navigation).toBeHidden()
  await expect(page.locator('#hero-title')).toBeInViewport()
  await expect.poll(() => page.evaluate(() => scrollY)).toBeLessThan(20)
  await openSiteMenu(page)
  await page.setViewportSize({ width: 1366, height: 900 })
  await expect(toggle).toBeHidden()
  await expect(navigation).toBeVisible()
  await page.setViewportSize({ width: 375, height: 812 })
  await expect(toggle).toHaveAttribute('aria-expanded', 'false')
  await expect(navigation).toBeHidden()
})

test('menú móvil: acciones de cuenta y cierre de sesión', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await login(page)
  await expect(page.getByRole('button', { name: 'Abrir menú', exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: /Cuenta de María Rivera/ }).click()
  await expect(page.getByRole('button', { name: 'Cerrar sesión', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Cerrar sesión', exact: true }).click()
  await expect(page).toHaveURL(/\/login$/)
})

for (const width of [375, 1366]) {
  test(`encabezado privado: solo logo, iniciales y rol; conserva sesión a ${width}px`, async ({ page, backend }) => {
    await page.setViewportSize({ width, height: 900 })
    let passwordLogins = 0
    page.on('request', (request) => { if (request.url().includes('/auth/v1/token')) passwordLogins += 1 })
    await login(page)
    for (const [role, route, label] of [
      ['student', '/estudiante', 'Estudiante'], ['researcher', '/cientifico', 'Científico'],
      ['community', '/comunidad', 'Pescador Buzo'], ['admin', '/admin', 'Administrador'],
      ['pending_scientist', '/solicitud', 'Científico pendiente'], ['unassigned', '/completar-perfil', 'Sin perfil'],
    ]) {
      backend.profileRole = role
      await page.goto(route)
      const header = page.getByRole('banner')
      const account = header.getByRole('button', { name: /Cuenta de María Rivera/ })
      await expect(account).toHaveText('MR')
      await expect(header.locator('.account-role')).toHaveText(label)
      await expect(header.getByRole('navigation')).toHaveCount(0)
      await expect(header.getByRole('button', { name: 'Abrir menú', exact: true })).toHaveCount(0)
      await account.click()
      await page.getByRole('link', { name: 'Mi cuenta', exact: true }).click()
      await expect(page).toHaveURL(/\/cuenta$/)
      await header.getByRole('link', { name: 'GaleoTrack, mi espacio', exact: true }).click()
      await expect(page).toHaveURL(new RegExp(`${route}$`))
    }
    expect(passwordLogins).toBe(1)
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  })
}

test('la portada reconoce una sesión abierta y permite volver al espacio sin otro login', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await login(page)
  await page.goto('/')
  await openSiteMenu(page)
  const navigation = page.getByRole('navigation', { name: 'Navegación principal' })
  await expect(navigation.getByRole('link', { name: 'Mi espacio', exact: true })).toHaveAttribute('href', '/admin')
  await expect(navigation.getByRole('link', { name: 'Iniciar sesión', exact: true })).toHaveCount(0)
  await navigation.getByRole('link', { name: 'Mi espacio', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Panel de revisión', exact: true })).toBeVisible()
})

test('menú en horizontal y texto ampliado: todos los destinos siguen accesibles', async ({ page }) => {
  await page.setViewportSize({ width: 812, height: 375 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await page.addStyleTag({ content: 'html { font-size: 200%; }' })
  await openSiteMenu(page)
  const navigation = page.getByRole('navigation', { name: 'Navegación principal' })
  const signup = navigation.getByRole('link', { name: 'Crear cuenta' })
  await signup.scrollIntoViewIfNeeded()
  await expect(signup).toBeInViewport()
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await signup.click()
  await expect(page).toHaveURL(/\/register$/)
})
