'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { MapContainer, Marker, Popup, useMap, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import { Icon } from '@/components/icons'
import type { PublicMapSighting } from '@/lib/sightings/public-map'
import { groupMapSightings } from '@/lib/sightings/map-data'
import { formatSightingDate } from '@/lib/sightings/public-map'
import { sharkMarkerIcon } from '@/lib/sightings/map-icons'
import { MapTileLayer } from '@/components/maps/satellite-tile-layer'
import { MapLayerControl } from '@/components/maps/map-layer-control'
import { useMapLayer } from '@/lib/sightings/use-map-layer'
import { PublicSightingReview } from './public-sighting-review'
import 'leaflet/dist/leaflet.css'

type Props = {
  rows: PublicMapSighting[]
  selected: PublicMapSighting | null
  onSelect: (row: PublicMapSighting) => void
  compact?: boolean
}

function MapPoints({ rows, selected, onSelect, compact }: Props) {
  const map = useMap()
  const [zoom, setZoom] = useState(map.getZoom())
  useMapEvents({ zoomend: () => setZoom(map.getZoom()) })
  const groups = useMemo(() => groupMapSightings(rows, zoom), [rows, zoom])
  useEffect(() => {
    if (selected && !compact) map.setView([selected.latitude, selected.longitude], Math.max(map.getZoom(), 11), { animate: false })
  }, [map, selected, compact])

  return <>{groups.map((group) => <MapPoint key={group.key} group={group} zoom={zoom} active={group.sightings.some((row) => row.id === selected?.id)} onSelect={onSelect} />)}</>
}

function MapPoint({ group, zoom, active, onSelect }: { group: ReturnType<typeof groupMapSightings<PublicMapSighting>>[number]; zoom: number; active: boolean; onSelect: (row: PublicMapSighting) => void }) {
    const map = useMap()
    const marker = useRef<L.Marker | null>(null)
    const [sightingId, setSightingId] = useState(group.sightings[0].id)
    const popupId = `tracker-sightings-${group.key.replace(':', '-')}`
    const multiple = group.sightings.length > 1
    const overlapping = multiple && (zoom >= 18 || group.sightings.every((row) => row.latitude === group.sightings[0].latitude && row.longitude === group.sightings[0].longitude))
    const showPopup = !multiple || overlapping
    const label = multiple ? `${group.sightings.length} avistamientos; ${overlapping ? 'consultar registros' : 'acercar esta zona'}` : `Ver avistamiento: ${group.sightings[0].species || 'Especie no identificada'}`
    const icon = useMemo(() => multiple
      ? L.divIcon({ className: `tracker-marker tracker-marker--group${active ? ' tracker-marker--active' : ''}`, html: `<span>${group.sightings.length}</span>`, iconSize: [44, 44], iconAnchor: [22, 22] })
      : sharkMarkerIcon(`tracker-marker${active ? ' tracker-marker--active' : ''}`), [active, multiple, group.sightings.length])
    const activate = (marker?: L.Marker) => {
      if (!showPopup) {
        map.fitBounds(L.latLngBounds(group.sightings.map((row) => [row.latitude, row.longitude])), { padding: [48, 48], maxZoom: Math.min(map.getZoom() + 3, 18), animate: false })
        return
      }
      onSelect(group.sightings.find((row) => row.id === sightingId) ?? group.sightings[0])
      queueMicrotask(() => marker?.openPopup())
    }
    const sighting = group.sightings.find((row) => row.id === sightingId) ?? group.sightings[0]
    useEffect(() => {
      if (active && showPopup) marker.current?.openPopup()
    }, [active, showPopup])
    return <Marker ref={marker} position={[group.latitude, group.longitude]} icon={icon} title={label} alt={label} eventHandlers={{
      add: (event) => event.target.getElement()?.setAttribute('aria-label', label),
      popupopen: (event) => {
        const popup = event.popup.getElement()
        popup?.querySelector('.leaflet-popup-close-button')?.setAttribute('aria-label', 'Cerrar ficha del avistamiento')
        const content = popup?.querySelector('.leaflet-popup-content')
        content?.setAttribute('tabindex', '0')
        content?.setAttribute('role', 'region')
        content?.setAttribute('aria-label', 'Datos del avistamiento')
      },
      click: (event) => activate(event.target),
      keypress: (event) => {
        if (event.originalEvent.key === 'Enter' || event.originalEvent.key === ' ') {
          event.originalEvent.preventDefault()
          activate(event.target)
        }
      },
    }}>
      {showPopup && <Popup autoPan autoPanPadding={[12, 12]} minWidth={180} maxWidth={280} maxHeight={210}>
        <article className="tracker-popup">
          {multiple && <div className="tracker-popup-selector"><label htmlFor={popupId}>Avistamientos en este punto</label><select id={popupId} value={sighting.id} onChange={(event) => {
            setSightingId(event.target.value)
            const row = group.sightings.find((row) => row.id === event.target.value)
            if (row) onSelect(row)
          }}>{group.sightings.map((row, index) => <option key={row.id} value={row.id}>{index + 1}. {row.species || 'Especie no identificada'}</option>)}</select></div>}
          <p className="tracker-popup-eyebrow">FICHA DEL AVISTAMIENTO</p>
          <h2>{sighting.species || 'Especie no identificada'}</h2>
          <PublicSightingReview sighting={sighting} />
          {sighting.source_name && <p>Registro histórico · {sighting.source_name}</p>}
          <p>{sighting.location_name || 'Ubicación sin nombre'}</p>
          <dl>
            <div><dt>Fecha</dt><dd>{formatSightingDate(sighting.sighting_date, sighting)}</dd></div>
            <div><dt>Hora local · PR</dt><dd>{sighting.sighting_time?.slice(0, 5) || 'No registrada'}</dd></div>
            <div><dt>Individuos</dt><dd>{sighting.quantity ?? 'No registrado'}</dd></div>
            <div><dt>Coordenadas</dt><dd>{sighting.latitude.toFixed(4)}, {sighting.longitude.toFixed(4)}</dd></div>
          </dl>
        </article>
      </Popup>}
    </Marker>
}

