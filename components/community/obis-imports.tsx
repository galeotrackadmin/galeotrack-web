'use client'

import { useCallback, useRef, useState, type ChangeEvent } from 'react'
import { supabase } from '@/lib/supabase-client'
import { useResource } from '@/lib/use-resource'
import { parseObisCsv, summarizeObis, type ImportBatch, type ObisRecord } from '@/lib/sightings/obis-import'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { FormField, Input } from '@/components/ui/form-field'
import { useConfirmation } from '@/components/ui/confirmation-provider'
import { ListSkeleton } from '@/components/ui/loading-state'
import { useUpdateGuard } from '@/lib/pwa/use-update-guard'

export function ObisImports() {
  const confirm = useConfirmation()
  const load = useCallback(async (signal?: AbortSignal) => {
    let query = supabase.from('sighting_import_batches').select('id,file_name,row_count,duplicate_count,status,created_at,quality_summary').order('created_at', { ascending: false }).limit(100)
    if (signal) query = query.abortSignal(signal)
    const { data, error } = await query.returns<ImportBatch[]>()
    if (error) throw new Error('No se pudieron cargar las importaciones. Comprueba que esté aplicada la migración 202610150003_obis_import_batches.sql.')
    return data ?? []
  }, [])
  const resource = useResource(load)
  const [preview, setPreview] = useState<{ name: string; records: ObisRecord[] } | null>(null)
  const [busy, setBusy] = useState('')
  const [notice, setNotice] = useState<{ kind: 'error' | 'success'; message: string } | null>(null)
  const inFlight = useRef(false)
  const fileInput = useRef<HTMLInputElement>(null)
  const fileRevision = useRef(0)
  useUpdateGuard(Boolean(busy || preview))

  async function chooseFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    const revision = ++fileRevision.current
    setPreview(null); setNotice(null)
    if (!file) return
    try {
      if (!file.name.toLowerCase().endsWith('.csv') || file.size > 2_000_000) throw new Error('Selecciona un CSV de hasta 2 MB; no cargues el Excel directamente.')
      const records = parseObisCsv(await file.text())
      if (revision === fileRevision.current) setPreview({ name: file.name, records })
    } catch (error) {
      if (revision === fileRevision.current) setNotice({ kind: 'error', message: error instanceof Error ? error.message : 'No se pudo leer el archivo.' })
    }
  }

  async function importFile() {
    if (!preview || inFlight.current) return
    if (!await confirm({ title: `¿Importar ${preview.records.length} registros?`, description: `${preview.name} se guardará como lote OBIS pendiente. Se conservarán los posibles duplicados. Los registros activos con coordenadas serán visibles en el mapa público con la advertencia de revisión pendiente en su tarjeta.`, action: 'Importar lote' })) return
    inFlight.current = true; setBusy('import'); setNotice(null)
    try {
      const { data, error } = await supabase.rpc('import_obis_batch', { file_name: preview.name, records: preview.records })
      if (error || !data) throw new Error(error?.code === 'PGRST202' ? 'Aplica primero la migración 202610150003_obis_import_batches.sql en Supabase.' : 'No se pudo importar el lote. No se guardaron registros nuevos; revisa los datos y vuelve a intentarlo.')
      setNotice({ kind: 'success', message: `Lote OBIS registrado: ${preview.records.length} filas. Si este contenido ya existía, se reutilizó su lote sin duplicar registros. Los lotes retirados se restauran desde el historial.` })
      setPreview(null)
      if (fileInput.current) fileInput.current.value = ''
      resource.refresh()
    } catch (error) { setNotice({ kind: 'error', message: error instanceof Error ? error.message : 'No se pudo importar el lote.' }) }
    finally { inFlight.current = false; setBusy('') }
  }

  async function toggleBatch(batch: ImportBatch) {
    if (inFlight.current) return
    const withdraw = batch.status !== 'withdrawn'
    if (!await confirm({ title: withdraw ? '¿Retirar el lote completo?' : '¿Restaurar este lote?', description: withdraw
      ? `${batch.file_name} (${batch.row_count} registros). Sus registros activos se ocultarán de los listados y mapas. No afecta otros lotes ni reportes comunitarios.`
      : `${batch.file_name}. Los registros retirados por el lote volverán como pendientes y serán visibles en el mapa público con su advertencia; no se marcarán como verificados.`, action: withdraw ? 'Retirar lote' : 'Restaurar lote', danger: withdraw })) return
    inFlight.current = true; setBusy(batch.id); setNotice(null)
    try {
      const { data, error } = await supabase.rpc('set_obis_batch_withdrawn', { batch_id: batch.id, withdraw })
      if (error) throw new Error('No se pudo cambiar el estado del lote. Comprueba tus permisos e inténtalo de nuevo.')
      setNotice({ kind: 'success', message: `${withdraw ? 'Lote retirado' : 'Lote restaurado como pendiente'}: ${data ?? 0} registros afectados. Los demás registros no se modificaron.` })
      resource.refresh()
    } catch (error) { setNotice({ kind: 'error', message: error instanceof Error ? error.message : 'No se pudo cambiar el estado.' }) }
    finally { inFlight.current = false; setBusy('') }
  }

  const summary = preview ? summarizeObis(preview.records) : null
  return <section id="importaciones" aria-labelledby="imports-title" className="space-y-5">
    <div><p className="section-eyebrow">DATOS HISTÓRICOS · OBIS</p><h2 id="imports-title" className="mt-2 text-2xl font-semibold text-ocean">Importaciones por lote</h2><p className="mt-2 text-muted">Carga avistamientos-obis-datos.csv para importar los 115 registros de la hoja Datos. No se atribuyen a tu usuario y quedan pendientes de revisión.</p></div>
    <Alert kind="info">La hoja Datos no incluye identificadores OBIS, licencias ni incertidumbre de coordenadas. Conservamos esa limitación para revisión; no significa que las observaciones estén verificadas ni que cada fila represente un individuo distinto.</Alert>
    {notice && <Alert kind={notice.kind}>{notice.message}</Alert>}
    <div className="ui-card space-y-5 p-5 sm:p-6">
      <FormField id="obis-file" label="Archivo CSV de OBIS" required hint="Usa las nueve columnas originales de la hoja Datos; no se eliminan duplicados ni se inventan fechas."><Input ref={fileInput} id="obis-file" type="file" accept=".csv,text/csv" disabled={busy !== ''} onChange={(event) => void chooseFile(event)} aria-describedby="obis-file-hint" /></FormField>
      {preview && summary && <>
        <p className="font-semibold">Vista previa: {preview.name} · {preview.records.length} registros</p>
        <ul className="list-disc space-y-1 pl-5 text-sm text-muted"><li>{summary.duplicates} filas repetidas: se conservan y se señalan.</li><li>{summary.missingDates} sin fecha; {summary.partialDates} con fecha parcial.</li><li>{summary.invalidYears} años inválidos; se preserva el valor original.</li><li>{summary.missingLocalities} sin localidad.</li></ul>
        <div className="max-h-80 overflow-auto rounded-lg border border-border" tabIndex={0} role="region" aria-label="Vista previa de los registros OBIS">
          <table className="w-full text-left text-sm"><caption className="sr-only">Registros del CSV antes de importar</caption><thead><tr>{['Fila', 'Nombre científico', 'Fecha original', 'Localidad'].map((label) => <th key={label} scope="col" className="p-3 font-semibold">{label}</th>)}</tr></thead><tbody>{preview.records.map((record, index) => <tr key={index} className="border-t border-border"><td className="p-3">{index + 1}</td><td className="p-3">{record['Scientific Name']}</td><td className="p-3">{record['Event Date'] || 'Sin fecha'}</td><td className="p-3">{record.locality || 'No indicada'}</td></tr>)}</tbody></table>
        </div>
        <Button disabled={busy !== '' || resource.loading || Boolean(resource.error)} loading={busy === 'import'} onClick={() => void importFile()}>Importar {preview.records.length} registros como pendientes</Button>
      </>}
    </div>
    <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="text-lg font-semibold">Historial de lotes</h3><Button variant="secondary" disabled={busy !== '' || resource.loading} onClick={resource.refresh}>Actualizar lotes</Button></div>
    {resource.loading && <ListSkeleton label="Cargando lotes…" />}
    {resource.error && <Alert kind="error">{resource.error}</Alert>}
    {resource.data?.length === 0 && <p className="text-muted">Aún no hay lotes importados.</p>}
    <ul className="grid gap-4">{resource.data?.map((batch) => <li key={batch.id} className="ui-card space-y-3 p-5"><div className="flex flex-wrap items-start justify-between gap-4"><div><h4 className="font-semibold">{batch.file_name}</h4><p className="mt-1 text-sm text-muted">OBIS · {batch.row_count} registros · {new Date(batch.created_at).toLocaleDateString('es-PR')}</p><p className="mt-1 text-sm">Estado: {batch.status === 'withdrawn' ? 'Retirado' : 'Importado para revisión'}</p></div><Button variant={batch.status === 'withdrawn' ? 'secondary' : 'danger'} loading={busy === batch.id} disabled={busy !== ''} onClick={() => void toggleBatch(batch)}>{batch.status === 'withdrawn' ? 'Restaurar lote' : 'Retirar lote completo'}</Button></div><p className="text-sm text-muted">{batch.duplicate_count} posibles duplicados · {batch.quality_summary.missing_dates ?? 0} sin fecha · {batch.quality_summary.partial_dates ?? 0} fechas parciales.</p><p className="break-all text-xs text-muted">Identificador del lote: {batch.id}</p></li>)}</ul>
    {resource.data?.length === 100 && <p className="text-sm text-muted">Se muestran los últimos 100 lotes.</p>}
  </section>
}
