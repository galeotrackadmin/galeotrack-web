'use client'

import { useEffect, useState } from 'react'

// Cada respuesta queda ligada a su consulta; cambios de filtro ignoran peticiones antiguas.
export function useResource<T>(load: (signal?: AbortSignal) => Promise<T>) {
  const [revision, setRevision] = useState(0)
  const [result, setResult] = useState<{ load: typeof load; revision: number; data?: T; error?: string } | null>(null)
  useEffect(() => {
    let active = true
    const controller = new AbortController()
    void load(controller.signal).then((data) => {
      if (active) setResult({ load, revision, data })
    }).catch((error: unknown) => {
      if (active) setResult({ load, revision, error: error instanceof Error ? error.message : 'No se pudieron cargar los datos.' })
    })
    return () => { active = false; controller.abort() }
  }, [load, revision])
  const current = result?.load === load && result?.revision === revision
  return { data: current ? result.data : undefined, error: current ? result.error : undefined, loading: !current, refresh: () => setRevision((n) => n + 1) }
}
