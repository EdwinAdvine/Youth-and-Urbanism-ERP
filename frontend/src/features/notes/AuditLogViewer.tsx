import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import apiClient from '../../api/client'

interface AuditLogEntry {
  id: string
  action: string
  user_name: string
  ip_address: string
  created_at: string
  details: string
}

interface AuditLogResponse {
  logs: AuditLogEntry[]
}

interface AuditLogViewerProps {
  noteId: string
  onClose: () => void
}

const ACTION_COLORS: Record<string, string> = {
  view: '#3ec9d6',
  edit: '#ffa21d',
  share: '#51459d',
  export: '#6fd943',
  delete: '#ff3a6e',
}

function ActionIcon({ action }: { action: string }) {
  const color = ACTION_COLORS[action] ?? '#9ca3af'
  switch (action) {
    case 'view':
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke={color} strokeWidth="2" />
          <circle cx="12" cy="12" r="3" stroke={color} strokeWidth="2" />
        </svg>
      )
    case 'edit':
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" stroke={color} strokeWidth="2" strokeLinecap="round" />
          <path d="M18.5 2.5a2.1 2.1 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" stroke={color} strokeWidth="2" strokeLinejoin="round" />
        </svg>
      )
    case 'share':
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
          <circle cx="18" cy="5" r="3" stroke={color} strokeWidth="2" />
          <circle cx="6" cy="12" r="3" stroke={color} strokeWidth="2" />
          <circle cx="18" cy="19" r="3" stroke={color} strokeWidth="2" />
          <line x1="8.6" y1="13.5" x2="15.4" y2="17.5" stroke={color} strokeWidth="2" />
          <line x1="15.4" y1="6.5" x2="8.6" y2="10.5" stroke={color} strokeWidth="2" />
        </svg>
      )
    case 'export':
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" stroke={color} strokeWidth="2" strokeLinecap="round" />
          <polyline points="7 10 12 15 17 10" stroke={color} strokeWidth="2" strokeLinecap="round" />
          <line x1="12" y1="15" x2="12" y2="3" stroke={color} strokeWidth="2" strokeLinecap="round" />
        </svg>
      )
    case 'delete':
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
          <polyline points="3 6 5 6 21 6" stroke={color} strokeWidth="2" strokeLinecap="round" />
          <path d="M19 6l-1 14H6L5 6M10 11v6M14 11v6" stroke={color} strokeWidth="2" strokeLinecap="round" />
          <path d="M9 6V4h6v2" stroke={color} strokeWidth="2" strokeLinecap="round" />
        </svg>
      )
    default:
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" stroke={color} strokeWidth="2" />
          <line x1="12" y1="8" x2="12" y2="12" stroke={color} strokeWidth="2" strokeLinecap="round" />
          <circle cx="12" cy="16" r="1" fill={color} />
        </svg>
      )
  }
}

