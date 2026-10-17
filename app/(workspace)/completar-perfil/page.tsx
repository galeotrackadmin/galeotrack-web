'use client'

import Link from 'next/link'
import { useProfile } from '@/components/auth/access-gate'
import { RegisterForm } from '@/components/auth/register-form'
import { homeForRole } from '@/lib/access'
import { PageHeading } from '@/components/layout/page-heading'

export default function CompleteProfilePage() {
  const profile = useProfile()
  return <section><PageHeading eyebrow="Encuentra tu espacio" title="Completa tu perfil" image="coral" description="Tu cuenta ya está conectada. Cuéntanos cómo quieres participar." /><div className="ui-card mx-auto max-w-xl p-6 sm:p-8">{profile.role === 'unassigned' ? <RegisterForm completeProfile /> : <Link href={homeForRole(profile.role)} className="button button--primary">Tu perfil ya está listo. Ir a mi espacio</Link>}</div></section>
}
