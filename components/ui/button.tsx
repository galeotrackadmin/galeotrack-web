import type { ComponentProps } from 'react'

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'inverse'

export function buttonStyles(variant: Variant = 'primary', className = '') {
  return `button button--${variant} ${className}`
}

export function Button({ variant = 'primary', loading = false, disabled, className = '', children, type = 'button', ...props }: ComponentProps<'button'> & { variant?: Variant; loading?: boolean }) {
  return (
    <button {...props} type={type} disabled={disabled || loading} aria-busy={loading || undefined} className={buttonStyles(variant, className)}>
      {loading && <span className="ui-spinner" aria-hidden="true" />}
      {children}
    </button>
  )
}
