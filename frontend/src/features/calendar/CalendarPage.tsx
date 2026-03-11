import { useState, useCallback } from 'react'
import { useSwipeGesture } from '../../hooks/useSwipeGesture'
import {
  useCalendarEvents,
  useCreateCalendarEvent,
  useUpdateCalendarEvent,
  useDeleteCalendarEvent,
  type CalendarEvent,
  type CreateEventPayload,
} from '../../api/calendar'
import MiniCalendar from './MiniCalendar'
import MultiCalendarSidebar from './MultiCalendarSidebar'
import EventDetailPopover from './EventDetailPopover'
import RecurringEventEditor from './RecurringEventEditor'
import CalendarShareDialog from './CalendarShareDialog'
import PrintView from './PrintView'

// ─── Types ───────────────────────────────────────────────────────────────────

type EventType = 'meeting' | 'task' | 'reminder' | 'holiday'
type CalView = 'month' | 'week' | 'day'

// ─── Event type config ────────────────────────────────────────────────────────

const EVENT_COLORS: Record<EventType, { bg: string; text: string; dot: string; light: string }> = {
  meeting:  { bg: 'bg-[#51459d]',  text: 'text-white',      dot: '#51459d',  light: 'bg-[#51459d]/10 text-[#51459d]' },
  task:     { bg: 'bg-[#6fd943]',  text: 'text-white',      dot: '#6fd943',  light: 'bg-green-50 text-green-700' },
  reminder: { bg: 'bg-[#ffa21d]',  text: 'text-white',      dot: '#ffa21d',  light: 'bg-orange-50 text-orange-700' },
  holiday:  { bg: 'bg-[#ff3a6e]',  text: 'text-white',      dot: '#ff3a6e',  light: 'bg-red-50 text-red-700' },
}

const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

// ─── Helpers ─────────────────────────────────────────────────────────────────

const today = new Date()

function toDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Extract YYYY-MM-DD from an ISO datetime string */
function getDateFromIso(iso: string): string {
  return iso.slice(0, 10)
}

