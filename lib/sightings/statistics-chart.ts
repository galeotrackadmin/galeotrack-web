import type { EChartsOption } from 'echarts'

export type StatisticsChartPoint = { label: string; count: number; tone?: 'success' | 'warning' | 'muted' }
export type StatisticsChartAppearance = {
  width: number; fontSize: number; fontFamily: string; reducedMotion: boolean;
  primary: string; hover: string; foreground: string; muted: string; border: string; surface: string; soft: string;
  success: string; warning: string; onPrimary: string
}

const number = (value: number) => value.toLocaleString('es-PR')
export const statisticsPercent = (value: number, total: number) => total > 0
  ? new Intl.NumberFormat('es-PR', { style: 'percent', maximumFractionDigits: 1 }).format(value / total)
  : '—'

export function statisticsBarOption(points: StatisticsChartPoint[], appearance: StatisticsChartAppearance, percentageTotal?: number): EChartsOption {
  const { width, fontSize, fontFamily, reducedMotion, primary, hover, foreground, muted, border, surface, soft } = appearance
  const labelWidth = Math.min(180, width * .42)
  const valueWidth = Math.max(36, number(Math.max(0, ...points.map((point) => point.count))).length * fontSize * .7 + 12)
  return {
    backgroundColor: 'transparent',
    animation: !reducedMotion,
    animationDuration: 200,
    animationDurationUpdate: 200,
    textStyle: { fontFamily, fontSize, color: foreground },
    grid: { left: labelWidth + 12, right: valueWidth, top: 12, bottom: fontSize * 2.5 },
    tooltip: {
      trigger: 'axis', confine: true,
      // No HTML: las etiquetas proceden de registros y pueden contener texto no confiable.
      renderMode: 'richText', backgroundColor: surface, borderColor: border,
      textStyle: { color: foreground, fontFamily, fontSize },
      axisPointer: { type: 'shadow', shadowStyle: { color: soft } },
      valueFormatter: (value) => `${number(Number(value))} registros${percentageTotal === undefined ? '' : ` (${statisticsPercent(Number(value), percentageTotal)})`}`,
    },
    xAxis: {
      type: 'value', min: 0, minInterval: 1, splitNumber: 3,
      axisLabel: { color: muted, fontFamily, fontSize, formatter: number, hideOverlap: true },
      splitLine: { lineStyle: { color: border, type: 'dashed' } },
    },
    yAxis: {
      type: 'category', inverse: true, data: points.map((point) => point.label),
      axisLine: { show: false }, axisTick: { show: false },
      axisLabel: { interval: 0, width: labelWidth, overflow: 'truncate', color: foreground, fontFamily, fontSize, margin: 12 },
    },
    series: [{
      type: 'bar', name: 'Registros', data: points.map((point) => ({ name: point.label, value: point.count })),
      barMaxWidth: 18, showBackground: true,
      backgroundStyle: { color: soft, borderRadius: 6 },
      itemStyle: { color: primary, borderRadius: [0, 6, 6, 0] },
      emphasis: { itemStyle: { color: hover } },
      label: { show: true, position: 'right', color: foreground, fontFamily, fontSize, formatter: (params) => number(Number(params.value)) },
    }],
  }
}

export function statisticsPieOption(points: StatisticsChartPoint[], appearance: StatisticsChartAppearance): EChartsOption {
  const total = points.reduce((sum, point) => sum + point.count, 0)
  const { reducedMotion, foreground, fontFamily, fontSize, surface, border, primary, onPrimary } = appearance
  return {
    backgroundColor: 'transparent', animation: !reducedMotion, animationDuration: 200, animationDurationUpdate: 200,
    textStyle: { fontFamily, fontSize, color: foreground },
    tooltip: {
      trigger: 'item', confine: true, renderMode: 'richText',
      backgroundColor: surface, borderColor: border, textStyle: { color: foreground, fontFamily, fontSize },
      formatter: '{b}\n{c} registros ({d}%)',
    },
    series: [{
      type: 'pie', name: 'Salud visual', radius: ['35%', '76%'], center: ['50%', '50%'],
      stillShowZeroSum: false, percentPrecision: 1, minShowLabelAngle: 15,
      selectedMode: false, emphasis: { scale: !reducedMotion },
      itemStyle: { borderColor: surface, borderWidth: 3 },
      label: { show: true, position: 'inside', color: onPrimary, fontFamily, fontSize, fontWeight: 700,
        formatter: (params) => statisticsPercent(Number(params.value), total) },
      data: points.map((point) => ({ name: point.label, value: point.count, itemStyle: { color: point.tone ? appearance[point.tone] : primary } })),
    }],
  }
}
