export const PWA_NAME = 'GaleoTrack'
export const PWA_BACKGROUND = '#020d1c'

// CSS pixels and device pixel ratio. Unknown screens use the platform's default launch screen.
export const APPLE_SCREENS = [
  [375, 667, 2], [375, 812, 3], [390, 844, 3], [393, 852, 3],
  [402, 874, 3], [414, 896, 2], [428, 926, 3], [430, 932, 3],
  [440, 956, 3], [768, 1024, 2], [810, 1080, 2], [820, 1180, 2],
  [834, 1194, 2], [1024, 1366, 2],
] as const

export function appleStartupImages() {
  return APPLE_SCREENS.flatMap(([width, height, ratio]) => ['portrait', 'landscape'].map((orientation) => ({
    url: `/pwa/startup/${width}x${height}@${ratio}-${orientation}.png`,
    media: `(device-width: ${width}px) and (device-height: ${height}px) and (-webkit-device-pixel-ratio: ${ratio}) and (orientation: ${orientation})`,
  })))
}
