import { chromium } from '@playwright/test'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { APPLE_SCREENS, PWA_BACKGROUND } from '../lib/pwa/config.ts'

// Run explicitly when brand assets change. Generated PNGs are committed, not generated on Vercel.
const root = new URL('../', import.meta.url)
const image = await readFile(new URL('public/images/brand/app_logo.png', root))
const browser = await chromium.launch()
try {
  const page = await browser.newPage()
  const source = `data:image/png;base64,${image.toString('base64')}`
  const assets = [192, 512].flatMap((size) => [
    { file: `icon-${size}.png`, width: size, height: size, maskable: false, splash: false },
    { file: `maskable-${size}.png`, width: size, height: size, maskable: true, splash: false },
  ])
  for (const [w, h, ratio] of APPLE_SCREENS) {
    for (const orientation of ['portrait', 'landscape']) assets.push({
      file: `startup/${w}x${h}@${ratio}-${orientation}.png`,
      width: (orientation === 'portrait' ? w : h) * ratio,
      height: (orientation === 'portrait' ? h : w) * ratio,
      maskable: false, splash: true,
    })
  }
  await mkdir(new URL('public/pwa/startup/', root), { recursive: true })
  for (const asset of assets) {
    const data = await page.evaluate(async ({ source, asset, background }) => {
      const img = new Image()
      img.src = source
      await img.decode()
      const canvas = document.createElement('canvas')
      canvas.width = asset.width; canvas.height = asset.height
      const context = canvas.getContext('2d')
      context.fillStyle = asset.splash ? background : '#05275e'
      context.fillRect(0, 0, canvas.width, canvas.height)
      const size = asset.splash ? Math.min(canvas.width, canvas.height) * 0.24 : canvas.width * (asset.maskable ? 0.64 : 1)
      context.drawImage(img, (canvas.width - size) / 2, (canvas.height - size) / 2, size, size)
      return canvas.toDataURL('image/png').split(',')[1]
    }, { source, asset, background: PWA_BACKGROUND })
    await writeFile(new URL(`public/pwa/${asset.file}`, root), Buffer.from(data, 'base64'))
  }
  console.log(`Generated ${assets.length} brand assets.`)
} finally {
  await browser.close()
}
