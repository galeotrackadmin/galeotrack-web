'use client'

import { useRef, useState, type FormEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase-client'
import { getProfile, homeForRole } from '@/lib/access'
import { Button } from '@/components/ui/button'
import { FormField, Input, Select } from '@/components/ui/form-field'
import { Alert } from '@/components/ui/alert'

export function RegisterForm({ completeProfile = false }: { completeProfile?: boolean }) {
  const router = useRouter()
  const [role, setRole] = useState('student')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)
  const submitting = useRef(false)
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting.current) return
    submitting.current = true
    setBusy(true); setError('')
    const fields = new FormData(event.currentTarget)
    const fullName = String(fields.get('name') ?? '').trim()
    const affiliation = String(fields.get('affiliation') ?? '').trim()
    try {
      if (fullName.length < 2) throw new Error('Escribe un nombre de al menos dos caracteres.')
      if (role === 'researcher' && affiliation.length < 2) throw new Error('Indica tu institución o actividad investigadora.')
      if (completeProfile) {
        const { error } = await supabase.rpc('complete_profile', { selected_role: role, display_name: fullName, organization: affiliation })
        if (error) throw new Error('No se pudo guardar el perfil. Actualiza la página y vuelve a intentarlo.')
      } else {
        const { data, error } = await supabase.auth.signUp({
          email: String(fields.get('email')).trim(), password: String(fields.get('password')),
          options: { emailRedirectTo: `${window.location.origin}/auth/callback`, data: { full_name: fullName, requested_role: role, affiliation } },
        })
        if (error) throw new Error(error.code === 'weak_password' ? 'Elige una contraseña más segura.' : 'No se pudo crear la cuenta. Revisa los datos o inténtalo más tarde.')
        if (!data.session) { setSent(true); return }
      }
      const profile = await getProfile(supabase)
      // Recarga el contexto del espacio después de asignar un perfil social.
      if (completeProfile) window.location.assign(homeForRole(profile.role))
      else router.replace(homeForRole(profile.role))
    } catch (error) { setError(error instanceof Error ? error.message : 'No se pudo completar el registro.') }
    finally { submitting.current = false; setBusy(false) }
  }
  if (sent) return <div className="space-y-5"><Alert kind="success">Revisa tu correo. Si el registro puede completarse, recibirás un enlace para confirmar tu cuenta. Ábrelo en este mismo navegador.</Alert><Link href="/login" className="button button--primary">Volver al inicio de sesión</Link></div>
  return <form onSubmit={submit} className="space-y-5" aria-busy={busy}>
    <fieldset disabled={busy} className="space-y-5">
      <FormField id="name" label="Nombre completo" required><Input id="name" name="name" autoComplete="name" minLength={2} maxLength={120} required /></FormField>
      <FormField id="role" label="Quiero participar como" required><Select id="role" name="role" value={role} onChange={(e) => setRole(e.target.value)}><option value="student">Estudiante</option><option value="researcher">Científico</option><option value="community">Pescador Buzo</option></Select></FormField>
      {role === 'researcher' && <><FormField id="affiliation" label="Institución o actividad investigadora" required><Input id="affiliation" name="affiliation" minLength={2} maxLength={200} required /></FormField><Alert kind="info">Un administrador revisará tu solicitud antes de habilitar el modo científico.</Alert></>}
      {!completeProfile && <><FormField id="email" label="Correo electrónico" required><Input id="email" name="email" type="email" autoComplete="email" required /></FormField><FormField id="password" label="Contraseña" required hint="Utiliza al menos 8 caracteres."><Input id="password" name="password" type="password" autoComplete="new-password" minLength={8} maxLength={128} aria-describedby="password-hint" required /></FormField></>}
    </fieldset>
    {error && <Alert kind="error">{error}</Alert>}
    <Button type="submit" className="w-full" loading={busy} disabled={busy}>{busy ? 'Guardando…' : completeProfile ? 'Guardar mi perfil' : 'Crear cuenta'}</Button>
    {!completeProfile && <p className="text-center text-sm text-muted">¿Ya tienes cuenta? <Link href="/login" className="font-semibold text-primary underline">Iniciar sesión</Link></p>}
  </form>
}
