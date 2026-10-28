'use client'

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { hasUpdateGuard } from '@/lib/pwa/update-safety'
import type { InstallPromptEvent, InstallState } from '@/lib/pwa/platform'
import { Button } from '@/components/ui/button'

type PwaContextValue = { state: InstallState; install: () => Promise<void>; message: string }
const PwaContext = createContext<PwaContextValue | null>(null)

export function usePwa() {
  const context = useContext(PwaContext)
  if (!context) throw new Error('La instalación requiere PwaProvider.')
  return context
}

function standalone() {
  return window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: fullscreen)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
}

function unsafeToReload() {
  // The update button's own loading state is not an application mutation.
  const busy = [...document.querySelectorAll('[aria-busy="true"]')].some((element) => !element.closest('[data-pwa-status]'))
  return hasUpdateGuard() || busy ||
    /^\/(?:auth(?:\/|$)|login$|register$|update-password$)/.test(window.location.pathname)
}

export function PwaProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<InstallState>('checking')
  const [message, setMessage] = useState('')
  const [offline, setOffline] = useState(false)
  const [update, setUpdate] = useState<ServiceWorkerRegistration | null>(null)
  const [postponed, setPostponed] = useState(false)
  const [updating, setUpdating] = useState(false)
  const [updateMessage, setUpdateMessage] = useState('')
  const prompt = useRef<InstallPromptEvent | null>(null)
  const prompting = useRef(false)
  const requestedReload = useRef(false)
  const updateTimeout = useRef<number | null>(null)

  useEffect(() => {
    const mode = window.matchMedia('(display-mode: standalone)')
    const syncMode = () => setState(standalone() ? 'installed' : window.isSecureContext ? prompt.current ? 'available' : 'manual' : 'unsupported')
    syncMode()
    const beforeInstall = (event: Event) => {
      event.preventDefault()
      prompt.current = event as InstallPromptEvent
      if (!standalone()) setState('available')
    }
    const installed = () => { prompt.current = null; setState('installed'); setMessage('El navegador confirmó la instalación de GaleoTrack.') }
    window.addEventListener('beforeinstallprompt', beforeInstall)
    window.addEventListener('appinstalled', installed)
    mode.addEventListener('change', syncMode)
    return () => {
      window.removeEventListener('beforeinstallprompt', beforeInstall)
      window.removeEventListener('appinstalled', installed)
      mode.removeEventListener('change', syncMode)
    }
  }, [])

  useEffect(() => {
    const sync = () => setOffline(!navigator.onLine)
    sync()
    window.addEventListener('online', sync)
    window.addEventListener('offline', sync)
    return () => { window.removeEventListener('online', sync); window.removeEventListener('offline', sync) }
  }, [])

  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !window.isSecureContext || !('serviceWorker' in navigator)) return
    let disposed = false
    let registration: ServiceWorkerRegistration | undefined
    let lastCheck = 0
    const watched = new Map<ServiceWorker, () => void>()
    const checkWaiting = () => {
      if (registration?.waiting && navigator.serviceWorker.controller && !disposed) setUpdate(registration)
    }
    const watchInstalling = () => {
      const worker = registration?.installing
      if (!worker || watched.has(worker)) return
      const changed = () => { if (worker.state === 'installed') checkWaiting() }
      worker.addEventListener('statechange', changed)
      watched.set(worker, changed)
    }
    const check = () => {
      if (!registration || document.visibilityState !== 'visible' || !navigator.onLine || Date.now() - lastCheck < 60 * 60 * 1000) return
      lastCheck = Date.now()
      void registration.update().catch(() => { /* Offline or a protected preview must not break the application. */ })
    }
    const changedController = () => {
      if (!requestedReload.current) return
      if (updateTimeout.current !== null) window.clearTimeout(updateTimeout.current)
      requestedReload.current = false
      if (unsafeToReload()) {
        setUpdating(false)
        setUpdateMessage('La actualización está lista. Guarda tu trabajo y recarga cuando termines.')
        return
      }
      window.location.reload()
    }
    navigator.serviceWorker.addEventListener('controllerchange', changedController)
    void navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' }).then((value) => {
      if (disposed) return
      registration = value
      registration.addEventListener('updatefound', watchInstalling)
      watchInstalling(); checkWaiting(); check()
    }).catch(() => {
      // Installation may still be supported without offline capabilities.
      if (!disposed) setMessage('El modo sin conexión no pudo prepararse. Puedes seguir usando GaleoTrack con Internet.')
    })
    window.addEventListener('online', check)
    document.addEventListener('visibilitychange', check)
    const interval = window.setInterval(check, 60 * 60 * 1000)
    return () => {
      disposed = true
      window.clearInterval(interval)
      if (updateTimeout.current !== null) window.clearTimeout(updateTimeout.current)
      registration?.removeEventListener('updatefound', watchInstalling)
      watched.forEach((listener, worker) => worker.removeEventListener('statechange', listener))
      navigator.serviceWorker.removeEventListener('controllerchange', changedController)
      window.removeEventListener('online', check)
      document.removeEventListener('visibilitychange', check)
    }
  }, [])

  async function install() {
    const event = prompt.current
    if (!event || prompting.current) return
    prompting.current = true
    prompt.current = null // A deferred prompt can only be consumed once.
    setState('prompting'); setMessage('')
    try {
      const result = await event.prompt()
      const choice = result ?? await event.userChoice
      if (standalone()) setState('installed')
      else if (choice.outcome === 'accepted') {
        // Accepted is not proof that OS installation completed.
        setState((current) => current === 'installed' ? current : 'accepted')
        setMessage('Solicitud aceptada. El navegador está preparando la aplicación.')
      } else {
        setState((current) => current === 'installed' ? current : 'manual')
        setMessage('Instalación pospuesta. Puedes volver a usar las opciones del navegador cuando quieras.')
      }
    } catch {
      setState((current) => current === 'installed' ? current : 'manual')
      setMessage('No se pudo abrir la instalación. Usa las instrucciones del navegador para intentarlo de nuevo.')
    } finally { prompting.current = false }
  }

  function activateUpdate() {
    setUpdateMessage('')
    if (unsafeToReload()) {
      setUpdateMessage('Guarda o cancela los cambios y espera a que terminen las operaciones antes de actualizar.')
      return
    }
    if (!navigator.onLine) { setUpdateMessage('Necesitas conexión para cargar la nueva versión.'); return }
    const worker = update?.waiting
    if (!worker) { setUpdate(null); setUpdateMessage('La versión ya está activa. Puedes recargar después de guardar tu trabajo.'); return }
    setUpdating(true)
    const channel = new MessageChannel()
    updateTimeout.current = window.setTimeout(() => {
      requestedReload.current = false; setUpdating(false)
      setUpdateMessage('No se pudo activar la actualización. Vuelve a intentarlo cuando tengas conexión.')
      channel.port1.close()
    }, 10000)
    channel.port1.onmessage = (event: MessageEvent<{ status: string }>) => {
      channel.port1.close()
      if (event.data.status === 'other-windows') {
        if (updateTimeout.current !== null) window.clearTimeout(updateTimeout.current)
        requestedReload.current = false; setUpdating(false)
        setUpdateMessage('Cierra las otras pestañas o ventanas de GaleoTrack y vuelve a pulsar Actualizar. No se recargarán por sorpresa.')
      }
    }
    requestedReload.current = true
    try {
      worker.postMessage({ type: 'GALEOTRACK_ACTIVATE' }, [channel.port2])
    } catch {
      if (updateTimeout.current !== null) window.clearTimeout(updateTimeout.current)
      requestedReload.current = false; setUpdating(false)
      channel.port1.close()
      setUpdateMessage('La actualización cambió de estado. Guarda tu trabajo y vuelve a intentarlo.')
    }
  }

  return <PwaContext value={{ state, install, message }}>
    <div className="pwa-notices" data-pwa-status aria-label="Estado de la aplicación">
      {state === 'installed' && message && <section className="pwa-notice" role="status"><p>{message}</p><Button variant="ghost" onClick={() => setMessage('')}>Cerrar aviso</Button></section>}
      {offline && <section className="pwa-notice" role="status"><strong>Sin conexión a Internet</strong><p>Conserva esta ventana abierta. Los mapas y el envío de datos necesitan conexión; no se enviará nada automáticamente al reconectar.</p></section>}
      {update && !postponed && <section className="pwa-notice" aria-labelledby="pwa-update-title">
        <strong id="pwa-update-title">Nueva versión disponible</strong>
        <p>Actualiza cuando hayas guardado tu trabajo. Esta ventana se recargará.</p>
        <div className="pwa-notice-actions"><Button variant="primary" loading={updating} onClick={activateUpdate}>Actualizar</Button><Button variant="ghost" disabled={updating} onClick={() => { setPostponed(true); setUpdateMessage('') }}>Más tarde</Button></div>
      </section>}
      {updateMessage && <p className="pwa-notice" role="status">{updateMessage}</p>}
    </div>
    {children}
  </PwaContext>
}
