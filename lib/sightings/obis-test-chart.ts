import type { CustomSeriesRenderItem, EChartsOption } from 'echarts'

export type ObisTestKind = 'abundance' | 'temporal' | 'depth'
export type ObisTestPoint = { label: string; value: number; display: string; sampleSize?: number }

// Los colores y el relieve reproducen las figuras del documento de prueba.
export function obisTestChartOption(kind: ObisTestKind, points: ObisTestPoint[], fontSize = 14, fontFamily = 'sans-serif'): EChartsOption {
  const depth = kind === 'depth'
  const temporal = kind === 'temporal'
  const color = kind === 'abundance' ? '#ff00ff' : '#9900ff'
  const axisStyle = { color: '#202020', fontSize, fontFamily }
  const axis = { axisLabel: axisStyle, nameTextStyle: axisStyle, axisLine: { lineStyle: { color: '#555555' } }, axisTick: { show: false } }
  const renderItem: CustomSeriesRenderItem = (_params, api) => {
    const index = Number(api.value(0))
    const value = Number(api.value(1))
    const start = api.coord(depth ? [0, index] : [index, 0])
    const end = api.coord(depth ? [value, index] : [index, value])
    const band = api.size?.(depth ? [0, 1] : [1, 0]) as number[]
    const size = Math.min(fontSize * (depth ? 3 : 2), Math.abs(band[depth ? 1 : 0]) * .65)
    const bevel = Math.min(9, size * .25)
    const x = depth ? start[0] : start[0] - size / 2
    const y = depth ? start[1] - size / 2 : end[1]
    const w = depth ? end[0] - start[0] : size
    const h = depth ? size : start[1] - end[1]
    return { type: 'group', children: [
      { type: 'polygon', shape: { points: [[x, y], [x + bevel, y - bevel], [x + w + bevel, y - bevel], [x + w, y]] }, style: { fill: depth ? '#b43dff' : '#ff42ff' } },
      { type: 'polygon', shape: { points: [[x + w, y], [x + w + bevel, y - bevel], [x + w + bevel, y + h - bevel], [x + w, y + h]] }, style: { fill: depth ? '#65009e' : '#a000a0' } },
      { type: 'rect', shape: { x, y, width: w, height: h }, style: { fill: color } },
      ...(depth ? [{ type: 'text' as const, silent: true, style: { x: x + w + bevel + 6, y: y + h / 2, text: points[index].display, font: `${fontSize}px ${fontFamily}`, fill: '#8000c8', verticalAlign: 'middle' as const } }] : []),
    ] }
  }
  return {
    backgroundColor: '#ffffff', animation: false,
    textStyle: { color: '#202020', fontFamily, fontSize },
    grid: { left: fontSize * (depth ? 15 : 5), right: fontSize * (depth ? 8 : 3), top: 24, bottom: fontSize * (kind === 'abundance' ? 14 : 5) },
    tooltip: {
      trigger: temporal ? 'axis' : 'item', renderMode: 'richText', confine: true,
      backgroundColor: '#ffffff', borderColor: '#555555', textStyle: axisStyle,
      formatter: (params) => {
        const item = Array.isArray(params) ? params[0] : params
        const point = points[item.dataIndex]
        return `${point.label}\n${point.display} ${depth ? 'm' : 'registros'}${depth ? `\n${point.sampleSize} registros con profundidad máxima` : ''}`
      },
    },
    xAxis: depth ? {
      ...axis, type: 'value', min: 0, max: 400, interval: 100,
      name: 'Profundidad promedio (m)', nameLocation: 'middle', nameGap: fontSize * 3,
      splitLine: { lineStyle: { color: '#cccccc' } },
    } : temporal ? {
      ...axis, type: 'value', min: 1933, max: 2020, splitNumber: 4,
      name: 'Año', nameLocation: 'middle', nameGap: fontSize * 3,
      axisLabel: { ...axisStyle, formatter: (value: number) => value === 1933 ? '' : String(value), hideOverlap: true },
      splitLine: { lineStyle: { color: '#cccccc' } },
    } : {
      ...axis, type: 'category', data: points.map((point) => point.label),
      name: 'Nombre científico', nameLocation: 'middle', nameGap: fontSize * 12,
      axisLabel: { ...axisStyle, interval: 0, rotate: 64 },
    },
    yAxis: depth ? {
      ...axis, type: 'category', inverse: true, data: points.map((point) => point.label),
      name: 'Especie', nameLocation: 'middle', nameGap: fontSize * 13,
      axisLabel: { ...axisStyle, formatter: (value: string) => value.replace(' ', '\n') },
    } : {
      ...axis, type: 'value', min: 0, max: temporal ? 12 : 40, interval: temporal ? 2 : 10,
      name: 'Número de registros', nameLocation: 'middle', nameGap: fontSize * 3,
      splitLine: { lineStyle: { color: '#cccccc' } },
    },
    series: temporal ? [{
      type: 'line', name: 'Registros por año', smooth: false, showSymbol: true, symbolSize: 2,
      data: points.map((point) => [Number(point.label), point.value]),
      lineStyle: { color, width: 2.5 }, itemStyle: { color },
      label: { show: true, position: 'bottom', color: '#8000c8', fontSize, formatter: (params) => points[params.dataIndex].display },
      labelLayout: { hideOverlap: true },
    }] : [{
      type: 'custom', name: depth ? 'Profundidad promedio' : 'Registros por identificación', renderItem,
      dimensions: ['category', 'value'], encode: depth ? { x: 1, y: 0 } : { x: 0, y: 1 },
      data: points.map((point, index) => ({ name: point.label, value: [index, point.value] })),
    }],
  }
}
