import type { Metadata } from 'next'
import { AuthCallback } from '@/components/auth/auth-callback'

export const metadata: Metadata = { title: 'Validando acceso', robots: { index: false, follow: false } }

export default function CallbackPage() {
  return <AuthCallback />
}
