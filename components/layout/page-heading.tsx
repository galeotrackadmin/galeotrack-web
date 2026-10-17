import type { ReactNode } from 'react'
import Image from 'next/image'

export type SectionImage = 'ocean-shark' | 'student' | 'scientist' | 'diver' | 'coral'

export function PageHeading({ eyebrow, title, description, actions, image = 'ocean-shark', compact = false }: { eyebrow: string; title: string; description: ReactNode; actions?: ReactNode; image?: SectionImage; compact?: boolean }) {
  return (
    <div className={`page-hero page-hero--${image}${compact ? ' page-hero--compact' : ''}`}>
      <Image src={`/images/landing/${image}.webp`} alt="" fill sizes="(max-width: 1280px) 100vw, 1280px" loading="eager" fetchPriority="high" className="page-hero-photo" />
      <div className="page-hero-content">
        <p className="section-eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <div className="page-hero-description">{description}</div>
        {actions && <div className="page-hero-actions">{actions}</div>}
      </div>
    </div>
  )
}
