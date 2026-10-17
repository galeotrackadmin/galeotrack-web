'use client'

import { Fragment } from 'react'
import { TileLayer } from 'react-leaflet'

export const SATELLITE_TILES = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
export const OCEANIC_TILES = 'https://server.arcgisonline.com/ArcGIS/rest/services/Ocean/World_Ocean_Base/MapServer/tile/{z}/{y}/{x}'
export const OCEANIC_REFERENCE_TILES = 'https://server.arcgisonline.com/ArcGIS/rest/services/Ocean/World_Ocean_Reference/MapServer/tile/{z}/{y}/{x}'
export const SATELLITE_ATTRIBUTION = 'Tiles &copy; Esri &middot; Sources: Esri, Maxar, Earthstar Geographics, and the GIS User Community'
export type MapLayer = 'satellite' | 'oceanic'

export function MapTileLayer({ layer, onTileError, onTileLoad }: { layer: MapLayer; onTileError?: () => void; onTileLoad?: () => void }) {
  return <Fragment>
    <TileLayer key={layer} url={layer === 'satellite' ? SATELLITE_TILES : OCEANIC_TILES} maxNativeZoom={layer === 'satellite' ? 18 : 13} attribution={SATELLITE_ATTRIBUTION} eventHandlers={{ tileerror: onTileError, tileload: onTileLoad }} />
    {layer === 'oceanic' && <TileLayer url={OCEANIC_REFERENCE_TILES} maxNativeZoom={13} attribution={SATELLITE_ATTRIBUTION} eventHandlers={{ tileerror: onTileError, tileload: onTileLoad }} />}
  </Fragment>
}
