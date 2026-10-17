'use client'

import { useEffect, useRef, useState, type FormEvent } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase-client'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { FormField, Input } from '@/components/ui/form-field'

export function UpdatePasswordForm() {
  const [ready, setReady] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const [busy, setBusy] = useState(false)
  const initialized = useRef(false)

  useEffect(() => {
    if (initialized.current) return
    initialized.current = true
    const code = new URLSearchParams(window.location.search).get('code')
    if (!code) {
      void Promise.resolve().then(() => setError('El enlace no es válido o ya fue utilizado. Solicita uno nuevo desde el inicio de sesión.'))
      return
    }
    void supabase.auth.exchangeCodeForSession(code).then(({ error: exchangeError }) => {
      window.history.replaceState(window.history.state, '', '/update-password')
      if (exchangeError) setError('El enlace de recuperación venció o ya fue utilizado. Solicita uno nuevo desde el inicio de sesión.')
      else setReady(true)
    }).catch(() => setError('No se pudo validar el enlace. Comprueba tu conexión e inténtalo otra vez.'))
  }, [])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const password = String(data.get('password') ?? '')
    const confirmation = String(data.get('password_confirmation') ?? '')
    if (password !== confirmation) {
      setError('Las contraseñas no coinciden. Revísalas e inténtalo de nuevo.')
      return
    }
    setBusy(true)
    setError('')
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password })
      if (updateError) throw updateError
      setDone(true)
      await supabase.auth.signOut().catch(() => undefined)
    } catch {
      setError('No se pudo actualizar la contraseña. El enlace puede haber vencido; solicita uno nuevo e inténtalo otra vez.')
    } finally {
      setBusy(false)
    }
  }

  return <>
    <p className="auth-kicker">RECUPERACIÓN DE CUENTA</p>
    <h1>{done ? 'Contraseña actualizada.' : 'Crea una contraseña nueva.'}</h1>
    <p className="auth-description">{done ? 'Ya puedes iniciar sesión con tu nueva contraseña.' : 'Elige una contraseña de al menos 8 caracteres para volver a acceder a tu cuenta.'}</p>
    {error && <Alert kind="error" className="my-6">{error}</Alert>}
    {done ? <Link href="/login" className="button button--primary mt-6 w-full">Volver al inicio de sesión</Link> : ready ? <form onSubmit={submit} className="auth-form mt-7" aria-busy={busy}>
      <FormField id="password" label="Contraseña nueva" required hint="Al menos 8 caracteres."><Input id="password" name="password" type="password" autoComplete="new-password" minLength={8} maxLength={128} required disabled={busy} /></FormField>
      <FormField id="password-confirmation" label="Confirma la contraseña" required><Input id="password-confirmation" name="password_confirmation" type="password" autoComplete="new-password" minLength={8} maxLength={128} required disabled={busy} /></FormField>
      <Button type="submit" className="w-full" disabled={busy} loading={busy}>Guardar contraseña nueva</Button>
    </form> : !error ? <p role="status" className="auth-callback-status"><span className="ui-spinner" aria-hidden="true" /> Validando el enlace de recuperación…</p> : <Link href="/login" className="button button--secondary mt-4 w-full">Volver al inicio de sesión</Link>}
  </>
}
