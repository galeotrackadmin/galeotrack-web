import type { SupabaseClient } from '@supabase/supabase-js'
import { FEET_TO_METERS, MEASUREMENTS, sightingSchema } from './schema.ts'
import { canReport, getProfile } from '../access.ts'
import { EVIDENCE_BUCKET, evidencePath, validateEvidence, type EvidenceFiles, type EvidenceKind } from './media.ts'

function sightingPayload(data: ReturnType<typeof sightingSchema.parse>, media: Partial<Record<EvidenceKind, string>>, contact?: Record<string, string | null> | null) {
  return {
    species: data.species, species_other: data.species === 'Otro' ? data.species_other : null,
    location_name: data.location_name, sighting_date: data.sighting_date, sighting_time: data.sighting_time, quantity: data.quantity,
    ...Object.fromEntries(MEASUREMENTS.map(({ name, column }) => [column, data[name] === undefined ? null : Number((data[name] * FEET_TO_METERS).toFixed(6))])),
    sex: data.sex, behavior: data.behavior, behavior_other: data.behavior === 'Otro' ? data.behavior_other : null,
    health_conditions: data.health_conditions, health_other: data.health_conditions.includes('Otro') ? data.health_other : null,
    notes: data.notes || null, latitude: data.latitude, longitude: data.longitude, altitude: data.altitude ?? null, accuracy: data.accuracy ?? null,
    photo_path: media.photo ?? null, video_path: media.video ?? null,
    ...(contact !== undefined ? { contact: data.contact_consent === 'yes' ? contact : null } : {}),
  }
}

export async function updateSighting(client: SupabaseClient, reportId: string, input: unknown, files: EvidenceFiles = {}, onProgress?: (message: string) => void): Promise<void> {
  const data = sightingSchema.parse(input)
  for (const kind of ['photo', 'video'] as const) if (files[kind]) validateEvidence(files[kind], kind)
  const uploaded: string[] = []
  try {
    const profile = await getProfile(client)
    if (!canReport(profile.role)) throw new Error('Tu perfil solo puede consultar avistamientos.')
    const { data: current, error: currentError } = await client.from('sightings').select('reporter_id, photo_path, video_path').eq('id', reportId).single<{ reporter_id: string | null; photo_path: string | null; video_path: string | null }>()
    if (currentError || !current || (profile.role !== 'admin' && current.reporter_id !== profile.id)) throw new Error('No tienes permiso para editar este avistamiento.')
    const media: Partial<Record<EvidenceKind, string>> = { photo: current.photo_path ?? undefined, video: current.video_path ?? undefined }
    for (const kind of ['photo', 'video'] as const) {
      const file = files[kind]
      if (!file) continue
      onProgress?.(kind === 'photo' ? 'Subiendo fotografía…' : 'Subiendo video…')
      const path = await evidencePath(file, kind, profile.id, reportId)
      const { error } = await client.storage.from(EVIDENCE_BUCKET).upload(path, file, { upsert: false, contentType: file.type })
      if (error && !['409', 'Duplicate'].includes(String(error.statusCode ?? error.name))) throw error
      uploaded.push(path); media[kind] = path
    }
    onProgress?.('Guardando cambios…')
    const { data: updated, error } = await client.from('sightings').update({ ...sightingPayload(data, media), updated_at: new Date().toISOString() }).eq('id', reportId).select('id').maybeSingle<{ id: string }>()
    if (error || !updated) throw error ?? new Error('El avistamiento ya no existe o no se pudo editar.')
  } catch (error) {
    if (uploaded.length) await client.storage.from(EVIDENCE_BUCKET).remove(uploaded).catch(() => undefined)
    throw error instanceof Error && error.message.startsWith('No tienes permiso') ? error : new Error('No se pudieron guardar los cambios. Comprueba tus permisos y vuelve a intentarlo.')
  }
}

export async function createSighting(client: SupabaseClient, input: unknown, files: EvidenceFiles = {}, reportId = crypto.randomUUID(), onProgress?: (message: string) => void): Promise<void> {
  const data = sightingSchema.parse(input)
  for (const kind of ['photo', 'video'] as const) if (files[kind]) validateEvidence(files[kind], kind)
  const uploaded: string[] = []
  try {
    const profile = await getProfile(client)
    if (!canReport(profile.role)) throw new Error('No tienes permiso para reportar.')
    const media: Partial<Record<EvidenceKind, string>> = {}
    for (const kind of ['photo', 'video'] as const) {
      const file = files[kind]
      if (!file) continue
      onProgress?.(kind === 'photo' ? 'Subiendo fotografía…' : 'Subiendo video…')
      const path = await evidencePath(file, kind, profile.id, reportId)
      const { error } = await client.storage.from(EVIDENCE_BUCKET).upload(path, file, { upsert: false, contentType: file.type })
      // Las rutas incluyen el hash del contenido: un reintento puede reutilizarlas.
      if (error && !['409', 'Duplicate'].includes(String(error.statusCode ?? error.name))) throw error
      uploaded.push(path)
      media[kind] = path
    }
    const payload = sightingPayload(data, media, { name: data.contact_name, email: data.contact_email, phone: data.contact_phone || null })
    onProgress?.('Guardando avistamiento…')
    const { error } = await client.rpc('submit_sighting', { report_id: reportId, payload })
    if (error) throw error
  } catch (error) {
    // RLS impide borrar evidencia ya vinculada si se perdió la respuesta de éxito.
    if (uploaded.length) await client.storage.from(EVIDENCE_BUCKET).remove(uploaded).catch(() => undefined)
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P0002') throw new Error('Este envío ya fue guardado con otros datos. Consulta tus avistamientos antes de iniciar otro registro.')
    throw new Error('No se pudo enviar el avistamiento. Tus datos siguen aquí; revisa tu conexión e inténtalo de nuevo.')
  }
}