function formatRelativeTime(dateStr: string): string {
  const now = Date.now()
  const past = new Date(dateStr).getTime()
  const diff = Math.floor((now - past) / 1000)

  if (diff < 60) return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`
  return new Date(dateStr).toLocaleDateString()
}

const PAGE_SIZE = 20

export default function AuditLogViewer({ noteId, onClose }: AuditLogViewerProps) {
  const [offset, setOffset] = useState(0)
  const [allLogs, setAllLogs] = useState<AuditLogEntry[]>([])

  const query = useQuery<AuditLogResponse>({
    queryKey: ['notes', noteId, 'audit-log', offset],
    queryFn: async () => {
      const { data } = await apiClient.get<AuditLogResponse>(`/notes/${noteId}/audit-log`, {
        params: { limit: PAGE_SIZE, offset },
      })
      if (offset === 0) {
        setAllLogs(data.logs)
      } else {
        setAllLogs((prev) => [...prev, ...data.logs])
      }
      return data
    },
    enabled: !!noteId,
  })

  const handleLoadMore = () => {
    setOffset((prev) => prev + PAGE_SIZE)
  }

  const hasMore = (query.data?.logs.length ?? 0) === PAGE_SIZE

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        right: 0,
        bottom: 0,
        width: 320,
        zIndex: 50,
        background: '#fff',
        boxShadow: '-4px 0 24px rgba(0,0,0,0.15)',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: 'Open Sans, sans-serif',
        animation: 'slideInRight 0.25s ease',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '14px 16px',
          borderBottom: '1px solid #e5e7eb',
          background: '#fafafa',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M9 11l3 3L22 4" stroke="#51459d" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" stroke="#51459d" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <span style={{ fontWeight: 700, fontSize: 15, color: '#111827' }}>Audit Log</span>
        </div>
        <button onClick={onClose} style={closeBtnStyle} aria-label="Close">×</button>
      </div>

      {/* Legend */}
      <div
        style={{
          display: 'flex',
          gap: 10,
          padding: '8px 16px',
          borderBottom: '1px solid #f3f4f6',
          flexWrap: 'wrap',
        }}
      >
        {Object.entries(ACTION_COLORS).map(([action, color]) => (
          <div key={action} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#6b7280' }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: color }} />
            <span style={{ textTransform: 'capitalize' }}>{action}</span>
          </div>
        ))}
      </div>

      {/* Log list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
        {query.isLoading && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 32 }}>
            <div style={spinnerStyle} />
          </div>
        )}

        {query.isError && (
          <div style={{ padding: '16px', textAlign: 'center', color: '#ff3a6e', fontSize: 13 }}>
            Failed to load audit log.
          </div>
        )}

        {!query.isLoading && allLogs.length === 0 && (
          <div style={{ padding: '32px 16px', textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>
            No audit log entries found.
          </div>
        )}

        {allLogs.map((entry) => (
          <div
            key={entry.id}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 10,
              padding: '10px 16px',
              borderBottom: '1px solid #f3f4f6',
            }}
          >
            <div
              style={{
                width: 30,
                height: 30,
                borderRadius: '50%',
                background: `${ACTION_COLORS[entry.action] ?? '#9ca3af'}18`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                marginTop: 2,
              }}
            >
              <ActionIcon action={entry.action} />
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>{entry.user_name}</span>
                <span
                  style={{
                    fontSize: 11,
                    color: ACTION_COLORS[entry.action] ?? '#6b7280',
                    fontWeight: 600,
                    textTransform: 'capitalize',
                    background: `${ACTION_COLORS[entry.action] ?? '#9ca3af'}18`,
                    padding: '1px 6px',
                    borderRadius: 4,
                  }}
                >
                  {entry.action}
                </span>
              </div>

              {entry.details && (
                <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2, lineHeight: 1.4 }}>
                  {entry.details}
                </div>
              )}

              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                <span style={{ fontSize: 11, color: '#9ca3af' }}>{formatRelativeTime(entry.created_at)}</span>
                {entry.ip_address && (
                  <>
                    <span style={{ color: '#d1d5db', fontSize: 11 }}>·</span>
                    <span style={{ fontSize: 11, color: '#9ca3af', fontFamily: 'monospace' }}>{entry.ip_address}</span>
                  </>
                )}
              </div>
            </div>
          </div>
        ))}

        {/* Load more */}
        {!query.isLoading && hasMore && (
          <div style={{ padding: '12px 16px' }}>
            <button
              onClick={handleLoadMore}
              disabled={query.isFetching}
              style={{
                width: '100%',
                padding: '8px',
                border: '1px solid #e5e7eb',
                borderRadius: 8,
                background: '#fff',
                cursor: 'pointer',
                fontSize: 13,
                color: '#51459d',
                fontFamily: 'Open Sans, sans-serif',
                fontWeight: 600,
              }}
            >
              {query.isFetching ? 'Loading...' : 'Load More'}
            </button>
          </div>
        )}
      </div>

      <style>{`
        @keyframes slideInRight { from { transform: translateX(100%); } to { transform: translateX(0); } }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}

const closeBtnStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  fontSize: 22,
  cursor: 'pointer',
  color: '#9ca3af',
  lineHeight: 1,
  padding: 0,
}

const spinnerStyle: React.CSSProperties = {
  width: 28,
  height: 28,
  borderRadius: '50%',
  border: '3px solid #e5e7eb',
  borderTop: '3px solid #51459d',
  animation: 'spin 1s linear infinite',
}
