'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { MEDIA_TYPES, validateEvidence, type EvidenceKind } from '@/lib/sightings/media'

export function EvidenceInput({ kind, disabled, onChange }: { kind: EvidenceKind; disabled: boolean; onChange: (file?: File) => void }) {
  const [selection, setSelection] = useState<{ file: File; url: string } | null>(null)
  const [error, setError] = useState('')
  const [inputKey, setInputKey] = useState(0)
  useEffect(() => () => { if (selection) URL.revokeObjectURL(selection.url) }, [selection])
  const id = `evidence-${kind}`
  return <div className="space-y-3">
    <label className="block font-semibold" htmlFor={id}>{kind === 'photo' ? 'Evidencia fotográfica' : 'Video del ejemplar o comportamiento'} <span className="text-sm font-normal text-muted">Opcional</span></label>
    <p id={`${id}-hint`} className="text-sm text-muted">{kind === 'photo' ? 'Adjunta una foto clara del tiburón: hocico, cuerpo completo o condición de salud. JPG, PNG o WebP.' : 'Adjunta un video corto del nado, liberación o interacción. MP4, WebM o MOV.'}</p>
    <input key={inputKey} id={id} type="file" accept={Object.keys(MEDIA_TYPES[kind]).join(',')} disabled={disabled} aria-invalid={!!error} aria-describedby={`${id}-hint${error ? ` ${id}-error` : ''}`} className="field-control evidence-input" onChange={(event) => {
      const file = event.target.files?.[0]
      if (!file) return
      try {
        validateEvidence(file, kind)
        setSelection({ file, url: URL.createObjectURL(file) }); onChange(file); setError('')
      } catch (error) {
        setError(error instanceof Error ? error.message : 'No se pudo abrir el archivo.')
        event.target.value = ''
      }
    }} />
    {error && <p id={`${id}-error`} className="text-sm text-danger" role="alert">{error}</p>}
    {selection && <div className="rounded-xl border border-border bg-background p-4">
      {kind === 'photo' ? <Image unoptimized src={selection.url} width={640} height={360} alt="Vista previa de la fotografía seleccionada" className="max-h-64 w-full rounded-lg object-contain" /> : <video src={selection.url} controls preload="metadata" aria-label="Vista previa del video seleccionado" className="max-h-64 w-full rounded-lg" />}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3"><p className="min-w-0 break-all text-sm text-muted">{selection.file.name} · {(selection.file.size / 1024 / 1024).toFixed(1)} MB</p><Button variant="secondary" disabled={disabled} onClick={() => { setSelection(null); onChange(undefined); setError(''); setInputKey((key) => key + 1) }}>Quitar {kind === 'photo' ? 'foto' : 'video'}</Button></div>
    </div>}
  </div>
}
