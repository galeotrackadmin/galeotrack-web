'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import ReactEChartsCore from 'echarts-for-react/lib/core'
import * as echarts from 'echarts/core'
import { BarChart, PieChart } from 'echarts/charts'
import { GridComponent, TooltipComponent } from 'echarts/components'
import { SVGRenderer } from 'echarts/renderers'
import { statisticsBarOption, statisticsPieOption, type StatisticsChartAppearance, type StatisticsChartPoint } from '@/lib/sightings/statistics-chart'

echarts.use([BarChart, PieChart, GridComponent, TooltipComponent, SVGRenderer])
const opts = { renderer: 'svg' as const }

export default function StatisticsEChart({ points, type = 'bar', percentageTotal }: { points: StatisticsChartPoint[]; type?: 'bar' | 'pie'; percentageTotal?: number }) {
  const root = useRef<HTMLDivElement>(null)
  const chart = useRef<ReactEChartsCore>(null)
  const [appearance, setAppearance] = useState<StatisticsChartAppearance | null>(null)
  useEffect(() => {
    const element = root.current
    if (!element) return
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => {
      chart.current?.getEchartsInstance()?.resize({ width: element.clientWidth, height: element.clientHeight, animation: { duration: 0 } })
      const style = getComputedStyle(element)
      const token = (name: string) => style.getPropertyValue(name).trim()
      setAppearance({
        width: element.clientWidth, fontSize: parseFloat(getComputedStyle(document.documentElement).fontSize) * .875,
        fontFamily: style.fontFamily, reducedMotion: motion.matches,
        primary: token('--primary'), hover: token('--primary-hover'), foreground: token('--foreground'),
        muted: token('--muted'), border: token('--border'), surface: token('--surface'), soft: token('--soft'),
        success: token('--success'), warning: token('--warning'), onPrimary: token('--on-primary'),
      })
    }
    const resize = new ResizeObserver(update)
    resize.observe(element)
    motion.addEventListener('change', update)
    return () => { resize.disconnect(); motion.removeEventListener('change', update) }
  }, [])
  const option = useMemo(() => appearance ? type === 'pie'
    ? statisticsPieOption(points, appearance) : statisticsBarOption(points, appearance, percentageTotal)
    : null, [points, appearance, type, percentageTotal])

  return <div ref={root} className="statistics-echart" aria-hidden="true">
    {option && <ReactEChartsCore ref={chart} echarts={echarts} option={option} opts={opts} notMerge autoResize={false} style={{ height: '100%', width: '100%' }} />}
  </div>
}
