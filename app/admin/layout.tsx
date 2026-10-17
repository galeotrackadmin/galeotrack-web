import type { ReactNode } from 'react'
import { AccessGate } from '@/components/auth/access-gate'
import { SiteFooter } from '@/components/layout/site-footer'
import '@/components/layout/workspace.css'

export default function AdminLayout({ children }: { children: ReactNode }) {
  return <AccessGate><div className="workspace-page flex min-h-svh flex-col">{children}<SiteFooter /></div></AccessGate>
}
