export const OBIS_COLUMNS = ['Scientific Name', 'Decimal Latitude', 'Decimal Longitude', 'Year', 'Event Date', 'locality', 'Individual Count', 'Country', 'Fuente/datos'] as const
export type ObisRecord = Record<typeof OBIS_COLUMNS[number], string>
export type ImportBatch = {
  id: string; file_name: string; row_count: number; duplicate_count: number; status: 'pending' | 'withdrawn';
  created_at: string; quality_summary: { missing_dates?: number; partial_dates?: number; invalid_years?: number }
}

// CSV RFC 4180: admite BOM de Excel, comas y saltos de línea dentro de comillas.
export function parseObisCsv(text: string): ObisRecord[] {
  if (text.length > 2_000_000) throw new Error('El CSV supera el límite de 2 MB.')
  const rows: string[][] = []
  let row: string[] = []; let cell = ''; let quoted = false; let closed = false
  const finishCell = () => { row.push(cell); cell = ''; closed = false }
  const finishRow = () => { finishCell(); if (row.some((value) => value !== '')) rows.push(row); row = [] }
  text = text.replace(/^\uFEFF/, '')
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') { cell += '"'; index += 1 }
      else if (char === '"') { quoted = false; closed = true }
      else cell += char
    } else if (char === ',') finishCell()
    else if (char === '\r' || char === '\n') { if (char === '\r' && text[index + 1] === '\n') index += 1; finishRow() }
    else if (char === '"' && !cell && !closed) quoted = true
    else {
      if (closed || char === '"') throw new Error('El CSV contiene comillas mal cerradas.')
      cell += char
    }
  }
  if (quoted) throw new Error('El CSV contiene un campo sin cerrar sus comillas.')
  if (cell || row.length || closed) finishRow()
  const header = rows.shift()?.map((column) => column.trim()) ?? []
  if (header.length !== OBIS_COLUMNS.length || new Set(header).size !== header.length || OBIS_COLUMNS.some((column) => !header.includes(column))) {
    throw new Error('Las columnas no coinciden con el CSV OBIS de la hoja Datos. Usa avistamientos-obis-datos.csv.')
  }
  if (!rows.length || rows.length > 5000) throw new Error('El archivo debe contener entre 1 y 5000 registros.')
  return rows.map((values, index) => {
    if (values.length !== header.length) throw new Error(`Fila ${index + 2}: cantidad de columnas incorrecta.`)
    const record = Object.fromEntries(header.map((key, position) => [key, values[position]])) as ObisRecord
    const lat = record['Decimal Latitude'].trim(); const lon = record['Decimal Longitude'].trim()
    if (!lat || !lon || !Number.isFinite(Number(lat)) || !Number.isFinite(Number(lon)) || Math.abs(Number(lat)) > 90 || Math.abs(Number(lon)) > 180) {
      throw new Error(`Fila ${index + 2}: coordenadas inválidas.`)
    }
    if (record['Scientific Name'].trim().length < 3 || record['Scientific Name'].trim().length > 200) throw new Error(`Fila ${index + 2}: nombre científico inválido.`)
    if (record['Fuente/datos'].trim().toUpperCase() !== 'OBIS') throw new Error(`Fila ${index + 2}: la fuente debe ser OBIS.`)
    const amount = record['Individual Count'].trim()
    if (amount && (!/^\d+(\.0+)?$/.test(amount) || Number(amount) < 1 || Number(amount) > 2147483647)) throw new Error(`Fila ${index + 2}: cantidad inválida.`)
    return record
  })
}

export function summarizeObis(records: ObisRecord[]) {
  const seen = new Set<string>()
  return records.reduce((summary, record) => {
    const key = JSON.stringify(OBIS_COLUMNS.map((column) => record[column]))
    if (seen.has(key)) summary.duplicates += 1
    seen.add(key)
    const date = record['Event Date'].trim()
    if (!date) summary.missingDates += 1
    if (/^\d{4}[-_]\d{2}$/.test(date)) summary.partialDates += 1
    if (record.Year.trim() && !/^\d{4}(\.0+)?$/.test(record.Year.trim())) summary.invalidYears += 1
    if (!record.locality.trim()) summary.missingLocalities += 1
    return summary
  }, { duplicates: 0, missingDates: 0, partialDates: 0, invalidYears: 0, missingLocalities: 0 })
}

export const IMPORT_FLAG_LABELS: Record<string, string> = {
  taxonomy_unreviewed: 'Identificación taxonómica pendiente de revisión',
  license_not_provided: 'La hoja Datos no incluye licencia ni atribución completa',
  coordinate_uncertainty_not_provided: 'Precisión de coordenadas no indicada en esta hoja',
  source_identifier_not_provided: 'Identificador original OBIS no incluido en esta hoja',
  count_requires_source_check: 'Cantidad tomada del Excel; cotejar con la fuente original',
  missing_locality: 'Localidad no indicada', missing_count: 'Cantidad no indicada',
  invalid_source_year: 'Año original inválido (por ejemplo, #VALUE!)', partial_date: 'Fecha parcial: no se inventó un día',
  source_time_not_interpreted: 'Hora de la fuente conservada sin asumir zona horaria ni precisión',
  year_mismatch: 'El año de la fuente no coincide con su fecha', invalid_source_date: 'Fecha original pendiente de revisión',
  missing_date: 'Fecha no indicada', possible_duplicate: 'Posible duplicado dentro del lote: conservado para revisión',
}
