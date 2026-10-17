'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { getProfile, homeForRole } from '@/lib/access'
import { supabase } from '@/lib/supabase-client'
import { useResource } from '@/lib/use-resource'

// La portada no cierra la sesión: permite volver al espacio sin introducir credenciales.
export function PublicSessionLinks() {
  const [revision, setRevision] = useState(0)
  const load = useCallback(async () => {
    void revision
    const { data: { session }, error } = await supabase.auth.getSession()
    if (error) throw error
    if (!session) return null
    const profile = await getProfile(supabase)
    return homeForRole(profile.role)
  }, [revision])
  const resource = useResource(load)

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (['SIGNED_IN', 'SIGNED_OUT', 'USER_UPDATED', 'TOKEN_REFRESHED'].includes(event)) setRevision((value) => value + 1)
    })
    return () => subscription.unsubscribe()
  }, [])

  if (resource.loading) return <span className="site-nav-link" role="status">Comprobando sesión…</span>
  if (resource.data || resource.error) return <Link href={resource.data ?? '/cuenta'} className="site-nav-link">Mi espacio</Link>
  return <>
    <Link href="/login" className="site-nav-link">Iniciar sesión</Link>
    <Link href="/register" className="button site-signup-button">Crear cuenta</Link>
  </>
}
