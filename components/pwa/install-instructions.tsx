'use client'

import { Dialog } from '@base-ui/react/dialog'
import { Share, PlusSquare, MonitorDown, X } from 'lucide-react'
import { installPlatform } from '@/lib/pwa/platform'
import { Button } from '@/components/ui/button'

export default function InstallInstructions({ open, onOpenChange, returnFocus }: { open: boolean; onOpenChange: (open: boolean) => void; returnFocus: React.RefObject<HTMLButtonElement | null> }) {
  const platform = typeof navigator === 'undefined' ? 'other' : installPlatform(navigator.userAgent, navigator.platform, navigator.maxTouchPoints)
  return <Dialog.Root open={open} onOpenChange={onOpenChange}>
    <Dialog.Portal>
      <Dialog.Backdrop className="confirmation-backdrop" />
      <Dialog.Viewport className="confirmation-viewport">
        <Dialog.Popup className="confirmation-popup pwa-instructions" finalFocus={returnFocus}>
          <div className="pwa-dialog-head"><MonitorDown size={28} aria-hidden="true" /><Dialog.Close className="pwa-close" aria-label="Cerrar instrucciones"><X size={22} aria-hidden="true" /></Dialog.Close></div>
          <Dialog.Title className="confirmation-title">GaleoTrack, a un toque</Dialog.Title>
          <Dialog.Description className="confirmation-description">Abre la aplicación desde tu dispositivo, sin buscarla en una tienda. Los mapas y los reportes necesitan Internet.</Dialog.Description>
          {platform === 'ios' ? <ol className="pwa-steps">
            <li><Share size={22} aria-hidden="true" /><span>Abre el menú <strong>Compartir</strong> de tu navegador.</span></li>
            <li><PlusSquare size={22} aria-hidden="true" /><span>Selecciona <strong>Añadir a pantalla de inicio</strong>. Si no aparece, abre este sitio en Safari.</span></li>
            <li><span>Si aparece <strong>Abrir como app web</strong>, actívalo y pulsa <strong>Añadir</strong>.</span></li>
          </ol> : platform === 'mac-safari' ? <ol className="pwa-steps">
            <li><Share size={22} aria-hidden="true" /><span>En Safari, abre <strong>Compartir</strong> o el menú <strong>Archivo</strong>.</span></li>
            <li><PlusSquare size={22} aria-hidden="true" /><span>Selecciona <strong>Añadir al Dock</strong> y confirma con <strong>Añadir</strong>.</span></li>
          </ol> : <ol className="pwa-steps">
            <li><MonitorDown size={22} aria-hidden="true" /><span>Busca el icono de instalación en la barra de direcciones o abre el menú del navegador.</span></li>
            <li><PlusSquare size={22} aria-hidden="true" /><span>{platform === 'edge' ? <>Entra en <strong>Aplicaciones → Instalar este sitio como una aplicación</strong>.</> : platform === 'android' ? <>Busca <strong>Instalar aplicación</strong> o <strong>Añadir a pantalla de inicio</strong>.</> : <>Busca <strong>Instalar GaleoTrack</strong>, <strong>Instalar página como aplicación</strong> o la opción equivalente.</>}</span></li>
            <li><span>Confirma la instalación. Si no aparece esa opción, puedes seguir usando la web o abrirla en un navegador compatible.</span></li>
          </ol>}
          <p className="pwa-instructions-note">{platform === 'mac-safari' ? 'Añadir al Dock requiere macOS Sonoma o posterior. ' : ''}Las opciones dependen del navegador y su versión. Algunos crean un acceso directo. Si ya instalaste GaleoTrack, ábrelo desde su icono; no siempre podemos detectarlo desde esta pestaña.</p>
          <Button className="pwa-done" onClick={() => onOpenChange(false)}>Entendido</Button>
        </Dialog.Popup>
      </Dialog.Viewport>
    </Dialog.Portal>
  </Dialog.Root>
}
