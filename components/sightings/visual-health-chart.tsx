import { useId } from 'react'
import { HEALTH_LABELS, HEALTH_SIGN_LABELS, type VisualHealthStatistics } from '@/lib/sightings/statistics'
import { statisticsPercent, type StatisticsChartPoint } from '@/lib/sightings/statistics-chart'
import { StatisticsChart } from './statistics-chart'

export function VisualHealthChart({ health, total }: { health?: VisualHealthStatistics; total: number }) {
  const id = useId()
  if (!health) return <figure className="ui-card statistics-chart" aria-labelledby={id}>
    <figcaption><h4 id={id}>Salud visual</h4></figcaption>
    <p className="statistics-empty" role="note">La salud visual está pendiente de configurar en Supabase. Aplica la migración <code>202610170001_visual_health_statistics.sql</code>. No se interpretan los datos ausentes como animales sanos.</p>
  </figure>
  const points: StatisticsChartPoint[] = [
    { label: HEALTH_LABELS.without_marks, count: health.without_marks, tone: 'success' },
    { label: HEALTH_LABELS.with_signs, count: health.with_signs, tone: 'warning' },
    { label: HEALTH_LABELS.unknown, count: health.unknown, tone: 'muted' },
  ]
  return <StatisticsChart title="Salud visual" description="Porcentaje de registros según la condición visual reportada, no de ejemplares. Sin marcas visibles no equivale a un diagnóstico de buena salud." type="pie" points={points} percentageTotal={total}>
    {total > 0 && <>
      <ul className="statistics-health-legend" aria-label="Salud visual: comparación por categoría">
        {points.map((point) => <li key={point.label}>
          <div><span>{point.label}</span><strong>{statisticsPercent(point.count, total)}</strong></div>
          <span>{point.count.toLocaleString('es-PR')} registros</span>
          <span className={`statistics-health-track statistics-health-track--${point.tone}`} aria-hidden="true"><span style={{ width: `${point.count / total * 100}%` }} /></span>
        </li>)}
      </ul>
      <p className="statistics-health-note">Base: {total.toLocaleString('es-PR')} registros de estos filtros, incluidos los que no tienen información concluyente. Los datos ausentes, desconocidos o contradictorios se agrupan aparte. Porcentajes redondeados. Cada registro pertenece a una sola categoría.</p>
      <details className="statistics-table statistics-health-signs"><summary>Ver signos reportados</summary>
        <p>Un registro puede incluir varios signos; estos conteos se superponen. Anzuelos, redes y basura están agrupados porque el formulario los registra en una misma opción.</p>
        <dl>{Object.entries(HEALTH_SIGN_LABELS).map(([key, label]) => <div key={key}><dt>{label}</dt><dd>{health.signs[key as keyof typeof health.signs].toLocaleString('es-PR')}</dd></div>)}</dl>
      </details>
    </>}
  </StatisticsChart>
}
