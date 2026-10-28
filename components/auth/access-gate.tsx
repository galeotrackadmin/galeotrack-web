'use client'

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { canAccess, canReport, getProfile, homeForRole, SessionRequiredError, type Mode, type Profile } from '@/lib/access'
import { supabase } from '@/lib/supabase-client'
import { Alert } from '@/components/ui/alert'
import { Button, buttonStyles } from '@/components/ui/button'
import { PageHeading } from '@/components/layout/page-heading'
import { WorkspaceSkeleton } from '@/components/ui/loading-state'

const ProfileContext = createContext<{ profile: Profile; refresh: () => Promise<void> } | null>(null)
export function useProfile() {
  const context = useContext(ProfileContext)
  if (!context) throw new Error('El perfil requiere AccessGate.')
  return context.profile
}

export function useRefreshProfile() {
  const context = useContext(ProfileContext)
  if (!context) throw new Error('El perfil requiere AccessGate.')
  return context.refresh
}

export function AccessGate({ children }: { children: ReactNode }) {
  const router = useRouter()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const refresh = useCallback(async () => {
    try {
      const next = await getProfile(supabase)
      setProfile(next)
      setError('')
    } catch (error) {
      setProfile(null)
      if (error instanceof SessionRequiredError) router.replace('/login')
      else setError(error instanceof Error ? error.message : 'No se pudo comprobar el acceso.')
    }
  }, [router])
  useEffect(() => {
    let active = true
    async function load() {
      try {
        const next = await getProfile(supabase)
        if (active) { setProfile(next); setError('') }
      } catch (error) {
        if (!active) return
        setProfile(null)
        if (error instanceof SessionRequiredError) router.replace('/login')
        else setError(error instanceof Error ? error.message : 'No se pudo comprobar el acceso.')
      }
    }
    void load()
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') { setProfile(null); router.replace('/login') }
    })
    // Returning to an installed app while offline must not unmount an in-memory report.
    const refreshOnFocus = () => { if (navigator.onLine) void load() }
    window.addEventListener('focus', refreshOnFocus)
    return () => { active = false; subscription.unsubscribe(); window.removeEventListener('focus', refreshOnFocus) }
  }, [router, attempt])
  if (error) return <div className="page-container py-12"><Alert kind="error">{error}</Alert><Button className="mt-4" onClick={() => { setError(''); setAttempt(attempt + 1) }}>Reintentar</Button></div>
  if (!profile) return <WorkspaceSkeleton />
  return <ProfileContext value={{ profile, refresh }}>{children}</ProfileContext>
}

export function RequireMode({ mode, children }: { mode: Mode; children: ReactNode }) {
  const profile = useProfile()
  if (!canAccess(profile.role, mode)) return <section><PageHeading eyebrow="Tu espacio en GaleoTrack" title="Este espacio no está disponible para tu perfil." description="Tus herramientas están en tu página de inicio." image="coral" actions={<Link href={homeForRole(profile.role)} className={buttonStyles('primary')}>Ir a mi espacio</Link>} /></section>
  return children
}

export function RequireReporter({ children }: { children: ReactNode }) {
  const profile = useProfile()
  if (!canReport(profile.role)) return <PageHeading eyebrow="Tu espacio en GaleoTrack" title="Este espacio no está disponible para tu perfil." description="El registro está disponible para científicos aprobados, buzos, pescadores y administradores." actions={<Link href={homeForRole(profile.role)} className={buttonStyles('primary')}>Ir a mi espacio</Link>} />
  return children
}
