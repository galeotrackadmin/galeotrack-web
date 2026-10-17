import Image from 'next/image'
import Link from 'next/link'
import { HomeLink } from './home-link'

export function Brand({ href }: { href?: string }) {
  const logo = <Image src="/images/brand/galeotrack-logo.webp" alt="GaleoTrack" width={960} height={225} sizes="(max-width: 639px) 200px, 220px" loading="eager" className="brand-logo" />
  return href
    ? <Link href={href} aria-label="GaleoTrack, mi espacio" className="brand">{logo}</Link>
    : <HomeLink aria-label="GaleoTrack, inicio" className="brand">{logo}</HomeLink>
}
