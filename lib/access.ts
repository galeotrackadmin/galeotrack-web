import type { SupabaseClient } from '@supabase/supabase-js'

export type UserRole = 'student' | 'researcher' | 'community' | 'admin' | 'pending_scientist' | 'unassigned'
export type Mode = 'student' | 'researcher' | 'community' | 'admin'
export type Profile = {
  id: string
  email: string
  fullName: string
  role: UserRole
  scienceStatus: 'pending' | 'approved' | 'rejected' | null
  requestNote?: string | null
}

export const ROLE_LABELS: Record<UserRole, string> = {
  student: 'Estudiante', researcher: 'Científico', community: 'Pescador Buzo',
  admin: 'Administrador', pending_scientist: 'Científico pendiente', unassigned: 'Sin perfil',
}

export function homeForRole(role: UserRole): string {
  return { student: '/estudiante', researcher: '/cientifico', community: '/comunidad', admin: '/admin', pending_scientist: '/solicitud', unassigned: '/completar-perfil' }[role]
}

export function canAccess(role: UserRole, mode: Mode): boolean {
  return role === 'admin' || role === mode
}

export function canReport(role: UserRole): boolean {
  return ['community', 'researcher', 'admin'].includes(role)
}

export class SessionRequiredError extends Error {}

export async function getProfile(client: SupabaseClient): Promise<Profile> {
  const { data: { user }, error } = await client.auth.getUser()
  if (error || !user) throw new SessionRequiredError('Inicia sesión para continuar.')
  const { data, error: profileError } = await client.from('profiles')
    .select('role, full_name, science_status, request_note').eq('id', user.id).maybeSingle()
  if (profileError) throw new Error('No se pudo cargar tu perfil. Comprueba la conexión y la configuración de la base de datos.')
  if (!data) return { id: user.id, email: user.email ?? '', fullName: '', role: 'unassigned', scienceStatus: null }
  if (!Object.hasOwn(ROLE_LABELS, data.role)) throw new Error('Tu cuenta no tiene acceso al panel: su perfil no es compatible. Contacta al administrador.')
  return { id: user.id, email: user.email ?? '', fullName: data.full_name ?? '', role: data.role, scienceStatus: data.science_status ?? null, requestNote: data.request_note }
}
