'use client'

import { useProfile } from '@/components/auth/access-gate'
import { homeForRole } from '@/lib/access'
import { Brand } from './brand'
import { AccountMenu } from './account-menu'

export function WorkspaceHeader() {
  const profile = useProfile()
  return <>
    <a href="#main-content" className="skip-link">Ir al contenido principal</a>
    <header className="site-header workspace-header">
      <div className="page-container site-header-inner">
        <Brand href={homeForRole(profile.role)} />
        <AccountMenu />
      </div>
    </header>
  </>
}
