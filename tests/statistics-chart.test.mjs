import assert from 'node:assert/strict'
import { test } from 'node:test'
import { statisticsBarOption, statisticsPieOption, statisticsPercent } from '../lib/sightings/statistics-chart.ts'

const appearance = {
  width: 560, fontSize: 14, fontFamily: 'Geist', reducedMotion: false,
  primary: '#91BFDF', hover: '#B9D8EE', foreground: '#F5F8FC', muted: '#BDCDDD',
  border: '#2C4055', surface: '#0C1828', soft: '#16283B',
  success: '#A1DFBE', warning: '#EFD294', onPrimary: '#020D1C',
}

test('ECharts conserva los años, el orden y los valores exactos sin inventar fechas', () => {
  const points = [{ label: '2021', count: 2 }, { label: '2026', count: 1100 }, { label: 'Sin año conocido', count: 3 }]
  const option = statisticsBarOption(points, appearance)
  assert.deepEqual(option.yAxis.data, points.map((point) => point.label))
  assert.deepEqual(option.series[0].data, points.map((point) => ({ name: point.label, value: point.count })))
  assert.equal(option.yAxis.inverse, true)
  assert.equal(option.xAxis.min, 0)
  assert.equal(option.xAxis.minInterval, 1)
  assert.equal(option.series[0].label.formatter({ value: 1100 }), '1,100')
})

test('ECharts respeta movimiento reducido, colores del sitio y etiquetas no confiables', () => {
  const label = '<img src=x onerror=alert(1)>'
  const option = statisticsBarOption([{ label, count: 0 }], { ...appearance, reducedMotion: true })
  assert.equal(option.animation, false)
  assert.equal(option.tooltip.renderMode, 'richText', 'never interpolate sighting labels as HTML')
  assert.equal(option.tooltip.confine, true)
  assert.equal(option.tooltip.valueFormatter(12), '12 registros')
  assert.equal(option.series[0].data[0].name, label)
  assert.equal(option.series[0].data[0].value, 0)
  assert.equal(option.series[0].itemStyle.color, appearance.primary)
  assert.equal(option.series[0].label.color, appearance.foreground)
})

test('ECharts adapta las etiquetas al ancho móvil y admite series vacías sin NaN', () => {
  const desktop = statisticsBarOption([], appearance)
  const mobile = statisticsBarOption([], { ...appearance, width: 255, fontSize: 28 })
  assert.ok(mobile.yAxis.axisLabel.width < desktop.yAxis.axisLabel.width)
  assert.equal(mobile.yAxis.axisLabel.overflow, 'truncate')
  assert.ok(Number.isFinite(mobile.grid.right))
  assert.deepEqual(mobile.series[0].data, [])
})

test('composición: los porcentajes usan todos los registros y no eliminan los desconocidos', () => {
  const option = statisticsBarOption([{ label: 'Sin identificar', count: 1 }, { label: 'Ginglymostoma cirratum', count: 3 }], appearance, 4)
  assert.equal(option.tooltip.valueFormatter(1), '1 registros (25%)')
  assert.equal(statisticsPercent(3, 4), '75%')
  assert.equal(statisticsPercent(1, 3), '33.3%')
  assert.equal(statisticsPercent(0, 0), '—', 'an empty denominator is not a measured zero percent')
})

test('salud circular: categorías excluyentes, ceros sin sectores ficticios y porcentajes con base completa', () => {
  const points = [{ label: 'Sin marcas visibles', count: 2, tone: 'success' }, { label: 'Con signos reportados', count: 1, tone: 'warning' }, { label: 'Sin información concluyente', count: 1, tone: 'muted' }]
  const option = statisticsPieOption(points, { ...appearance, reducedMotion: true })
  assert.equal(option.series[0].type, 'pie')
  assert.equal(option.series[0].stillShowZeroSum, false)
  assert.equal(option.series[0].selectedMode, false, 'the denominator must not change by hiding categories')
  assert.equal(option.series[0].label.formatter({ value: 2 }), '50%')
  assert.equal(option.series[0].data[2].value, 1)
  assert.equal(option.series[0].data[0].itemStyle.color, appearance.success)
  assert.equal(option.series[0].data[1].itemStyle.color, appearance.warning)
  assert.equal(option.series[0].label.color, appearance.onPrimary)
  assert.equal(option.animation, false)
  assert.equal(option.tooltip.renderMode, 'richText')
  assert.equal(statisticsPieOption([], appearance).series[0].data.length, 0)
})
