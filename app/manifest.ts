import type { MetadataRoute } from 'next'
import { PWA_BACKGROUND, PWA_NAME } from '@/lib/pwa/config'

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/', name: PWA_NAME, short_name: PWA_NAME,
    description: 'Conservación marina y ciencia ciudadana en Puerto Rico. Aprende y comparte avistamientos de tiburones.',
    lang: 'es', dir: 'ltr', start_url: '/', scope: '/',
    display: 'standalone', background_color: PWA_BACKGROUND, theme_color: PWA_BACKGROUND,
    prefer_related_applications: false,
    categories: ['education', 'science'],
    icons: [
      { src: '/pwa/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/pwa/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/pwa/maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: '/pwa/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
