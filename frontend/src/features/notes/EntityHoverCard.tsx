import { useState, useRef, useCallback, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import apiClient from '../../api/client'

interface EntityHoverCardProps {
  entityType: string
  entityId: string
  children: React.ReactNode
}

// Entity-specific widget data shapes (all optional since they vary by type)
interface WidgetData {
  // invoice
  status?: string
  amount?: number
  due_date?: string
  client?: string
  currency?: string
  // project
  progress?: number
  team_size?: number
  // deal
  stage?: string
  value?: number
  contact_name?: string
  // contact
  email?: string
  phone?: string
  company?: string
  // ticket
  priority?: string
  created_date?: string
  // employee
  department?: string
  job_title?: string
  // note
  title?: string
  word_count?: number
  last_edited?: string
  // common
  name?: string
}

const STATUS_COLORS: Record<string, string> = {
  active: '#6fd943',
  open: '#3ec9d6',
  closed: '#9ca3af',
  paid: '#6fd943',
  pending: '#ffa21d',
  overdue: '#ff3a6e',
  won: '#6fd943',
  lost: '#ff3a6e',
  draft: '#9ca3af',
  high: '#ff3a6e',
  medium: '#ffa21d',
  low: '#6fd943',
  critical: '#ff3a6e',
}

function StatusBadge({ value }: { value: string }) {
  const color = STATUS_COLORS[value.toLowerCase()] ?? '#9ca3af'
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '2px 8px',
        borderRadius: 4,
        fontSize: 11,
        fontWeight: 600,
        background: `${color}20`,
        color,
        textTransform: 'capitalize',
      }}
    >
      {value}
    </span>
  )
}

function ProgressBar({ value }: { value: number }) {
  const clamped = Math.min(100, Math.max(0, value))
  return (
    <div style={{ background: '#e5e7eb', borderRadius: 4, height: 6, overflow: 'hidden', flex: 1 }}>
      <div
        style={{
          width: `${clamped}%`,
          height: '100%',
          background: clamped >= 80 ? '#6fd943' : clamped >= 40 ? '#3ec9d6' : '#ffa21d',
          borderRadius: 4,
          transition: 'width 0.3s ease',
        }}
      />
    </div>
  )
}

function SkeletonRow() {
  return (
    <div
      style={{
        height: 12,
        background: 'linear-gradient(90deg, #f3f4f6 25%, #e5e7eb 50%, #f3f4f6 75%)',
        backgroundSize: '200% 100%',
        borderRadius: 4,
        animation: 'shimmer 1.5s infinite',
        marginBottom: 8,
      }}
    />
  )
}

function CardRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
      <span style={{ fontSize: 11, color: '#9ca3af', fontWeight: 500 }}>{label}</span>
      <span style={{ fontSize: 12, color: '#374151', fontWeight: 600, textAlign: 'right', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{children}</span>
    </div>
  )
}

function WidgetContent({ entityType, data }: { entityType: string; data: WidgetData }) {
  const formatCurrency = (amount?: number, currency = 'USD') => {
    if (amount === undefined) return '—'
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount)
  }

  switch (entityType) {
    case 'invoice':
      return (
        <>
          {data.client && <CardRow label="Client">{data.client}</CardRow>}
          {data.amount !== undefined && <CardRow label="Amount">{formatCurrency(data.amount, data.currency)}</CardRow>}
          {data.due_date && <CardRow label="Due">{new Date(data.due_date).toLocaleDateString()}</CardRow>}
          {data.status && <CardRow label="Status"><StatusBadge value={data.status} /></CardRow>}
        </>
      )
    case 'project':
      return (
        <>
          {data.status && <CardRow label="Status"><StatusBadge value={data.status} /></CardRow>}
          {data.team_size !== undefined && <CardRow label="Team">{data.team_size} members</CardRow>}
          {data.progress !== undefined && (
            <div style={{ marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 11, color: '#9ca3af' }}>Progress</span>
                <span style={{ fontSize: 11, color: '#374151', fontWeight: 600 }}>{data.progress}%</span>
              </div>
              <ProgressBar value={data.progress} />
            </div>
          )}
        </>
      )
    case 'deal':
      return (
        <>
          {data.stage && <CardRow label="Stage"><StatusBadge value={data.stage} /></CardRow>}
          {data.value !== undefined && <CardRow label="Value">{formatCurrency(data.value)}</CardRow>}
          {data.contact_name && <CardRow label="Contact">{data.contact_name}</CardRow>}
        </>
      )
    case 'contact':
      return (
        <>
          {data.company && <CardRow label="Company">{data.company}</CardRow>}
          {data.email && <CardRow label="Email">{data.email}</CardRow>}
          {data.phone && <CardRow label="Phone">{data.phone}</CardRow>}
        </>
      )
    case 'ticket':
      return (
        <>
          {data.status && <CardRow label="Status"><StatusBadge value={data.status} /></CardRow>}
          {data.priority && <CardRow label="Priority"><StatusBadge value={data.priority} /></CardRow>}
          {data.created_date && <CardRow label="Created">{new Date(data.created_date).toLocaleDateString()}</CardRow>}
        </>
      )
    case 'employee':
      return (
        <>
          {data.job_title && <CardRow label="Title">{data.job_title}</CardRow>}
          {data.department && <CardRow label="Dept">{data.department}</CardRow>}
          {data.email && <CardRow label="Email">{data.email}</CardRow>}
        </>
      )
    case 'note':
      return (
        <>
          {data.word_count !== undefined && <CardRow label="Words">{data.word_count.toLocaleString()}</CardRow>}
          {data.last_edited && <CardRow label="Edited">{new Date(data.last_edited).toLocaleDateString()}</CardRow>}
        </>
      )
    default:
      return (
        <div style={{ fontSize: 12, color: '#9ca3af', fontStyle: 'italic' }}>
          No preview available for this entity type.
        </div>
      )
  }
}

