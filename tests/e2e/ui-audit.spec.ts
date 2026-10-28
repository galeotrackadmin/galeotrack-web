import AxeBuilder from '@axe-core/playwright'
import type { Page } from '@playwright/test'
import { test, expect, login } from './fixtures'

const widths = [320, 375, 430, 768, 1024, 1280, 1440, 1920]
const publicRoutes = ['/', '/patrones-de-distribucion', '/login', '/register', '/update-password', '/auth/callback', '/cuenta-eliminada', '/ruta-inexistente-ui-audit']
const protectedRoutes = [
  ['/admin', 'admin'], ['/estudiante', 'student'], ['/cientifico', 'researcher'], ['/comunidad', 'community'],
  ['/report', 'community'], ['/cuenta', 'community'], ['/gestion', 'admin'],
  ['/completar-perfil', 'unassigned'], ['/solicitud', 'pending_scientist'],
]

async function geometry(page: Page) {
  return page.evaluate(() => {
    const visible = (element: Element) => {
      const style = getComputedStyle(element)
      const rect = element.getBoundingClientRect()
      return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none'
    }
    const controls = [...document.querySelectorAll('button, .button, summary, .site-nav-link, [role="button"]')].filter(visible)
    const small = controls.filter((element) => {
      const rect = element.getBoundingClientRect()
      return rect.width < 43.5 || rect.height < 43.5
    }).map((element) => ({ label: element.getAttribute('aria-label') || element.textContent?.trim().slice(0, 65), width: element.getBoundingClientRect().width, height: element.getBoundingClientRect().height }))
    const inputs = [...document.querySelectorAll('.field-control')].filter(visible)
    return {
      overflow: document.documentElement.scrollWidth > innerWidth,
      overflowing: document.documentElement.scrollWidth > innerWidth ? [...document.querySelectorAll('main *')].filter(visible).filter((element) => {
        const rect = element.getBoundingClientRect()
        return rect.right > innerWidth + 1 && !element.closest('.leaflet-pane')
      }).slice(0, 8).map((element) => ({ tag: element.tagName, className: element.getAttribute('class')?.slice(0, 110) })) : [],
      small,
      smallInputs: inputs.filter((element) => parseFloat(getComputedStyle(element).fontSize) < 16).map((element) => element.id),
    }
  })
}

for (const width of widths) {
  test(`auditoría UI: todas las rutas a ${width}px`, async ({ page, backend }, testInfo) => {
    test.setTimeout(180000)
    backend.rows[0].status = 'verified'
    await page.setViewportSize({ width, height: 900 })
    await page.emulateMedia({ reducedMotion: 'reduce' })
    const evidence: unknown[] = []
    const inspect = async (route: string) => {
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
      await page.evaluate(() => document.fonts.ready)
      const measurements = await geometry(page)
      evidence.push({ route, width, ...measurements })
      expect.soft(measurements.overflow, `${route}: overflow ${JSON.stringify(measurements.overflowing)}`).toBe(false)
      expect.soft(measurements.small, `${route}: objetivos táctiles`).toEqual([])
      expect.soft(measurements.smallInputs, `${route}: tamaño mínimo de los campos`).toEqual([])
      if (width === 320 || width === 1440) {
        const accessibility = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).exclude('nextjs-portal').analyze()
        expect.soft(accessibility.violations, `${route}: axe`).toEqual([])
        if (['/', '/login', '/estudiante', '/cientifico', '/comunidad', '/admin', '/report', '/gestion', '/cuenta'].includes(route)) {
          await page.screenshot({ path: testInfo.outputPath(`${route === '/' ? 'portada' : route.slice(1)}-${width}.png`), fullPage: true, animations: 'disabled', style: 'nextjs-portal { visibility: hidden; }' })
        }
      }
    }
    for (const route of publicRoutes) { await page.goto(route); await inspect(route) }
    await login(page)
    for (const [route, role] of protectedRoutes) { backend.profileRole = role; await page.goto(route); await inspect(route) }
    await testInfo.attach('geometry.json', { body: JSON.stringify(evidence, null, 2), contentType: 'application/json' })
  })
}

