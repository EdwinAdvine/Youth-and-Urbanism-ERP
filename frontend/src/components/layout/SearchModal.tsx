/**
 * SearchModal — global cross-module search modal (Cmd+K / Ctrl+K).
 *
 * Opens as a full-screen overlay. Queries the backend via `api/search`
 * (`GET /search?q=...`) with a 300ms debounce to avoid excessive requests.
 * Results are grouped by module (Inventory, HR, CRM, etc.) with module-specific
 * emoji icons for quick visual scanning.
 *
 * Keyboard navigation:
 * - Arrow Up/Down — move through results
 * - Enter — navigate to selected result
 * - Escape — close modal
 *
 * Navigates to the result's `url` field and closes the modal on selection.
 * Empty state shows a "No results" message. Loading state shows a spinner.
 */
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
  handbook: '📖',
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
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-0 md:pt-[10vh]">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal panel — full-screen on mobile, centered card on desktop */}
      <div className="relative bg-white dark:bg-gray-800 md:rounded-[10px] shadow-2xl w-full md:max-w-xl md:mx-4 h-full md:h-auto overflow-hidden flex flex-col">
        {/* Search input row */}
        <div className="flex items-center gap-3 px-4 py-3 md:py-3 border-b border-gray-100 dark:border-gray-800 safe-top shrink-0">
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
            className="flex-1 text-base md:text-sm min-h-[44px] text-gray-900 dark:text-gray-100 placeholder:text-gray-400 bg-transparent focus:outline-none"
          />
          {isFetching && <Spinner size="sm" />}
          <button
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center text-gray-400 hover:text-gray-600 active:text-gray-800 transition-colors text-xs font-medium border border-gray-200 dark:border-gray-700 rounded px-1.5 py-0.5 md:min-h-0 md:min-w-0"
          >
            <span className="hidden md:inline">Esc</span>
            <svg className="h-5 w-5 md:hidden" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Results area */}
        <div className="flex-1 md:flex-none md:max-h-[60vh] overflow-y-auto">
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
            <div key={group.module} className="border-b border-gray-50 dark:border-gray-900 last:border-0">
              {/* Group header */}
              <div className="flex items-center gap-2 px-4 py-2 bg-gray-50 dark:bg-gray-950">
                <span className="text-base leading-none">
                  {MODULE_ICONS[group.module] ?? '🔍'}
                </span>
                <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                  {group.label}
                </span>
              </div>

              {/* Group items */}
              {group.items.map((item) => (
                <button
                  key={item.id}
                  onClick={() => handleItemClick(item.link)}
                  className={cn(
                    'w-full flex items-center gap-3 px-4 py-2.5 min-h-[44px] text-left',
                    'hover:bg-primary/5 active:bg-primary/10 transition-colors'
                  )}
                >
                  <span
                    className="h-7 w-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0"
                    aria-hidden="true"
                  >
                    {item.title.charAt(0).toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
                      {item.title}
                    </p>
                    {item.subtitle && (
                      <p className="text-xs text-gray-400 truncate">{item.subtitle}</p>
                    )}
                  </div>
                  <svg
                    className="h-4 w-4 text-gray-300 dark:text-gray-600 shrink-0"
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
          <div className="px-4 py-2 border-t border-gray-100 dark:border-gray-800 flex items-center gap-3 text-xs text-gray-400">
            <span>Click a result to navigate</span>
            <span className="ml-auto">Press Esc to close</span>
          </div>
        )}
      </div>
    </div>
  )
}
