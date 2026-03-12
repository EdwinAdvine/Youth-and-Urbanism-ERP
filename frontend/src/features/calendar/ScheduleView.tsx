import { useMemo } from 'react'
import type { CalendarEvent } from '../../api/calendar'

// ─── Types ───────────────────────────────────────────────────────────────────

interface ScheduleViewProps {
  /** The week start date */
  weekStart: Date
  events: CalendarEvent[]
  /** User/resource rows to display */
  resources: { id: string; name: string; avatar?: string; color?: string }[]
  onEventClick: (event: CalendarEvent) => void
  onSlotClick: (resourceId: string, date: string, hour: number) => void
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function formatTimeShort(iso: string): string {
  const d = new Date(iso)
  const h = d.getHours()
  const m = d.getMinutes()
  const period = h >= 12 ? 'p' : 'a'
  const hour = h % 12 || 12
  return m === 0 ? `${hour}${period}` : `${hour}:${String(m).padStart(2, '0')}${period}`
}

const EVENT_COLORS: Record<string, string> = {
  meeting:  'bg-[#51459d]',
  task:     'bg-[#6fd943]',
  reminder: 'bg-[#ffa21d]',
  holiday:  'bg-[#ff3a6e]',
  focus:    'bg-indigo-400',
  booking:  'bg-teal-500',
  deadline: 'bg-rose-600',
}

const DAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

// ─── Schedule View (Horizontal timeline per resource) ────────────────────────

export default function ScheduleView({
  weekStart,
  events,
  resources,
  onEventClick,
  onSlotClick,
}: ScheduleViewProps) {
  const todayStr = toDateStr(new Date())

  // Generate 7 dates for the week
  const dates = useMemo(
    () => Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart)
      d.setDate(d.getDate() + i)
      return d
    }),
    [weekStart]
  )

  // Group events by organizer/attendee
  const eventsByResource = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {}
    for (const r of resources) {
      map[r.id] = events.filter(
        (e) => e.organizer_id === r.id || (e.attendees && e.attendees.includes(r.id))
      )
    }
    return map
  }, [events, resources])

  return (
    <div className="flex-1 overflow-auto">
      <div className="min-w-[900px]">
        {/* Header — day labels */}
        <div className="flex border-b border-gray-200 dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-900 z-10">
          <div className="w-40 shrink-0 px-3 py-2 border-r border-gray-200 dark:border-gray-700">
            <span className="text-xs font-semibold text-gray-500">Team Member</span>
          </div>
          <div className="flex-1 flex">
            {dates.map((date) => {
              const dateStr = toDateStr(date)
              const isToday = dateStr === todayStr
              return (
                <div
                  key={dateStr}
                  className={`flex-1 text-center py-2 border-r border-gray-200 dark:border-gray-700 min-w-[120px]
                    ${isToday ? 'bg-[#51459d]/5' : ''}`}
                >
                  <p className="text-[10px] text-gray-400 uppercase">{DAYS_SHORT[date.getDay()]}</p>
                  <p className={`text-sm font-bold ${isToday ? 'text-[#51459d]' : 'text-gray-700 dark:text-gray-300'}`}>
                    {date.getDate()}
                  </p>
                </div>
              )
            })}
          </div>
        </div>

        {/* Resource rows */}
        {resources.length === 0 ? (
          <div className="text-center py-12 text-gray-400 text-sm">
            No team members to display. Add team members to see their schedules.
          </div>
        ) : (
          resources.map((resource) => {
            const resourceEvents = eventsByResource[resource.id] || []

            return (
              <div
                key={resource.id}
                className="flex border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50/50 dark:hover:bg-gray-800/50 transition-colors"
              >
                {/* Resource label */}
                <div className="w-40 shrink-0 px-3 py-3 border-r border-gray-200 dark:border-gray-700 flex items-center gap-2">
                  {resource.avatar ? (
                    <img src={resource.avatar} alt="" className="w-6 h-6 rounded-full" />
                  ) : (
                    <div
                      className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold"
                      style={{ backgroundColor: resource.color || '#51459d' }}
                    >
                      {resource.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <span className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate">
                    {resource.name}
                  </span>
                </div>

                {/* Day columns with events */}
                <div className="flex-1 flex">
                  {dates.map((date) => {
                    const dateStr = toDateStr(date)
                    const isToday = dateStr === todayStr
                    const dayEvents = resourceEvents.filter(
                      (e) => e.start_time.slice(0, 10) === dateStr
                    )

                    return (
                      <div
                        key={dateStr}
                        className={`flex-1 min-w-[120px] px-1 py-1.5 border-r border-gray-100 dark:border-gray-800 min-h-[48px]
                          ${isToday ? 'bg-[#51459d]/[0.02]' : ''}`}
                        onClick={() => onSlotClick(resource.id, dateStr, 9)}
                      >
                        {dayEvents.map((ev) => {
                          const bgColor = EVENT_COLORS[ev.event_type] || EVENT_COLORS.meeting
                          return (
                            <button
                              key={ev.id}
                              onClick={(e) => { e.stopPropagation(); onEventClick(ev) }}
                              className={`w-full text-left text-[9px] font-medium px-1.5 py-1 rounded-[4px] truncate text-white mb-0.5 ${bgColor} hover:brightness-110 transition-all`}
                              title={`${ev.title} (${formatTimeShort(ev.start_time)} - ${formatTimeShort(ev.end_time)})`}
                            >
                              <span className="opacity-75 mr-1">{formatTimeShort(ev.start_time)}</span>
                              {ev.title}
                            </button>
                          )
                        })}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
