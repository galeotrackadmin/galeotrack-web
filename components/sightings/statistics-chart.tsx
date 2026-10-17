'use client'

import { useId, type CSSProperties, type ReactNode } from 'react'
import dynamic from 'next/dynamic'
import { statisticsPercent, type StatisticsChartPoint } from '@/lib/sightings/statistics-chart'

const EChart = dynamic(() => import('./statistics-echart'), {
  ssr: false,
  loading: () => <p className="statistics-chart-loading">Preparando gráfica… Los valores están disponibles en la tabla de datos.</p>,
})

export function StatisticsChart({ title, description, points, chronological = false, type = 'bar', percentageTotal, children }: {
  title: string; description: string; points: StatisticsChartPoint[]; chronological?: boolean;
  type?: 'bar' | 'pie'; percentageTotal?: number; children?: ReactNode
}) {
  const titleId = useId()
  const height = type === 'pie' ? 18 : Math.max(12.5, points.length * 2.75 + 3)
  const hasData = points.length > 0 && (type !== 'pie' || points.some((point) => point.count > 0))
  return <figure className="ui-card statistics-chart" aria-labelledby={titleId}>
    <figcaption><h4 id={titleId}>{title}</h4><p>{description}</p></figcaption>
    {hasData ? <>
      <div className="statistics-chart-visual" style={{ '--statistics-chart-height': `${height}rem` } as CSSProperties} role="img" aria-label={`Gráfica ${type === 'pie' ? 'circular' : 'de barras'}: ${title}. Consulta los valores exactos en la tabla de datos.`} tabIndex={height > 25 ? 0 : undefined}>
        <EChart points={points} type={type} percentageTotal={percentageTotal} />
      </div>
      <details className={`statistics-table${percentageTotal === undefined ? '' : ' statistics-table--percentages'}`}><summary>Ver tabla de datos: {title.toLowerCase()}</summary><table><caption className="sr-only">{title}: valores exactos</caption><thead><tr><th scope="col">{chronological ? 'Año' : 'Grupo'}</th><th scope="col">Registros</th>{percentageTotal !== undefined && <th scope="col">Porcentaje</th>}</tr></thead><tbody>{points.map((point) => <tr key={point.label}><th scope="row">{point.label}</th><td>{point.count.toLocaleString('es-PR')}</td>{percentageTotal !== undefined && <td>{statisticsPercent(point.count, percentageTotal)}</td>}</tr>)}</tbody></table></details>
    </> : <p className="statistics-empty">No hay registros para estos filtros.</p>}
    {children}
  </figure>
}