const ENTITY_COLORS: Record<string, string> = {
  note: '#51459d',
  invoice: '#6fd943',
  project: '#3ec9d6',
  deal: '#ffa21d',
  contact: '#ff3a6e',
  ticket: '#9333ea',
  employee: '#f97316',
}

export default function EntityHoverCard({ entityType, entityId, children }: EntityHoverCardProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [cardPos, setCardPos] = useState<{ top: number; left: number } | null>(null)
  const [isFetching, setIsFetching] = useState(false)

  const showTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const triggerRef = useRef<HTMLSpanElement>(null)

  const { data, isLoading } = useQuery<WidgetData>({
    queryKey: ['notes', 'widget', entityType, entityId],
    queryFn: async () => {
      const { data } = await apiClient.get<WidgetData>(`/notes/widgets/${entityType}/${entityId}`)
      return data
    },
    enabled: isFetching,
    staleTime: 60_000,
  })

  const positionCard = useCallback(() => {
    const trigger = triggerRef.current
    if (!trigger) return
    const rect = trigger.getBoundingClientRect()
    const cardWidth = 280
    const cardHeight = 160

    let left = rect.left + window.scrollX
    if (left + cardWidth > window.innerWidth - 16) {
      left = window.innerWidth - cardWidth - 16
    }

    let top: number
    if (rect.top - cardHeight - 8 > 8) {
      top = rect.top + window.scrollY - cardHeight - 8
    } else {
      top = rect.bottom + window.scrollY + 8
    }

    setCardPos({ top, left })
  }, [])

  const handleMouseEnter = useCallback(() => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current)
      hideTimerRef.current = null
    }
    showTimerRef.current = setTimeout(() => {
      setIsFetching(true)
      positionCard()
      setIsVisible(true)
    }, 400)
  }, [positionCard])

  const handleMouseLeave = useCallback(() => {
    if (showTimerRef.current) {
      clearTimeout(showTimerRef.current)
      showTimerRef.current = null
    }
    hideTimerRef.current = setTimeout(() => {
      setIsVisible(false)
    }, 200)
  }, [])

  useEffect(() => {
    return () => {
      if (showTimerRef.current) clearTimeout(showTimerRef.current)
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current)
    }
  }, [])

  const color = ENTITY_COLORS[entityType] ?? '#6b7280'
  const cardTitle = (data as WidgetData & { title?: string; name?: string })?.title
    ?? (data as WidgetData & { name?: string })?.name
    ?? `${entityType} #${entityId.slice(0, 8)}`

  return (
    <>
      <span
        ref={triggerRef}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        style={{
          cursor: 'pointer',
          textDecoration: 'underline dotted',
          textDecorationColor: color,
          color: 'inherit',
        }}
      >
        {children}
      </span>

      {isVisible && cardPos && (
        <div
          style={{
            position: 'fixed',
            top: cardPos.top,
            left: cardPos.left,
            zIndex: 9999,
            width: 280,
            background: '#fff',
            borderRadius: 10,
            boxShadow: '0 8px 30px rgba(0,0,0,0.18)',
            border: `1.5px solid ${color}30`,
            fontFamily: 'Open Sans, sans-serif',
            overflow: 'hidden',
            animation: 'fadeIn 0.15s ease',
          }}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          {/* Card header */}
          <div
            style={{
              padding: '10px 14px',
              background: `${color}12`,
              borderBottom: `1px solid ${color}20`,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: color,
                flexShrink: 0,
              }}
            />
            <span
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: '#111827',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {isLoading ? '...' : cardTitle}
            </span>
            <span
              style={{
                marginLeft: 'auto',
                fontSize: 10,
                fontWeight: 600,
                color: '#fff',
                background: color,
                borderRadius: 4,
                padding: '1px 6px',
                textTransform: 'capitalize',
                flexShrink: 0,
              }}
            >
              {entityType}
            </span>
          </div>

          {/* Card body */}
          <div style={{ padding: '12px 14px' }}>
            {isLoading ? (
              <>
                <SkeletonRow />
                <SkeletonRow />
                <div style={{ height: 12, background: '#f3f4f6', borderRadius: 4, width: '60%', animation: 'shimmer 1.5s infinite' }} />
              </>
            ) : data ? (
              <WidgetContent entityType={entityType} data={data} />
            ) : (
              <div style={{ fontSize: 12, color: '#9ca3af', fontStyle: 'italic' }}>Unable to load data.</div>
            )}
          </div>
        </div>
      )}

      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }
        @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
      `}</style>
    </>
  )
}
