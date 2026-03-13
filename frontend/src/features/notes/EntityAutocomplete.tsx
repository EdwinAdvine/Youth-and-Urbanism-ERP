import { useEffect, useRef, useState, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import apiClient from '../../api/client'

interface EntityItem {
  id: string
  label: string
  type: string
}

interface UserItem {
  id: string
  name: string
  email: string
  avatar_url?: string
}

interface EntityAutocompleteProps {
  query: string
  type: 'user' | 'entity'
  onSelect: (item: { id: string; label: string; type: string }) => void
  onClose: () => void
  position: { top: number; left: number }
}

function useDebounced<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

const ENTITY_TYPE_COLORS: Record<string, string> = {
  note: '#51459d',
  invoice: '#6fd943',
  project: '#3ec9d6',
  deal: '#ffa21d',
  contact: '#ff3a6e',
  ticket: '#9333ea',
  employee: '#f97316',
  user: '#3ec9d6',
}

export default function EntityAutocomplete({
  query,
  type,
  onSelect,
  onClose,
  position,
}: EntityAutocompleteProps) {
  const [activeIndex, setActiveIndex] = useState(0)
  const listRef = useRef<HTMLDivElement>(null)
  const debouncedQuery = useDebounced(query, 300)

  const userQuery = useQuery<{ users: UserItem[] }>({
    queryKey: ['users', 'search', debouncedQuery],
    queryFn: async () => {
      const { data } = await apiClient.get<{ users: UserItem[] }>('/users/search', {
        params: { q: debouncedQuery, limit: 8 },
      })
      return data
    },
    enabled: type === 'user',
  })

  const entityQuery = useQuery<{ results: (EntityItem & { entity_type?: string })[] }>({
    queryKey: ['notes', 'search', 'entities', debouncedQuery],
    queryFn: async () => {
      const { data } = await apiClient.get('/notes/search/entities', {
        params: { q: debouncedQuery, limit: 8 },
      })
      return data
    },
    enabled: type === 'entity',
  })

  const items: { id: string; label: string; type: string; sub?: string; avatar?: string }[] =
    type === 'user'
      ? (userQuery.data?.users ?? []).map((u) => ({
          id: u.id,
          label: u.name,
          type: 'user',
          sub: u.email,
          avatar: u.avatar_url,
        }))
      : (entityQuery.data?.results ?? []).map((e) => ({
          id: e.id,
          label: e.label,
          type: e.type,
          sub: e.entity_type,
        }))

  const isLoading = type === 'user' ? userQuery.isLoading : entityQuery.isLoading

  // Reset active index when items change
  useEffect(() => {
    setActiveIndex(0)
  }, [items.length])

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setActiveIndex((i) => Math.min(i + 1, items.length - 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setActiveIndex((i) => Math.max(i - 1, 0))
      } else if (e.key === 'Enter') {
        e.preventDefault()
        if (items[activeIndex]) {
          onSelect(items[activeIndex])
        }
      } else if (e.key === 'Escape') {
        onClose()
      }
    },
    [items, activeIndex, onSelect, onClose]
  )

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  // Scroll active item into view
  useEffect(() => {
    const list = listRef.current
    if (!list) return
    const active = list.children[activeIndex] as HTMLElement | undefined
    active?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex])

  if (!isLoading && items.length === 0) {
    return null
  }

  return (
    <div
      style={{
        position: 'absolute',
        top: position.top,
        left: position.left,
        zIndex: 50,
        background: '#fff',
        border: '1px solid #e5e7eb',
        borderRadius: 10,
        boxShadow: '0 8px 28px rgba(0,0,0,0.15)',
        minWidth: 260,
        maxWidth: 320,
        maxHeight: 300,
        overflow: 'hidden',
        fontFamily: 'Open Sans, sans-serif',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '8px 12px',
          borderBottom: '1px solid #f3f4f6',
          fontSize: 11,
          color: '#9ca3af',
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        }}
      >
        {type === 'user' ? '@Mention user' : '#Link entity'}
        {query && ` — "${query}"`}
      </div>

      {isLoading && (
        <div style={{ padding: '14px 12px', display: 'flex', alignItems: 'center', gap: 8, color: '#9ca3af', fontSize: 13 }}>
          <div style={miniSpinner} />
          Searching...
        </div>
      )}

      {!isLoading && (
        <div ref={listRef} style={{ overflowY: 'auto', maxHeight: 240 }}>
          {items.map((item, idx) => {
            const color = ENTITY_TYPE_COLORS[item.type] ?? '#6b7280'
            const isActive = idx === activeIndex

            return (
              <button
                key={item.id}
                onClick={() => onSelect(item)}
                onMouseEnter={() => setActiveIndex(idx)}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '9px 12px',
                  border: 'none',
                  background: isActive ? 'rgba(81,69,157,0.07)' : 'transparent',
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontFamily: 'Open Sans, sans-serif',
                  borderLeft: isActive ? '3px solid #51459d' : '3px solid transparent',
                  transition: 'background 0.1s',
                }}
              >
                {/* Avatar or type icon */}
                {item.avatar ? (
                  <img
                    src={item.avatar}
                    alt={item.label}
                    style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
                  />
                ) : (
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: '50%',
                      background: `${color}20`,
                      border: `1.5px solid ${color}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 11,
                      fontWeight: 700,
                      color,
                      flexShrink: 0,
                    }}
                  >
                    {item.label.charAt(0).toUpperCase()}
                  </div>
                )}

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {item.label}
                  </div>
                  {item.sub && (
                    <div style={{ fontSize: 11, color: '#9ca3af', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {item.sub}
                    </div>
                  )}
                </div>

                {/* Type badge */}
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 600,
                    color: '#fff',
                    background: color,
                    borderRadius: 4,
                    padding: '2px 6px',
                    textTransform: 'capitalize',
                    flexShrink: 0,
                  }}
                >
                  {item.type}
                </span>
              </button>
            )
          })}
        </div>
      )}

      {/* Footer hint */}
      <div
        style={{
          padding: '6px 12px',
          borderTop: '1px solid #f3f4f6',
          fontSize: 10,
          color: '#c4c7cc',
          display: 'flex',
          gap: 12,
        }}
      >
        <span>↑↓ Navigate</span>
        <span>↵ Select</span>
        <span>Esc Close</span>
      </div>
    </div>
  )
}

const miniSpinner: React.CSSProperties = {
  width: 14,
  height: 14,
  borderRadius: '50%',
  border: '2px solid #e5e7eb',
  borderTop: '2px solid #51459d',
  animation: 'spin 0.8s linear infinite',
  flexShrink: 0,
}
