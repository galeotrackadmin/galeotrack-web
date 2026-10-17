'use client'

import { useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase-client'
import { getProfile, homeForRole } from '@/lib/access'
import { getOAuthSignInUrl, type SocialProvider } from '@/lib/auth'
import { Icon as AuthIcon, GoogleIcon, MicrosoftIcon } from '@/components/icons'
import { Button } from '@/components/ui/button'
import { FormField, Input } from '@/components/ui/form-field'
import { Alert } from '@/components/ui/alert'

export function LoginForm() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [pending, setPending] = useState<'password' | 'recovery' | SocialProvider | null>(null)
  const [recoveryNotice, setRecoveryNotice] = useState('')
  const submitting = useRef(false)
  const loading = pending !== null

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting.current) return
    submitting.current = true
    setError('')
    setRecoveryNotice('')
    setPending('password')

    try {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
      if (error) {
        setError(error.code === 'invalid_credentials'
          ? 'Correo o contraseña incorrectos. Revisa tus datos e inténtalo de nuevo.'
          : error.code === 'email_not_confirmed'
            ? 'Confirma tu correo electrónico desde el enlace que te enviamos antes de iniciar sesión.'
            : error.code === 'too_many_requests'
              ? 'Hubo demasiados intentos. Espera unos minutos antes de volver a intentarlo.'
              : 'No se pudo iniciar sesión. Comprueba tu conexión e inténtalo de nuevo.')
        return
      }
      const profile = await getProfile(supabase)
      router.replace(homeForRole(profile.role))
    } catch (error) {
      setError(error instanceof Error && error.message.includes('no tiene acceso al panel')
        ? 'Tu perfil no tiene acceso al panel. Contacta al administrador para revisar tu cuenta.'
        : 'La sesión se inició, pero no se pudo cargar tu perfil. Comprueba tu conexión e inténtalo de nuevo; el correo se conservará.')
    } finally {
      submitting.current = false
      setPending(null)
    }
  }

  async function handlePasswordRecovery() {
    if (submitting.current) return
    if (!email.trim()) {
      setError('Escribe tu correo electrónico para enviarte el enlace de recuperación.')
      document.getElementById('email')?.focus()
      return
    }
    if (!(document.getElementById('email') as HTMLInputElement | null)?.checkValidity()) {
      setError('Revisa el formato de tu correo electrónico e inténtalo de nuevo.')
      document.getElementById('email')?.focus()
      return
    }
    submitting.current = true
    setError('')
    setRecoveryNotice('')
    setPending('recovery')
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/update-password` })
      if (error) throw error
      setRecoveryNotice('Si existe una cuenta asociada a ese correo, recibirás un enlace para crear una contraseña nueva. Revisa también la carpeta de correo no deseado.')
    } catch {
      setError('No se pudo enviar el enlace. Comprueba tu conexión e inténtalo de nuevo en unos minutos.')
    } finally {
      submitting.current = false
      setPending(null)
    }
  }

  async function handleSocialLogin(provider: SocialProvider) {
    if (submitting.current) return
    submitting.current = true
    setError('')
    setPending(provider)
    try {
      const url = await getOAuthSignInUrl(supabase, provider, window.location.origin)
      window.location.assign(url)
    } catch {
      setError('No se pudo conectar con el proveedor. Comprueba tu conexión o utiliza tu correo y contraseña.')
      submitting.current = false
      setPending(null)
    }
  }

  return (
    <>
      <div className="auth-providers" aria-label="Acceso con una cuenta externa" aria-busy={pending === 'google' || pending === 'azure'}>
        <Button variant="secondary" className="w-full" disabled={loading} loading={pending === 'google'} onClick={() => void handleSocialLogin('google')}>
          {pending !== 'google' && <GoogleIcon />}
          {pending === 'google' ? 'Conectando con Google…' : 'Continuar con Google'}
        </Button>
        <Button variant="secondary" className="w-full" disabled={loading} loading={pending === 'azure'} onClick={() => void handleSocialLogin('azure')}>
          {pending !== 'azure' && <MicrosoftIcon />}
          {pending === 'azure' ? 'Conectando con Microsoft…' : 'Continuar con Microsoft'}
        </Button>
      </div>

      <div className="auth-divider"><span>o con tu correo electrónico</span></div>

      <form onSubmit={handleLogin} className="auth-form" aria-busy={pending === 'password'} aria-describedby={error ? 'login-error' : undefined}>
        <FormField id="email" label="Correo electrónico" required showRequiredIndicator={false}>
          <div className="auth-input-wrap">
            <AuthIcon name="mail" />
            <Input id="email" name="email" type="email" autoComplete="username" autoCapitalize="none" spellCheck={false} value={email} onChange={(event) => setEmail(event.target.value)} required disabled={loading} placeholder="tu@organizacion.org" />
          </div>
        </FormField>
        <FormField id="password" label="Contraseña" required showRequiredIndicator={false}>
          <div className="auth-input-wrap">
            <AuthIcon name="lock" />
            <Input id="password" name="password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required disabled={loading} placeholder="Introduce tu contraseña" />
            <button className="auth-password-toggle" type="button" onClick={() => setShowPassword((visible) => !visible)} disabled={loading} aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'} aria-pressed={showPassword} aria-controls="password"><AuthIcon name={showPassword ? 'eye-off' : 'eye'} /></button>
          </div>
        </FormField>

        <button type="button" className="auth-recovery-link" onClick={() => void handlePasswordRecovery()} disabled={loading}>
          {pending === 'recovery' ? 'Enviando enlace…' : '¿Olvidaste tu contraseña?'}
        </button>

        {error && <Alert id="login-error" kind="error">{error}</Alert>}
        {recoveryNotice && <Alert kind="success">{recoveryNotice}</Alert>}

        <Button type="submit" disabled={loading} loading={pending === 'password'} className="w-full">
          {pending === 'password' ? 'Verificando acceso…' : <>Iniciar sesión <AuthIcon name="arrow" /></>}
        </Button>
      </form>
      <p className="sr-only" role="status">{pending === 'google' ? 'Redirigiendo a Google.' : pending === 'azure' ? 'Redirigiendo a Microsoft.' : pending === 'password' ? 'Verificando tu acceso.' : ''}</p>

      <div className="auth-access-note"><AuthIcon name="shield" /><p>Google y Microsoft son alternativas al acceso con correo y contraseña. Tu perfil te lleva a tu espacio de GaleoTrack.<br /><Link href="/register" className="font-semibold text-primary underline">¿Primera vez? Crea tu cuenta</Link></p></div>
    </>
  )
}
