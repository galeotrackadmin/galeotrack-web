import Link from 'next/link'
import { Alert } from '@/components/ui/alert'

export default function AccountDeletedPage() {
  return <>
    <p className="auth-kicker">PRIVACIDAD DE CUENTA</p>
    <h1>Tu cuenta fue eliminada.</h1>
    <p className="auth-description">Se borraron los datos de perfil, contacto y evidencia. Los avistamientos se conservaron sin atribución personal para mantener el registro científico.</p>
    <Alert kind="success" className="mt-6">La eliminación se completó correctamente.</Alert>
    <Link href="/" className="button button--primary mt-6 w-full">Volver a GaleoTrack</Link>
  </>
}
