'use client'

import { createContext, useContext, type ComponentProps, type ReactNode } from 'react'

const FieldContext = createContext<{ id: string; hint?: string; error?: string } | null>(null)

function useFieldAccessibility(props: { id?: string; 'aria-describedby'?: string; 'aria-invalid'?: ComponentProps<'input'>['aria-invalid'] }) {
  const field = useContext(FieldContext)
  const belongsToField = field && (!props.id || props.id === field.id)
  const descriptions = [props['aria-describedby'], belongsToField && fieldDescription(field.id, field.error, field.hint)].filter(Boolean).join(' ').split(/\s+/).filter(Boolean)
  return {
    id: props.id ?? field?.id,
    'aria-describedby': [...new Set(descriptions)].join(' ') || undefined,
    'aria-invalid': props['aria-invalid'] ?? (belongsToField && field.error ? true : undefined),
  }
}

export function fieldDescription(id: string, error?: string, hint?: string) {
  return [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(' ') || undefined
}

export function FormField({ id, label, required, showRequiredIndicator = true, hint, error, children, className = '' }: {
  id: string; label: string; required?: boolean; showRequiredIndicator?: boolean; hint?: string; error?: string; children: ReactNode; className?: string
}) {
  return (
    <FieldContext value={{ id, hint, error }}><div className={`min-w-0 ${className}`}>
      <label htmlFor={id} className="mb-2 block text-sm font-semibold">
        {label}{required ? (showRequiredIndicator && <span className="ml-1 text-primary" aria-hidden="true">*</span>) : <span className="ml-2 text-xs font-normal text-muted">Opcional</span>}
      </label>
      {children}
      {hint && <p id={`${id}-hint`} className="mt-2 text-sm text-muted">{hint}</p>}
      {error && <p id={`${id}-error`} className="mt-2 text-sm font-medium text-danger">{error}</p>}
    </div></FieldContext>
  )
}

export function Input({ className = '', ...props }: ComponentProps<'input'>) {
  const accessibility = useFieldAccessibility(props)
  return <input {...props} {...accessibility} className={`field-control ${className}`} />
}

export function Select({ className = '', ...props }: ComponentProps<'select'>) {
  const accessibility = useFieldAccessibility(props)
  return <select {...props} {...accessibility} className={`field-control ${className}`} />
}

export function Textarea({ className = '', ...props }: ComponentProps<'textarea'>) {
  const accessibility = useFieldAccessibility(props)
  return <textarea {...props} {...accessibility} className={`field-control ${className}`} />
}
