import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { obisTestChartOption } from '../lib/sightings/obis-test-chart.ts'

const data = JSON.parse(await readFile(new URL('../lib/sightings/obis-test-data.json', import.meta.url)))

test('OBIS Excel: conserva 115 registros, 24 identificaciones y los 17 años exactos', () => {
  assert.equal(data.source, 'Occurrence (1).xlsx')
  assert.equal(data.abundance.length, 24)
  assert.equal(data.abundance.reduce((sum, point) => sum + point.value, 0), 115)
  assert.deepEqual(data.abundance.slice(0, 4).map(({ label, value }) => [label, value]), [
    ['Ginglymostoma cirratum', 38], ['Carcharhinus perezii', 13], ['Galeus arae', 9], ['Etmopterus hillianus', 9],
  ])
  assert.deepEqual(data.temporal.map(({ label, value }) => [Number(label), value]), [
    [1933, 1], [1959, 5], [1987, 10], [2004, 9], [2005, 2], [2006, 2], [2007, 2], [2008, 2],
    [2009, 12], [2010, 6], [2011, 2], [2013, 2], [2014, 2], [2015, 10], [2016, 1], [2019, 2], [2020, 2],
  ])
  assert.equal(data.unknownYears, 43)
  assert.equal(data.temporal.reduce((sum, point) => sum + point.value, data.unknownYears), 115)
})

test('OBIS profundidad: usa maximumDepthInMeters y conserva los cinco promedios del PDF', () => {
  assert.equal(data.depthField, 'maximumDepthInMeters')
  assert.deepEqual(data.depth.map(({ display, sampleSize }) => [display, sampleSize]), [
    ['35', 2], ['26.38461538', 13], ['23.43605263', 38], ['13', 5], ['329', 1],
  ])
  assert.equal(data.depth[1].value, 343 / 13)
})

test('OBIS gráficas: línea numérica sin suavizar ni inventar ceros, y barras vectoriales', () => {
  const temporal = obisTestChartOption('temporal', data.temporal)
  assert.equal(temporal.animation, false)
  assert.equal(temporal.series[0].type, 'line')
  assert.equal(temporal.series[0].smooth, false)
  assert.equal(temporal.xAxis.type, 'value')
  assert.deepEqual(temporal.series[0].data, data.temporal.map(({ label, value }) => [Number(label), value]))
  for (const kind of ['abundance', 'depth']) {
    const option = obisTestChartOption(kind, data[kind])
    assert.equal(option.series[0].type, 'custom')
    assert.equal(option.series[0].data.length, data[kind].length)
    assert.equal(option.tooltip.renderMode, 'richText')
    assert.equal(option.tooltip.confine, true)
    assert.match(option.tooltip.formatter({ dataIndex: 0 }), kind === 'depth' ? /35 m/ : /38 registros/)
  }
})

test('OBIS relieve: cada barra mantiene la longitud proporcional a su valor', () => {
  for (const kind of ['abundance', 'depth']) {
    const option = obisTestChartOption(kind, data[kind])
    const horizontal = kind === 'depth'
    const shape = option.series[0].renderItem({}, {
      value: (index) => index === 0 ? 0 : data[kind][0].value,
      coord: ([x, y]) => horizontal ? [x * 2, 30 + y * 50] : [30 + x * 50, 300 - y * 2],
      size: () => [50, 50],
    })
    assert.equal(shape.children[2].type, 'rect')
    assert.equal(shape.children[2].shape[horizontal ? 'width' : 'height'], data[kind][0].value * 2)
  }
})
