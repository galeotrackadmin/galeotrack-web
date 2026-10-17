'use client'

import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase-client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/form-field'
import { Alert } from '@/components/ui/alert'

type Place = { name: string; latitude: number; longitude: number }
export function PlaceSearch({ disabled, onSelect }: { disabled: boolean; onSelect: (place: Place) => void }) {
  const [query, setQuery] = useState('')
  const [places, setPlaces] = useState<Place[]>([])
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const request = useRef<AbortController | null>(null)
  const blocked = useRef(disabled)
  useEffect(() => { blocked.current = disabled; if (disabled) request.current?.abort() }, [disabled])
  useEffect(() => () => { request.current?.abort() }, [])
  async function search() {
    if (disabled || loading) return
    const controller = new AbortController(); request.current = controller
    setLoading(true); setMessage(''); setPlaces([])
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Inicia sesión para buscar lugares.')
      const response = await fetch(`/api/places?q=${encodeURIComponent(query.trim())}`, { headers: { Authorization: `Bearer ${session.access_token}` }, signal: controller.signal })
      const result = await response.json()
      if (!response.ok) throw new Error(result.message ?? 'No se pudo buscar el lugar.')
      if (controller.signal.aborted || blocked.current) return
      setPlaces(result.places)
      if (!result.places.length) setMessage('No encontramos ese lugar. Prueba otro nombre o selecciona el punto en el mapa.')
    } catch (error) {
      if (!controller.signal.aborted) setMessage(error instanceof Error ? error.message : 'No se pudo buscar el lugar.')
    } finally { setLoading(false) }
  }
  return <div className="space-y-3">
    <label htmlFor="place-search" className="block text-sm font-semibold">Buscar lugar o dirección</label>
    <div className="flex flex-wrap gap-3"><Input id="place-search" value={query} onChange={(e) => setQuery(e.target.value)} maxLength={200} disabled={disabled || loading} placeholder="Ej. Playa Crash Boat, Aguadilla" className="min-w-0 flex-1 basis-56" onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void search() } }} /><Button variant="secondary" disabled={disabled || loading || query.trim().length < 3} loading={loading} onClick={() => void search()}>Buscar lugar</Button></div>
    {message && <Alert kind="info">{message}</Alert>}
    {places.length > 0 && <><p role="status" className="text-sm text-muted">{places.length} resultados. Selecciona el lugar del avistamiento.</p><ul className="divide-y divide-border rounded-xl border border-border">{places.map((place, index) => <li key={`${place.latitude}-${place.longitude}-${index}`}><button type="button" disabled={disabled} className="w-full rounded-xl p-4 text-left text-sm hover:bg-soft" onClick={() => { if (disabled) return; onSelect(place); setPlaces([]); setQuery(place.name); setMessage('Lugar seleccionado. Ajusta el punto si el encuentro fue mar adentro.') }}>{place.name}</button></li>)}</ul></>}
    <p className="text-xs text-muted">Búsqueda geográfica: OpenStreetMap / Nominatim. Confirma la posición exacta del encuentro.</p>
  </div>
}
