import { cn, Spinner } from '../../components/ui'
import { useTicketAuditLog, type AuditLogEntry } from '../../api/support_phase1'

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const minutes = Math.floor(diff / (1000 * 60))
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

const ACTION_STYLES: Record<string, { color: string; bg: string; icon: React.ReactNode }> = {
  created: {
    color: 'bg-[#6fd943]',
    bg: 'bg-[#6fd943]/10',
    icon: (
      <svg className="h-4 w-4 text-[#6fd943]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
      </svg>
    ),
  },
  assigned: {
    color: 'bg-[#3ec9d6]',
    bg: 'bg-[#3ec9d6]/10',
    icon: (
      <svg className="h-4 w-4 text-[#3ec9d6]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
    ),
  },
  status_changed: {
    color: 'bg-[#51459d]',
    bg: 'bg-[#51459d]/10',
    icon: (
      <svg className="h-4 w-4 text-[#51459d]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
      </svg>
    ),
  },
  field_changed: {
    color: 'bg-[#ffa21d]',
    bg: 'bg-[#ffa21d]/10',
    icon: (
      <svg className="h-4 w-4 text-[#ffa21d]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
      </svg>
    ),
  },
  comment_added: {
    color: 'bg-[#ff3a6e]',
    bg: 'bg-[#ff3a6e]/10',
    icon: (
      <svg className="h-4 w-4 text-[#ff3a6e]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
      </svg>
    ),
  },
}

const DEFAULT_STYLE = {
  color: 'bg-gray-400',
  bg: 'bg-gray-100',
  icon: (
    <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
}

function describeAction(entry: AuditLogEntry): string {
  switch (entry.action) {
    case 'created':
      return 'Ticket created'
    case 'assigned':
      return entry.new_value ? `Assigned to ${entry.new_value}` : 'Assignee updated'
    case 'status_changed':
      if (entry.old_value && entry.new_value) {
        return `Status changed from ${entry.old_value.replace(/_/g, ' ')} to ${entry.new_value.replace(/_/g, ' ')}`
      }
      return entry.new_value ? `Status set to ${entry.new_value.replace(/_/g, ' ')}` : 'Status changed'
    case 'field_changed':
      if (entry.field_name) {
        const field = entry.field_name.replace(/_/g, ' ')
        if (entry.old_value && entry.new_value) {
          return `${field} changed from "${entry.old_value}" to "${entry.new_value}"`
        }
        return entry.new_value ? `${field} set to "${entry.new_value}"` : `${field} updated`
      }
      return 'Field updated'
    case 'comment_added':
      return 'Comment added'
    default:
      return entry.action.replace(/_/g, ' ')
  }
}

export default function TicketAuditLog({ ticketId }: { ticketId: string }) {
  const { data: entries, isLoading } = useTicketAuditLog(ticketId)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner size="lg" />
      </div>
    )
  }

  if (!entries || entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-gray-400">
        <svg className="h-10 w-10 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p className="text-sm font-medium">No audit history</p>
        <p className="text-xs mt-1">Changes to this ticket will appear here</p>
      </div>
    )
  }

  return (
    <div className="relative">
      {/* Vertical timeline line */}
      <div className="absolute left-5 top-3 bottom-3 w-px bg-gray-200 dark:bg-gray-700" />

      <div className="space-y-6">
        {entries.map((entry) => {
          const style = ACTION_STYLES[entry.action] ?? DEFAULT_STYLE
          return (
            <div key={entry.id} className="relative flex gap-4 pl-1">
              {/* Icon circle */}
              <div
                className={cn(
                  'relative z-10 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full',
                  style.bg
                )}
              >
                {style.icon}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0 pt-1">
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {describeAction(entry)}
                </p>
                <div className="flex items-center gap-3 mt-1">
                  {entry.user_name && (
                    <span className="text-xs text-gray-500">{entry.user_name}</span>
                  )}
                  <span className="text-xs text-gray-400">{timeAgo(entry.created_at)}</span>
                </div>
                {entry.ip_address && (
                  <span className="text-[10px] text-gray-400 mt-0.5 block">
                    IP: {entry.ip_address}
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