/** Extract HH:MM from an ISO datetime string */
function getTimeFromIso(iso: string): string {
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

/** Combine a YYYY-MM-DD date and HH:MM time into an ISO datetime string */
function composeIso(date: string, time: string): string {
  return `${date}T${time}:00`
}

function formatTime(iso?: string) {
  if (!iso) return ''
  const time = getTimeFromIso(iso)
  const [h, min] = time.split(':').map(Number)
  const period = h >= 12 ? 'PM' : 'AM'
  const hour = h % 12 || 12
  return `${hour}:${String(min).padStart(2, '0')} ${period}`
}

// ─── Event Form Modal ─────────────────────────────────────────────────────────

function EventModal({ date, event, onClose, onSave, onDelete }: {
  date: string;
  event?: CalendarEvent;
  onClose: () => void;
  onSave: (payload: CreateEventPayload) => void;
  onDelete?: (id: string) => void;
}) {
  const [title, setTitle] = useState(event?.title ?? '')
  const [type, setType] = useState<EventType>(event?.event_type ?? 'meeting')
  const [time, setTime] = useState(event ? getTimeFromIso(event.start_time) : '')
  const [endTime, setEndTime] = useState(event?.end_time ? getTimeFromIso(event.end_time) : '')
  const [description, setDescription] = useState(event?.description ?? '')
  const [attendees, setAttendees] = useState(event?.attendees?.join(', ') ?? '')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-gray-800 rounded-[10px] shadow-2xl w-full max-w-md">
        <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{event ? 'Edit Event' : 'New Event'}</h3>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-[6px] text-gray-500">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Event title"
              className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-[8px] focus:outline-none focus:ring-1 focus:ring-[#51459d]/40 font-medium bg-transparent"
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Date</label>
              <input type="date" defaultValue={date} className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-[8px] focus:outline-none bg-transparent" readOnly />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Type</label>
              <select value={type} onChange={(e) => setType(e.target.value as EventType)} className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-[8px] focus:outline-none bg-white dark:bg-gray-800">
                <option value="meeting">Meeting</option>
                <option value="task">Task</option>
                <option value="reminder">Reminder</option>
                <option value="holiday">Holiday</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Start time</label>
              <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-[8px] focus:outline-none bg-transparent" />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">End time</label>
              <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-[8px] focus:outline-none bg-transparent" />
            </div>
          </div>

          <div>
            <label className="text-xs text-gray-500 block mb-1">Attendees</label>
            <input value={attendees} onChange={(e) => setAttendees(e.target.value)} placeholder="Alice, James, Grace…" className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-[8px] focus:outline-none bg-transparent" />
          </div>

          <div>
            <label className="text-xs text-gray-500 block mb-1">Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="Optional description…" className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-[8px] focus:outline-none resize-none bg-transparent" />
          </div>
        </div>

        <div className="px-5 py-3 border-t border-gray-100 dark:border-gray-800 flex items-center gap-2">
          {event && onDelete && (
            <button onClick={() => { onDelete(event.id); onClose() }} className="p-2 text-red-500 hover:bg-red-50 rounded-[8px] transition-colors">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
            </button>
          )}
          <div className="flex-1" />
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-[8px] transition-colors">Cancel</button>
          <button
            onClick={() => {
              if (title) {
                const startTime = time ? composeIso(date, time) : composeIso(date, '00:00')
                const endTimeIso = endTime ? composeIso(date, endTime) : time ? composeIso(date, time) : composeIso(date, '23:59')
                onSave({
                  title,
                  event_type: type,
                  start_time: startTime,
                  end_time: endTimeIso,
                  description: description || undefined,
                  attendees: attendees ? attendees.split(',').map((a) => a.trim()) : undefined,
                  all_day: !time,
                })
                onClose()
              }
            }}
            disabled={!title}
            className="px-4 py-2 text-sm bg-[#51459d] text-white rounded-[8px] hover:bg-[#3d3480] transition-colors disabled:opacity-50"
          >
            {event ? 'Save changes' : 'Create event'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Week view ────────────────────────────────────────────────────────────────

function WeekView({ events, weekStart, onDayClick, onEventClick }: {
  events: CalendarEvent[];
  weekStart: Date;
  onDayClick: (date: string) => void;
  onEventClick: (ev: CalendarEvent) => void;
}) {
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart)
    d.setDate(d.getDate() + i)
    return d
  })

  return (
    <div className="flex-1 overflow-auto">
      <div className="grid grid-cols-7 border-b border-gray-100 dark:border-gray-800">
        {days.map((day, i) => {
          const dateStr = toDateStr(day)
          const isToday = dateStr === toDateStr(today)
          const dayEvents = events.filter((e) => getDateFromIso(e.start_time) === dateStr)
          return (
            <div key={i} className="border-r border-gray-100 dark:border-gray-800 last:border-r-0 min-h-32 p-2">
              <div
                className={`text-center mb-2 cursor-pointer`}
                onClick={() => onDayClick(dateStr)}
              >
                <p className="text-[10px] text-gray-400 uppercase">{DAYS_OF_WEEK[day.getDay()]}</p>
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-semibold mx-auto ${isToday ? 'bg-[#51459d] text-white' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'}`}>
                  {day.getDate()}
                </div>
              </div>
              <div className="space-y-1">
                {dayEvents.map((ev) => (
                  <button
                    key={ev.id}
                    onClick={() => onEventClick(ev)}
                    className={`w-full text-left text-[10px] font-medium px-1.5 py-1 rounded-[4px] truncate ${EVENT_COLORS[ev.event_type].light} hover:opacity-80 transition-opacity`}
                  >
                    {!ev.all_day && <span className="opacity-70 mr-1">{formatTime(ev.start_time)}</span>}
                    {ev.title}
                  </button>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Day view ─────────────────────────────────────────────────────────────────

function DayView({ events, date, onEventClick }: {
  events: CalendarEvent[];
  date: Date;
  onEventClick: (ev: CalendarEvent) => void;
}) {
  const dateStr = toDateStr(date)
  const dayEvents = events
    .filter((e) => getDateFromIso(e.start_time) === dateStr)
    .sort((a, b) => a.start_time.localeCompare(b.start_time))

  return (
    <div className="flex-1 overflow-auto p-4">
      <div className="max-w-2xl mx-auto space-y-1">
        {dayEvents.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <p className="text-sm">No events today</p>
          </div>
        ) : (
          dayEvents.map((ev) => (
            <button
              key={ev.id}
              onClick={() => onEventClick(ev)}
              className={`w-full flex items-start gap-3 p-3 rounded-[8px] text-left hover:opacity-90 transition-opacity ${EVENT_COLORS[ev.event_type].light}`}
            >
              <div className="text-xs font-semibold min-w-[60px]">
                {ev.all_day ? 'All day' : formatTime(ev.start_time)}
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold">{ev.title}</p>
                {ev.end_time && <p className="text-xs opacity-70">Until {formatTime(ev.end_time)}</p>}
                {ev.description && <p className="text-xs mt-0.5 opacity-80">{ev.description}</p>}
                {ev.attendees && ev.attendees.length > 0 && (
                  <div className="flex items-center gap-1 mt-1">
                    <svg className="h-3 w-3 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                    <span className="text-xs opacity-70">{ev.attendees.join(', ')}</span>
                  </div>
                )}
              </div>
              <div className="w-2 h-2 rounded-full mt-1 shrink-0" style={{ backgroundColor: EVENT_COLORS[ev.event_type].dot }} />
            </button>
          ))
        )}
      </div>
    </div>
  )
}

// ─── Month view ───────────────────────────────────────────────────────────────

function MonthView({ events, year, month, onDayClick, onEventClick, onEventDrop }: {
  events: CalendarEvent[];
  year: number;
  month: number;
  onDayClick: (date: string) => void;
  onEventClick: (ev: CalendarEvent) => void;
  onEventDrop?: (event: CalendarEvent, newDate: string) => void;
}) {
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  const startPad = firstDay.getDay()
  const totalCells = Math.ceil((startPad + lastDay.getDate()) / 7) * 7

  const cells = Array.from({ length: totalCells }, (_, i) => {
    const dayNum = i - startPad + 1
    if (dayNum < 1 || dayNum > lastDay.getDate()) return null
    const d = new Date(year, month, dayNum)
    return toDateStr(d)
  })

  const todayStr = toDateStr(today)

  return (
    <div className="flex-1 overflow-auto">
      {/* Day headers */}
      <div className="grid grid-cols-7 border-b border-gray-100 dark:border-gray-800">
        {DAYS_OF_WEEK.map((d) => (
          <div key={d} className="py-2 text-center text-[11px] font-semibold text-gray-500 uppercase tracking-wide">
            {d}
          </div>
        ))}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-7 flex-1">
        {cells.map((dateStr, i) => {
          if (!dateStr) {
            return <div key={i} className="border-r border-b border-gray-50 dark:border-gray-950 bg-gray-50/50 dark:bg-gray-950/50 min-h-24" />
          }
          const dayEvents = events.filter((e) => getDateFromIso(e.start_time) === dateStr)
          const isToday = dateStr === todayStr
          const dayNum = parseInt(dateStr.split('-')[2])

          return (
            <div
              key={i}
              className={`border-r border-b border-gray-100 dark:border-gray-800 min-h-24 p-1.5 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors ${isToday ? 'bg-[#51459d]/3' : ''}`}
              onClick={() => onDayClick(dateStr)}
              onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move' }}
              onDrop={(e) => {
                e.preventDefault()
                const eventId = e.dataTransfer.getData('text/plain')
                const droppedEvent = events.find((ev) => ev.id === eventId)
                if (droppedEvent && onEventDrop) {
                  onEventDrop(droppedEvent, dateStr)
                }
              }}
            >
              <div className="flex items-center justify-between mb-1">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold ${isToday ? 'bg-[#51459d] text-white' : 'text-gray-700 dark:text-gray-300'}`}>
                  {dayNum}
                </div>
              </div>
              <div className="space-y-0.5">
                {dayEvents.slice(0, 3).map((ev) => (
                  <button
                    key={ev.id}
                    draggable
                    onClick={(e) => { e.stopPropagation(); onEventClick(ev) }}
                    onDragStart={(e) => {
                      e.dataTransfer.setData('text/plain', ev.id)
                      e.dataTransfer.effectAllowed = 'move'
                    }}
                    className={`w-full text-left text-[10px] font-medium px-1.5 py-0.5 rounded-[3px] truncate ${EVENT_COLORS[ev.event_type].light} hover:opacity-80 transition-opacity cursor-grab active:cursor-grabbing`}
                  >
                    {!ev.all_day && <span className="opacity-60 mr-1">{formatTime(ev.start_time).replace(' AM', 'a').replace(' PM', 'p')}</span>}
                    {ev.title}
                  </button>
                ))}
                {dayEvents.length > 3 && (
                  <p className="text-[9px] text-gray-400 pl-1">+{dayEvents.length - 3} more</p>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function CalendarPage() {
  const [viewDate, setViewDate] = useState(new Date())
  const [view, setView] = useState<CalView>(window.innerWidth < 640 ? 'day' : 'month')
  const [modal, setModal] = useState<{ date: string; event?: CalendarEvent } | null>(null)
  const [popoverEvent, setPopoverEvent] = useState<{ event: CalendarEvent; rect: DOMRect | null } | null>(null)
  const [showRecurring, setShowRecurring] = useState(false)
  const [showShare, setShowShare] = useState(false)
  const [showPrint, setShowPrint] = useState(false)
  const { data } = useCalendarEvents()
  const events = data?.events ?? []

  const createEvent = useCreateCalendarEvent()
  const updateEvent = useUpdateCalendarEvent()
  const deleteEvent = useDeleteCalendarEvent()

  // Drag-and-drop reschedule handler
  const handleEventDrop = (event: CalendarEvent, newDate: string) => {
    const oldDateStr = getDateFromIso(event.start_time)
    if (oldDateStr === newDate) return

    const oldStart = new Date(event.start_time)
    const oldEnd = event.end_time ? new Date(event.end_time) : new Date(event.start_time)
    const diff = oldEnd.getTime() - oldStart.getTime()

    const [year, month, day] = newDate.split('-').map(Number)
    const newStart = new Date(oldStart)
    newStart.setFullYear(year, month - 1, day)
    const newEnd = new Date(newStart.getTime() + diff)

    updateEvent.mutate({
      id: event.id,
      start_time: newStart.toISOString(),
      end_time: newEnd.toISOString(),
    })
  }

  // Swipe gesture for mobile navigation between date ranges
  const handleSwipeLeft = useCallback(() => navigate(1), [])
  const handleSwipeRight = useCallback(() => navigate(-1), [])
  const swipeHandlers = useSwipeGesture({
    onSwipeLeft: handleSwipeLeft,
    onSwipeRight: handleSwipeRight,
    threshold: 60,
  })

  const navigate = (dir: 1 | -1) => {
    const d = new Date(viewDate)
    if (view === 'month') d.setMonth(d.getMonth() + dir)
    else if (view === 'week') d.setDate(d.getDate() + dir * 7)
    else d.setDate(d.getDate() + dir)
    setViewDate(d)
  }

  const getWeekStart = (d: Date) => {
    const start = new Date(d)
    start.setDate(d.getDate() - d.getDay())
    return start
  }

  const headerLabel = () => {
    if (view === 'month') return `${MONTHS_LONG[viewDate.getMonth()]} ${viewDate.getFullYear()}`
    if (view === 'week') {
      const ws = getWeekStart(viewDate)
      const we = new Date(ws); we.setDate(we.getDate() + 6)
      return `${ws.toLocaleDateString('en-KE', { month: 'short', day: 'numeric' })} – ${we.toLocaleDateString('en-KE', { month: 'short', day: 'numeric', year: 'numeric' })}`
    }
    return viewDate.toLocaleDateString('en-KE', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
  }

  const handleSave = (payload: CreateEventPayload) => {
    if (modal?.event) {
      updateEvent.mutate({ id: modal.event.id, ...payload })
    } else {
      createEvent.mutate(payload)
    }
  }

  // Upcoming events
  const todayStr = toDateStr(today)
  const upcomingEvents = [...events]
    .filter((e) => getDateFromIso(e.start_time) >= todayStr)
    .sort((a, b) => a.start_time.localeCompare(b.start_time))
    .slice(0, 5)

  return (
    <div className="h-full flex flex-col md:flex-row overflow-hidden">
      {/* Mobile new event button */}
      <div className="md:hidden shrink-0 p-3 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800">
        <button
          onClick={() => setModal({ date: toDateStr(today) })}
          className="w-full flex items-center justify-center gap-2 bg-[#51459d] hover:bg-[#3d3480] text-white text-sm font-medium rounded-[8px] px-4 py-2.5 min-h-[44px] transition-colors"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          New Event
        </button>
      </div>

      {/* Left sidebar - hidden on mobile */}
      <aside className="hidden md:flex w-64 shrink-0 bg-white dark:bg-gray-900 border-r border-gray-100 dark:border-gray-800 flex-col">
        <div className="p-4 border-b border-gray-100 dark:border-gray-800">
          <button
            onClick={() => setModal({ date: toDateStr(today) })}
            className="w-full flex items-center justify-center gap-2 bg-[#51459d] hover:bg-[#3d3480] text-white text-sm font-medium rounded-[8px] px-4 py-2.5 transition-colors"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            New Event
          </button>
        </div>

        {/* Mini Calendar */}
        <div className="p-3 border-b border-gray-100 dark:border-gray-800">
          <MiniCalendar
            selectedDate={viewDate}
            onDateSelect={(date) => {
              setViewDate(date)
              setView('day')
            }}
          />
        </div>

        {/* Upcoming */}
        <div className="flex-1 overflow-y-auto p-3">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2 px-1">Upcoming</p>
          {upcomingEvents.length === 0 ? (
            <p className="text-xs text-gray-400 px-1">No upcoming events</p>
          ) : (
            <div className="space-y-1">
              {upcomingEvents.map((ev) => (
                <button
                  key={ev.id}
                  onClick={() => setModal({ date: getDateFromIso(ev.start_time), event: ev })}
                  className="w-full flex items-start gap-2.5 px-2 py-2 rounded-[8px] hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-left"
                >
                  <div className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0" style={{ backgroundColor: EVENT_COLORS[ev.event_type].dot }} />
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-gray-800 dark:text-gray-200 truncate">{ev.title}</p>
                    <p className="text-[10px] text-gray-400">
                      {new Date(getDateFromIso(ev.start_time) + 'T12:00:00').toLocaleDateString('en-KE', { month: 'short', day: 'numeric' })}
                      {!ev.all_day && ` · ${formatTime(ev.start_time)}`}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}

          <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-800">
            <MultiCalendarSidebar />
          </div>
        </div>
      </aside>

      {/* Main calendar */}
      <div className="flex-1 flex flex-col overflow-hidden bg-white dark:bg-gray-900">
        {/* Toolbar */}
        <div className="border-b border-gray-100 dark:border-gray-800 px-3 sm:px-5 py-2 sm:py-3 flex flex-wrap items-center gap-2 sm:gap-3 shrink-0">
          <div className="flex items-center gap-1">
            <button onClick={() => navigate(-1)} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-[6px] text-gray-500 transition-colors">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            </button>
            <button
              onClick={() => setViewDate(new Date())}
              className="px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-[8px] transition-colors"
            >
              Today
            </button>
            <button onClick={() => navigate(1)} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-[6px] text-gray-500 transition-colors">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            </button>
          </div>

          <h2 className="text-sm sm:text-base font-semibold text-gray-900 dark:text-gray-100 flex-1">{headerLabel()}</h2>

          <button
            onClick={() => setShowShare(true)}
            className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-[6px] text-gray-500 transition-colors"
            title="Share calendar"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
          </button>
          <button
            onClick={() => setShowPrint(true)}
            className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-[6px] text-gray-500 transition-colors"
            title="Print view"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2z" /></svg>
          </button>

          <div className="flex items-center border border-gray-200 dark:border-gray-700 rounded-[8px] overflow-hidden">
            {(['month', 'week', 'day'] as CalView[]).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`px-3 py-2 sm:py-1.5 text-xs font-medium capitalize transition-colors min-w-[44px] sm:min-w-0 ${view === v ? 'bg-[#51459d] text-white' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'}`}
              >
                {v}
              </button>
            ))}
          </div>
        </div>

        {/* Calendar view - with touch swipe for mobile */}
        <div {...swipeHandlers} className="flex-1 flex flex-col overflow-hidden">
        {view === 'month' && (
          <MonthView
            events={events}
            year={viewDate.getFullYear()}
            month={viewDate.getMonth()}
            onDayClick={(date) => setModal({ date })}
            onEventClick={(ev) => setModal({ date: getDateFromIso(ev.start_time), event: ev })}
            onEventDrop={handleEventDrop}
          />
        )}
        {view === 'week' && (
          <WeekView
            events={events}
            weekStart={getWeekStart(viewDate)}
            onDayClick={(date) => setModal({ date })}
            onEventClick={(ev) => setModal({ date: getDateFromIso(ev.start_time), event: ev })}
          />
        )}
        {view === 'day' && (
          <DayView
            events={events}
            date={viewDate}
            onEventClick={(ev) => setModal({ date: getDateFromIso(ev.start_time), event: ev })}
          />
        )}
        </div>
      </div>

      {modal && (
        <EventModal
          date={modal.date}
          event={modal.event}
          onClose={() => setModal(null)}
          onSave={handleSave}
          onDelete={(id) => deleteEvent.mutate(id)}
        />
      )}

      {popoverEvent && (
        <EventDetailPopover
          event={popoverEvent.event}
          anchorRect={popoverEvent.rect}
          onClose={() => setPopoverEvent(null)}
          onEdit={(ev) => setModal({ date: getDateFromIso(ev.start_time), event: ev })}
          onDelete={(id) => deleteEvent.mutate(id)}
        />
      )}

      <RecurringEventEditor
        open={showRecurring}
        onClose={() => setShowRecurring(false)}
        onApply={(_config, ruleString) => {
          if (modal) {
            handleSave({
              title: 'Recurring Event',
              start_time: composeIso(modal.date, '09:00'),
              end_time: composeIso(modal.date, '10:00'),
              recurrence_rule: ruleString,
            })
          }
        }}
      />

      <CalendarShareDialog
        open={showShare}
        onClose={() => setShowShare(false)}
      />

      {showPrint && (
        <PrintView
          year={viewDate.getFullYear()}
          month={viewDate.getMonth()}
          onClose={() => setShowPrint(false)}
        />
      )}
    </div>
  )
}
