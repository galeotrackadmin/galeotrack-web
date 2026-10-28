'use client'

import { useState, type ReactElement, type ReactNode } from 'react'
import { Popover } from '@base-ui/react/popover'
import { Tooltip } from '@base-ui/react/tooltip'

export function ActionTooltip({ label, children }: { label: string; children: ReactElement }) {
  return <Tooltip.Root><Tooltip.Trigger render={children} delay={200} closeDelay={100} /><Tooltip.Portal><Tooltip.Positioner side="top" sideOffset={8} collisionPadding={16} className="sighting-hint-positioner"><Tooltip.Popup role="tooltip" className="sighting-hint sighting-tooltip">{label}</Tooltip.Popup></Tooltip.Positioner></Tooltip.Portal></Tooltip.Root>
}

// Las explicaciones sin acción también se pueden abrir y cerrar por toque.
export function IconPopover({ label, description, className = '', children }: { label: string; description: string; className?: string; children: ReactNode }) {
  const [open, setOpen] = useState(false)
  return <Popover.Root open={open} onOpenChange={setOpen}>
    <Popover.Trigger className={`sighting-icon-button ${className}`} aria-label={label} openOnHover delay={200} closeDelay={100} onFocus={(event) => { if (event.currentTarget.matches(':focus-visible')) setOpen(true) }}>{children}</Popover.Trigger>
    <Popover.Portal><Popover.Positioner side="top" sideOffset={8} collisionPadding={16} className="sighting-hint-positioner"><Popover.Popup className="sighting-hint" initialFocus={false} finalFocus={false}><Popover.Title className="sighting-hint-title">{label}</Popover.Title><Popover.Description className="sighting-hint-description">{description}</Popover.Description></Popover.Popup></Popover.Positioner></Popover.Portal>
  </Popover.Root>
}
