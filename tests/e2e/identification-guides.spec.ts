import AxeBuilder from '@axe-core/playwright'
import { test, expect, login } from './fixtures'

const files = ['Caribbean Shark Placard_Spanish.pdf', 'Rec-Shark-ID-Placard-04-2024.pdf']

for (const [role, route] of [['student', '/estudiante'], ['researcher', '/cientifico'], ['community', '/comunidad']] as const) {
  for (const width of [375, 1440]) {
    test(`guías PDF: ${role} puede visualizar y descargar ambas guías a ${width}px`, async ({ page, backend, request }) => {
      await page.setViewportSize({ width, height: 900 })
      await login(page)
      backend.profileRole = role
      await page.goto(route)
      await page.getByRole('navigation', { name: 'Secciones de este espacio' }).getByRole('link', { name: 'Guías de identificación', exact: true }).click()
      await expect(page).toHaveURL(/#guias$/)
      const guides = page.getByRole('region', { name: 'Guías de identificación', exact: true })
      await expect(guides).toBeInViewport()
      await expect(guides.getByRole('article')).toHaveCount(2)
      for (const [index, filename] of files.entries()) {
        const card = guides.getByRole('article').nth(index)
        const view = card.getByRole('link', { name: /^Visualizar/ })
        const download = card.getByRole('link', { name: /^Descargar/ })
        const href = `/pdf/${encodeURIComponent(filename)}`
        await expect(view).toHaveAttribute('href', href)
        await expect(view).toHaveAttribute('target', '_blank')
        await expect(view).toHaveAttribute('rel', 'noopener noreferrer')
        await expect(download).toHaveAttribute('href', href)
        await expect(download).toHaveAttribute('download', filename)
        if (role === 'student' && width === 1440) {
          const response = await request.get(href)
          expect(response.ok()).toBe(true)
          expect(response.headers()['content-type']).toContain('application/pdf')
          expect((await response.body()).subarray(0, 5).toString()).toBe('%PDF-')
          const downloaded = page.waitForEvent('download')
          await download.click()
          const file = await downloaded
          expect(file.suggestedFilename()).toBe(filename)
          expect(await file.failure()).toBeNull()
        }
      }
      if (role !== 'community') await expect(page.locator('.workspace-sections > section:last-child')).toHaveAttribute('id', 'referencias')
      if (width === 375) await page.addStyleTag({ content: 'html { font-size: 200%; }' })
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
      const accessibility = await new AxeBuilder({ page }).include('#guias').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()
      expect(accessibility.violations).toEqual([])
    })
  }
}
