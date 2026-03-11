import { type CalendarEvent } from '../../api/calendar'

interface EventDetailPopoverProps {
  event: CalendarEvent
  anchorRect?: DOMRect | null
  onClose: () => void
  onEdit: (event: CalendarEvent) => void
  onDelete: (id: string) => void
}

function formatTime(iso: string) {
  const d = new Date(iso)
  const h = d.getHours()
  const m = d.getMinutes()
  const period = h >= 12 ? 'PM' : 'AM'
  const hour = h % 12 || 12
  return `${hour}:${String(m).padStart(2, '0')} ${period}`
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-KE', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

const EVENT_TYPE_COLORS: Record<string, { dot: string; label: string }> = {
  meeting:  { dot: '#51459d', label: 'Meeting' },
  task:     { dot: '#6fd943', label: 'Task' },
  reminder: { dot: '#ffa21d', label: 'Reminder' },
  holiday:  { dot: '#ff3a6e', label: 'Holiday' },
}

export default function EventDetailPopover({
  event,
  anchorRect,
  onClose,
  onEdit,
  onDelete,
}: EventDetailPopoverProps) {
  const typeConfig = EVENT_TYPE_COLORS[event.event_type] ?? EVENT_TYPE_COLORS.meeting

  // Position popover near anchor if available, otherwise center
  const style: React.CSSProperties = anchorRect
    ? {
        position: 'fixed',
        top: Math.min(anchorRect.bottom + 8, window.innerHeight - 320),
        left: Math.min(anchorRect.left, window.innerWidth - 340),
        zIndex: 60,
      }
    : {
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 60,
      }

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-50" onClick={onClose} />

      {/* Popover */}
      <div
        style={style}
        className="w-80 bg-white dark:bg-gray-800 rounded-[10px] shadow-xl border border-gray-100 dark:border-gray-800 overflow-hidden"
      >
        {/* Header with color strip */}
        <div className="h-1.5" style={{ backgroundColor: typeConfig.dot }} />
        <div className="p-4">
          {/* Title + type badge */}
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1 min-w-0 pr-2">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 leading-tight">
                {event.title}
              </h3>
              <span
                className="inline-block mt-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full"
                style={{
                  backgroundColor: typeConfig.dot + '15',
                  color: typeConfig.dot,
                }}
              >
                {typeConfig.label}
              </span>
            </div>
            <button
              onClick={onClose}
              className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-[6px] text-gray-400 transition-colors shrink-0"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Details */}
          <div className="space-y-2.5 text-xs text-gray-600 dark:text-gray-400">
            {/* Date & time */}
            <div className="flex items-start gap-2">
              <svg className="h-4 w-4 text-gray-400 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <p className="font-medium text-gray-700 dark:text-gray-300">{formatDate(event.start_time)}</p>
                {event.all_day ? (
                  <p className="text-gray-400">All day</p>
                ) : (
                  <p className="text-gray-500">
                    {formatTime(event.start_time)}
                    {event.end_time && ` - ${formatTime(event.end_time)}`}
                  </p>
                )}
              </div>
            </div>

            {/* Location */}
            {event.location && (
              <div className="flex items-start gap-2">
                <svg className="h-4 w-4 text-gray-400 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span>{event.location}</span>
              </div>
            )}

            {/* Description */}
            {event.description && (
              <div className="flex items-start gap-2">
                <svg className="h-4 w-4 text-gray-400 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
                </svg>
                <p className="text-gray-500 line-clamp-3">{event.description}</p>
              </div>
            )}

            {/* Attendees */}
            {event.attendees && event.attendees.length > 0 && (
              <div className="flex items-start gap-2">
                <svg className="h-4 w-4 text-gray-400 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <div className="flex flex-wrap gap-1">
                  {event.attendees.map((a, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center gap-1 bg-gray-100 dark:bg-gray-900 text-gray-600 dark:text-gray-400 text-[10px] px-2 py-0.5 rounded-full"
                    >
                      <span className="w-4 h-4 rounded-full bg-[#51459d]/10 text-[#51459d] flex items-center justify-center text-[8px] font-bold">
                        {a.charAt(0).toUpperCase()}
                      </span>
                      {a}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Recurrence */}
            {event.recurrence_rule && (
              <div className="flex items-center gap-2">
                <svg className="h-4 w-4 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <span className="text-gray-400">Recurring: {event.recurrence_rule}</span>
              </div>
            )}

            {/* Jitsi link */}
            {event.jitsi_room && (
              <a
                href={event.jitsi_room}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-[#51459d] hover:underline"
              >
                <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                Join video call
              </a>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-800 flex items-center justify-end gap-2">
          <button
            onClick={() => {
              if (window.confirm('Delete this event?')) {
                onDelete(event.id)
                onClose()
              }
            }}
            className="px-3 py-1.5 text-xs text-[#ff3a6e] hover:bg-red-50 rounded-[6px] transition-colors"
          >
            Delete
          </button>
          <button
            onClick={() => {
              onEdit(event)
              onClose()
            }}
            className="px-3 py-1.5 text-xs bg-[#51459d] text-white rounded-[6px] hover:bg-[#3d3480] transition-colors"
          >
            Edit
          </button>
        </div>
      </div>
    </>
  )
}
