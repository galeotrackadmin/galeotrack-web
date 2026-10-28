'use client'

import { useCallback, useEffect, useState, type FormEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useProfile, useRefreshProfile } from '@/components/auth/access-gate'
import { PageHeading } from '@/components/layout/page-heading'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { FormField, Input, Select } from '@/components/ui/form-field'
import { ROLE_LABELS, homeForRole, type UserRole } from '@/lib/access'
import { supabase } from '@/lib/supabase-client'
import { useConfirmation } from '@/components/ui/confirmation-provider'
import { useUpdateGuard } from '@/lib/pwa/use-update-guard'

type RoleHistory = { id: string; previous_role: string; requested_role: string; status: string; review_note: string | null; created_at: string; reviewed_at: string | null }
const roleChoices = [
  { value: 'student', label: 'Estudiante' },
  { value: 'community', label: 'Pescador / Buzo' },
  { value: 'researcher', label: 'Científico (requiere aprobación)' },
]

function displayRole(role: string) { return ROLE_LABELS[role as UserRole] ?? role }

export function AccountSettings() {
  const confirm = useConfirmation()
  const profile = useProfile()
  const refreshProfile = useRefreshProfile()
  const router = useRouter()
  const [name, setName] = useState(profile.fullName)
  const [organization, setOrganization] = useState('')
  const [selectedRole, setSelectedRole] = useState(profile.role === 'community' ? 'community' : profile.role === 'researcher' || profile.role === 'pending_scientist' ? 'researcher' : 'student')
  const [history, setHistory] = useState<RoleHistory[]>([])
  const [draftCount, setDraftCount] = useState<number | null>(null)
  const [hasEmailPassword, setHasEmailPassword] = useState(false)
  const [notice, setNotice] = useState<{ kind: 'success' | 'error' | 'info'; message: string } | null>(null)
  const [busy, setBusy] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [deleteConfirmation, setDeleteConfirmation] = useState('')
  const initialRole = profile.role === 'community' ? 'community' : profile.role === 'researcher' || profile.role === 'pending_scientist' ? 'researcher' : 'student'
  useUpdateGuard(Boolean(busy || name !== profile.fullName || organization || selectedRole !== initialRole || currentPassword || newPassword || confirmPassword || deleteConfirmation))

  const loadAccountData = useCallback(async () => {
    const [historyResult, authResult] = await Promise.all([
      supabase.from('profile_role_history').select('id,previous_role,requested_role,status,review_note,created_at,reviewed_at').eq('user_id', profile.id).order('created_at', { ascending: false }).limit(20).returns<RoleHistory[]>(),
      supabase.auth.getUser(),
    ])
    if (!historyResult.error) setHistory(historyResult.data ?? [])
    const user = authResult.data.user
    setHasEmailPassword(Boolean(user?.identities?.some((identity) => identity.provider === 'email')))
    if (profile.role === 'researcher') {
      const { count } = await supabase.from('publications').select('id', { count: 'exact', head: true }).eq('author_id', profile.id).eq('status', 'draft')
      setDraftCount(count ?? 0)
    } else setDraftCount(null)
  }, [profile.id, profile.role])

  useEffect(() => { void Promise.resolve().then(loadAccountData) }, [loadAccountData])

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy('profile'); setNotice(null)
    const { error } = await supabase.rpc('update_my_profile', { display_name: name.trim() })
    if (error) setNotice({ kind: 'error', message: 'No se pudo guardar el nombre. Comprueba que tenga entre 2 y 120 caracteres.' })
    else { await refreshProfile(); setNotice({ kind: 'success', message: 'Tu nombre se guardó correctamente.' }) }
    setBusy('')
  }

  async function changeRole(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setNotice(null)
    if (profile.role === 'admin') return
    const leavingResearch = profile.role === 'researcher' && selectedRole !== 'researcher'
    const draftWarning = leavingResearch
      ? `\n\n${draftCount === null ? 'Tus borradores se conservarán.' : `Tienes ${draftCount} borrador${draftCount === 1 ? '' : 'es'}; se conservarán.`} No podrás editarlos hasta recuperar el acceso científico.`
      : ''
    const reviewWarning = selectedRole === 'researcher' ? '\n\nUn administrador debe aprobar el acceso científico antes de habilitarlo.' : ''
    if (busy || !await confirm({ title: '¿Cambiar tu perfil de participación?', description: `Nuevo perfil: ${roleChoices.find((role) => role.value === selectedRole)?.label}. Tus reportes existentes se conservarán.${draftWarning}${reviewWarning}`, action: 'Cambiar perfil' })) return
    setBusy('role')
    const { error } = await supabase.rpc('change_my_role', { selected_role: selectedRole, organization: organization.trim() })
    if (error) setNotice({ kind: 'error', message: error.message.includes('pendiente') ? 'Ya tienes una solicitud científica pendiente.' : 'No se pudo cambiar el perfil. Inténtalo de nuevo.' })
    else {
      await refreshProfile()
      await loadAccountData()
      setNotice({ kind: 'success', message: selectedRole === 'researcher' ? 'Solicitud enviada. El acceso científico quedará pendiente de aprobación.' : 'Tu perfil se actualizó. Los reportes existentes se conservaron.' })
    }
    setBusy('')
  }

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setNotice(null)
    if (newPassword.length < 8 || newPassword !== confirmPassword) {
      setNotice({ kind: 'error', message: newPassword.length < 8 ? 'La contraseña nueva debe tener al menos 8 caracteres.' : 'Las contraseñas nuevas no coinciden.' }); return
    }
    setBusy('password')
    const { error: signInError } = await supabase.auth.signInWithPassword({ email: profile.email, password: currentPassword })
    if (signInError) {
      setNotice({ kind: 'error', message: 'La contraseña actual no es correcta.' }); setBusy(''); return
    }
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    if (error) setNotice({ kind: 'error', message: 'No se pudo actualizar la contraseña. Revisa la política de seguridad e inténtalo otra vez.' })
    else { setCurrentPassword(''); setNewPassword(''); setConfirmPassword(''); setNotice({ kind: 'success', message: 'Contraseña actualizada.' }) }
    setBusy('')
  }

  async function signOutEverywhere() {
    if (busy || !await confirm({ title: '¿Cerrar todas las sesiones?', description: 'Se cerrará tu sesión en este y en los demás dispositivos. Tendrás que volver a iniciar sesión para acceder a tu espacio.', action: 'Cerrar todas las sesiones' })) return
    setBusy('sessions')
    const { error } = await supabase.auth.signOut({ scope: 'global' })
    if (error) { setNotice({ kind: 'error', message: 'No se pudieron cerrar todas las sesiones.' }); setBusy(''); return }
    router.replace('/login')
  }

  async function downloadData() {
    setBusy('download'); setNotice(null)
    const [profileResult, sightingsResult, publicationsResult] = await Promise.all([
      supabase.from('profiles').select('full_name,role,science_status,affiliation,request_note').eq('id', profile.id).single(),
      supabase.from('sightings').select('*').eq('reporter_id', profile.id).is('deleted_at', null),
      supabase.from('publications').select('title,summary,content,references_text,status,created_at,updated_at').eq('author_id', profile.id),
    ])
    if (profileResult.error || sightingsResult.error || publicationsResult.error) {
      setNotice({ kind: 'error', message: 'No se pudo preparar la descarga completa de tus datos. Inténtalo otra vez.' }); setBusy(''); return
    }
    const ids = (sightingsResult.data ?? []).map((row) => row.id)
    const contactsResult = ids.length ? await supabase.from('sighting_contacts').select('sighting_id,name,email,phone,consented_at').in('sighting_id', ids) : { data: [], error: null }
    if (contactsResult.error) { setNotice({ kind: 'error', message: 'No se pudo incluir la información de contacto consentida en la descarga.' }); setBusy(''); return }
    const evidencePaths = [...new Set((sightingsResult.data ?? []).flatMap((row) => [row.photo_path, row.video_path]).filter((path): path is string => Boolean(path)))]
    const signedEvidence = await Promise.all(evidencePaths.map(async (path) => {
      const { data, error } = await supabase.storage.from('sighting-evidence').createSignedUrl(path, 60)
      return error ? null : { path, url: data.signedUrl }
    }))
    if (signedEvidence.some((entry) => entry === null)) {
      setNotice({ kind: 'error', message: 'No se pudieron preparar los enlaces seguros de toda la evidencia. Inténtalo otra vez.' }); setBusy(''); return
    }
    const file = new Blob([JSON.stringify({ exported_at: new Date().toISOString(), account: { email: profile.email, ...profileResult.data }, role_history: history, sightings: sightingsResult.data, sighting_contacts: contactsResult.data, publications: publicationsResult.data, evidence_downloads: signedEvidence.filter(Boolean), evidence_links_expire_in_seconds: 60 }, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(file)
    const link = document.createElement('a'); link.href = url; link.download = 'galeotrack-mis-datos.json'; link.click(); URL.revokeObjectURL(url)
    setBusy(''); setNotice({ kind: 'success', message: 'Descarga preparada. Incluye tus datos de cuenta, reportes, contactos consentidos, publicaciones y enlaces de evidencia que vencen en 60 segundos.' })
  }

  async function deleteAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setNotice(null)
    if (deleteConfirmation !== 'ELIMINAR') { setNotice({ kind: 'error', message: 'Escribe ELIMINAR exactamente para confirmar.' }); return }
    if (busy || !await confirm({ title: '¿Eliminar tu cuenta definitivamente?', description: 'Se eliminarán tu perfil, contactos consentidos, borradores y evidencia. Los avistamientos se conservarán sin atribución y las publicaciones publicadas quedarán sin autor. Esta acción no se puede deshacer.', action: 'Eliminar mi cuenta', danger: true })) return
    setBusy('delete')
    const { data, error } = await supabase.functions.invoke('delete-account', { body: { confirmation: deleteConfirmation } })
    if (error || data?.error) {
      let detail = data?.error as string | undefined
      if (!detail && error?.context instanceof Response) {
        try { detail = (await error.context.json()).error } catch { /* Se usa el mensaje genérico inferior. */ }
      }
      setNotice({ kind: 'error', message: detail ?? 'No se pudo completar la eliminación. Si tu sesión tiene más de 10 minutos, vuelve a iniciar sesión e inténtalo de nuevo.' }); setBusy(''); return
    }
    await supabase.auth.signOut({ scope: 'local' })
    router.replace('/cuenta-eliminada')
  }

  return <section className="account-settings space-y-6" aria-labelledby="account-title">
    <PageHeading compact eyebrow="TU CUENTA" title="Perfil y privacidad" description="Administra tu información, el perfil de participación y la seguridad de tu cuenta." />
    {notice && <Alert kind={notice.kind}>{notice.message}</Alert>}

    <section className="ui-card account-card" aria-labelledby="profile-title">
      <h2 id="profile-title" className="text-xl font-semibold text-ocean">Información del perfil</h2>
      <p className="mt-2 text-sm text-muted">Este nombre se usa para identificar tu perfil dentro de GaleoTrack. Tu correo no se muestra en el mapa público.</p>
      <form className="mt-5 grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end" onSubmit={saveProfile}>
        <FormField id="account-name" label="Nombre completo" required><Input id="account-name" value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" minLength={2} maxLength={120} required disabled={busy !== ''} /></FormField>
        <Button type="submit" loading={busy === 'profile'} disabled={busy !== '' || name.trim() === profile.fullName}>Guardar nombre</Button>
      </form>
      <dl className="account-meta mt-5"><div><dt>Correo</dt><dd>{profile.email}</dd></div><div><dt>Perfil activo</dt><dd>{ROLE_LABELS[profile.role]}</dd></div></dl>
      {!profile.fullName && <Alert kind="info" className="mt-4">Completa tu nombre para que tu cuenta quede identificada correctamente.</Alert>}
    </section>

    <section className="ui-card account-card" aria-labelledby="role-title">
      <h2 id="role-title" className="text-xl font-semibold text-ocean">Perfil de participación</h2>
      <p className="mt-2 text-sm text-muted">Puedes cambiar entre estudiante y comunidad. El acceso científico siempre requiere aprobación. La administración no se puede asignar desde esta pantalla.</p>
      {profile.role === 'admin' ? <Alert kind="info" className="mt-4">Los perfiles administradores solo pueden cambiarse por otro administrador.</Alert> : <form className="mt-5 grid gap-4" onSubmit={changeRole}>
        <FormField id="account-role" label="Quiero participar como" required><Select id="account-role" value={selectedRole} onChange={(event) => setSelectedRole(event.target.value)} disabled={busy !== ''}><option value="student">Estudiante</option><option value="community">Pescador / Buzo</option><option value="researcher">Científico (requiere aprobación)</option></Select></FormField>
        {selectedRole === 'researcher' && <FormField id="account-affiliation" label="Institución o actividad investigadora" required><Input id="account-affiliation" value={organization} onChange={(event) => setOrganization(event.target.value)} minLength={2} maxLength={200} required disabled={busy !== ''} /></FormField>}
        {selectedRole === 'researcher' && <Alert kind="info">Al solicitar el perfil científico, el acceso queda pendiente de revisión. Si tienes borradores científicos, se conservan mientras se revisa.</Alert>}
        {profile.scienceStatus === 'rejected' && <Alert kind="error">La solicitud anterior fue rechazada. Puedes consultar la nota de revisión en el historial o enviar una nueva solicitud científica.</Alert>}
        <div><Button type="submit" loading={busy === 'role'} disabled={busy !== '' || (profile.role === selectedRole) || (profile.role === 'pending_scientist' && profile.scienceStatus === 'pending' && selectedRole === 'researcher')}>Guardar cambio de perfil</Button></div>
      </form>}
      <div className="mt-6"><h3 className="font-semibold">Historial de solicitudes</h3>{history.length ? <ol className="account-history mt-3">{history.map((item) => <li key={item.id}><strong>{displayRole(item.requested_role)}</strong><span>{item.status === 'completed' ? 'Cambio aplicado' : item.status === 'pending' ? 'Pendiente de revisión' : item.status === 'approved' ? 'Aprobada' : item.status === 'rejected' ? 'Rechazada' : 'Retirada'} · {new Date(item.created_at).toLocaleDateString('es-PR')}</span>{item.review_note && <p>{item.review_note}</p>}</li>)}</ol> : <p className="mt-2 text-sm text-muted">Aún no hay cambios o solicitudes de perfil.</p>}</div>
    </section>

    <section className="ui-card account-card" aria-labelledby="privacy-title">
      <h2 id="privacy-title" className="text-xl font-semibold text-ocean">Privacidad y tus datos</h2>
      <p className="mt-2 text-sm text-muted">En el mapa público aparecen avistamientos activos pendientes y verificados: especie, ubicación, fecha, hora, cantidad, coordenadas, fuente y estado de revisión. Las tarjetas advierten cuando un registro no está verificado. No se publican tu nombre, correo, notas, contacto ni evidencia adjunta.</p>
      <Button className="mt-5" variant="secondary" onClick={downloadData} loading={busy === 'download'} disabled={busy !== ''}>Descargar mis datos</Button>
    </section>

    <section className="ui-card account-card" aria-labelledby="security-title">
      <h2 id="security-title" className="text-xl font-semibold text-ocean">Seguridad</h2>
      {hasEmailPassword ? <form className="mt-5 grid gap-4" onSubmit={changePassword}>
        <FormField id="current-password" label="Contraseña actual" required><Input id="current-password" type="password" autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} required disabled={busy !== ''} /></FormField>
        <FormField id="new-password" label="Contraseña nueva" required hint="Al menos 8 caracteres."><Input id="new-password" type="password" autoComplete="new-password" minLength={8} maxLength={128} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} required disabled={busy !== ''} /></FormField>
        <FormField id="confirm-password" label="Confirma la contraseña nueva" required><Input id="confirm-password" type="password" autoComplete="new-password" minLength={8} maxLength={128} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required disabled={busy !== ''} /></FormField>
        <div><Button type="submit" loading={busy === 'password'} disabled={busy !== ''}>Cambiar contraseña</Button></div>
      </form> : <p className="mt-3 text-sm text-muted">Tu cuenta usa un proveedor de acceso externo. Administra la contraseña desde la configuración de ese proveedor.</p>}
      <div className="mt-6 border-t border-border pt-5"><h3 className="font-semibold">Sesiones abiertas</h3><p className="mt-1 text-sm text-muted">Cierra la sesión en este y en todos los demás dispositivos.</p><Button className="mt-3" variant="secondary" onClick={signOutEverywhere} loading={busy === 'sessions'} disabled={busy !== ''}>Cerrar sesión en todos los dispositivos</Button></div>
    </section>

    <section className="ui-card account-card account-delete-card" aria-labelledby="delete-title">
      <h2 id="delete-title" className="text-xl font-semibold text-danger">Eliminar cuenta</h2>
      <p className="mt-2 text-sm text-muted">Se eliminarán tu perfil, contactos consentidos, borradores y evidencia adjunta. Los avistamientos estructurados se conservarán sin atribución a tu cuenta; las publicaciones ya publicadas quedarán sin autor. La eliminación no se puede deshacer.</p>
      <form className="mt-5 grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end" onSubmit={deleteAccount}>
        <FormField id="delete-confirmation" label="Escribe ELIMINAR para confirmar" required hint="Por seguridad, tu inicio de sesión debe haberse realizado durante los últimos 10 minutos."><Input id="delete-confirmation" value={deleteConfirmation} onChange={(event) => setDeleteConfirmation(event.target.value)} autoComplete="off" required disabled={busy !== ''} /></FormField>
        <Button type="submit" variant="danger" loading={busy === 'delete'} disabled={busy !== '' || deleteConfirmation !== 'ELIMINAR' || profile.role === 'admin'}>Eliminar mi cuenta</Button>
      </form>
      {profile.role === 'admin' && <p className="mt-3 text-sm text-danger">Las cuentas administradoras no pueden autoeliminarse. Contacta con otro administrador.</p>}
    </section>

    <p className="text-sm text-muted">Volver a <Link className="font-semibold text-primary underline" href={homeForRole(profile.role)}>mi espacio</Link>.</p>
  </section>
}
