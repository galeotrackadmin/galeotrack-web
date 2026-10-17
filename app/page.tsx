import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { SiteHeader } from '@/components/layout/site-header'
import { SiteFooter } from '@/components/layout/site-footer'
import { Icon } from '@/components/icons'
import { PublicTracker } from '@/components/tracker/public-tracker'
import './landing.css'

export const metadata: Metadata = {
  title: 'GaleoTrack · Ciencia y comunidad por los tiburones de Puerto Rico',
  description: 'Iniciativa de ciencia ciudadana e investigación marina para recopilar, mapear y divulgar datos sobre las poblaciones de tiburones en Puerto Rico.',
}

const collaborators = [
  {
    title: 'Estudiante', category: 'EDUCACIÓN', number: '01',
    image: 'student', alt: 'Persona tomando apuntes junto a un ordenador portátil',
    description: 'Encuentra un espacio para aprender sobre la biodiversidad marina local, participar en la recolección de datos de campo y desarrollar destrezas en investigación y conservación.',
    features: ['Conoce las especies marinas', 'Explora los avistamientos', 'Aprende de la comunidad científica'],
    note: 'Un espacio para descubrir y aprender a tu ritmo.',
    href: '/estudiante', action: 'Acceso estudiante',
  },
  {
    title: 'Científico', category: 'CIENCIA', number: '02',
    image: 'scientist', alt: 'Investigadora trabajando con equipos de laboratorio',
    description: 'Aporta hallazgos a la base de datos local y consulta información validada sobre la presencia y distribución de tiburones en la isla.',
    features: ['Consulta datos de avistamientos', 'Redacta y publica investigaciones', 'Comparte resultados y referencias'],
    note: 'El acceso científico requiere validación del administrador.',
    href: '/cientifico', action: 'Acceso científico',
  },
  {
    title: 'Pescador Buzo', category: 'COMUNIDAD', number: '03',
    image: 'diver', alt: 'Buzo observando un banco de peces junto a un arrecife',
    description: 'Tu experiencia y conocimiento del mar ayudan a monitorear las especies clave de Puerto Rico.',
    features: ['Pescadores: reportan avistamientos e interacciones en alta mar y la costa', 'Buzos: aportan fotos y videos para identificar y evaluar ejemplares', 'Registra encuentros y consulta tus reportes'],
    note: 'Comparte tus observaciones desde tu cuenta.',
    href: '/comunidad', action: 'Acceso buzo / pescador',
  },
]

const steps = [
  { number: '01', title: 'Reportar avistamientos', description: 'Registra encuentros con tiburones mediante fotos, videos y datos de ubicación.', image: 'Expedition', alt: 'Expedición marina para documentar avistamientos' },
  { number: '02', title: 'Visualizar información geoespacial', description: 'Consulta el mapa interactivo con la distribución de especies reportadas en la isla.', image: 'geomapa', alt: 'Mapa geográfico para explorar registros de especies marinas' },
  { number: '03', title: 'Aprender e identificar', description: 'Accede a guías taxonómicas, información morfométrica y recursos sobre la conservación de elasmobranquios en el Caribe.', image: 'taxonomia', alt: 'Guía de taxonomía para aprender a identificar especies marinas' },
]

const objectives = [
  { number: '01', title: 'Estandarizar la recolección de datos', description: 'Diseñar una herramienta accesible para registrar avistamientos, variables espaciotemporales, datos de salud y evidencia multimedia.' },
  { number: '02', title: 'Mapear la distribución', description: 'Consolidar reportes comunitarios validados y registros mundiales de biodiversidad (OBIS) para identificar zonas de avistamiento y vacíos de información.' },
  { number: '03', title: 'Fomentar educación y conservación', description: 'Ofrecer guías de identificación y recursos que promuevan la alfabetización oceánica y la protección de los elasmobranquios del Caribe.' },
  { number: '04', title: 'Facilitar el acceso científico', description: 'Crear un canal bidireccional para aportar, consultar y descargar datos útiles para la evaluación poblacional y las decisiones ambientales.' },
]

