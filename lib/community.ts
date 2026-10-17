import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'

export type Publication = {
  id: string; author_id: string; title: string; summary: string; content: string
  references_text: string; status: 'draft' | 'published'; created_at: string; updated_at: string
}
export type SpeciesGuide = { id: string; name: string; scientific_name: string; description: string; habitat: string; source_url: string }
export const publicationSchema = z.object({
  title: z.string().trim().min(3).max(180), summary: z.string().trim().min(10).max(500),
  content: z.string().trim().min(20).max(30000), references_text: z.string().trim().max(4000),
  status: z.enum(['draft', 'published']),
})
export const speciesSchema = z.object({
  name: z.string().trim().min(3).max(120), scientific_name: z.string().trim().max(160),
  description: z.string().trim().min(20).max(10000), habitat: z.string().trim().max(1000),
  source_url: z.union([z.literal(''), z.url().refine((url) => new URL(url).protocol === 'https:')]),
})

export async function loadPublications(client: SupabaseClient, page: number, authorId?: string, manageAll = false) {
  let query = client.from('publications').select('*', { count: 'exact' })
  if (authorId) query = query.eq('author_id', authorId)
  else if (!manageAll) query = query.eq('status', 'published')
  const { data, error, count } = await query.order('created_at', { ascending: false }).order('id', { ascending: false }).range((page - 1) * 6, page * 6 - 1).returns<Publication[]>()
  if (error) throw new Error('No se pudieron cargar las publicaciones. Inténtalo de nuevo.')
  return { rows: data ?? [], total: count ?? 0 }
}

export async function savePublication(client: SupabaseClient, input: unknown, authorId: string, id?: string) {
  const parsed = publicationSchema.safeParse(input)
  if (!parsed.success) throw new Error('Revisa la publicación: título (3–180), resumen (10–500), contenido (20–30 000) y referencias (hasta 4000 caracteres).')
  const query = id ? client.from('publications').update({ ...parsed.data, updated_at: new Date().toISOString() }).eq('id', id) : client.from('publications').insert({ ...parsed.data, author_id: authorId })
  const { data, error } = await query.select('id').maybeSingle()
  if (error || !data) throw new Error('No se pudo guardar la publicación. Comprueba tus permisos y vuelve a intentarlo.')
}

export async function loadSpecies(client: SupabaseClient, page: number) {
  const { data, error, count } = await client.from('species_guides').select('*', { count: 'exact' }).order('name').order('id').range((page - 1) * 100, page * 100 - 1).returns<SpeciesGuide[]>()
  if (error) throw new Error('No se pudo cargar el catálogo de especies.')
  return { rows: data ?? [], total: count ?? 0 }
}

export async function saveSpecies(client: SupabaseClient, input: unknown, id?: string) {
  const parsed = speciesSchema.safeParse(input)
  if (!parsed.success) throw new Error('Revisa los campos y utiliza una dirección HTTPS válida para la fuente.')
  const query = id ? client.from('species_guides').update({ ...parsed.data, updated_at: new Date().toISOString() }).eq('id', id) : client.from('species_guides').insert(parsed.data)
  const { data, error } = await query.select('id').maybeSingle()
  if (error || !data) throw new Error('No se pudo guardar la ficha. Comprueba que el nombre no esté repetido y que tengas permiso.')
}