function MapControls({ compact }: { compact?: boolean }) {
  const map = useMap()
  const controls = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (controls.current) {
      L.DomEvent.disableClickPropagation(controls.current)
      L.DomEvent.disableScrollPropagation(controls.current)
    }
    const resize = new ResizeObserver(() => map.invalidateSize())
    resize.observe(map.getContainer())
    return () => resize.disconnect()
  }, [map])
  return <div ref={controls} className="tracker-map-controls">
    <button type="button" aria-label="Acercar mapa" onClick={() => map.zoomIn()}><Icon name="plus" /></button>
    <button type="button" aria-label="Alejar mapa" onClick={() => map.zoomOut()}><span aria-hidden="true">−</span></button>
    {!compact && <button type="button" aria-label="Centrar mapa en Puerto Rico" onClick={() => map.setView([18.2208, -66.5901], 8, { animate: false })}><Icon name="compass" /></button>}
  </div>
}

function CompactMapBehavior() {
  const map = useMap()
  useEffect(() => {
    map.fitBounds([[17.75, -67.5], [18.65, -65.2]], { padding: [16, 16], maxZoom: 8, animate: false })
    const touch = window.matchMedia('(pointer: coarse)')
    const update = () => { if (touch.matches) map.dragging.disable(); else map.dragging.enable() }
    update()
    touch.addEventListener('change', update)
    return () => touch.removeEventListener('change', update)
  }, [map])
  return null
}

export default function PublicTrackerMap({ rows, selected, onSelect, compact }: Props) {
  const [tileError, setTileError] = useState(false)
  const [layer, chooseLayer] = useMapLayer()
  return <>
    <MapContainer className="tracker-map" center={[18.2208, -66.5901]} zoom={8} minZoom={3} maxZoom={18} scrollWheelZoom={false} zoomControl={false} attributionControl={true} fadeAnimation={false} zoomAnimation={false} markerZoomAnimation={false}>
      <MapTileLayer layer={layer} onTileError={() => setTileError(true)} onTileLoad={() => setTileError(false)} />
      {compact && <CompactMapBehavior />}
      <MapPoints rows={rows} selected={selected} onSelect={onSelect} compact={compact} />
      <MapControls compact={compact} />
    </MapContainer>
    <MapLayerControl layer={layer} onChange={chooseLayer} />
    {tileError && <p className="tracker-tile-error" role="status">El fondo del mapa no está disponible.</p>}
  </>
}
