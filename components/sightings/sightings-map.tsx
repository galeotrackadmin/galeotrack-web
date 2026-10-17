'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import Image from 'next/image'
import { MapContainer, Marker, Popup, ZoomControl, useMap, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import type { MapSighting } from '@/lib/types'
import { groupMapSightings } from '@/lib/sightings/map-data'
import { ObservationDetails } from './observation-details'
import { StatusBadge } from '@/components/ui/status-badge'
import { Button } from '@/components/ui/button'
import { Alert } from '@/components/ui/alert'
import 'leaflet/dist/leaflet.css'
import { formatImportedDate } from '@/lib/sightings/import-date'
import './sightings-map.css'
import { supabase } from '@/lib/supabase-client'
import { useResource } from '@/lib/use-resource'
import { EVIDENCE_BUCKET } from '@/lib/sightings/media'
import { sharkMarkerIcon } from '@/lib/sightings/map-icons'
import { MapTileLayer } from '@/components/maps/satellite-tile-layer'
import { MapLayerControl } from '@/components/maps/map-layer-control'
import { useMapLayer } from '@/lib/sightings/use-map-layer'

function MapPhoto({ path, species }: { path: string; species: string }) {
  const load = useCallback(async () => {
    const { data, error } = await supabase.storage.from(EVIDENCE_BUCKET).createSignedUrl(path, 600)
    if (error) throw new Error('No se pudo cargar la fotografía.')
    return data.signedUrl
  }, [path])
  const resource = useResource(load)
  return <div className="mt-3">{resource.loading && <p role="status">Cargando fotografía…</p>}{resource.data && <Image unoptimized src={resource.data} width={320} height={200} alt={`Fotografía de ${species}`} className="max-h-40 w-full rounded-lg object-contain" />}{resource.error && <p className="text-muted">{resource.error}</p>}</div>
}

function PopupFrame({ children }: { children: ReactNode }) {
  const map = useMap()
  const content = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const popup = content.current?.closest<HTMLElement>('.leaflet-popup')
    if (!popup) return
    // Encuadrar después de renderizar la ficha y al cambiar su tamaño.
    const fit = () => {
      const card = popup.getBoundingClientRect(), frame = map.getContainer().getBoundingClientRect()
      const dx = card.left < frame.left + 12 ? card.left - frame.left - 12 : Math.max(0, card.right - frame.right + 12)
      const dy = card.top < frame.top + 12 ? card.top - frame.top - 12 : Math.max(0, card.bottom - frame.bottom + 12)
      if (dx || dy) map.panBy([dx, dy], { animate: false })
    }
    fit()
    const resize = new ResizeObserver(fit)
    resize.observe(popup)
    return () => resize.disconnect()
  }, [map])
  return <div ref={content} className="sighting-popup">{children}</div>
}

