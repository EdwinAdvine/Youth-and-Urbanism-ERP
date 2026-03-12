import React, { useState, useRef, useEffect } from 'react'

/* ── Context ──────────────────────────────────────────────────────────── */

interface SelectContextValue {
  value: string
  onValueChange: (value: string) => void
  open: boolean
  setOpen: (open: boolean) => void
}

const SelectContext = React.createContext<SelectContextValue | null>(null)

function useSelectContext() {
  const ctx = React.useContext(SelectContext)
  if (!ctx) throw new Error('Select components must be used within <Select>')
  return ctx
}

/* ── Select (root) ────────────────────────────────────────────────────── */

interface SelectProps {
  value: string
  onValueChange: (value: string) => void
  children: React.ReactNode
}

export function Select({ value, onValueChange, children }: SelectProps) {
  const [open, setOpen] = useState(false)
  return (
    <SelectContext.Provider value={{ value, onValueChange, open, setOpen }}>
      <div className="relative">
        {children}
      </div>
    </SelectContext.Provider>
  )
}

/* ── SelectTrigger ────────────────────────────────────────────────────── */

interface SelectTriggerProps {
  children: React.ReactNode
  className?: string
}

export function SelectTrigger({ children, className = '' }: SelectTriggerProps) {
  const { open, setOpen } = useSelectContext()
  return (
    <button
      type="button"
      onClick={() => setOpen(!open)}
      className={[
        'w-full flex items-center justify-between rounded-[10px] border border-gray-200 dark:border-gray-700',
        'bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100',
        'focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary',
        className,
      ].join(' ')}
    >
      {children}
      <svg className="h-4 w-4 text-gray-400 shrink-0 ml-2" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
      </svg>
    </button>
  )
}

/* ── SelectValue ──────────────────────────────────────────────────────── */

interface SelectValueProps {
  placeholder?: string
}

export function SelectValue({ placeholder }: SelectValueProps) {
  const { value } = useSelectContext()
  return <span className={value ? '' : 'text-gray-400'}>{value || placeholder || ''}</span>
}

/* ── SelectContent ────────────────────────────────────────────────────── */

interface SelectContentProps {
  children: React.ReactNode
}

export function SelectContent({ children }: SelectContentProps) {
  const { open, setOpen } = useSelectContext()
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open, setOpen])

  if (!open) return null

  return (
    <div
      ref={ref}
      className="absolute z-50 mt-1 w-full rounded-[10px] border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg max-h-60 overflow-y-auto"
    >
      <div className="py-1">{children}</div>
    </div>
  )
}

/* ── SelectItem ───────────────────────────────────────────────────────── */

interface SelectItemProps {
  value: string
  children: React.ReactNode
}

export function SelectItem({ value: itemValue, children }: SelectItemProps) {
  const { value, onValueChange, setOpen } = useSelectContext()
  const isSelected = value === itemValue
  return (
    <button
      type="button"
      onClick={() => { onValueChange(itemValue); setOpen(false) }}
      className={[
        'w-full text-left px-3 py-2 text-sm transition-colors',
        isSelected
          ? 'bg-primary/10 text-primary font-medium'
          : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700',
      ].join(' ')}
    >
      {children}
    </button>
  )
}
