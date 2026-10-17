'use client'

import Link from 'next/link'
import type { ReactNode } from 'react'

export function HomeLink({ children, className, 'aria-label': ariaLabel }: { children: ReactNode; className?: string; 'aria-label'?: string }) {
  return <Link href="/#inicio" className={className} aria-label={ariaLabel} onClick={(event) => {
    if (window.location.pathname === '/' && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey && event.button === 0) {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
    }
  }}>{children}</Link>
}
