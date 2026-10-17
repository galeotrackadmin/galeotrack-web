'use client'

import type { MapLayer } from './satellite-tile-layer'

export function MapLayerControl({ layer, onChange }: { layer: MapLayer; onChange: (layer: MapLayer) => void }) {
  return <div className="map-layer-control" role="group" aria-label="Fondo del mapa">
    <button type="button" aria-pressed={layer === 'satellite'} onClick={() => onChange('satellite')}>Satélite</button>
    <button type="button" aria-pressed={layer === 'oceanic'} onClick={() => onChange('oceanic')}>Oceánico</button>
  </div>
}
