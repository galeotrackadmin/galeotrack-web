import type { Metadata } from 'next'
import Link from 'next/link'
import { SiteHeader } from '@/components/layout/site-header'
import { SiteFooter } from '@/components/layout/site-footer'
import { PublicTracker } from '@/components/tracker/public-tracker'
import { Icon } from '@/components/icons'
import '../landing.css'
import './distribution.css'

export const metadata: Metadata = {
  title: 'Patrones de distribución de tiburones en Puerto Rico',
  description: 'Explora los avistamientos registrados y conoce las líneas de análisis para estudiar la distribución de tiburones y otros elasmobranquios en Puerto Rico.',
}

const indicators = [
  { number: '01', title: 'Composición de especies', text: 'Los registros de especies podrán ayudar a estudiar cuáles se observan con mayor frecuencia y cómo se distribuyen alrededor del archipiélago.' },
  { number: '02', title: 'Profundidad y hábitat', text: 'La información de profundidad y hábitat, cuando esté disponible, permitirá explorar encuentros en arrecifes de coral, pastos marinos y zonas pelágicas.' },
  { number: '03', title: 'Indicadores de salud visual', text: 'Las fotografías y observaciones de salud podrán apoyar el análisis de marcas, lesiones e interacciones con artes de pesca.' },
]

const references = [
  'Credille, K. M., Frazier, K. S., Hullinger, G. A., & Hines, M. E. (1993). Meningoencephalitis in a nurse shark (Ginglymostoma cirratum) caused by a nematode. Journal of Wildlife Diseases, 29(1), 165–168.',
  'Espinoza, M., Lino, P. G., & García, V. (2018). Guía de campo para la identificación de tiburones en aguas territoriales de Puerto Rico. Editorial Marina.',
  'Hernández-Delgado, E. A. (2015). Uso de Sistemas de Información Geográfica (SIG) para el manejo de áreas marinas protegidas en Puerto Rico. Universidad de Puerto Rico.',
  'Llerena, N., Sanjuan, M., & Pérez, J. (2012). Protocolo de marcaje y toma de datos biométricos para el monitoreo de elasmobranquios en el Caribe. Revista de Ciencias Marinas, 4(2), 45–58.',
  'Nature Editorial. (2023). Environmental DNA (eDNA) as a non-invasive tool for monitoring shark diversity and distribution in coastal ecosystems. Nature Communications, 14(12), 1022.',
  'Ward-Paige, C. A., Mora, C., Lotze, H. K., Pattengill-Semmens, C., McClenachan, L., Arias-Schreiber, M., & Myers, R. A. (2010). Large-scale absence of sharks on reefs in the greater-Caribbean: A baseline for fish and future conservation. PLoS ONE, 5(8), e11916.',
  'Bond, M. E., et al. (2017). Abundance and size structure of a reef shark population within a marine reserve has remained stable for more than a decade. Marine Ecology Progress Series, 576, 1–10. https://doi.org/10.3354/meps12241',
  'Departamento de Recursos Naturales y Ambientales (DRNA). (2010). Reglamento de Pesca de Puerto Rico (Reglamento 7949). Gobierno de Puerto Rico.',
  'Garner, M. M. (2013). A retrospective study of disease in elasmobranchs. Veterinary Pathology, 50(3), 377–389. https://doi.org/10.1177/0300985813482147',
  'National Oceanic and Atmospheric Administration. (2019). Guía de cumplimiento para el negociante, importador/exportador de especies altamente migratorias (HMS). Oficina de Pesquerías Sostenibles; NMFS.',
  'Ostrander, G. K., Cheng, K. C., Wolf, J. C., & Spitsbergen, J. M. (2004). Shark cartilage, cancer and the growing threat of pseudoscience. Cancer Research, 64(23), 8485–8491.',
  'Shipley, O. N., et al. (2021). Metal concentrations in coastal sharks from The Bahamas with a focus on the Caribbean reef shark. Scientific Reports, 11(218), 1–11. https://doi.org/10.1038/s41598-020-79973-w',
  'Smith, M., et al. (Eds.). (2017). Elasmobranch Husbandry Manual II: Recent Advances in the Care of Sharks, Rays and their Relatives. Ohio Biological Survey.',
  'Ward-Paige, C. A., et al. (2010). Large-scale absence of sharks on reefs in the greater-Caribbean: A footprint of human pressures. PLoS ONE, 5(8), e11916. https://doi.org/10.1371/journal.pone.0011916',
]

