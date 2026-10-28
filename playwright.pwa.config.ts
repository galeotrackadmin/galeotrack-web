import { defineConfig } from '@playwright/test'

const baseURL = process.env.PWA_BASE_URL ?? 'http://127.0.0.1:3200'
const { hostname, port } = new URL(baseURL)

export default defineConfig({
  outputDir: './test-results-pwa',
  testDir: './tests/pwa', fullyParallel: false, workers: 1,
  timeout: 60000, expect: { timeout: 15000 }, reporter: 'list',
  use: { baseURL, browserName: 'chromium', serviceWorkers: 'allow', trace: 'retain-on-failure' },
  webServer: {
    command: `npm run start -- --hostname ${hostname} --port ${port || '3200'}`,
    url: `${baseURL}/manifest.webmanifest`,
    reuseExistingServer: false, timeout: 120000,
  },
})
