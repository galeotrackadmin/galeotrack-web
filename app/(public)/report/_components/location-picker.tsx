'use client'

import { useEffect } from 'react'
import dynamic from 'next/dynamic'
import { useWatch, type Control, type FieldErrors, type UseFormRegister, type UseFormSetValue, type UseFormTrigger } from 'react-hook-form'
import { coordinateValue, type SightingFormData, type SightingFormInput } from '@/lib/sightings/schema'
import { useGeolocation } from '../_hooks/use-geolocation'
import { Icon } from '@/components/icons'
import { Button } from '@/components/ui/button'
import { Alert } from '@/components/ui/alert'
import { FormField, Input, fieldDescription } from '@/components/ui/form-field'
import { LoadingState } from '@/components/ui/loading-state'
import { PlaceSearch } from '@/components/sightings/place-search'

const LocationMap = dynamic(() => import('./location-map'), { ssr: false, loading: () => <LoadingState label="Cargando el mapa…" className="h-[350px] bg-soft" /> })

type Props = {
  control: Control<SightingFormInput, unknown, SightingFormData>
  register: UseFormRegister<SightingFormInput>
  setValue: UseFormSetValue<SightingFormInput>
  trigger: UseFormTrigger<SightingFormInput>
  errors: FieldErrors<SightingFormInput>
  disabled: boolean
}

export function LocationPicker({ control, register, setValue, trigger, errors, disabled }: Props) {
  const [rawLatitude, rawLongitude] = useWatch({ control, name: ['latitude', 'longitude'] })
  const latitude = coordinateValue(rawLatitude, -90, 90)
  const longitude = coordinateValue(rawLongitude, -180, 180)
  const location = useGeolocation()

  // Ignora una respuesta GPS que llegue después de comenzar el envío o desmontar.
  const { clear } = location
  // La cancelación usa una función estable del hook.
  useEffect(() => { if (disabled) clear() }, [disabled, clear])

  function selectLocation(lat: number, lng: number, metadata?: { altitude: number | null; accuracy: number }) {
    if (disabled) return
    setValue('latitude', Number(lat.toFixed(6)), { shouldDirty: true })
    setValue('longitude', Number(lng.toFixed(6)), { shouldDirty: true })
    setValue('altitude', metadata?.altitude ?? '', { shouldDirty: true })
    setValue('accuracy', metadata?.accuracy ?? '', { shouldDirty: true })
    void trigger(['latitude', 'longitude'])
  }

  function clearCoordinates() {
    location.clear()
    setValue('latitude', '', { shouldDirty: true })
    setValue('longitude', '', { shouldDirty: true })
    setValue('altitude', '', { shouldDirty: true })
    setValue('accuracy', '', { shouldDirty: true })
    void trigger(['latitude', 'longitude'])
  }

  const hasCoordinates = latitude !== undefined && longitude !== undefined
  return (
    <div>
      <PlaceSearch disabled={disabled} onSelect={(place) => { location.clear(); selectLocation(place.latitude, place.longitude); setValue('location_name', place.name, { shouldDirty: true, shouldValidate: true }) }} />
      <p id="map-help" className="mt-4 text-sm leading-relaxed text-muted">Usa tu ubicación si estás en el lugar del avistamiento, toca el mapa o escribe las coordenadas. La latitud y la longitud son obligatorias para situar tu reporte.</p>
      <div className="mt-4 flex flex-wrap gap-3"><Button variant="secondary" onClick={() => location.locate(selectLocation)} loading={location.loading} disabled={disabled}>{!location.loading && <Icon name="pin" />}{location.loading ? 'Obteniendo ubicación…' : 'Usar mi ubicación'}</Button><Button variant="ghost" onClick={clearCoordinates} disabled={disabled || ((rawLatitude === '' || rawLatitude == null) && (rawLongitude === '' || rawLongitude == null) && !location.loading)}>Quitar coordenadas</Button></div>
      {location.status && <Alert kind={location.status.kind} className="mt-4">{location.status.message}</Alert>}
      <div className="relative isolate mt-5 overflow-hidden rounded-xl border border-border" role="region" aria-label="Mapa del lugar del avistamiento" aria-describedby="map-help">
        <LocationMap latitude={hasCoordinates ? latitude : undefined} longitude={hasCoordinates ? longitude : undefined} onLocationChange={(lat, lng) => { location.clear(); selectLocation(lat, lng) }} disabled={disabled} />
      </div>
      <p role="status" className="mt-3 min-h-5 text-sm text-muted">{hasCoordinates ? 'Ubicación seleccionada. Puedes ajustar el marcador o editar las coordenadas.' : 'Sin coordenadas seleccionadas. El mapa muestra Puerto Rico.'}</p>
      <div className="mt-4 grid gap-5 sm:grid-cols-2">
        <FormField id="latitude" label="Latitud" required error={errors.latitude?.message}><Input {...register('latitude', { onChange: () => { location.clear(); setValue('altitude', ''); setValue('accuracy', '') }, onBlur: () => { void trigger(['latitude', 'longitude']) } })} id="latitude" type="number" inputMode="decimal" step="any" min={-90} max={90} placeholder="18.340000" aria-invalid={!!errors.latitude} aria-describedby={fieldDescription('latitude', errors.latitude?.message)} className="font-mono" /></FormField>
        <FormField id="longitude" label="Longitud" required error={errors.longitude?.message}><Input {...register('longitude', { onChange: () => { location.clear(); setValue('altitude', ''); setValue('accuracy', '') }, onBlur: () => { void trigger(['latitude', 'longitude']) } })} id="longitude" type="number" inputMode="decimal" step="any" min={-180} max={180} placeholder="-67.250000" aria-invalid={!!errors.longitude} aria-describedby={fieldDescription('longitude', errors.longitude?.message)} className="font-mono" /></FormField>
        <FormField id="altitude" label="Altitud (m)" error={errors.altitude?.message}><Input {...register('altitude')} id="altitude" type="number" inputMode="decimal" step="any" aria-invalid={!!errors.altitude} aria-describedby={fieldDescription('altitude', errors.altitude?.message)} /></FormField>
        <FormField id="accuracy" label="Precisión (m)" error={errors.accuracy?.message} hint="Margen de error del GPS; no indica la profundidad del agua."><Input {...register('accuracy')} id="accuracy" type="number" inputMode="decimal" min={0} step="any" aria-invalid={!!errors.accuracy} aria-describedby={fieldDescription('accuracy', errors.accuracy?.message, 'Margen de error del GPS; no indica la profundidad del agua.')} /></FormField>
      </div>
    </div>
  )
}
