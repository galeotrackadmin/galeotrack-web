import type { SupabaseClient } from '@supabase/supabase-js'

export type SocialProvider = 'google' | 'azure'

export async function getOAuthSignInUrl(
  client: SupabaseClient,
  provider: SocialProvider,
  origin: string,
): Promise<string> {
  const { data, error } = await client.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: new URL('/auth/callback', origin).href,
      // Microsoft requiere el scope email para crear la sesión en Supabase.
      scopes: provider === 'azure' ? 'email' : undefined,
      skipBrowserRedirect: true,
      queryParams: { prompt: 'select_account' },
    },
  })

  if (error || !data.url) {
    throw new Error('No se pudo conectar con el proveedor. Inténtalo de nuevo.')
  }

  // Conserva la asociación del verificador si se inicia otro acceso en otra pestaña.
  const authorizationUrl = new URL(data.url)
  if (data.flowId) {
    const callback = new URL('/auth/callback', origin)
    callback.searchParams.set('sb_flow_id', data.flowId)
    authorizationUrl.searchParams.set('redirect_to', callback.href)
  }
  return authorizationUrl.href
}

export async function completeOAuthSignIn(client: SupabaseClient, callbackUrl: string) {
  const url = new URL(callbackUrl)
  const fragment = new URLSearchParams(url.hash.slice(1))
  const providerError = url.searchParams.get('error') ?? fragment.get('error')

  if (providerError) {
    throw new Error(providerError === 'access_denied'
      ? 'El acceso fue cancelado o no fue autorizado. Puedes intentarlo de nuevo.'
      : 'El proveedor no pudo completar el acceso. Inténtalo de nuevo o utiliza tu correo y contraseña.')
  }

  const code = url.searchParams.get('code')
  if (!code) {
    throw new Error('Este enlace de acceso no es válido. Vuelve a iniciar sesión.')
  }

  const flowId = url.searchParams.get('sb_flow_id')
  const { data, error } = await client.auth.exchangeCodeForSession(
    code,
    flowId ? { flowId } : undefined,
  )
  if (error || !data.session) {
    throw new Error('El enlace ha caducado o no se pudo validar. Inicia sesión de nuevo desde este navegador.')
  }
}
