import { useState } from 'react'
import { cn } from '@/components/ui'

interface CollapsibleSectionProps {
  title: string
  children: React.ReactNode
  defaultOpen?: boolean
}

export default function CollapsibleSection({ title, children, defaultOpen = false }: CollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className="border border-gray-100 dark:border-gray-800 rounded-[10px] overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center justify-between w-full px-4 py-3 text-left bg-gray-50 dark:bg-gray-950 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
      >
        <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{title}</span>
        <svg
          className={cn('h-4 w-4 text-gray-500 transition-transform', open && 'rotate-180')}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && <div className="p-4 border-t border-gray-100 dark:border-gray-800">{children}</div>}
    </div>
  )
}
