'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import ReactEChartsCore from 'echarts-for-react/lib/core'
import * as echarts from 'echarts/core'
import { CustomChart, LineChart } from 'echarts/charts'
import { GridComponent, TooltipComponent } from 'echarts/components'
import { SVGRenderer } from 'echarts/renderers'
import { obisTestChartOption, type ObisTestKind, type ObisTestPoint } from '@/lib/sightings/obis-test-chart'

echarts.use([CustomChart, LineChart, GridComponent, TooltipComponent, SVGRenderer])
const opts = { renderer: 'svg' as const }

export default function ObisTestEChart({ kind, points }: { kind: ObisTestKind; points: ObisTestPoint[] }) {
  const root = useRef<HTMLDivElement>(null)
  const chart = useRef<ReactEChartsCore>(null)
  const [font, setFont] = useState({ size: 14, family: 'sans-serif' })
  useEffect(() => {
    const element = root.current
    if (!element) return
    const resize = new ResizeObserver(() => {
      const size = parseFloat(getComputedStyle(document.documentElement).fontSize) * .875
      const family = getComputedStyle(element).fontFamily
      setFont((current) => current.size === size && current.family === family ? current : { size, family })
      chart.current?.getEchartsInstance()?.resize({ width: element.clientWidth, height: element.clientHeight, animation: { duration: 0 } })
    })
    resize.observe(element)
    return () => resize.disconnect()
  }, [])
  const option = useMemo(() => obisTestChartOption(kind, points, font.size, font.family), [kind, points, font])
  return <div ref={root} className={`obis-test-echart obis-test-echart--${kind}`} aria-hidden="true"><ReactEChartsCore ref={chart} echarts={echarts} option={option} opts={opts} notMerge autoResize={false} style={{ height: '100%', width: '100%' }} /></div>
}
