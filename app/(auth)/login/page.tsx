import type { Metadata } from 'next'
import { LoginForm } from '@/components/auth/login-form'

export const metadata: Metadata = { title: 'Iniciar sesión' }

export default function LoginPage() {
  return (
    <>
      <p className="auth-kicker">TU COMUNIDAD MARINA</p>
      <h1>Bienvenido a bordo.</h1>
      <p className="auth-description">Estudiante, científico o pescador buzo: inicia sesión para acceder a las herramientas de tu perfil.</p>
      <LoginForm />
    </>
  )
}
