'use client'

import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import { Icon } from '@/components/icons'

export function SiteHeaderShell({ brand, navigation, sections }: { brand: ReactNode; navigation: ReactNode; sections?: ReactNode }) {
  const pathname = usePathname()
  const [openPath, setOpenPath] = useState<string | null>(null)
  const open = openPath === pathname
  const header = useRef<HTMLElement>(null)
  const toggle = useRef<HTMLButtonElement>(null)
  const panelId = useId()

  useEffect(() => {
    const desktop = window.matchMedia('(min-width: 1200px)')
    const closeOnDesktop = () => { if (desktop.matches) setOpenPath(null) }
    desktop.addEventListener('change', closeOnDesktop)
    return () => desktop.removeEventListener('change', closeOnDesktop)
  }, [])

  useEffect(() => {
    if (!open) return
    const dismiss = (event: PointerEvent | FocusEvent) => {
      if (event.target instanceof Node && !header.current?.contains(event.target)) setOpenPath(null)
    }
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpenPath(null)
        toggle.current?.focus()
      }
    }
    document.addEventListener('pointerdown', dismiss)
    document.addEventListener('focusin', dismiss)
    document.addEventListener('keydown', escape)
    return () => {
      document.removeEventListener('pointerdown', dismiss)
      document.removeEventListener('focusin', dismiss)
      document.removeEventListener('keydown', escape)
    }
  }, [open])

  return <header ref={header} className={`site-header${sections ? ' site-header--extended' : ''}`}>
    <div className="page-container site-header-inner">
      {brand}
      <button ref={toggle} type="button" className="site-menu-toggle" aria-label={open ? 'Cerrar menú' : 'Abrir menú'} aria-expanded={open} aria-controls={panelId} onClick={() => setOpenPath(open ? null : pathname)}>
        <Icon name={open ? 'close' : 'menu'} /><span>Menú</span>
      </button>
      <div id={panelId} className="site-header-panel" data-open={open} onClick={(event) => {
        if (event.target instanceof Element && !event.target.closest('.account-menu') && event.target.closest('a, button')) setOpenPath(null)
      }}>
        {navigation}
        {sections && <div className="site-header-sections">{sections}</div>}
      </div>
    </div>
  </header>
}
