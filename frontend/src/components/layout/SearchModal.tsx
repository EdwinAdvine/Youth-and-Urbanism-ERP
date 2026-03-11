import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { cn, Spinner } from '../ui'
import { useGlobalSearch } from '../../api/search'
import type { SearchResultGroup } from '../../api/search'

interface SearchModalProps {
  open: boolean
  onClose: () => void
}

const MODULE_ICONS: Record<string, string> = {
  inventory: '📦',
  hr: '👥',
  crm: '🤝',
  finance: '💰',
  projects: '📋',
}

export default function SearchModal({ open, onClose }: SearchModalProps) {
  const [inputValue, setInputValue] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()

  // Debounce input → query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(inputValue.trim())
    }, 300)
    return () => clearTimeout(timer)
  }, [inputValue])

  // Auto-focus input when modal opens; reset on close
  useEffect(() => {
    if (open) {
      setInputValue('')
      setDebouncedQuery('')
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  // Close on Escape
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose])

  // Lock body scroll
  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden'
    else document.body.style.overflow = ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  const { data, isFetching } = useGlobalSearch(debouncedQuery, open)

  const handleItemClick = (link: string) => {
    navigate(link)
    onClose()
  }

  if (!open) return null

  const hasQuery = debouncedQuery.length > 0
  const hasResults = (data?.results?.length ?? 0) > 0

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh]">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal panel */}
      <div className="relative bg-white rounded-[10px] shadow-2xl w-full max-w-xl mx-4 overflow-hidden">
        {/* Search input row */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
          <svg
            className="h-5 w-5 text-gray-400 shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Search anything..."
            className="flex-1 text-sm text-gray-900 placeholder:text-gray-400 bg-transparent focus:outline-none"
          />
          {isFetching && <Spinner size="sm" />}
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors text-xs font-medium border border-gray-200 rounded px-1.5 py-0.5"
          >
            Esc
          </button>
        </div>

        {/* Results area */}
        <div className="max-h-[60vh] overflow-y-auto">
          {!hasQuery && (
            <div className="py-12 text-center text-sm text-gray-400">
              Start typing to search...
            </div>
          )}

          {hasQuery && !isFetching && !hasResults && (
            <div className="py-12 text-center text-sm text-gray-400">
              No results found for &ldquo;{debouncedQuery}&rdquo;
            </div>
          )}

          {hasQuery && hasResults && data?.results.map((group: SearchResultGroup) => (
            <div key={group.module} className="border-b border-gray-50 last:border-0">
              {/* Group header */}
              <div className="flex items-center gap-2 px-4 py-2 bg-gray-50">
                <span className="text-base leading-none">
                  {MODULE_ICONS[group.module] ?? '🔍'}
                </span>
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  {group.label}
                </span>
              </div>

              {/* Group items */}
              {group.items.map((item) => (
                <button
                  key={item.id}
                  onClick={() => handleItemClick(item.link)}
                  className={cn(
                    'w-full flex items-center gap-3 px-4 py-2.5 text-left',
                    'hover:bg-primary/5 transition-colors'
                  )}
                >
                  <span
                    className="h-7 w-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0"
                    aria-hidden="true"
                  >
                    {item.title.charAt(0).toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-gray-900 truncate">
                      {item.title}
                    </p>
                    {item.subtitle && (
                      <p className="text-xs text-gray-400 truncate">{item.subtitle}</p>
                    )}
                  </div>
                  <svg
                    className="h-4 w-4 text-gray-300 shrink-0"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </button>
              ))}
            </div>
          ))}
        </div>

        {/* Footer hint */}
        {hasResults && (
          <div className="px-4 py-2 border-t border-gray-100 flex items-center gap-3 text-xs text-gray-400">
            <span>Click a result to navigate</span>
            <span className="ml-auto">Press Esc to close</span>
          </div>
        )}
      </div>
    </div>
  )
}
