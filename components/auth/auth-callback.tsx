'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Icon as AuthIcon } from '@/components/icons'
import { Alert } from '@/components/ui/alert'
import { buttonStyles } from '@/components/ui/button'
import { completeOAuthSignIn } from '@/lib/auth'
import { getProfile, homeForRole } from '@/lib/access'
import { supabase } from '@/lib/supabase-client'

export function AuthCallback() {
  const router = useRouter()
  const [error, setError] = useState('')
  const exchange = useRef<Promise<string> | null>(null)

  useEffect(() => {
    let active = true
    // Comparte el intercambio entre las ejecuciones del efecto en Strict Mode.
    if (!exchange.current) {
      const callbackUrl = window.location.href
      window.history.replaceState(window.history.state, '', '/auth/callback')
      exchange.current = completeOAuthSignIn(supabase, callbackUrl).then(async () => {
        const profile = await getProfile(supabase)
        return homeForRole(profile.role)
      })
    }

    void exchange.current.then((destination) => {
      if (active) router.replace(destination)
    }).catch((error: unknown) => {
      if (!active) return
      setError(error instanceof Error ? error.message : 'No se pudo completar el acceso. Inténtalo de nuevo.')
    })

    return () => { active = false }
  }, [router])

  return (
    <>
      <p className="auth-kicker">ACCESO A GALEOTRACK</p>
      <h1>{error ? 'Vamos a intentarlo de nuevo.' : 'Preparando tu espacio de trabajo.'}</h1>
      {error ? (
        <>
          <Alert kind="error" className="my-6">{error}</Alert>
          <Link href="/login" className={buttonStyles('primary', 'w-full')}>Volver al inicio de sesión <AuthIcon name="arrow" /></Link>
        </>
      ) : (
        <p role="status" className="auth-callback-status"><span className="ui-spinner" aria-hidden="true" /> Validando tu sesión y los permisos de tu cuenta…</p>
      )}
    </>
  )
}
