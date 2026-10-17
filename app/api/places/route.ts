import { createClient } from '@supabase/supabase-js'

type Place = { name: string; latitude: number; longitude: number }
const cache = new Map<string, { expires: number; places: Place[] }>()

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get('q')?.trim() ?? ''
  if (query.length < 3 || query.length > 200) return Response.json({ message: 'Escribe entre 3 y 200 caracteres.' }, { status: 400 })
  const authorization = request.headers.get('authorization')
  if (!authorization?.startsWith('Bearer ')) return Response.json({ message: 'Inicia sesión para buscar lugares.' }, { status: 401 })
  const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }, global: { headers: { Authorization: authorization } },
  })
  const { data: { user }, error } = await client.auth.getUser(authorization.slice(7))
  if (error || !user) return Response.json({ message: 'Tu sesión terminó. Vuelve a iniciar sesión.' }, { status: 401 })
  const { data: profile } = await client.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (!profile || !['community', 'researcher', 'admin'].includes(profile.role)) return Response.json({ message: 'No tienes acceso al registro.' }, { status: 403 })
  const key = query.toLocaleLowerCase('es')
  const cached = cache.get(key)
  if (cached && cached.expires > Date.now()) return Response.json({ places: cached.places })
  const { data: allowed, error: throttleError } = await client.rpc('claim_geocoding_request')
  if (throttleError) return Response.json({ message: 'La búsqueda no está disponible. Puedes seleccionar el punto en el mapa.' }, { status: 503 })
  if (!allowed) return Response.json({ message: 'Espera un momento y vuelve a buscar.' }, { status: 429, headers: { 'Retry-After': '2' } })
  try {
    const url = new URL(process.env.GEOCODING_SEARCH_URL ?? 'https://nominatim.openstreetmap.org/search')
    url.searchParams.set('q', query); url.searchParams.set('format', 'jsonv2'); url.searchParams.set('limit', '5')
    url.searchParams.set('viewbox', '-68.5,19,-65,17.5'); url.searchParams.set('bounded', '0')
    const response = await fetch(url, { headers: { 'User-Agent': 'GaleoTrack/1.0 (marine-sighting-reports)', 'Accept-Language': 'es' }, signal: AbortSignal.timeout(8000), cache: 'no-store' })
    if (!response.ok) throw new Error('Geocoder unavailable')
    const rows: unknown = await response.json()
    if (!Array.isArray(rows)) throw new Error('Invalid geocoder response')
    const places: Place[] = rows.flatMap((row) => {
      if (!row || typeof row.display_name !== 'string' || typeof row.lat !== 'string' || typeof row.lon !== 'string') return []
      const latitude = Number(row.lat); const longitude = Number(row.lon)
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return []
      return [{ name: row.display_name.slice(0, 200), latitude, longitude }]
    }).slice(0, 5)
    if (cache.size >= 100) cache.delete(cache.keys().next().value!)
    cache.set(key, { expires: Date.now() + 86400000, places })
    return Response.json({ places })
  } catch {
    return Response.json({ message: 'No se pudo buscar el lugar. Puedes tocar el mapa o introducir las coordenadas.' }, { status: 502 })
  }
}
