import type { ReactNode } from 'react'
import Image from 'next/image'
import { Brand } from './brand'
import './auth.css'

export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <main className="auth-layout">
      <a className="skip-link" href="#main-content">Ir al contenido principal</a>
      <aside className="auth-story" aria-label="GaleoTrack, conservación marina">
        <Image src="/images/landing/ocean-shark.webp" alt="" fill sizes="(max-width: 959px) 100vw, 52vw" loading="eager" fetchPriority="high" className="auth-story-photo" />
        <Brand />

        <div className="auth-story-content">
          <span className="auth-eyebrow">PUERTO RICO · CONSERVACIÓN MARINA</span>
          <h2>El océano <br />nos conecta.<br /><em>Tu historia empieza aquí.</em></h2>
          <p>Aprende sobre especies, comparte conocimiento científico y contribuye con tus avistamientos. Tres formas de conocer y proteger la vida marina.</p>

        </div>

        <div className="auth-story-footer"><span>Datos con propósito.</span><span>Impacto que trasciende.</span></div>
      </aside>

      <section className="auth-panel" aria-label="Acceso al panel">
        <div id="main-content" className="auth-content" tabIndex={-1}>
          {children}
        </div>
        <footer className="auth-panel-footer">© 2026 Galeo Track. Todos los derechos reservados.</footer>
      </section>
    </main>
  )
}
