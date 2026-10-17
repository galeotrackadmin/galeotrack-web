'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

type LocationStatus = { kind: 'info' | 'success' | 'error'; message: string } | null

export function useGeolocation() {
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<LocationStatus>(null)
  const request = useRef(0)
  const inFlight = useRef(false)

  useEffect(() => () => { request.current += 1; inFlight.current = false }, [])

  const clear = useCallback(() => {
    request.current += 1
    inFlight.current = false
    setLoading(false)
    setStatus(null)
  }, [])

  function locate(onLocation: (latitude: number, longitude: number, metadata?: { altitude: number | null; accuracy: number }) => void) {
    if (inFlight.current) return
    if (!navigator.geolocation) {
      setStatus({ kind: 'error', message: 'Este navegador no ofrece geolocalización. Puedes usar el mapa o escribir las coordenadas.' })
      return
    }
    const id = ++request.current
    inFlight.current = true
    setLoading(true)
    setStatus(null)

    function fail(message: string) {
      if (id !== request.current) return
      inFlight.current = false
      setLoading(false)
      setStatus({ kind: 'error', message })
    }

    try {
      navigator.geolocation.getCurrentPosition((position) => {
        if (id !== request.current) return
        inFlight.current = false
        setLoading(false)
        onLocation(position.coords.latitude, position.coords.longitude, { altitude: position.coords.altitude, accuracy: position.coords.accuracy })
        setStatus({ kind: 'success', message: 'Ubicación obtenida. Confirma que corresponde al lugar del avistamiento.' })
      }, (error) => {
        const message = error.code === 1 ? 'No se permitió el acceso a tu ubicación.' : error.code === 2 ? 'Tu ubicación no está disponible en este momento.' : 'La solicitud de ubicación tardó demasiado.'
        fail(`${message} Puedes reintentar, usar el mapa o escribir las coordenadas.`)
      }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 })
    } catch {
      fail('No se pudo obtener tu ubicación. Puedes usar el mapa o escribir las coordenadas.')
    }
  }

  return { loading, status, locate, clear }
}
