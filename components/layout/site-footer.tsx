import Link from 'next/link'
import { Brand } from './brand'
import { Icon } from '@/components/icons'

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="page-container">
        <div className="site-footer-main">
          <div className="site-footer-about">
            <Brand />
            <p className="site-footer-description">Proyecto de investigación y ciencia ciudadana para la conservación marina en Puerto Rico.</p>
            <div className="site-footer-founder"><p className="site-footer-founder-label">Fundadora</p><p className="site-footer-founder-name">Alexandra Marrero Zambrana</p></div>
          </div>
          <nav aria-label="Enlaces rápidos del pie de página" className="site-footer-column"><h2>Enlaces rápidos</h2><Link href="/">Inicio <Icon name="chevron-right" /></Link><Link href="/#proyecto">Sobre el proyecto <Icon name="chevron-right" /></Link><Link href="/patrones-de-distribucion">Patrones de distribución <Icon name="chevron-right" /></Link><Link href="/patrones-de-distribucion#guide-title">Guías de identificación <Icon name="chevron-right" /></Link><Link href="/patrones-de-distribucion#references-title">Recursos académicos <Icon name="chevron-right" /></Link><Link href="/#contacto">Contacto <Icon name="chevron-right" /></Link></nav>
          <div className="site-footer-contact" id="contacto">
            <h2>Contacto</h2>
            <a href="tel:+17872452509"><span className="site-footer-contact-icon" aria-hidden="true"><svg className="site-footer-phone-symbol" viewBox="0 0 24 24"><path d="M6.6 2.8 9.4 2c.7-.2 1.4.2 1.6.9l1.1 3.6c.2.6 0 1.2-.5 1.6l-1.8 1.4a14.3 14.3 0 0 0 4.7 4.7l1.4-1.8c.4-.5 1-.7 1.6-.5l3.6 1.1c.7.2 1.1.9.9 1.6l-.8 2.8c-.2.7-.9 1.2-1.7 1.2C10.8 18.6 5.4 13.2 5.4 6.5c0-.8.5-1.5 1.2-1.7Z" /></svg></span><span><span className="site-footer-contact-label">Teléfono</span>787-245-2509</span></a>
            <a href="mailto:alexandramarrero68@gmail.com"><span className="site-footer-contact-icon" aria-hidden="true"><Icon name="mail" /></span><span><span className="site-footer-contact-label">Correo de la fundadora</span>alexandramarrero68@gmail.com</span></a>
            <a href="mailto:galeotrack.admin@gmail.com"><span className="site-footer-contact-icon" aria-hidden="true"><Icon name="mail" /></span><span><span className="site-footer-contact-label">Administración</span>galeotrack.admin@gmail.com</span></a>
          </div>
        </div>
        <div className="site-footer-bottom"><p>© 2026 Galeo Track. Todos los derechos reservados.</p><p>Conectados por el océano.</p></div>
      </div>
    </footer>
  )
}