export default function DistributionPage() {
  return <div className="landing-page distribution-page">
    <SiteHeader active="distribution" />
    <main id="main-content" tabIndex={-1}>
      <section className="distribution-hero page-container" aria-labelledby="distribution-title">
        <p className="landing-eyebrow">CIENCIA CIUDADANA · PUERTO RICO</p>
        <h1 id="distribution-title">Patrones de distribución de tiburones en Puerto Rico</h1>
        <p>Explora los avistamientos registrados alrededor del archipiélago. Cada tarjeta muestra su estado de revisión para distinguir los registros pendientes de los verificados.</p>
      </section>

      <section className="distribution-map-section" aria-labelledby="map-intro-title">
        <div className="distribution-map-intro page-container">
          <div><p className="landing-eyebrow">EXPLORA LOS REGISTROS</p><h2 id="map-intro-title">Avistamientos registrados</h2></div>
          <p>Selecciona un punto para consultar la especie, el lugar y los datos del encuentro. Usa + y − para explorar el mapa.</p>
        </div>
        <PublicTracker compact />
        <p className="distribution-map-caption page-container">Los puntos representan reportes comunitarios y registros históricos activos. Una zona sin marcadores puede tener pocos reportes o muestreos; no confirma ausencia de tiburones.</p>
      </section>

      <section className="distribution-section page-container" aria-labelledby="indicators-title">
        <div className="distribution-section-heading">
          <p className="landing-eyebrow">DEL REGISTRO AL CONOCIMIENTO</p>
          <h2 id="indicators-title">Cómo interpretar los registros</h2>
          <p>El mapa muestra dónde se han documentado encuentros. Los registros pendientes todavía no han sido verificados por GaleoTrack; por sí solos, estos datos no permiten estimar el tamaño de una población ni su estado de salud.</p>
        </div>
        <div className="distribution-data-note"><h3>Registros históricos de OBIS</h3><p>Los datos históricos de OBIS se gestionan por lotes y se identifican por su fuente. Su estado de revisión aparece en la tarjeta; mostrar un registro no equivale a verificarlo.</p></div>
        <div className="distribution-analysis-heading"><p className="landing-eyebrow">LÍNEAS DE ANÁLISIS PREVISTAS</p><p>Estas son preguntas que los datos podrán ayudar a explorar. Los resultados agregados se publicarán cuando exista información consolidada para calcularlos.</p></div>
        <div className="distribution-indicators">{indicators.map((item) => <article className="distribution-indicator" key={item.number}><span>{item.number}</span><h3>{item.title}</h3><p>{item.text}</p></article>)}</div>
      </section>

      <section className="distribution-guide" aria-labelledby="guide-title"><div className="page-container distribution-guide-inner">
        <div><p className="landing-eyebrow">RECURSO DE CAMPO</p><h2 id="guide-title">Guía de identificación de tiburones</h2></div>
        <div><p>Consulta los rasgos visuales de los tiburones del Caribe para comparar tus fotografías y apoyar la identificación de un encuentro.</p><p>La guía de NOAA puede servirte antes de salir al campo o al preparar un reporte.</p><a className="button landing-button landing-button--outline" href="https://www.fisheries.noaa.gov/s3/2021-09/Caribbean%20Shark%20Placard_Spanish.pdf" target="_blank" rel="noreferrer">Abrir guía de tiburones del Caribe · NOAA (PDF)<Icon name="arrow" /></a></div>
      </div></section>

      <section className="distribution-section page-container" aria-labelledby="references-title">
        <div className="distribution-section-heading"><p className="landing-eyebrow">FUENTES CONSULTADAS</p><h2 id="references-title">Referencias</h2><p>Consulta la bibliografía sobre investigación, identificación y conservación de elasmobranquios.</p></div>
        <details className="distribution-reference-list"><summary>Ver referencias bibliográficas ({references.length})<Icon name="chevron-right" /></summary><ol className="distribution-references">{references.map((reference) => <li key={reference}>{reference}</li>)}</ol></details>
      </section>

      <section className="distribution-cta" aria-labelledby="distribution-cta-title"><div className="page-container distribution-cta-inner"><div><p className="landing-eyebrow">CONTRIBUYE AL CONOCIMIENTO</p><h2 id="distribution-cta-title">¿Tuviste un encuentro con un tiburón?</h2><p>Comparte el lugar, los detalles y evidencia del avistamiento para aportar a la investigación marina.</p></div><Link className="button landing-button landing-button--solid" href="/report">Reportar un avistamiento <Icon name="arrow" /></Link></div></section>
    </main>
    <SiteFooter />
  </div>
}
