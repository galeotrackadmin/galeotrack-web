import type { ComponentProps } from 'react'
import { Icon, type IconName } from '@/components/icons'

const variants = {
  error: { styles: 'border-danger-border bg-danger-soft text-danger', icon: 'alert' },
  success: { styles: 'border-success-border bg-success-soft text-success', icon: 'check' },
  info: { styles: 'border-info-border bg-info-soft text-info', icon: 'info' },
} satisfies Record<string, { styles: string; icon: IconName }>

export function Alert({ kind = 'info', children, className = '', ...props }: ComponentProps<'div'> & { kind?: keyof typeof variants }) {
  const variant = variants[kind]
  return (
    <div role={kind === 'error' ? 'alert' : 'status'} {...props} className={`flex items-start gap-3 rounded-xl border p-4 text-sm leading-relaxed ${variant.styles} ${className}`}>
      <Icon name={variant.icon} className="mt-0.5 shrink-0" />
      <div className="min-w-0 break-words">{children}</div>
    </div>
  )
}
