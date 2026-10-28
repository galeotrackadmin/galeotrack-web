import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { inflateSync } from 'node:zlib'

test('figuras OBIS de prueba: los PNG conservan todos los píxeles RGB del PDF original', async () => {
  const source = await readFile(new URL('../public/pdf/obis-resultados-prueba.pdf', import.meta.url))
  const text = source.toString('latin1')
  const pattern = /\d+\s+0\s+obj\s*<<([^<>]*?\/Subtype\s*\/Image[^<>]*)>>\s*stream[\r\n]+/g
  const originals = [...text.matchAll(pattern)]
  assert.equal(originals.length, 3)
  for (const [index, original] of originals.entries()) {
    const width = Number(original[1].match(/\/Width\s+(\d+)/)[1])
    const height = Number(original[1].match(/\/Height\s+(\d+)/)[1])
    const length = Number(original[1].match(/\/Length\s+(\d+)/)[1])
    const start = original.index + original[0].length
    const pixels = inflateSync(source.subarray(start, start + length))
    const png = await readFile(new URL(`../public/images/obis-test/figure-${index + 1}.png`, import.meta.url))
    assert.deepEqual(png.subarray(0, 8), Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    assert.equal(png.readUInt32BE(16), width)
    assert.equal(png.readUInt32BE(20), height)
    const imageData = []
    for (let offset = 8; offset < png.length;) {
      const size = png.readUInt32BE(offset)
      if (png.toString('ascii', offset + 4, offset + 8) === 'IDAT') imageData.push(png.subarray(offset + 8, offset + 8 + size))
      offset += size + 12
    }
    const rows = inflateSync(Buffer.concat(imageData))
    const stride = width * 3
    assert.equal(rows.length, (stride + 1) * height)
    for (let row = 0; row < height; row++) {
      assert.equal(rows[row * (stride + 1)], 0, 'No se aplican filtros ni remuestreo a los píxeles.')
      assert.deepEqual(rows.subarray(row * (stride + 1) + 1, (row + 1) * (stride + 1)), pixels.subarray(row * stride, (row + 1) * stride))
    }
  }
})