test('auditoría UI: cuenta con nombre largo, teclado, texto ampliado y poca altura', async ({ page, backend }) => {
  backend.profileName = 'María Rivera de la Comunidad Científica '.repeat(8).trim()
  await page.setViewportSize({ width: 812, height: 375 })
  await login(page)
  await page.addStyleTag({ content: 'html { font-size: 200%; }' })
  const trigger = page.getByRole('button', { name: /^Cuenta de/ })
  await trigger.click()
  const panel = page.locator('.account-menu-panel')
  await expect(panel).toBeVisible()
  await expect.poll(() => panel.evaluate((element) => element.getBoundingClientRect().bottom <= innerHeight - 12)).toBe(true)
  await expect.poll(() => panel.evaluate((element) => element.scrollHeight > element.clientHeight)).toBe(true)
  await panel.getByRole('button', { name: 'Cerrar sesión', exact: true }).focus()
  await expect.poll(() => panel.evaluate((element) => element.scrollTop)).toBeGreaterThan(0)
  await page.keyboard.press('Escape')
  await expect(trigger).toBeFocused()
  await expect(panel).toBeHidden()
  await trigger.click()
  await page.getByRole('link', { name: 'Revisar avistamientos', exact: true }).focus()
  await expect(panel).toBeHidden()
})

test('auditoría UI: ayudas y errores asociados a los campos sin alterar el envío', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 900 })
  await page.goto('/register')
  await expect(page.locator('.auth-story h2 em')).toHaveCSS('display', 'block')
  await expect(page.locator('#password')).toHaveAccessibleDescription('Utiliza al menos 8 caracteres.')
  await login(page)
  await page.goto('/cuenta')
  await expect(page.locator('#new-password')).toHaveAccessibleDescription('Al menos 8 caracteres.')
  await page.goto('/report')
  await page.getByRole('button', { name: 'Enviar avistamiento', exact: true }).click()
  await expect(page.locator('#sighting_date')).toHaveAttribute('aria-invalid', 'true')
  await expect(page.locator('#sighting_date')).toHaveAccessibleDescription('Selecciona una fecha válida.')
  await page.locator('#sighting_date').hover()
  await expect(page.locator('#sighting_date')).toHaveCSS('border-color', 'rgb(255, 180, 171)')
})

test.describe('auditoría UI: toque sintetizado', () => {
  test.use({ viewport: { width: 320, height: 740 }, hasTouch: true, isMobile: true })
  test('mapa, selector de capas y menú público operables por toque', async ({ page }) => {
    await page.goto('/')
    const viewport = page.locator('meta[name="viewport"]')
    await expect(viewport).toHaveAttribute('content', /viewport-fit=cover/)
    await expect(viewport).not.toHaveAttribute('content', /user-scalable=no|maximum-scale=1(?:,|$)/)
    const marker = page.getByRole('button', { name: 'Ver avistamiento: Tiburón nodriza', exact: true })
    await expect(marker).toBeVisible()
    expect((await marker.boundingBox())!.width).toBeGreaterThanOrEqual(44)
    await expect(marker.locator('.shark-map-glyph')).toHaveJSProperty('offsetWidth', 13)
    await page.getByRole('button', { name: 'Oceánico', exact: true }).tap()
    await expect(page.getByRole('button', { name: 'Oceánico', exact: true })).toHaveAttribute('aria-pressed', 'true')
    await marker.tap()
    await expect(page.locator('.tracker-popup')).toBeVisible()
    await page.getByRole('button', { name: 'Abrir menú', exact: true }).tap()
    await expect(page.getByRole('navigation', { name: 'Navegación principal', exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Cerrar menú', exact: true }).tap()
    await expect(page.getByRole('navigation', { name: 'Navegación principal', exact: true })).toBeHidden()
  })
})
