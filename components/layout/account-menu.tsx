'use client'

import { useEffect, useId, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useProfile } from '@/components/auth/access-gate'
import { homeForRole, ROLE_LABELS } from '@/lib/access'
import { supabase } from '@/lib/supabase-client'

function initials(name: string, email: string) {
  const source = name.trim() || email.split('@')[0]
  const parts = source.split(/[\s._-]+/).filter(Boolean)
  return (parts.length > 1 ? `${parts[0][0]}${parts[parts.length - 1][0]}` : source.slice(0, 2)).toLocaleUpperCase('es')
}

export function AccountMenu() {
  const profile = useProfile()
  const router = useRouter()
  const container = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const panel = useRef<HTMLDivElement>(null)
  const panelId = useId()
  const [busy, setBusy] = useState(false)
  const [open, setOpen] = useState(false)
  const [error, setError] = useState('')
  const name = profile.fullName.trim() || 'Completa tu perfil'

  useEffect(() => {
    const close = (event: PointerEvent | FocusEvent) => { if (event.target instanceof Node && !container.current?.contains(event.target)) setOpen(false) }
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && open) {
        setOpen(false)
        trigger.current?.focus()
      }
    }
    document.addEventListener('pointerdown', close)
    document.addEventListener('focusin', close)
    document.addEventListener('keydown', escape)
    return () => { document.removeEventListener('pointerdown', close); document.removeEventListener('focusin', close); document.removeEventListener('keydown', escape) }
  }, [open])

  useEffect(() => {
    if (!open) return
    const fit = () => {
      const element = panel.current
      if (!element) return
      const viewport = window.visualViewport
      const bottom = viewport ? viewport.offsetTop + viewport.height : window.innerHeight
      element.style.setProperty('--account-menu-max-height', `${Math.max(48, bottom - element.getBoundingClientRect().top - 16)}px`)
    }
    fit()
    window.addEventListener('resize', fit)
    window.visualViewport?.addEventListener('resize', fit)
    window.visualViewport?.addEventListener('scroll', fit)
    return () => {
      window.removeEventListener('resize', fit)
      window.visualViewport?.removeEventListener('resize', fit)
      window.visualViewport?.removeEventListener('scroll', fit)
    }
  }, [open])

  async function logout() {
    setBusy(true); setError('')
    const { error } = await supabase.auth.signOut({ scope: 'local' })
    if (error) { setError('No se pudo cerrar sesión. Inténtalo de nuevo.'); setBusy(false); return }
    router.replace('/login')
  }

  return <div ref={container} className="account-menu" data-open={open}>
    <button ref={trigger} type="button" className="account-menu-trigger" aria-label={`Cuenta de ${name}, ${ROLE_LABELS[profile.role]}`} aria-expanded={open} aria-controls={panelId} onClick={() => setOpen((value) => !value)}>
      <span className="account-avatar" aria-hidden="true">{initials(profile.fullName, profile.email)}</span>
    </button>
    <span className="account-role">{ROLE_LABELS[profile.role]}</span>
    <div ref={panel} id={panelId} className="account-menu-panel" hidden={!open}>
      <div className="account-menu-identity">
        <strong>{profile.fullName || 'Nombre pendiente'}</strong>
        <span>{profile.email}</span>
        <span>{ROLE_LABELS[profile.role]}</span>
        {profile.role === 'pending_scientist' && <span>Solicitud científica: {profile.scienceStatus === 'rejected' ? 'rechazada' : 'pendiente'}</span>}
      </div>
      {error && <p className="account-menu-error" role="alert">{error}</p>}
      <Link href="/cuenta" className="account-menu-item" onClick={() => setOpen(false)}>Mi cuenta</Link>
      <Link href={homeForRole(profile.role)} className="account-menu-item" onClick={() => setOpen(false)}>Mi espacio</Link>
      <button type="button" className="account-menu-item account-menu-logout" disabled={busy} onClick={logout}>{busy ? 'Cerrando sesión…' : 'Cerrar sesión'}</button>
    </div>
  </div>
}
