import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.117.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function response(body: Record<string, string>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return response({ error: 'Método no permitido.' }, 405)

  const authorization = request.headers.get('Authorization') ?? ''
  const token = authorization.replace(/^Bearer\s+/i, '')
  if (!token || token === authorization) return response({ error: 'Inicia sesión nuevamente para continuar.' }, 401)

  let confirmation: string
  try {
    const body = await request.json()
    confirmation = body?.confirmation
  } catch {
    return response({ error: 'Solicitud no válida.' }, 400)
  }
  if (confirmation !== 'ELIMINAR') return response({ error: 'Escribe ELIMINAR para confirmar.' }, 400)

  const url = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !anonKey || !serviceKey) return response({ error: 'La eliminación de cuentas no está configurada en el servidor.' }, 503)

  const authClient = createClient(url, anonKey, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false } })
  const { data: { user }, error: authError } = await authClient.auth.getUser(token)
  if (authError || !user) return response({ error: 'La sesión no es válida. Inicia sesión nuevamente.' }, 401)

  try {
    const payloadPart = token.split('.')[1]
    const claims = JSON.parse(atob(payloadPart.replace(/-/g, '+').replace(/_/g, '/')))
    const authTime = Number(claims.auth_time)
    if (!Number.isFinite(authTime) || authTime > Date.now() / 1000 + 30 || Date.now() / 1000 - authTime > 600) {
      return response({ error: 'Por seguridad, cierra sesión e inicia sesión nuevamente antes de eliminar tu cuenta.' }, 403)
    }
  } catch {
    return response({ error: 'No se pudo verificar la antigüedad de la sesión. Inicia sesión nuevamente.' }, 403)
  }

  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
  const { error: prepareError } = await admin.rpc('prepare_account_deletion', { target_user_id: user.id })
  if (prepareError) {
    const isAdmin = prepareError.message.includes('administradora')
    return response({ error: isAdmin ? prepareError.message : 'No se pudo anonimizar la cuenta. Tus datos siguen intactos.' }, isAdmin ? 403 : 500)
  }

  // Los archivos privados están bajo uid/report-id/filename; solo se borra el prefijo del usuario autenticado.
  const reportFolders: { name: string; id: string | null }[] = []
  for (let offset = 0; ; offset += 1000) {
    const { data: objects, error: objectQueryError } = await admin.storage.from('sighting-evidence')
      .list(user.id, { limit: 1000, offset })
    if (objectQueryError) return response({ error: 'La cuenta fue anonimizada, pero no se pudo limpiar toda su evidencia. Contacta con soporte.' }, 500)
    reportFolders.push(...(objects ?? []).filter((object) => !object.id && !object.name.startsWith('.')))
    if (!objects || objects.length < 1000) break
  }
  const paths: string[] = []
  for (const folder of reportFolders) {
    for (let offset = 0; ; offset += 1000) {
      const { data: files, error: filesError } = await admin.storage.from('sighting-evidence')
        .list(`${user.id}/${folder.name}`, { limit: 1000, offset })
      if (filesError) return response({ error: 'La cuenta fue anonimizada, pero no se pudo limpiar toda su evidencia. Contacta con soporte.' }, 500)
      for (const file of files ?? []) if (file.id) paths.push(`${user.id}/${folder.name}/${file.name}`)
      if (!files || files.length < 1000) break
    }
  }
  for (let index = 0; index < paths.length; index += 100) {
    const { error: removeError } = await admin.storage.from('sighting-evidence').remove(paths.slice(index, index + 100))
    if (removeError) return response({ error: 'La cuenta fue anonimizada, pero no se pudo limpiar toda su evidencia. Contacta con soporte.' }, 500)
  }

  const { error: deleteError } = await admin.auth.admin.deleteUser(user.id)
  if (deleteError) return response({ error: 'Tus datos ya fueron anonimizados, pero no se pudo cerrar la cuenta. Contacta con soporte para completar la eliminación.' }, 500)
  return response({ message: 'Cuenta eliminada. Los avistamientos se conservaron de forma anonimizada.' })
})
