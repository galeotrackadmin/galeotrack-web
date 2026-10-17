import type { ReactNode } from 'react'
import Link from 'next/link'
import { Brand } from './brand'
import { Icon } from '@/components/icons'
import { SiteHeaderShell } from './site-header-shell'
import { HomeLink } from './home-link'
import { PublicSessionLinks } from './public-session-links'

export function SiteHeader({ home = false, active, actions, accountLabel, children }: { home?: boolean; active?: 'report' | 'admin' | 'distribution'; actions?: ReactNode; accountLabel?: string; children?: ReactNode }) {
  const sections = children ?? ((active === 'report' || active === 'admin') && <nav aria-label="Herramientas de revisión" className="site-navigation">
    <Link href="/report" aria-current={active === 'report' ? 'page' : undefined} className="button site-nav-link"><Icon name="pin" />Reportar avistamiento</Link>
    <Link href={active === 'admin' ? '/admin' : '/login'} aria-current={active === 'admin' ? 'page' : undefined} className="button site-nav-link"><Icon name="shield" />{active === 'admin' ? 'Panel de revisión' : 'Acceso al panel'}</Link>
  </nav>)
  return (
    <>
      <a href="#main-content" className="skip-link">Ir al contenido principal</a>
      <SiteHeaderShell brand={<Brand />} sections={sections} navigation={
          <div className="site-header-navigation">
            <nav aria-label="Navegación principal" className="site-navigation">
              <HomeLink className={`site-nav-link${home ? ' site-nav-link--highlight' : ''}`}>Inicio</HomeLink>
              <a href={home ? '#proyecto' : '/#proyecto'} className="site-nav-link">Sobre Nosotros</a>
              <Link href="/patrones-de-distribucion" aria-current={active === 'distribution' ? 'page' : undefined} className="site-nav-link">Patrones de distribución</Link>
              {!actions && <PublicSessionLinks />}
            </nav>
            {actions && <div className="site-header-account">{accountLabel && <span>{accountLabel}</span>}{actions}</div>}
          </div>
      } />
    </>
  )
}
