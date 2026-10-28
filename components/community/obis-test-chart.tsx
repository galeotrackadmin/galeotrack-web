'use client'

import dynamic from 'next/dynamic'
import { ChartSkeleton } from '@/components/ui/loading-state'
import type { ObisTestKind, ObisTestPoint } from '@/lib/sightings/obis-test-chart'

const Chart = dynamic(() => import('./obis-test-echart'), { ssr: false, loading: () => <ChartSkeleton label="Preparando gráfica del Excel…" /> })

export function ObisTestChart({ kind, points, title }: { kind: ObisTestKind; points: ObisTestPoint[]; title: string }) {
  return <div className="obis-test-chart-scroll" role="region" aria-label={`Gráfica interactiva: ${title}`} tabIndex={0}>
    <div className={`obis-test-chart-frame obis-test-chart-frame--${kind}`}><Chart kind={kind} points={points} /></div>
  </div>
}
