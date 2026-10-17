'use client'

import { useCallback, useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import Image from 'next/image'
import Link from 'next/link'
import { Icon } from '@/components/icons'
import { Button } from '@/components/ui/button'
import { useResource } from '@/lib/use-resource'
import { supabase } from '@/lib/supabase-client'
import { formatSightingDate, loadPublicMapSightings, type PublicMapSighting } from '@/lib/sightings/public-map'
import './public-tracker.css'
import { PublicSightingReview } from './public-sighting-review'

const TrackerMap = dynamic(() => import('./public-tracker-map'), {
  ssr: false,
  loading: () => <div className="tracker-map-loading" role="status"><span className="ui-spinner" /> Preparando el mapa de Puerto Rico…</div>,
})

export function PublicTracker({ compact = false }: { compact?: boolean }) {
  const load = useCallback((signal?: AbortSignal) => loadPublicMapSightings(supabase, signal), [])
  const resource = useResource(load)
  const [search, setSearch] = useState('')
  const [period, setPeriod] = useState('all')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [listPage, setListPage] = useState(1)
  const rows = useMemo(() => {
    const term = search.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - Number(period))
    const cutoffDay = `${cutoff.getFullYear()}-${String(cutoff.getMonth() + 1).padStart(2, '0')}-${String(cutoff.getDate()).padStart(2, '0')}`
    return (resource.data ?? []).filter((row) => {
      const text = `${row.species ?? ''} ${row.location_name ?? ''}`.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
      return text.includes(term) && (period === 'all' || (row.sighting_date && row.sighting_date >= cutoffDay))
    })
  }, [resource.data, search, period])
  const selected = rows.find((row) => row.id === selectedId) ?? null
  const currentPage = Math.min(listPage, Math.max(1, Math.ceil(rows.length / 6)))
  const speciesCount = new Set(rows.map((row) => row.species).filter(Boolean)).size
  const select = (row: PublicMapSighting) => setSelectedId(row.id)
  const resetFilters = () => { setSearch(''); setPeriod('all'); setSelectedId(null); setListPage(1) }

  if (compact) return <section id="mapa" className="public-tracker public-tracker--compact" aria-label="Mapa público de avistamientos">
    <div className="tracker-canvas" role="region" aria-label="Mapa interactivo de avistamientos en Puerto Rico" aria-describedby="tracker-map-help">
      <TrackerMap rows={resource.data ?? []} selected={selected} onSelect={select} compact />
      <p id="tracker-map-help" className="sr-only">Selecciona un marcador para consultar su ficha. Usa los botones para acercar o alejar el mapa.</p>
    </div>
    {resource.loading && <p className="tracker-map-status" role="status">Cargando avistamientos…</p>}
    {resource.error && <div className="tracker-map-status tracker-map-status--error" role="status"><span>{resource.error}</span><Button variant="secondary" onClick={resource.refresh}>Reintentar</Button></div>}
    {!resource.loading && !resource.error && !resource.data?.length && <p className="tracker-map-status" role="status">No hay avistamientos activos con coordenadas para mostrar.</p>}
  </section>

  return <section id="mapa" className="public-tracker" aria-labelledby="tracker-title">
    <div className="tracker-toolbar">
      <div className="tracker-heading"><span className="tracker-heading-icon"><Icon name="compass" /></span><h2 id="tracker-title">Mapa de avistamientos</h2></div>
      <div className="tracker-filters">
        <label className="tracker-search"><span className="sr-only">Buscar especie o lugar</span><Icon name="search" /><input type="search" value={search} onChange={(event) => { setSearch(event.target.value); setListPage(1) }} placeholder="Busca una especie o lugar" /></label>
        <label className="tracker-period"><span className="sr-only">Periodo de avistamientos</span><select value={period} onChange={(event) => { setPeriod(event.target.value); setListPage(1) }}><option value="all">Todas las fechas</option><option value="7">Últimos 7 días</option><option value="30">Últimos 30 días</option><option value="365">Último año</option></select></label>
      </div>
    </div>

    <div className="tracker-layout">
      <div className="tracker-canvas" role="region" aria-label="Mapa interactivo de avistamientos en Puerto Rico" aria-describedby="tracker-map-help">
        <TrackerMap rows={rows} selected={selected} onSelect={select} />
        <div className="tracker-map-legend"><span className="tracker-legend-dot shark-map-glyph" aria-hidden="true" /><span>Avistamiento registrado</span></div>
        <p id="tracker-map-help" className="sr-only">Selecciona un marcador o un avistamiento del listado para consultar su ficha. Usa los controles para acercar, alejar o centrar el mapa.</p>
      </div>

      <aside className="tracker-sidebar" aria-label="Explorador de avistamientos">
        {selected ? <div className="tracker-detail" aria-live="polite">
          <div className="tracker-detail-top"><span className="tracker-detail-eyebrow">FICHA DEL AVISTAMIENTO</span><button type="button" className="tracker-close" aria-label="Cerrar ficha del avistamiento" onClick={() => setSelectedId(null)}><Icon name="close" /></button></div>
          <h3>{selected.species || 'Especie no identificada'}</h3>
          <PublicSightingReview sighting={selected} />
          <p className="tracker-detail-location"><Icon name="pin" />{selected.location_name || 'Ubicación sin nombre'}</p>
          {selected.source_name && <p>Registro histórico · {selected.source_name}</p>}
          <dl className="tracker-detail-data"><div><dt>Fecha</dt><dd>{formatSightingDate(selected.sighting_date, selected)}</dd></div><div><dt>Hora local · PR</dt><dd>{selected.sighting_time?.slice(0, 5) || 'No registrada'}</dd></div><div><dt>Individuos</dt><dd>{selected.quantity ?? 'No registrado'}</dd></div><div><dt>Coordenadas</dt><dd className="tracker-coordinates">{selected.latitude.toFixed(4)}, {selected.longitude.toFixed(4)}</dd></div></dl>
        </div> : <div className="tracker-intro-card">
          <Image src="/images/landing/ocean-shark.webp" alt="" fill sizes="(max-width: 899px) 100vw, 360px" loading="eager" />
          <div><span className="tracker-verified"><Icon name="check" /> Ciencia y comunidad</span><h3>Un océano.<br />Mucho por descubrir.</h3><p>Selecciona un punto en el mapa y conoce los encuentros de nuestra comunidad.</p></div>
        </div>}

        <div className="tracker-statistics"><div><strong>{resource.loading || resource.error ? '—' : rows.length}</strong><span>Avistamientos</span></div><div><strong>{resource.loading || resource.error ? '—' : speciesCount}</strong><span>Identificaciones</span></div></div>
        <div className="tracker-results">
          <div className="tracker-results-heading"><h3>{selected ? 'Más avistamientos' : 'Encuentros registrados'}</h3><button type="button" className="tracker-close" aria-label="Actualizar avistamientos" disabled={resource.loading} onClick={resource.refresh}><Icon name="refresh" /></button></div>
          <p className="tracker-results-count" role="status">{resource.loading ? 'Cargando avistamientos…' : resource.error ? 'Datos no disponibles' : `${rows.length} ${rows.length === 1 ? 'resultado' : 'resultados'}`}</p>
          {resource.error ? <div className="tracker-empty"><Icon name="info" /><p>{resource.error}</p><Button variant="secondary" onClick={resource.refresh}>Reintentar</Button></div> : !resource.loading && rows.length === 0 ? <div className="tracker-empty"><Icon name="waves" /><p>{search || period !== 'all' ? 'No hay avistamientos con estos filtros.' : 'No hay avistamientos activos con coordenadas para mostrar.'}</p>{(search || period !== 'all') && <Button variant="secondary" onClick={resetFilters}>Limpiar filtros</Button>}</div> : <ul className="tracker-sighting-list">{rows.slice((currentPage - 1) * 6, currentPage * 6).map((row) => <li key={row.id}><button type="button" className={`tracker-sighting${selected?.id === row.id ? ' tracker-sighting--selected' : ''}`} aria-pressed={selected?.id === row.id} onClick={() => select(row)}><span className="tracker-sighting-icon"><Icon name="pin" /></span><span><strong>{row.species || 'Especie no identificada'}</strong><span>{row.location_name || 'Ubicación sin nombre'}</span>{row.source_name && <small>Registro histórico · {row.source_name}</small>}<small>{formatSightingDate(row.sighting_date, row)}</small></span><Icon name="chevron-right" /></button></li>)}</ul>}
          {rows.length > 6 && <nav className="tracker-pagination" aria-label="Páginas del explorador"><button type="button" aria-label="Avistamientos anteriores" disabled={currentPage === 1} onClick={() => setListPage(currentPage - 1)}><Icon name="chevron-left" /></button><span>{currentPage} / {Math.ceil(rows.length / 6)}</span><button type="button" aria-label="Avistamientos siguientes" disabled={currentPage * 6 >= rows.length} onClick={() => setListPage(currentPage + 1)}><Icon name="chevron-right" /></button></nav>}
        </div>
        <div className="tracker-contribute"><p>¿Tuviste un encuentro en el mar?</p><Link href="/report" className="button button--primary">Reportar un avistamiento <Icon name="arrow" /></Link></div>
      </aside>
    </div>
  </section>
}
