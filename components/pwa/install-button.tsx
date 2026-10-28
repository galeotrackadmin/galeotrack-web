'use client'

import dynamic from 'next/dynamic'
import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { IconDownload, IconX } from '@tabler/icons-react'
import { usePwa } from './pwa-provider'

const InstallInstructions = dynamic(() => import('./install-instructions'), { ssr: false })

const DISMISS_KEY = 'galeotrack:pwa-install-dismissed'
let dismissedInMemory = false

function subscribeDismissal(notify: () => void) {
  window.addEventListener(DISMISS_KEY, notify)
  window.addEventListener('storage', notify)
  return () => { window.removeEventListener(DISMISS_KEY, notify); window.removeEventListener('storage', notify) }
}

function dismissalSnapshot() {
  let dismissed = dismissedInMemory
  try { dismissed ||= sessionStorage.getItem(DISMISS_KEY) === '1' } catch { /* Private mode may restrict storage. */ }
  return dismissed ? 'dismissed' : 'visible'
}

export function InstallButton() {
  const { state, install, message } = usePwa()
  const [open, setOpen] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [intro, setIntro] = useState<'pending' | 'expanded' | 'complete'>('pending')
  const [hovered, setHovered] = useState(false)
  const [focused, setFocused] = useState(false)
  const [touchExpanded, setTouchExpanded] = useState(false)
  const visibility = useSyncExternalStore(subscribeDismissal, dismissalSnapshot, () => 'pending')
  const trigger = useRef<HTMLButtonElement>(null)
  const dock = useRef<HTMLElement>(null)
  const touchInput = useRef(false)
  const introTimers = useRef<number[]>([])
  const eligible = visibility === 'visible' && state !== 'checking' && state !== 'installed' && state !== 'unsupported'
  const expanded = intro === 'expanded' || hovered || focused || touchExpanded || open || state === 'prompting' || Boolean(message)
  const label = state === 'prompting' ? 'Abriendo instalación…' : state === 'accepted' ? 'Instalación solicitada' : 'Instalar aplicación'

  useEffect(() => {
    if (!eligible) return
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
    if (reducedMotion.matches) return
    // One explanation per page load; hover/focus can interrupt either transition.
    const reveal = window.setTimeout(() => setIntro('expanded'), 600)
    const collapse = window.setTimeout(() => setIntro('complete'), 3200)
    introTimers.current = [reveal, collapse]
    const stop = () => {
      if (!reducedMotion.matches) return
      window.clearTimeout(reveal); window.clearTimeout(collapse)
      setIntro('complete')
    }
    reducedMotion.addEventListener('change', stop)
    return () => {
      window.clearTimeout(reveal); window.clearTimeout(collapse)
      reducedMotion.removeEventListener('change', stop)
    }
  }, [eligible])

  useEffect(() => {
    if (!touchExpanded) return
    const collapseOutside = (event: PointerEvent) => {
      if (event.target instanceof Node && !dock.current?.contains(event.target)) setTouchExpanded(false)
    }
    document.addEventListener('pointerdown', collapseOutside)
    return () => document.removeEventListener('pointerdown', collapseOutside)
  }, [touchExpanded])

  function finishIntro() {
    introTimers.current.forEach((timer) => window.clearTimeout(timer))
    setIntro('complete')
  }

  function dismiss() {
    dismissedInMemory = true
    try { sessionStorage.setItem(DISMISS_KEY, '1') } catch { /* In-memory dismissal still works. */ }
    window.dispatchEvent(new Event(DISMISS_KEY))
    document.querySelector<HTMLElement>('#main-content')?.focus({ preventScroll: true })
  }

  if (!eligible) return null

  return <>
    <div className="pwa-install-clearance" aria-hidden="true" />
    <aside ref={dock} className="pwa-install" aria-label="Instalar GaleoTrack" data-expanded={expanded} data-intro={intro}>
      <div className="pwa-install-shell" onPointerEnter={(event) => {
        if (event.pointerType === 'mouse' && window.matchMedia('(hover: hover) and (pointer: fine)').matches) { finishIntro(); setHovered(true) }
      }} onPointerLeave={() => setHovered(false)} onFocusCapture={(event) => {
        if (event.target instanceof Element && event.target.matches(':focus-visible')) { finishIntro(); setFocused(true) }
      }} onBlurCapture={(event) => {
        if (!(event.relatedTarget instanceof Node) || !event.currentTarget.contains(event.relatedTarget)) setFocused(false)
      }}>
        <button ref={trigger} type="button" className="pwa-install-button" aria-label={label} disabled={state === 'prompting'} onPointerDown={(event) => {
          touchInput.current = event.pointerType === 'touch' && !expanded
          finishIntro()
        }} onClick={(event) => {
          if (touchInput.current && event.detail !== 0) { touchInput.current = false; setTouchExpanded(true); return }
          if (state === 'available') void install()
          else { setLoaded(true); setOpen(true) }
        }}>
          <span className="pwa-install-icon" aria-hidden="true"><IconDownload size={24} stroke={1.8} /></span>
          <span className="pwa-install-label" aria-hidden="true">{state === 'prompting' ? 'Abriendo…' : state === 'accepted' ? 'Solicitada' : 'Instalar'}</span>
        </button>
        <button type="button" className="pwa-install-dismiss" aria-label="Ocultar aviso de instalación" aria-hidden={!expanded} tabIndex={expanded ? 0 : -1} disabled={state === 'prompting'} onClick={dismiss}><IconX size={20} stroke={1.8} aria-hidden="true" /></button>
      </div>
      {message && <span className="pwa-install-message" role="status">{message}</span>}
    </aside>
    {loaded && <InstallInstructions open={open} onOpenChange={setOpen} returnFocus={trigger} />}
  </>
}
