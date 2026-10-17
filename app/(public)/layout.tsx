import type { ReactNode } from 'react'
import { AccessGate, RequireReporter } from '@/components/auth/access-gate'
import { WorkspaceHeader } from '@/components/layout/workspace-header'
import { SiteFooter } from '@/components/layout/site-footer'

export default function PublicLayout({ children }: { children: ReactNode }) {
  return <AccessGate><div className="flex min-h-svh flex-col"><WorkspaceHeader /><main id="main-content" tabIndex={-1} className="flex-1 py-10 sm:py-12"><RequireReporter>{children}</RequireReporter></main><SiteFooter /></div></AccessGate>
}
