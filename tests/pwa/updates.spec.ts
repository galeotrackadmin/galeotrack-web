import { createServer, request as proxyRequest } from 'node:http'
import { readFile } from 'node:fs/promises'
import { test as base, expect } from '../e2e/fixtures'

// A local proxy changes only the worker revision. All UI and assets come from the real production build.
const test = base.extend<{ release: { origin: string; next: () => void } }>({
  release: async ({ baseURL }, runFixture) => {
    const worker = await readFile(new URL('../../lib/pwa/worker.js', import.meta.url), 'utf8')
    let revision = 1
    const server = createServer((incoming, outgoing) => {
      if (incoming.url === '/sw.js') {
        outgoing.writeHead(200, { 'Content-Type': 'application/javascript', 'Cache-Control': 'no-store', 'Service-Worker-Allowed': '/' })
        outgoing.end(worker.replace('__GALEOTRACK_BUILD__', `test-${revision}`))
        return
      }
      const upstream = proxyRequest(new URL(incoming.url ?? '/', baseURL), { method: incoming.method, headers: { ...incoming.headers, host: new URL(baseURL!).host } }, (response) => {
        outgoing.writeHead(response.statusCode ?? 502, response.headers)
        response.pipe(outgoing)
      })
      upstream.on('error', () => { outgoing.writeHead(502); outgoing.end() })
      incoming.pipe(upstream)
    })
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
    const address = server.address()
    if (!address || typeof address === 'string') throw new Error('Proxy did not bind')
    try { await runFixture({ origin: `http://127.0.0.1:${address.port}`, next: () => { revision += 1 } }) }
    finally { server.closeAllConnections(); await new Promise<void>((resolve) => server.close(() => resolve())) }
  },
})

test('two releases wait for consent; other windows are not interrupted', async ({ page, context, release }) => {
  await page.goto(release.origin)
  await page.evaluate(() => navigator.serviceWorker.ready)
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true)
  const other = await context.newPage()
  await other.goto(release.origin)
  await other.evaluate(() => { (window as Window & { preserved?: string }).preserved = 'unsaved work in other window' })
  release.next()
  await page.evaluate(async () => { await (await navigator.serviceWorker.getRegistration())?.update() })
  await expect(page.getByText('Nueva versión disponible', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Actualizar', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Cierra las otras pestañas' })).toBeVisible()
  expect(await other.evaluate(() => (window as Window & { preserved?: string }).preserved)).toBe('unsaved work in other window')
  await other.close()
  await Promise.all([
    page.waitForEvent('load'),
    page.getByRole('button', { name: 'Actualizar', exact: true }).click(),
  ])
  await expect(page.getByText('Nueva versión disponible', { exact: true })).not.toBeVisible()
})

test('an edited report blocks voluntary reload, and postponing never reloads it', async ({ page, release }) => {
  // Auth uses the repository's HTTP mocks, never a remote Supabase project.
  await page.goto(`${release.origin}/login`)
  await page.getByLabel('Correo electrónico').fill('reviewer@example.test')
  await page.getByLabel('Contraseña', { exact: true }).fill('test-password')
  await page.getByRole('button', { name: 'Iniciar sesión', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Panel de revisión', exact: true })).toBeVisible()
  await page.goto(`${release.origin}/report`)
  await page.getByLabel('Nombre de la ubicación').fill('Trabajo sin guardar')
  await page.evaluate(() => navigator.serviceWorker.ready)
  release.next()
  await page.evaluate(async () => { await (await navigator.serviceWorker.getRegistration())?.update() })
  await expect(page.getByText('Nueva versión disponible', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Actualizar', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Guarda o cancela' })).toBeVisible()
  await expect(page.getByLabel('Nombre de la ubicación')).toHaveValue('Trabajo sin guardar')
  await page.getByRole('button', { name: 'Más tarde', exact: true }).click()
  await expect(page.getByText('Nueva versión disponible', { exact: true })).not.toBeVisible()
  await expect(page.getByLabel('Nombre de la ubicación')).toHaveValue('Trabajo sin guardar')
})
