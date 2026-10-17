'use client'

import { useCallback, useSyncExternalStore } from 'react'
import type { MapLayer } from '@/components/maps/satellite-tile-layer'

const STORAGE_KEY = 'galeotrack-map-layer'
const CHANGE_EVENT = 'galeotrack-map-layer-change'

export function useMapLayer() {
  const layer: MapLayer = useSyncExternalStore(
    (notify) => {
      window.addEventListener('storage', notify)
      window.addEventListener(CHANGE_EVENT, notify)
      return () => { window.removeEventListener('storage', notify); window.removeEventListener(CHANGE_EVENT, notify) }
    },
    () => window.localStorage.getItem(STORAGE_KEY) === 'oceanic' ? 'oceanic' : 'satellite',
    () => 'satellite',
  )
  const chooseLayer = useCallback((next: MapLayer) => {
    window.localStorage.setItem(STORAGE_KEY, next)
    window.dispatchEvent(new Event(CHANGE_EVENT))
  }, [])
  return [layer, chooseLayer] as const
}