export default function Home() {
  return (
    <div id="inicio" className="landing-page">
      <SiteHeader home />

      <main id="main-content" tabIndex={-1}>
        <section className="landing-hero landing-hero--tracker" aria-labelledby="hero-title">
          <div className="landing-hero-media">
            <Image src="/images/landing/ocean-shark.webp" alt="" fill sizes="100vw" loading="eager" fetchPriority="high" className="landing-photo" />
          </div>
          <div className="page-container landing-hero-content">
            <h1 id="hero-title">Conectando la ciencia y la comunidad por los tiburones de Puerto Rico.</h1>
            <p className="landing-hero-description">Una iniciativa de ciencia ciudadana e investigación marina para recopilar, mapear y divulgar datos sobre las poblaciones de tiburones en las aguas costeras del archipiélago.</p>
            <div className="landing-hero-actions">
              <a href="#colaboradores" className="button landing-button landing-button--outline">Cómo colaborar</a>
            </div>
          </div>
        </section>

        <PublicTracker compact />

        <section id="proyecto" className="landing-section page-container" aria-labelledby="project-title">
          <div className="landing-section-intro landing-project-intro">
            <div><h2 id="project-title">¿QUÉ ES GALEOTRACK?</h2></div>
            <div className="landing-project-copy">
              <p><strong>GaleoTrack</strong> es una iniciativa de ciencia ciudadana e investigación marina dedicada a la recopilación, mapeo y divulgación de datos sobre las poblaciones de tiburones en las aguas costeras del archipiélago de Puerto Rico.</p>
              <p>Este proyecto nace de la pasión de una estudiante de bachillerato de Ciencias Marinas por la conservación de los depredadores topes de nuestros ecosistemas oceánicos.</p>
              <p>Surge al identificar una brecha crítica en la ciencia local: en Puerto Rico existe un vacío importante de información accesible y de estudios continuos que permitan evaluar el estado actual, la distribución y la salud de las poblaciones de tiburones.</p>
              <p>GaleoTrack fue creado para transformar la manera en que recolectamos datos marinos, uniendo el esfuerzo de la comunidad con el rigor científico para proteger a estas especies clave.</p>
            </div>
          </div>
          <div className="landing-objectives"><p className="landing-eyebrow">NUESTROS OBJETIVOS</p><div className="landing-objective-grid">{objectives.map((objective) => <article className="landing-objective" key={objective.number}><span>{objective.number}</span><h3>{objective.title}</h3><p>{objective.description}</p></article>)}</div></div>
          <div className="landing-section-intro landing-uses-intro"><div><p className="landing-eyebrow">¿PARA QUÉ PUEDES USARLA?</p><h2>Reporta, explora y aprende.</h2></div><p><strong>GaleoTrack es una plataforma abierta y colaborativa dirigida a todas las personas que interactúan, estudian o sienten interés por el medio marino de Puerto Rico.</strong></p></div>
          <ol className="landing-journey">
            {steps.map((step) => (
              <li key={step.number} className="landing-step">
                <div className="landing-step-marker"><span>{step.number}</span><span className="landing-step-line" aria-hidden="true" /></div>
                <div className="landing-step-card">
                  <div className="landing-step-image"><Image src={`/images/landing/${step.image}.webp`} alt={step.alt} fill sizes="(min-width: 1320px) 400px, (min-width: 1024px) 33vw, (min-width: 600px) 560px, calc(100vw - 40px)" className={step.image === 'taxonomia' ? 'landing-photo landing-photo--taxonomy' : 'landing-photo'} /></div>
                  <div className="landing-step-copy"><h3>{step.title}</h3><p>{step.description}</p></div>
                </div>
              </li>
            ))}
          </ol>
          <p className="landing-data-note">El mapa público muestra avistamientos activos pendientes y verificados, incluidos los registros históricos de OBIS. Cada tarjeta indica la fuente y el estado de revisión.</p>
        </section>

        <section className="landing-mission" aria-labelledby="mission-title">
          <Image src="/images/landing/diver.webp" alt="" fill sizes="100vw" className="landing-photo" />
          <div className="page-container landing-mission-content">
            <p className="landing-eyebrow">¿POR QUÉ ES IMPORTANTE?</p>
            <h2 id="mission-title">Información para proteger especies clave.</h2>
            <p className="landing-mission-description">Históricamente, la información sobre los elasmobranquios de Puerto Rico ha estado dispersa, limitada o fuera del alcance del público y la comunidad académica. GaleoTrack busca centralizar, validar y visibilizar su presencia.</p>
          </div>
        </section>

        <section id="colaboradores" className="landing-section page-container" aria-labelledby="collaborators-title">
          <div className="landing-centered-heading"><p className="landing-eyebrow">ROLES DE LOS USUARIOS</p><h2 id="collaborators-title">Cada experiencia aporta al conocimiento.</h2><p>Estudiantes, pescadores, buzos y científicos e investigadores contribuyen desde su experiencia en el mar y en la investigación.</p></div>
          <div className="landing-role-grid">
            {collaborators.map((mode) => (
              <article key={mode.number} className="landing-role-card" aria-labelledby={`role-${mode.number}`}>
                <div className={`landing-role-image landing-role-image--${mode.image}`}>
                  <Image src={`/images/landing/${mode.image}.webp`} alt={mode.alt} fill sizes="(min-width: 1320px) 400px, (min-width: 1024px) 33vw, (min-width: 600px) 560px, calc(100vw - 40px)" className="landing-photo" />
                  <span className="landing-role-category">{mode.category}</span>
                </div>
                <div className="landing-role-body">
                  <h3 id={`role-${mode.number}`}>{mode.title}</h3>
                  <p className="landing-role-description">{mode.description}</p>
                  <ul>{mode.features.map((feature) => <li key={feature}>{feature}</li>)}</ul>
                  <div className="landing-role-bottom">
                    <p className="landing-role-note">{mode.note}</p>
                    <Link href={mode.href} className="button landing-button landing-button--outline landing-role-action">{mode.action}<Icon name="arrow" /></Link>
                  </div>
                </div>
              </article>
            ))}
          </div>
          <p className="landing-signup-note">¿Es tu primera visita? <Link href="/register">Crea tu cuenta y elige cómo colaborar.</Link></p>
        </section>

        <section className="landing-invitation" aria-labelledby="invitation-title">
          <div className="page-container landing-invitation-inner"><div><p className="landing-eyebrow">LA PRÓXIMA HISTORIA PUEDE SER TUYA</p><h2 id="invitation-title">Hay mucho por descubrir.<br />Hagámoslo juntos.</h2></div><Link href="/register" className="button landing-button landing-button--solid">Únete a GaleoTrack <Icon name="arrow" /></Link></div>
        </section>
      </main>
      <SiteFooter />
    </div>
  )
}
