import type { ReactNode } from 'react'
import { AccessGate } from '@/components/auth/access-gate'
import { WorkspaceHeader } from '@/components/layout/workspace-header'
import { SiteFooter } from '@/components/layout/site-footer'
import '@/components/layout/workspace.css'

export default function WorkspaceLayout({ children }: { children: ReactNode }) {
  return <AccessGate><div className="workspace-page flex min-h-svh flex-col"><WorkspaceHeader /><main id="main-content" tabIndex={-1} className="page-container workspace-main flex-1">{children}</main><SiteFooter /></div></AccessGate>
}
