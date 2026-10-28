import { ObisTestChart } from './obis-test-chart'
import data from '@/lib/sightings/obis-test-data.json'
import type { ObisTestKind, ObisTestPoint } from '@/lib/sightings/obis-test-chart'
import './obis-test-results.css'

const figures: { kind: ObisTestKind; title: string; description: string; points: ObisTestPoint[] }[] = [
  {
    title: 'Abundancia relativa de tiburones en Puerto Rico',
    description: 'Cantidad de registros por identificación.',
    kind: 'abundance', points: data.abundance,
  },
  {
    title: 'Tendencia temporal de registros de tiburones en Puerto Rico',
    description: 'Evolución de los registros a lo largo de los años.',
    kind: 'temporal', points: data.temporal,
  },
  {
    title: 'Distribución batimétrica promedio por especie en Puerto Rico',
    description: 'Profundidad máxima promedio registrada por especie.',
    kind: 'depth', points: data.depth,
  },
]

export function ObisTestResults() {
  return <section id="resultados-obis-prueba" aria-labelledby="obis-test-title" className="obis-test-results">
    <h3 id="obis-test-title" className="text-2xl font-semibold text-ocean">Estadísticas</h3>
    {figures.map((figure, index) => <figure key={figure.title} className="ui-card obis-test-figure" aria-labelledby={`obis-test-figure-${index + 1}`}>
      <figcaption className="obis-test-caption"><h4 id={`obis-test-figure-${index + 1}`}><span>Figura {index + 1}.</span> {figure.title}</h4><p>{figure.description}</p></figcaption>
      <ObisTestChart kind={figure.kind} points={figure.points} title={figure.title} />
      <details className="obis-test-data"><summary>Ver tabla de datos de la figura {index + 1}</summary><table><caption>Datos del Excel: {figure.title}</caption><thead><tr><th scope="col">{figure.kind === 'temporal' ? 'Año' : 'Identificación'}</th><th scope="col">{figure.kind === 'depth' ? 'Profundidad promedio (m)' : 'Registros'}</th>{figure.kind === 'depth' && <th scope="col">Registros con profundidad máxima</th>}</tr></thead><tbody>{figure.points.map((point) => <tr key={point.label}><th scope="row">{figure.kind === 'temporal' ? point.label : <i>{point.label}</i>}</th><td>{point.display}</td>{figure.kind === 'depth' && <td>{point.sampleSize}</td>}</tr>)}</tbody></table></details>
    </figure>)}
  </section>
}
