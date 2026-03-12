import React, { useEffect } from 'react'

/* ── Dialog (root) ────────────────────────────────────────────────────── */

interface DialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  children: React.ReactNode
}

export function Dialog({ open, onOpenChange, children }: DialogProps) {
  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden'
    else document.body.style.overflow = ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => onOpenChange(false)} />
      {children}
    </div>
  )
}

/* ── DialogContent ────────────────────────────────────────────────────── */

interface DialogContentProps {
  children: React.ReactNode
  className?: string
}

export function DialogContent({ children, className = '' }: DialogContentProps) {
  return (
    <div className={`relative bg-white dark:bg-gray-800 rounded-[10px] shadow-xl w-full mx-4 max-w-lg ${className}`}>
      {children}
    </div>
  )
}

/* ── DialogHeader ─────────────────────────────────────────────────────── */

export function DialogHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-gray-700">
      {children}
    </div>
  )
}

/* ── DialogTitle ──────────────────────────────────────────────────────── */

export function DialogTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{children}</h2>
}

/* ── DialogFooter ─────────────────────────────────────────────────────── */

export function DialogFooter({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-end gap-2 p-5 border-t border-gray-100 dark:border-gray-700">
      {children}
    </div>
  )
}
