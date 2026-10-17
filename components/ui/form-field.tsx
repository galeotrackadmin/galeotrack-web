import type { ComponentProps, ReactNode } from 'react'

export function fieldDescription(id: string, error?: string, hint?: string) {
  return [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(' ') || undefined
}

export function FormField({ id, label, required, showRequiredIndicator = true, hint, error, children, className = '' }: {
  id: string; label: string; required?: boolean; showRequiredIndicator?: boolean; hint?: string; error?: string; children: ReactNode; className?: string
}) {
  return (
    <div className={`min-w-0 ${className}`}>
      <label htmlFor={id} className="mb-2 block text-sm font-semibold">
        {label}{required ? (showRequiredIndicator && <span className="ml-1 text-primary" aria-hidden="true">*</span>) : <span className="ml-2 text-xs font-normal text-muted">Opcional</span>}
      </label>
      {children}
      {hint && <p id={`${id}-hint`} className="mt-2 text-sm text-muted">{hint}</p>}
      {error && <p id={`${id}-error`} className="mt-2 text-sm font-medium text-danger">{error}</p>}
    </div>
  )
}

export function Input({ className = '', ...props }: ComponentProps<'input'>) {
  return <input {...props} className={`field-control ${className}`} />
}

export function Select({ className = '', ...props }: ComponentProps<'select'>) {
  return <select {...props} className={`field-control ${className}`} />
}

export function Textarea({ className = '', ...props }: ComponentProps<'textarea'>) {
  return <textarea {...props} className={`field-control ${className}`} />
}