function MarkerGroup({ group }: { group: ReturnType<typeof groupMapSightings>[number] }) {
  const map = useMap()
  const [selectedId, setSelectedId] = useState(group.sightings[0].id)
  const [expanded, setExpanded] = useState(false)
  const selected = group.sightings.find((row) => row.id === selectedId) ?? group.sightings[0]
  const multiple = group.sightings.length > 1
  const label = multiple ? `${group.sightings.length} avistamientos en esta zona` : `Avistamiento: ${selected.species ?? 'No identificado'}`
  const icon = useMemo(() => multiple
    ? L.divIcon({ className: 'sightings-marker sightings-marker--group', html: `<span>${group.sightings.length}</span>`, iconSize: [26, 26], iconAnchor: [13, 13] })
    : sharkMarkerIcon(`sightings-marker sightings-marker--${selected.status}`), [multiple, group.sightings.length, selected.status])
  return <Marker position={[group.latitude, group.longitude]} icon={icon} title={label} alt={label} autoPanOnFocus={false} eventHandlers={{
    add: (event) => event.target.getElement()?.setAttribute('aria-label', label),
    mouseover: (event) => { if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) event.target.openPopup() },
    // Leaflet alterna el popup al hacer clic. Si el hover ya lo abrió, conservarlo abierto.
    click: (event) => queueMicrotask(() => event.target.openPopup()),
    keypress: (event) => { if (event.originalEvent.key === 'Enter' || event.originalEvent.key === ' ') { event.originalEvent.preventDefault(); queueMicrotask(() => event.target.openPopup()) } },
    popupopen: (event) => {
      const element = event.popup.getElement()
      if (!element) return
      element.querySelector('.leaflet-popup-close-button')?.setAttribute('aria-label', 'Cerrar tarjeta')
      const content = element.querySelector('.leaflet-popup-content')
      content?.setAttribute('tabindex', '0')
      content?.setAttribute('role', 'region')
      content?.setAttribute('aria-label', 'Ficha del avistamiento')
    },
  }}>
    <Popup autoPan={false} minWidth={180} maxWidth={300} maxHeight={180}>
      <PopupFrame>
        {multiple && <div className="mb-4 space-y-3"><label className="block font-semibold">Avistamientos en esta zona<select className="field-control mt-2" value={selected.id} onChange={(event) => { setSelectedId(event.target.value); setExpanded(false) }}>{group.sightings.map((row, index) => <option value={row.id} key={row.id}>{index + 1}. {row.species} · {row.sighting_date ?? 'Sin fecha'}</option>)}</select></label>{map.getZoom() < 18 && <Button variant="secondary" onClick={() => map.fitBounds(L.latLngBounds(group.sightings.map((row) => [row.latitude, row.longitude])), { maxZoom: Math.min(map.getZoom() + 3, 18), animate: false, padding: [40, 40] })}>Acercar esta zona</Button>}</div>}
        <p className="text-lg font-semibold">{selected.species || 'No identificado'}</p>
        {selected.source_name && <p>Registro histórico · {selected.source_name}</p>}
        <p>{selected.location_name || 'Ubicación no indicada'}</p>
        <p>{formatImportedDate(selected) || selected.sighting_date || 'Fecha no indicada'}{selected.sighting_time ? ` · ${selected.sighting_time.slice(0, 5)} (PR)` : ''} · {selected.quantity ?? '—'} individuos</p>
        <StatusBadge status={selected.status} />
        {selected.photo_path && <MapPhoto key={selected.photo_path} path={selected.photo_path} species={selected.species ?? 'tiburón observado'} />}
        <Button variant="secondary" className="mt-4 w-full" aria-expanded={expanded} onClick={() => setExpanded((value) => !value)}>{expanded ? 'Ocultar ficha' : 'Ver ficha y evidencia'}</Button>
        {expanded && <div className="mt-4"><ObservationDetails key={selected.id} id={selected.id} /></div>}
      </PopupFrame>
    </Popup>
  </Marker>
}

function Points({ rows }: { rows: MapSighting[] }) {
  const map = useMap()
  const [zoom, setZoom] = useState(map.getZoom())
  useMapEvents({ zoomend: () => setZoom(map.getZoom()) })
  const groups = useMemo(() => groupMapSightings(rows, zoom), [rows, zoom])
  return <>{groups.map((group) => <MarkerGroup key={group.key} group={group} />)}</>
}

export default function SightingsMap({ rows }: { rows: MapSighting[] }) {
  const [tileError, setTileError] = useState(false)
  const [layer, chooseLayer] = useMapLayer()
  const bounds = rows.length ? L.latLngBounds(rows.map((row) => [row.latitude, row.longitude])) : undefined
  return <>
    <MapContainer className="sightings-map" center={[18.2208, -66.5901]} zoom={8} bounds={bounds} boundsOptions={{ padding: [45, 45], maxZoom: 11 }} maxZoom={18} scrollWheelZoom={false} zoomControl={false} fadeAnimation={false} zoomAnimation={false} markerZoomAnimation={false}>
      <MapTileLayer layer={layer} onTileError={() => setTileError(true)} onTileLoad={() => setTileError(false)} />
      <ZoomControl position="bottomright" zoomInTitle="Acercar mapa" zoomOutTitle="Alejar mapa" />
      <Points rows={rows} />
      <MapBehavior />
    </MapContainer>
    <MapLayerControl layer={layer} onChange={chooseLayer} />
    {tileError && <Alert kind="info">El fondo cartográfico no está disponible. Puedes consultar las tarjetas y el listado de avistamientos.</Alert>}
  </>
}

function MapBehavior() {
  const map = useMap()
  useEffect(() => {
    const resize = new ResizeObserver(() => map.invalidateSize())
    resize.observe(map.getContainer())
    const touch = window.matchMedia('(pointer: coarse)')
    const update = () => { if (touch.matches) map.dragging.disable(); else map.dragging.enable() }
    update()
    touch.addEventListener('change', update)
    return () => { resize.disconnect(); touch.removeEventListener('change', update) }
  }, [map])
  return null
}
