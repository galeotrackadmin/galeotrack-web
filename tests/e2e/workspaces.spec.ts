import AxeBuilder from '@axe-core/playwright'
import { test, expect, login } from './fixtures'

for (const width of [360, 375, 390, 412, 430, 768, 1024, 1366, 1440, 1920]) {
  test(`espacios fotográficos: imágenes, navegación y contraste a ${width}px`, async ({ page, backend }, testInfo) => {
    test.setTimeout(120000)
    await page.setViewportSize({ width, height: 900 })
    await login(page)
    for (const route of ['/estudiante', '/cientifico', '/comunidad', '/admin', '/gestion', '/completar-perfil', '/register']) {
      backend.profileRole = route === '/completar-perfil' ? 'unassigned' : 'admin'
      await page.goto(route)
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
      const photo = page.locator(route === '/register' ? '.auth-story-photo' : '.page-hero-photo')
      await expect.poll(() => photo.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true)
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
      if (['/estudiante', '/cientifico', '/comunidad', '/admin'].includes(route)) {
        await expect(page.locator('.page-hero--compact')).toBeVisible()
        await expect(page.locator('.workspace-shortcuts .section-link-media')).toHaveCount(0)
        const map = page.getByRole('region', { name: 'Mapa de avistamientos', exact: true })
        await expect(map.locator('.sightings-map')).toBeVisible()
        expect(await map.locator('.sightings-map-frame').evaluate((element) => element.getBoundingClientRect().height)).toBe(width < 768 ? 320 : width < 1200 ? 400 : 480)
        if (route === '/admin') expect(await page.locator('.workspace-list').evaluate((list) => Boolean(list.compareDocumentPosition(document.querySelector('.admin-map')!) & Node.DOCUMENT_POSITION_FOLLOWING))).toBe(true)
      }
      const accessibility = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).exclude('nextjs-portal').analyze()
      expect(accessibility.violations).toEqual([])
      if (route === '/estudiante') {
        await page.getByRole('link', { name: 'Guía de especies', exact: true }).click()
        await expect(page).toHaveURL(/#especies$/)
        await expect(page.locator('#especies')).toBeInViewport()
      }
      await page.evaluate(() => window.scrollTo(0, 0))
      await page.screenshot({ path: testInfo.outputPath(`${route.slice(1)}-${width}.png`), fullPage: true, animations: 'disabled' })
      if (route !== '/register') {
        const header = page.locator('.site-header')
        const before = await header.boundingBox()
        await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
        await expect.poll(async () => (await header.boundingBox())!.y).toBeCloseTo(before!.y, 0)
        await expect(header.getByRole('navigation')).toHaveCount(0)
        const logo = header.getByRole('link', { name: 'GaleoTrack, mi espacio', exact: true })
        await expect(logo).toHaveAttribute('href', route === '/completar-perfil' ? '/completar-perfil' : '/admin')
        await logo.click()
        await expect(page).toHaveURL(route === '/completar-perfil' ? /\/completar-perfil$/ : /\/admin$/)
        await expect(page.getByRole('button', { name: /Cuenta de María Rivera/ })).toBeVisible()
      }
    }
  })
}

test('cuatro espacios: anclas, controles y texto ampliado en horizontal', async ({ page }) => {
  await login(page)
  await page.setViewportSize({ width: 812, height: 375 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  for (const route of ['/estudiante', '/cientifico', '/comunidad', '/admin']) {
    await page.goto(route)
    await page.addStyleTag({ content: 'html { font-size: 200%; }' })
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    const shortcut = page.getByRole('link', { name: route === '/admin' ? 'Revisar avistamientos' : 'Avistamientos y estadísticas', exact: true })
    await shortcut.click()
    const target = page.locator(route === '/admin' ? '#sightings-heading' : '#sightings-title')
    await expect(target).toBeInViewport()
    expect(await target.evaluate((element) => element.getBoundingClientRect().top)).toBeGreaterThanOrEqual(await page.locator('.site-header').evaluate((element) => element.getBoundingClientRect().bottom))
    const accessibility = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).exclude('nextjs-portal').analyze()
    expect(accessibility.violations).toEqual([])
  }
})
