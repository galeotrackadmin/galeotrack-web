import type { Metadata } from 'next'
import { UpdatePasswordForm } from '@/components/auth/update-password-form'

export const metadata: Metadata = { title: 'Crear contraseña nueva', robots: { index: false, follow: false } }

export default function UpdatePasswordPage() {
  return <UpdatePasswordForm />
}
