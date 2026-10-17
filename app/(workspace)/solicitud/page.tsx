'use client'

import Link from 'next/link'
import { useProfile } from '@/components/auth/access-gate'
import { homeForRole } from '@/lib/access'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { PageHeading } from '@/components/layout/page-heading'

export default function RequestPage() {
  const profile = useProfile()
  return <section><PageHeading eyebrow="Acceso científico" title="Estado de tu solicitud" image="scientist" description="Una nueva mirada para conocer y proteger el océano." /><div className="mx-auto max-w-2xl space-y-6">{profile.role !== 'pending_scientist' ? <Link href={homeForRole(profile.role)} className="button button--primary">Ir a mi espacio</Link> : <><Alert kind={profile.scienceStatus === 'rejected' ? 'error' : 'info'}>{profile.scienceStatus === 'rejected' ? 'Tu solicitud no fue aprobada. Contacta al administrador del proyecto si necesitas más información.' : 'Tu solicitud está pendiente. Un administrador validará tu perfil antes de habilitar las herramientas científicas.'}</Alert>{profile.requestNote && <div className="ui-card p-6"><h2 className="font-semibold text-ocean">Nota del administrador</h2><p className="article-body mt-2">{profile.requestNote}</p></div>}<p className="text-muted">Cuando tu cuenta esté habilitada podrás consultar avistamientos, guardar borradores y publicar tus investigaciones.</p><Button variant="secondary" onClick={() => window.location.reload()}>Comprobar estado</Button></>}</div></section>
}
