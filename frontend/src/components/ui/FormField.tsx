import React from 'react'
import { cn } from './index'

interface FormFieldProps {
  label: string
  children: React.ReactNode
  error?: string
  required?: boolean
  /** Force inline layout even on mobile (rare) */
  inline?: boolean
  className?: string
  htmlFor?: string
}

export default function FormField({
  label,
  children,
  error,
  required,
  inline = false,
  className,
  htmlFor,
}: FormFieldProps) {
  return (
    <div
      className={cn(
        inline
          ? 'flex flex-row items-start gap-4'
          : 'flex flex-col gap-1 md:flex-row md:items-start md:gap-4',
        className
      )}
    >
      <label
        htmlFor={htmlFor}
        className={cn(
          'text-sm font-medium text-gray-700 dark:text-gray-300 shrink-0',
          inline ? 'w-1/3 pt-2.5' : 'md:w-1/3 md:pt-2.5'
        )}
      >
        {label}
        {required && <span className="text-danger ml-0.5">*</span>}
      </label>
      <div className={cn('w-full', inline ? 'w-2/3' : 'md:w-2/3')}>
        {children}
        {error && (
          <p className="mt-1 text-xs text-danger">{error}</p>
        )}
      </div>
    </div>
  )
}
