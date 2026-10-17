import type { Metadata } from 'next'
import { RegisterForm } from '@/components/auth/register-form'

export const metadata: Metadata = { title: 'Crear cuenta' }
export default function RegisterPage() {
  return <><p className="auth-kicker">ÚNETE A GALEOTRACK</p><h1>Tu conexión con el océano.</h1><p className="auth-description">Elige tu perfil y empieza a aprender, investigar o contribuir.</p><RegisterForm /></>
}
