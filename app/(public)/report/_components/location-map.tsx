'use client'

import { useEffect, useState } from 'react'
import { MapContainer, Marker, ZoomControl, useMap, useMapEvents } from 'react-leaflet'
import { Alert } from '@/components/ui/alert'
import { sharkMarkerIcon } from '@/lib/sightings/map-icons'
import { MapTileLayer } from '@/components/maps/satellite-tile-layer'
import { MapLayerControl } from '@/components/maps/map-layer-control'
import { useMapLayer } from '@/lib/sightings/use-map-layer'
import 'leaflet/dist/leaflet.css'
import './location-map.css'

type Props = { latitude?: number; longitude?: number; onLocationChange: (latitude: number, longitude: number) => void; disabled?: boolean }

const DEFAULT_CENTER: [number, number] = [18.2208, -66.5901]
const markerIcon = sharkMarkerIcon('galeo-map-marker')

function MapInteraction({ latitude, longitude, onLocationChange, disabled }: Props) {
  const map = useMap()
  useMapEvents({ click: (event) => { if (!disabled) onLocationChange(event.latlng.lat, event.latlng.wrap().lng) } })
  useEffect(() => {
    if (latitude !== undefined && longitude !== undefined) map.setView([latitude, longitude], Math.max(map.getZoom(), 11), { animate: false })
    else map.setView(DEFAULT_CENTER, 9, { animate: false })
  }, [map, latitude, longitude])
  useEffect(() => {
    if (disabled) { map.dragging.disable(); map.touchZoom.disable(); map.doubleClickZoom.disable(); map.keyboard.disable() }
    else { map.dragging.enable(); map.touchZoom.enable(); map.doubleClickZoom.enable(); map.keyboard.enable() }
  }, [map, disabled])
  return null
}

export default function LocationMap(props: Props) {
  const [tileError, setTileError] = useState(false)
  const [layer, chooseLayer] = useMapLayer()
  const { latitude, longitude, disabled } = props
  return (
    <>
      <div className="relative" inert={disabled || undefined}>
        <MapContainer center={DEFAULT_CENTER} zoom={9} zoomControl={false} scrollWheelZoom={false} className="galeo-map h-[350px] w-full" attributionControl>
          <MapTileLayer layer={layer} onTileError={() => setTileError(true)} onTileLoad={() => setTileError(false)} />
          <MapLayerControl layer={layer} onChange={chooseLayer} />
          <ZoomControl position="topright" zoomInTitle="Acercar mapa" zoomOutTitle="Alejar mapa" />
          <MapInteraction {...props} />
          {latitude !== undefined && longitude !== undefined && <Marker position={[latitude, longitude]} icon={markerIcon} title="Ubicación del avistamiento" alt="Ubicación seleccionada" draggable={!disabled} eventHandlers={{ dragend: (event) => { if (!disabled) { const point = event.target.getLatLng(); props.onLocationChange(point.lat, point.wrap().lng) } } }} />}
        </MapContainer>
      </div>
      {tileError && <Alert kind="info" className="m-3">Algunas partes del mapa no se pudieron cargar. Puedes escribir las coordenadas o enviar el nombre del lugar sin usar el mapa.</Alert>}
    </>
  )
}
