import Image from 'next/image'
import Link from 'next/link'
import { Icon } from '@/components/icons'
import type { SectionImage } from './page-heading'

export type SectionLink = { href: string; title: string; description: string; image: SectionImage | 'geomapa' }

export function SectionLinks({ items, label, compact = false }: { items: SectionLink[]; label: string; compact?: boolean }) {
  if (compact) return <nav aria-label={label} className="workspace-shortcuts">{items.map((item) => <Link key={item.href} href={item.href} className="button button--secondary" aria-label={item.title}>{item.title}<Icon name="arrow" /></Link>)}</nav>
  return (
    <nav aria-label={label} className="section-links">
      {items.map((item, index) => (
        <Link key={item.href} href={item.href} className="section-link" aria-label={item.title}>
          <div className="section-link-media">
            <Image src={`/images/landing/${item.image}.webp`} alt="" fill sizes="(max-width: 639px) 100vw, (max-width: 1023px) 50vw, 33vw" className="section-link-photo" />
            <span className="section-link-number" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
          </div>
          <div className="section-link-copy">
            <span className="section-link-title">{item.title}<Icon name="arrow" /></span>
            <span className="section-link-description">{item.description}</span>
          </div>
        </Link>
      ))}
    </nav>
  )
}
