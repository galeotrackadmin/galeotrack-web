'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { supabase } from '@/lib/supabase-client'
import { createSighting, updateSighting } from '@/lib/sightings/create-sighting'
import { REPORT_DEFAULTS, sightingSchema, SPECIES, SEXES, BEHAVIORS, HEALTH_CONDITIONS, MEASUREMENTS, type SightingFormData, type SightingFormInput } from '@/lib/sightings/schema'
import type { EvidenceFiles } from '@/lib/sightings/media'
import { EvidenceInput } from '@/components/sightings/evidence-input'
import { Button } from '@/components/ui/button'
import { Alert } from '@/components/ui/alert'
import { Card } from '@/components/ui/card'
import { FormField, Input, Select, Textarea, fieldDescription } from '@/components/ui/form-field'
import { Icon } from '@/components/icons'
import { LocationPicker } from './location-picker'
import { canReport, getProfile, homeForRole } from '@/lib/access'
import { metersToFeet } from '@/lib/sightings/schema'
import type { Observation } from '@/lib/types'

export function ReportForm() {
  const router = useRouter()
  const [result, setResult] = useState<{ kind: 'error' | 'success'; message: string } | null>(null)
  const [invalid, setInvalid] = useState(false)
  const [progress, setProgress] = useState('')
  const [files, setFiles] = useState<EvidenceFiles>({})
  const [resetKey, setResetKey] = useState(0)
  const [editId, setEditId] = useState<string | null>(null)
  const [loadingEdit, setLoadingEdit] = useState(false)
  const [editReady, setEditReady] = useState(false)
  const sending = useRef(false)
  const submissionId = useRef<string | null>(null)
  const { register, handleSubmit, reset, control, setValue, trigger, formState: { errors, isSubmitting } } = useForm<SightingFormInput, unknown, SightingFormData>({
    resolver: zodResolver(sightingSchema), defaultValues: REPORT_DEFAULTS, mode: 'onBlur', reValidateMode: 'onChange',
  })
  const [species, behavior, health = [], consent, quantity] = useWatch({ control, name: ['species', 'behavior', 'health_conditions', 'contact_consent', 'quantity'] })

  useEffect(() => {
    let active = true
    const id = new URLSearchParams(window.location.search).get('edit')
    if (!id) return
    void Promise.resolve().then(async () => {
      if (!active) return
      setEditId(id); setLoadingEdit(true)
      try {
        const profile = await getProfile(supabase)
        if (!canReport(profile.role)) throw new Error('Tu perfil solo puede consultar avistamientos.')
        const { data, error } = await supabase.from('sightings').select('*').eq('id', id).is('deleted_at', null).maybeSingle<Observation>()
        if (error || !data || (profile.role !== 'admin' && data.reporter_id !== profile.id)) throw new Error('No tienes permiso para editar este avistamiento o ya no está disponible.')
        if (data.import_batch_id) throw new Error('Este registro histórico conserva sus datos originales. Si hay errores, administración puede retirar su lote desde Gestionar comunidad.')
        if (!active) return
        reset({
          ...REPORT_DEFAULTS, species: data.species ?? '', species_other: data.species_other ?? '',
          location_name: data.location_name ?? '', sighting_date: data.sighting_date?.slice(0, 10) ?? '', sighting_time: data.sighting_time?.slice(0, 5) ?? '', quantity: data.quantity ?? 1,
          total_length_ft: data.total_length_m == null ? '' : metersToFeet(data.total_length_m), fork_length_ft: data.fork_length_m == null ? '' : metersToFeet(data.fork_length_m),
          standard_length_ft: data.standard_length_m == null ? '' : metersToFeet(data.standard_length_m), interdorsal_length_ft: data.interdorsal_length_m == null ? '' : metersToFeet(data.interdorsal_length_m),
          sex: data.sex ?? 'No determinado', behavior: data.behavior ?? '', behavior_other: data.behavior_other ?? '', health_conditions: (data.health_conditions ?? []) as SightingFormInput['health_conditions'], health_other: data.health_other ?? '',
          notes: data.notes ?? '', latitude: data.latitude ?? '', longitude: data.longitude ?? '', altitude: data.altitude ?? '', accuracy: data.accuracy ?? '',
        })
        setEditReady(true)
      } catch (error) {
        if (active) setResult({ kind: 'error', message: error instanceof Error ? error.message : 'No se pudo cargar el avistamiento.' })
      } finally { if (active) setLoadingEdit(false) }
    })
    return () => { active = false }
  }, [reset])

  async function submit(data: SightingFormData) {
    if (sending.current) return
    sending.current = true; setResult(null); setInvalid(false)
    submissionId.current ??= crypto.randomUUID()
    try {
      if (editId) {
        await updateSighting(supabase, editId, data, files, setProgress)
        const profile = await getProfile(supabase)
        router.replace(homeForRole(profile.role))
      } else {
        await createSighting(supabase, data, files, submissionId.current, setProgress)
        reset(REPORT_DEFAULTS); setFiles({}); setResetKey((key) => key + 1); submissionId.current = null
        setResult({ kind: 'success', message: '¡Gracias por contribuir! Tu avistamiento fue enviado y está pendiente de verificación. Puedes registrar otro cuando quieras.' })
      }
    } catch (error) {
      setResult({ kind: 'error', message: error instanceof Error ? error.message : 'No se pudo enviar. Tus datos siguen aquí; inténtalo de nuevo.' })
    } finally { sending.current = false; setProgress('') }
  }
  function fieldProps(name: keyof SightingFormInput, hint?: string) {
    return { id: name, 'aria-invalid': !!errors[name], 'aria-describedby': fieldDescription(name, errors[name]?.message, hint) }
  }
  function choices(name: 'sex' | 'behavior' | 'contact_consent', label: string, options: readonly string[], hint?: string) {
    return <fieldset className="space-y-3" aria-invalid={!!errors[name]} aria-describedby={fieldDescription(name, errors[name]?.message, hint)}>
      <legend className="mb-2 font-semibold">{label} <span className="text-primary" aria-hidden="true">*</span></legend>
      {hint && <p id={`${name}-hint`} className="text-sm text-muted">{hint}</p>}
      <div className="report-choices">{options.map((value) => <label className="report-choice" key={value}><input type="radio" {...register(name)} value={value} /><span>{value === 'yes' ? 'Sí' : value === 'no' ? 'No' : value}</span></label>)}</div>
      {errors[name] && <p id={`${name}-error`} className="text-sm text-danger">{errors[name]?.message}</p>}
    </fieldset>
  }
  const sectionTitle = (number: string, title: string) => <legend className="mb-6 flex items-center gap-3 text-lg font-semibold"><span className="section-number" aria-hidden="true">{number}</span>{title}</legend>

  if (loadingEdit) return <p role="status" className="ui-card p-8 text-muted">Cargando avistamiento para editar…</p>
  if (editId && !editReady) return <div className="space-y-4"><Alert kind="error">{result?.message ?? 'No se pudo cargar el avistamiento.'}</Alert><Button variant="secondary" onClick={() => router.back()}>Volver</Button></div>
  return <form noValidate onSubmit={(event) => { void handleSubmit(submit, () => { setInvalid(true); setResult(null) })(event) }} className="space-y-6" aria-busy={isSubmitting}>
    <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted"><span className="inline-flex items-center gap-2"><Icon name="waves" />{editId ? 'Edita los detalles de tu avistamiento' : 'Tu reporte quedará vinculado a tu cuenta'}</span><span>* Campos obligatorios</span></div>
    <Card className="p-5 sm:p-8"><fieldset disabled={isSubmitting}>{sectionTitle('01', 'Momento del encuentro')}
      <div className="space-y-6">
        <p className="text-sm text-muted">{editId ? 'El perfil registrado del colaborador se conservará sin cambios.' : 'El rol del colaborador se obtiene automáticamente de tu cuenta al guardar el avistamiento.'}</p>
        <div className="grid gap-6 sm:grid-cols-2">
          <FormField id="sighting_date" label="Fecha del avistamiento" required error={errors.sighting_date?.message}><Input {...register('sighting_date')} {...fieldProps('sighting_date')} type="date" required /></FormField>
          <FormField id="sighting_time" label="Hora del avistamiento" required error={errors.sighting_time?.message} hint="Hora local de Puerto Rico (UTC−04:00)."><Input {...register('sighting_time')} {...fieldProps('sighting_time', 'Hora local de Puerto Rico (UTC−04:00).')} type="time" required /></FormField>
        </div>
      </div>
    </fieldset></Card>
    <Card className="p-5 sm:p-8"><fieldset disabled={isSubmitting}>{sectionTitle('02', 'Ubicación GPS del avistamiento')}
      <LocationPicker control={control} register={register} setValue={setValue} trigger={trigger} errors={errors} disabled={isSubmitting} />
      <div className="mt-6"><FormField id="location_name" label="Nombre de la ubicación" required error={errors.location_name?.message} hint="Playa, municipio o punto de referencia."><Input {...register('location_name')} {...fieldProps('location_name', 'Playa, municipio o punto de referencia.')} placeholder="Ej. Rincón, Puerto Rico" maxLength={200} required /></FormField></div>
    </fieldset></Card>
    <Card className="p-5 sm:p-8"><fieldset disabled={isSubmitting}>{sectionTitle('03', 'Especie e individuos')}
      <div className="space-y-6">
        <FormField id="species" label="Especie de tiburón observada" required error={errors.species?.message}><Select {...register('species')} {...fieldProps('species')} required><option value="">Selecciona una especie</option>{SPECIES.map((value) => <option key={value}>{value}</option>)}</Select></FormField>
        {species === 'Otro' && <FormField id="species_other" label="Otra especie observada" required error={errors.species_other?.message}><Input {...register('species_other')} {...fieldProps('species_other')} maxLength={200} /></FormField>}
        <FormField id="quantity" label="Cantidad de individuos" required hint="Escribe la cantidad de tiburones observados." error={errors.quantity?.message}><Input {...register('quantity')} {...fieldProps('quantity', 'Escribe la cantidad de tiburones observados.')} type="number" inputMode="numeric" min={1} step={1} required /></FormField>
      </div>
    </fieldset></Card>
    <Card className="p-5 sm:p-8"><fieldset disabled={isSubmitting}>{sectionTitle('04', 'Medidas morfométricas y sexo')}
      <p className="mb-6 text-sm text-muted">{Number(quantity) > 1 ? 'Registra las medidas y el sexo de un solo ejemplar de referencia del grupo. ' : ''}Las longitudes se expresan en pies (ft), admiten decimales y son opcionales. Deja vacías las que no conozcas.</p>
      <div className="mb-6 grid gap-6 sm:grid-cols-2">{MEASUREMENTS.map(({ name, label }) => <FormField key={name} id={name} label={`${label} (pies)`} error={errors[name]?.message}><Input {...register(name)} {...fieldProps(name)} type="number" inputMode="decimal" min="0.01" max="100" step="any" placeholder="Ej. 6.5" /></FormField>)}</div>
      {choices('sex', 'Sexo del tiburón', SEXES)}
    </fieldset></Card>
    <Card className="p-5 sm:p-8"><fieldset disabled={isSubmitting}>{sectionTitle('05', 'Comportamiento y salud visible')}
      <div className="space-y-6">
        {choices('behavior', 'Comportamiento observado', BEHAVIORS)}
        {behavior === 'Otro' && <FormField id="behavior_other" label="Describe el comportamiento" required error={errors.behavior_other?.message}><Textarea {...register('behavior_other')} {...fieldProps('behavior_other')} maxLength={1000} rows={3} /></FormField>}
        <fieldset aria-describedby={fieldDescription('health_conditions', errors.health_conditions?.message, 'Selecciona las condiciones observadas.')}><legend className="mb-3 font-semibold">Condición de salud visible *</legend>
          <p id="health_conditions-hint" className="mb-3 text-sm text-muted">Puedes indicar varias condiciones. «Sano» y «Desconocido» se eligen sin otras opciones. Ectoparásitos: piojos de mar, rémoras, nematodos, hongos u otros organismos visibles.</p>
          <div className="report-choices">{HEALTH_CONDITIONS.map((value) => <label className="report-choice" key={value}><input type="checkbox" {...register('health_conditions')} value={value} aria-invalid={!!errors.health_conditions} /><span>{value === 'Otro' ? 'Otro (describe lo que observas)' : value}</span></label>)}</div>
          {errors.health_conditions && <p id="health_conditions-error" className="mt-2 text-sm text-danger">{errors.health_conditions.message}</p>}
        </fieldset>
        {health.includes('Otro') && <FormField id="health_other" label="Describe la condición de salud" required error={errors.health_other?.message}><Textarea {...register('health_other')} {...fieldProps('health_other')} maxLength={1000} rows={3} /></FormField>}
        <FormField id="notes" label="Notas adicionales" error={errors.notes?.message}><Textarea {...register('notes')} {...fieldProps('notes')} rows={3} maxLength={3000} /></FormField>
      </div>
    </fieldset></Card>
    <Card className="p-5 sm:p-8"><fieldset disabled={isSubmitting}>{sectionTitle('06', 'Evidencia del encuentro')}{editId && <p className="mb-4 text-sm text-muted">La evidencia actual se conservará. Si adjuntas una nueva, reemplazará la correspondiente al guardar.</p>}<div className="space-y-8">
      {(['photo', 'video'] as const).map((kind) => <EvidenceInput key={`${resetKey}-${kind}`} kind={kind} disabled={isSubmitting} onChange={(file) => setFiles((current) => ({ ...current, [kind]: file }))} />)}
    </div></fieldset></Card>
    <Card className="p-5 sm:p-8"><fieldset disabled={isSubmitting || !!editId}>{sectionTitle('07', 'Contacto para seguimiento')}{editId && <p className="mb-4 text-sm text-muted">Los datos de contacto asociados se conservarán sin cambios durante la edición.</p>}
      {choices('contact_consent', '¿Deseas incluir tus datos de contacto para validación o seguimiento?', ['yes', 'no'], 'Solo se utilizarán para fines de verificación del equipo de investigación.')}
      {consent === 'yes' && <div className="mt-6 space-y-5">
        <FormField id="contact_name" label="Nombre de contacto" required error={errors.contact_name?.message}><Input {...register('contact_name')} {...fieldProps('contact_name')} autoComplete="name" maxLength={120} /></FormField>
        <FormField id="contact_email" label="Correo de contacto" required error={errors.contact_email?.message}><Input {...register('contact_email')} {...fieldProps('contact_email')} type="email" autoComplete="email" maxLength={254} /></FormField>
        <FormField id="contact_phone" label="Teléfono de contacto" error={errors.contact_phone?.message}><Input {...register('contact_phone')} {...fieldProps('contact_phone')} type="tel" autoComplete="tel" maxLength={40} /></FormField>
      </div>}
    </fieldset></Card>
    {invalid && Object.keys(errors).length > 0 && <Alert kind="error">Revisa los campos indicados. Te llevamos al primero que necesita atención.</Alert>}
    {result && <Alert kind={result.kind}>{result.message}</Alert>}
    <div className="rounded-[20px] border border-info-border bg-soft p-5 sm:p-8"><p className="mb-5 text-sm text-muted">{editId ? 'Al editar un reporte, volverá a quedar pendiente de revisión.' : 'El equipo de GaleoTrack revisará tu reporte antes de verificarlo.'}</p><Button type="submit" disabled={isSubmitting || loadingEdit} loading={isSubmitting} className="w-full">{isSubmitting ? (editId ? 'Guardando cambios…' : 'Enviando avistamiento…') : <>{editId ? 'Guardar cambios' : 'Enviar avistamiento'}<Icon name="arrow" /></>}</Button>{progress && <p role="status" className="mt-3 text-center text-sm text-muted">{progress}</p>}</div>
  </form>
}
