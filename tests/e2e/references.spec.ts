import AxeBuilder from '@axe-core/playwright'
import { test, expect, login } from './fixtures'

const dois = [
  'https://doi.org/10.3354/meps12241',
  'https://doi.org/10.1177/0300985813482147',
  'https://doi.org/10.1158/0008-5472.CAN-04-1813',
  'https://doi.org/10.1038/s41598-020-79973-w',
  'https://doi.org/10.1371/journal.pone.0011916',
]

for (const mode of [{ route: '/estudiante', role: 'student' }, { route: '/cientifico', role: 'researcher' }]) {
  for (const width of [375, 1440]) {
    test(`referencias: ${mode.role} reúne las 16 citas al final a ${width}px`, async ({ page, backend }) => {
      await page.setViewportSize({ width, height: 900 })
      await login(page)
      backend.profileRole = mode.role
      await page.goto(mode.route)
      const references = page.getByRole('region', { name: 'Referencias', exact: true })
      await expect(references.getByRole('heading', { name: 'Referencias', level: 2 })).toBeVisible()
      await expect(references.getByRole('listitem')).toHaveCount(16)
      await expect(references.getByRole('listitem').first()).toContainText('Credille, K. M.')
      await expect(references.getByRole('listitem').nth(13)).toContainText('A footprint of human pressures.')
      await expect(references.getByRole('listitem').last()).toContainText('Carrier, J. C.')
      await expect(references.getByText('OBIS Mapper. (n.d.).', { exact: true })).toBeVisible()
      await expect(references.getByText('A baseline for fish and future conservation.', { exact: false })).toBeVisible()
      await expect(page.locator('.workspace-sections > section:last-child')).toHaveAttribute('id', 'referencias')
      await expect(references.getByRole('link')).toHaveCount(dois.length + 1)
      await expect(references.getByRole('link', { name: 'https://mapper.obis.org/?taxonid=10193&areaid=276#', exact: true })).toHaveAttribute('href', 'https://mapper.obis.org/?taxonid=10193&areaid=276#')
      for (const doi of dois) await expect(references.getByRole('link', { name: doi, exact: true })).toHaveAttribute('href', doi)
      await references.scrollIntoViewIfNeeded()
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
      if (width === 375) {
        await page.addStyleTag({ content: 'html { font-size: 200%; }' })
        await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
      }
      const accessibility = await new AxeBuilder({ page }).include('#referencias').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()
      expect(accessibility.violations).toEqual([])
    })
  }
}

test('referencias: no se añade la sección al modo Pescador Buzo', async ({ page, backend }) => {
  await login(page)
  backend.profileRole = 'community'
  await page.goto('/comunidad')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Modo Pescador Buzo')
  await expect(page.locator('#referencias')).toHaveCount(0)
})
