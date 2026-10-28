'use client'

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { AlertDialog } from '@base-ui/react/alert-dialog'
import { CircleHelp, Trash2 } from 'lucide-react'
import { Button } from './button'

type Confirmation = { title: string; description: string; action: string; danger?: boolean }
const ConfirmationContext = createContext<((options: Confirmation) => Promise<boolean>) | null>(null)

export function useConfirmation() {
  const confirm = useContext(ConfirmationContext)
  if (!confirm) throw new Error('La confirmación requiere ConfirmationProvider.')
  return confirm
}

export function ConfirmationProvider({ children }: { children: ReactNode }) {
  const [content, setContent] = useState<Confirmation | null>(null)
  const [open, setOpen] = useState(false)
  const pending = useRef<((accepted: boolean) => void) | null>(null)
  const cancel = useRef<HTMLButtonElement>(null)
  const origin = useRef<HTMLElement | null>(null)
  const confirm = useCallback((options: Confirmation) => {
    // No se pueden abrir dos decisiones ni ejecutar la misma acción dos veces.
    if (pending.current) return Promise.resolve(false)
    origin.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    setContent(options)
    setOpen(true)
    return new Promise<boolean>((resolve) => { pending.current = resolve })
  }, [])
  const finish = useCallback((accepted: boolean) => {
    const resolve = pending.current
    pending.current = null
    setOpen(false)
    resolve?.(accepted)
  }, [])
  useEffect(() => () => { pending.current?.(false); pending.current = null }, [])
  const Symbol = content?.danger ? Trash2 : CircleHelp

  return <ConfirmationContext value={confirm}>
    {children}
    <AlertDialog.Root open={open} onOpenChange={(next) => { if (!next) finish(false) }}>
      <AlertDialog.Portal>
        <AlertDialog.Backdrop className="confirmation-backdrop" />
        <AlertDialog.Viewport className="confirmation-viewport">
          <AlertDialog.Popup className="confirmation-popup" initialFocus={cancel} finalFocus={() => origin.current?.isConnected && !origin.current.matches(':disabled') ? origin.current : document.querySelector<HTMLElement>('#main-content')}>
            <span className={`confirmation-symbol${content?.danger ? ' confirmation-symbol--danger' : ''}`}><Symbol size={24} strokeWidth={1.75} aria-hidden="true" /></span>
            <AlertDialog.Title className="confirmation-title">{content?.title}</AlertDialog.Title>
            <AlertDialog.Description className="confirmation-description">{content?.description}</AlertDialog.Description>
            <div className="confirmation-actions">
              <Button ref={cancel} variant="secondary" onClick={() => finish(false)}>Cancelar</Button>
              <Button variant={content?.danger ? 'danger' : 'primary'} onClick={() => finish(true)}>{content?.action}</Button>
            </div>
          </AlertDialog.Popup>
        </AlertDialog.Viewport>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  </ConfirmationContext>
}
