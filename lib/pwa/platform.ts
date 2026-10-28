export type InstallPlatform = 'ios' | 'mac-safari' | 'android' | 'edge' | 'chromium' | 'other'

// Only instruction copy uses platform hints. Installation itself is capability-driven.
export function installPlatform(userAgent: string, platform: string, maxTouchPoints: number): InstallPlatform {
  if (/iPad|iPhone|iPod/.test(userAgent) || (platform === 'MacIntel' && maxTouchPoints > 1)) return 'ios'
  if (/Android/.test(userAgent)) return 'android'
  if (/Edg\//.test(userAgent)) return 'edge'
  if (/Chrome|Chromium|CriOS/.test(userAgent)) return 'chromium'
  if (/Macintosh/.test(userAgent) && /Safari/.test(userAgent)) return 'mac-safari'
  return 'other'
}

export type InstallState = 'checking' | 'manual' | 'available' | 'prompting' | 'accepted' | 'installed' | 'unsupported'

export interface InstallPromptEvent extends Event {
  prompt(): Promise<{ outcome: 'accepted' | 'dismissed' } | void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}
