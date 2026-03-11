import { useMemo, useState } from 'react'
import { Card, Spinner, Badge, Button } from '../../components/ui'
import { useCalendarEvents, type CalendarEvent } from '../../api/calendar'

const EVENT_COLORS: Record<string, string> = {
  meeting: 'bg-primary/10 text-primary border-primary/20',
  task: 'bg-cyan-50 text-cyan-700 border-cyan-200',
  reminder: 'bg-orange-50 text-orange-700 border-orange-200',
  holiday: 'bg-green-50 text-green-700 border-green-200',
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' })
}

function formatDateHeader(date: string): string {
  const d = new Date(date)
  const today = new Date()
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  if (d.toDateString() === today.toDateString()) return 'Today'
  if (d.toDateString() === tomorrow.toDateString()) return 'Tomorrow'
  return d.toLocaleDateString('en', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
}

export default function AgendaView() {
  const [daysAhead, setDaysAhead] = useState(14)
  const start = new Date().toISOString()
  const end = new Date(Date.now() + daysAhead * 86400000).toISOString()

  const { data, isLoading } = useCalendarEvents({ start, end })

  const grouped = useMemo(() => {
    if (!data?.events) return new Map<string, CalendarEvent[]>()
    const sorted = [...data.events].sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
    const groups = new Map<string, CalendarEvent[]>()
    for (const event of sorted) {
      const dateKey = new Date(event.start_time).toDateString()
      const existing = groups.get(dateKey) ?? []
      existing.push(event)
      groups.set(dateKey, existing)
    }
    return groups
  }, [data])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Agenda</h1>
          <p className="text-sm text-gray-500 mt-1">Upcoming events sorted by date</p>
        </div>
        <div className="flex items-center gap-2">
          {[7, 14, 30].map((d) => (
            <Button
              key={d}
              size="sm"
              variant={daysAhead === d ? 'primary' : 'outline'}
              onClick={() => setDaysAhead(d)}
            >
              {d} days
            </Button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-24"><Spinner size="lg" /></div>
      ) : grouped.size === 0 ? (
        <Card>
          <div className="text-center py-16 text-gray-400">
            No upcoming events in the next {daysAhead} days.
          </div>
        </Card>
      ) : (
        <div className="space-y-6">
          {Array.from(grouped.entries()).map(([dateKey, events]) => (
            <div key={dateKey}>
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
                {formatDateHeader(dateKey)}
              </h2>
              <div className="space-y-2">
                {events.map((event) => {
                  const colorClass = EVENT_COLORS[event.event_type] ?? EVENT_COLORS.meeting
                  return (
                    <Card key={event.id} className={`border ${colorClass} !p-4`}>
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="text-sm font-semibold truncate">{event.title}</h3>
                            <Badge variant={event.event_type === 'meeting' ? 'primary' : event.event_type === 'task' ? 'info' : 'default'} className="capitalize">
                              {event.event_type}
                            </Badge>
                          </div>
                          {event.description && (
                            <p className="text-xs mt-1 opacity-80 truncate">{event.description}</p>
                          )}
                          <div className="flex items-center gap-4 mt-2 text-xs opacity-70">
                            <span>
                              {event.all_day
                                ? 'All day'
                                : `${formatTime(event.start_time)} - ${formatTime(event.end_time)}`}
                            </span>
                            {event.location && (
                              <span className="flex items-center gap-1">
                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                                {event.location}
                              </span>
                            )}
                            {event.attendees && event.attendees.length > 0 && (
                              <span>{event.attendees.length} attendee{event.attendees.length !== 1 ? 's' : ''}</span>
                            )}
                          </div>
                        </div>
                        {event.jitsi_room && (
                          <Button
                            size="sm"
                            variant="primary"
                            onClick={() => window.open(event.jitsi_room!, '_blank')}
                          >
                            Join
                          </Button>
                        )}
                      </div>
                    </Card>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
