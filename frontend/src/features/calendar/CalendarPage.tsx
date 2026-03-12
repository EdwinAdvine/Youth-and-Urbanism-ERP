import { useState, useCallback, useMemo } from 'react'
import { useSwipeGesture } from '../../hooks/useSwipeGesture'
import {
  useCalendarEvents,
  useCreateCalendarEvent,
  useUpdateCalendarEvent,
  useDeleteCalendarEvent,
  type CalendarEvent,
  type CreateEventPayload,
  type EventType,
  type SensitivityLevel,
  type PriorityLevel,
  type ReminderConfig,
} from '../../api/calendar'
import { useCalendarStore, type CalView } from '../../store/calendar'
import MiniCalendar from './MiniCalendar'
import MultiCalendarSidebar from './MultiCalendarSidebar'
import EventDetailPopover from './EventDetailPopover'
import RecurringEventEditor from './RecurringEventEditor'
import CalendarShareDialog from './CalendarShareDialog'
import PrintView from './PrintView'
import TimeGrid from './TimeGrid'
import YearView from './YearView'
import ScheduleView from './ScheduleView'
import AgendaView from './AgendaView'
import CalendarAnalytics from './CalendarAnalytics'
import BookingPageBuilder from './BookingPageBuilder'
import FocusTimeManager from './FocusTimeManager'
import ResourceBooking from './ResourceBooking'
import AutomationBuilder from './AutomationBuilder'
import MeetingPrepCard from './MeetingPrepCard'

// ─── Event type config ────────────────────────────────────────────────────────

const EVENT_COLORS: Record<string, { bg: string; text: string; dot: string; light: string }> = {
  meeting:  { bg: 'bg-[#51459d]',  text: 'text-white',      dot: '#51459d',  light: 'bg-[#51459d]/10 text-[#51459d]' },
  task:     { bg: 'bg-[#6fd943]',  text: 'text-white',      dot: '#6fd943',  light: 'bg-green-50 text-green-700' },
  reminder: { bg: 'bg-[#ffa21d]',  text: 'text-white',      dot: '#ffa21d',  light: 'bg-orange-50 text-orange-700' },
  holiday:  { bg: 'bg-[#ff3a6e]',  text: 'text-white',      dot: '#ff3a6e',  light: 'bg-red-50 text-red-700' },
  focus:    { bg: 'bg-indigo-500',  text: 'text-white',      dot: '#6366f1',  light: 'bg-indigo-50 text-indigo-700' },
  booking:  { bg: 'bg-teal-500',    text: 'text-white',      dot: '#14b8a6',  light: 'bg-teal-50 text-teal-700' },
  deadline: { bg: 'bg-rose-600',    text: 'text-white',      dot: '#e11d48',  light: 'bg-rose-50 text-rose-700' },
}

const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

// ─── Helpers ─────────────────────────────────────────────────────────────────

const today = new Date()

function toDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function getDateFromIso(iso: string): string {
  return iso.slice(0, 10)
}

function getTimeFromIso(iso: string): string {
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

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

function padTime(h: number, m: number): string {
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

// ─── Event Form Modal (upgraded) ─────────────────────────────────────────────

function EventModal({ date, event, startTime, endTime, onClose, onSave, onDelete }: {
  date: string
  event?: CalendarEvent
  startTime?: string
  endTime?: string
  onClose: () => void
  onSave: (payload: CreateEventPayload) => void
  onDelete?: (id: string) => void
}) {
  const [title, setTitle] = useState(event?.title ?? '')
  const [type, setType] = useState<EventType>(event?.event_type ?? 'meeting')
  const [time, setTime] = useState(event ? getTimeFromIso(event.start_time) : startTime ?? '')
  const [end, setEnd] = useState(event?.end_time ? getTimeFromIso(event.end_time) : endTime ?? '')
  const [description, setDescription] = useState(event?.description ?? '')
  const [attendees, setAttendees] = useState(event?.attendees?.join(', ') ?? '')
  const [location, setLocation] = useState(event?.location ?? '')
  const [priority, setPriority] = useState<PriorityLevel>(event?.priority ?? 'normal')
  const [sensitivity, setSensitivity] = useState<SensitivityLevel>(event?.sensitivity ?? 'normal')
  const [bufferBefore, setBufferBefore] = useState(event?.buffer_before ?? 0)
  const [bufferAfter, setBufferAfter] = useState(event?.buffer_after ?? 0)
  const [reminders, setReminders] = useState<ReminderConfig[]>(event?.reminders ?? [{ minutes_before: 15, channel: 'push' }])
  const [showAdvanced, setShowAdvanced] = useState(false)

  const addReminder = () => setReminders([...reminders, { minutes_before: 15, channel: 'push' }])
  const removeReminder = (idx: number) => setReminders(reminders.filter((_, i) => i !== idx))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-gray-800 rounded-[10px] shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between shrink-0">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{event ? 'Edit Event' : 'New Event'}</h3>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-[6px] text-gray-500">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="p-5 space-y-3 overflow-y-auto flex-1">
          {/* Title */}
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Event title"
            className="w-full px-3 py-2.5 text-sm border border-gray-200 dark:border-gray-700 rounded-[8px] focus:outline-none focus:ring-2 focus:ring-[#51459d]/40 font-medium bg-transparent"
            autoFocus
          />

          {/* Type + Priority row */}
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="text-[10px] text-gray-500 block mb-1 font-medium">Type</label>
              <select value={type} onChange={(e) => setType(e.target.value as EventType)} className="w-full px-2 py-2 text-xs border border-gray-200 dark:border-gray-700 rounded-[8px] focus:outline-none bg-white dark:bg-gray-800">
                <option value="meeting">Meeting</option>
                <option value="task">Task</option>
                <option value="reminder">Reminder</option>
                <option value="holiday">Holiday</option>
                <option value="focus">Focus Time</option>
                <option value="booking">Booking</option>
                <option value="deadline">Deadline</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] text-gray-500 block mb-1 font-medium">Priority</label>
              <select value={priority} onChange={(e) => setPriority(e.target.value as PriorityLevel)} className="w-full px-2 py-2 text-xs border border-gray-200 dark:border-gray-700 rounded-[8px] focus:outline-none bg-white dark:bg-gray-800">
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] text-gray-500 block mb-1 font-medium">Visibility</label>
              <select value={sensitivity} onChange={(e) => setSensitivity(e.target.value as SensitivityLevel)} className="w-full px-2 py-2 text-xs border border-gray-200 dark:border-gray-700 rounded-[8px] focus:outline-none bg-white dark:bg-gray-800">
                <option value="normal">Normal</option>
                <option value="private">Private</option>
                <option value="confidential">Confidential</option>
              </select>
            </div>
          </div>

          {/* Date + Time */}
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="text-[10px] text-gray-500 block mb-1 font-medium">Date</label>
              <input type="date" defaultValue={date} className="w-full px-2 py-2 text-xs border border-gray-200 dark:border-gray-700 rounded-[8px] focus:outline-none bg-transparent" readOnly />
            </div>
            <div>
              <label className="text-[10px] text-gray-500 block mb-1 font-medium">Start</label>
              <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="w-full px-2 py-2 text-xs border border-gray-200 dark:border-gray-700 rounded-[8px] focus:outline-none bg-transparent" />
            </div>
            <div>
              <label className="text-[10px] text-gray-500 block mb-1 font-medium">End</label>
              <input type="time" value={end} onChange={(e) => setEnd(e.target.value)} className="w-full px-2 py-2 text-xs border border-gray-200 dark:border-gray-700 rounded-[8px] focus:outline-none bg-transparent" />
            </div>
          </div>

          {/* Location */}
          <div>
            <label className="text-[10px] text-gray-500 block mb-1 font-medium">Location</label>
            <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Room, address, or video link..." className="w-full px-3 py-2 text-xs border border-gray-200 dark:border-gray-700 rounded-[8px] focus:outline-none bg-transparent" />
          </div>

          {/* Attendees */}
          <div>
            <label className="text-[10px] text-gray-500 block mb-1 font-medium">Attendees</label>
            <input value={attendees} onChange={(e) => setAttendees(e.target.value)} placeholder="Alice, James, Grace..." className="w-full px-3 py-2 text-xs border border-gray-200 dark:border-gray-700 rounded-[8px] focus:outline-none bg-transparent" />
          </div>

          {/* Description */}
          <div>
            <label className="text-[10px] text-gray-500 block mb-1 font-medium">Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="Optional description..." className="w-full px-3 py-2 text-xs border border-gray-200 dark:border-gray-700 rounded-[8px] focus:outline-none resize-none bg-transparent" />
          </div>

          {/* Reminders */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[10px] text-gray-500 font-medium">Reminders</label>
              <button onClick={addReminder} className="text-[10px] text-[#51459d] hover:underline">+ Add</button>
            </div>
            {reminders.map((r, idx) => (
              <div key={idx} className="flex items-center gap-2 mb-1">
                <select
                  value={r.minutes_before}
                  onChange={(e) => {
                    const updated = [...reminders]
                    updated[idx] = { ...r, minutes_before: Number(e.target.value) }
                    setReminders(updated)
                  }}
                  className="flex-1 px-2 py-1.5 text-xs border border-gray-200 dark:border-gray-700 rounded-[6px] bg-white dark:bg-gray-800"
                >
                  <option value={5}>5 minutes before</option>
                  <option value={15}>15 minutes before</option>
                  <option value={30}>30 minutes before</option>
                  <option value={60}>1 hour before</option>
                  <option value={1440}>1 day before</option>
                </select>
                <select
                  value={r.channel}
                  onChange={(e) => {
                    const updated = [...reminders]
                    updated[idx] = { ...r, channel: e.target.value as ReminderConfig['channel'] }
                    setReminders(updated)
                  }}
                  className="w-20 px-2 py-1.5 text-xs border border-gray-200 dark:border-gray-700 rounded-[6px] bg-white dark:bg-gray-800"
                >
                  <option value="push">Push</option>
                  <option value="email">Email</option>
                  <option value="in_app">In-app</option>
                </select>
                <button onClick={() => removeReminder(idx)} className="p-1 text-gray-400 hover:text-red-500">
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
            ))}
          </div>

          {/* Advanced toggle */}
          <button onClick={() => setShowAdvanced(!showAdvanced)} className="text-[10px] text-[#51459d] hover:underline">
            {showAdvanced ? 'Hide advanced options' : 'Show advanced options'}
          </button>

          {showAdvanced && (
            <div className="grid grid-cols-2 gap-2 p-3 bg-gray-50 dark:bg-gray-900 rounded-[8px]">
              <div>
                <label className="text-[10px] text-gray-500 block mb-1 font-medium">Buffer before (min)</label>
                <input type="number" min={0} max={60} value={bufferBefore} onChange={(e) => setBufferBefore(Number(e.target.value))} className="w-full px-2 py-1.5 text-xs border border-gray-200 dark:border-gray-700 rounded-[6px] bg-white dark:bg-gray-800" />
              </div>
              <div>
                <label className="text-[10px] text-gray-500 block mb-1 font-medium">Buffer after (min)</label>
                <input type="number" min={0} max={60} value={bufferAfter} onChange={(e) => setBufferAfter(Number(e.target.value))} className="w-full px-2 py-1.5 text-xs border border-gray-200 dark:border-gray-700 rounded-[6px] bg-white dark:bg-gray-800" />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-gray-100 dark:border-gray-700 flex items-center gap-2 shrink-0">
          {event && onDelete && (
            <button onClick={() => { onDelete(event.id); onClose() }} className="p-2 text-red-500 hover:bg-red-50 rounded-[8px] transition-colors">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
            </button>
          )}
          <div className="flex-1" />
          <button onClick={onClose} className="px-4 py-2 text-xs text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-[8px] transition-colors">Cancel</button>
          <button
            onClick={() => {
              if (title) {
                const startTime = time ? composeIso(date, time) : composeIso(date, '00:00')
                const endTimeIso = end ? composeIso(date, end) : time ? composeIso(date, time) : composeIso(date, '23:59')
                onSave({
                  title,
                  event_type: type,
                  start_time: startTime,
                  end_time: endTimeIso,
                  description: description || undefined,
                  attendees: attendees ? attendees.split(',').map((a) => a.trim()) : undefined,
                  location: location || undefined,
                  all_day: !time,
                  priority,
                  sensitivity,
                  buffer_before: bufferBefore,
                  buffer_after: bufferAfter,
                  reminders: reminders.length > 0 ? reminders : undefined,
                })
                onClose()
              }
            }}
            disabled={!title}
            className="px-4 py-2 text-xs bg-[#51459d] text-white rounded-[8px] hover:bg-[#3d3480] transition-colors disabled:opacity-50 font-medium"
          >
            {event ? 'Save changes' : 'Create event'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Upgraded Month view ─────────────────────────────────────────────────────

function MonthView({ events, year, month, onDayClick, onEventClick, onEventDrop }: {
  events: CalendarEvent[]
  year: number
  month: number
  onDayClick: (date: string) => void
  onEventClick: (ev: CalendarEvent) => void
  onEventDrop?: (event: CalendarEvent, newDate: string) => void
}) {
  const [expandedDay, setExpandedDay] = useState<string | null>(null)
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  const startPad = firstDay.getDay()
  const totalCells = Math.ceil((startPad + lastDay.getDate()) / 7) * 7

  const cells = Array.from({ length: totalCells }, (_, i) => {
    const dayNum = i - startPad + 1
    if (dayNum < 1 || dayNum > lastDay.getDate()) return null
    return toDateStr(new Date(year, month, dayNum))
  })

  const todayStr = toDateStr(today)
  const weekCount = totalCells / 7

  return (
    <div className="flex-1 overflow-auto">
      {/* Day headers + week numbers */}
      <div className="grid grid-cols-[32px_repeat(7,1fr)] border-b border-gray-100 dark:border-gray-800">
        <div className="py-2 text-center text-[9px] text-gray-400 font-medium">Wk</div>
        {DAYS_OF_WEEK.map((d) => (
          <div key={d} className="py-2 text-center text-[11px] font-semibold text-gray-500 uppercase tracking-wide">
            {d}
          </div>
        ))}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-[32px_repeat(7,1fr)] flex-1">
        {Array.from({ length: weekCount }, (_, weekIdx) => {
          // Calculate week number
          const firstDayOfWeek = cells[weekIdx * 7]
          const weekNum = firstDayOfWeek
            ? Math.ceil((new Date(firstDayOfWeek).getTime() - new Date(year, 0, 1).getTime()) / 86400000 / 7) + 1
            : ''

          return [
            // Week number gutter
            <div key={`wk-${weekIdx}`} className="border-b border-gray-50 dark:border-gray-900 flex items-start justify-center pt-2">
              <span className="text-[9px] text-gray-300 font-medium">{weekNum}</span>
            </div>,
            // 7 day cells
            ...cells.slice(weekIdx * 7, weekIdx * 7 + 7).map((dateStr, di) => {
              const cellIdx = weekIdx * 7 + di
              if (!dateStr) {
                return <div key={cellIdx} className="border-r border-b border-gray-50 dark:border-gray-950 bg-gray-50/50 dark:bg-gray-950/50 min-h-24" />
              }

              const dayEvents = events.filter((e) => getDateFromIso(e.start_time) === dateStr)
              const isToday = dateStr === todayStr
              const dayNum = parseInt(dateStr.split('-')[2])
              const isExpanded = expandedDay === dateStr
              const visibleCount = isExpanded ? dayEvents.length : 3

              return (
                <div
                  key={cellIdx}
                  className={`border-r border-b border-gray-100 dark:border-gray-800 min-h-24 p-1.5 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors ${isToday ? 'bg-[#51459d]/[0.03]' : ''}`}
                  onClick={() => onDayClick(dateStr)}
                  onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move' }}
                  onDrop={(e) => {
                    e.preventDefault()
                    const eventId = e.dataTransfer.getData('text/plain')
                    const droppedEvent = events.find((ev) => ev.id === eventId)
                    if (droppedEvent && onEventDrop) onEventDrop(droppedEvent, dateStr)
                  }}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold ${isToday ? 'bg-[#51459d] text-white' : 'text-gray-700 dark:text-gray-300'}`}>
                      {dayNum}
                    </div>
                    {dayEvents.length > 0 && (
                      <span className="text-[9px] text-gray-400">{dayEvents.length}</span>
                    )}
                  </div>
                  <div className="space-y-0.5">
                    {dayEvents.slice(0, visibleCount).map((ev) => {
                      const colors = EVENT_COLORS[ev.event_type] || EVENT_COLORS.meeting
                      return (
                        <button
                          key={ev.id}
                          draggable
                          onClick={(e) => { e.stopPropagation(); onEventClick(ev) }}
                          onDragStart={(e) => {
                            e.dataTransfer.setData('text/plain', ev.id)
                            e.dataTransfer.effectAllowed = 'move'
                          }}
                          className={`w-full text-left text-[10px] font-medium px-1.5 py-0.5 rounded-[3px] truncate ${colors.light} hover:opacity-80 transition-opacity cursor-grab active:cursor-grabbing flex items-center gap-1`}
                        >
                          {ev.priority === 'urgent' && <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />}
                          {ev.priority === 'high' && <span className="w-1.5 h-1.5 rounded-full bg-orange-500 shrink-0" />}
                          {!ev.all_day && <span className="opacity-60 mr-0.5 shrink-0">{formatTime(ev.start_time).replace(' AM', 'a').replace(' PM', 'p')}</span>}
                          <span className="truncate">{ev.title}</span>
                          {ev.erp_context && Object.keys(ev.erp_context).some(k => k.endsWith('_id') && ev.erp_context![k as keyof typeof ev.erp_context]) && (
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0 ml-auto" title="ERP linked" />
                          )}
                        </button>
                      )
                    })}
                    {dayEvents.length > 3 && !isExpanded && (
                      <button
                        onClick={(e) => { e.stopPropagation(); setExpandedDay(dateStr) }}
                        className="text-[9px] text-[#51459d] font-medium pl-1 hover:underline"
                      >
                        +{dayEvents.length - 3} more
                      </button>
                    )}
                    {isExpanded && dayEvents.length > 3 && (
                      <button
                        onClick={(e) => { e.stopPropagation(); setExpandedDay(null) }}
                        className="text-[9px] text-gray-400 font-medium pl-1 hover:underline"
                      >
                        Show less
                      </button>
                    )}
                  </div>
                </div>
              )
            }),
          ]
        }).flat()}
      </div>
    </div>
  )
}

// ─── View icon components ────────────────────────────────────────────────────

const VIEW_ICONS: Record<CalView, JSX.Element> = {
  day: <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="currentColor"><rect x="3" y="2" width="10" height="12" rx="1" fill="none" stroke="currentColor" strokeWidth="1.5"/><line x1="6" y1="5" x2="10" y2="5" stroke="currentColor" strokeWidth="1"/></svg>,
  week: <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="currentColor"><rect x="1" y="2" width="14" height="12" rx="1" fill="none" stroke="currentColor" strokeWidth="1.5"/><line x1="5" y1="2" x2="5" y2="14" stroke="currentColor" strokeWidth="0.5"/><line x1="8" y1="2" x2="8" y2="14" stroke="currentColor" strokeWidth="0.5"/><line x1="11" y1="2" x2="11" y2="14" stroke="currentColor" strokeWidth="0.5"/></svg>,
  month: <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="currentColor"><rect x="1" y="2" width="14" height="12" rx="1" fill="none" stroke="currentColor" strokeWidth="1.5"/><line x1="1" y1="6" x2="15" y2="6" stroke="currentColor" strokeWidth="0.5"/><line x1="1" y1="10" x2="15" y2="10" stroke="currentColor" strokeWidth="0.5"/><line x1="5" y1="2" x2="5" y2="14" stroke="currentColor" strokeWidth="0.5"/><line x1="9" y1="2" x2="9" y2="14" stroke="currentColor" strokeWidth="0.5"/></svg>,
  year: <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="currentColor"><rect x="1" y="1" width="6" height="6" rx="0.5" fill="none" stroke="currentColor" strokeWidth="1"/><rect x="9" y="1" width="6" height="6" rx="0.5" fill="none" stroke="currentColor" strokeWidth="1"/><rect x="1" y="9" width="6" height="6" rx="0.5" fill="none" stroke="currentColor" strokeWidth="1"/><rect x="9" y="9" width="6" height="6" rx="0.5" fill="none" stroke="currentColor" strokeWidth="1"/></svg>,
  schedule: <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="currentColor"><line x1="1" y1="4" x2="15" y2="4" stroke="currentColor" strokeWidth="1.5"/><line x1="1" y1="8" x2="15" y2="8" stroke="currentColor" strokeWidth="1.5"/><line x1="1" y1="12" x2="15" y2="12" stroke="currentColor" strokeWidth="1.5"/><circle cx="3" cy="4" r="1.5" fill="currentColor"/><circle cx="3" cy="8" r="1.5" fill="currentColor"/><circle cx="3" cy="12" r="1.5" fill="currentColor"/></svg>,
  agenda: <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="currentColor"><rect x="1" y="2" width="14" height="12" rx="1" fill="none" stroke="currentColor" strokeWidth="1.5"/><line x1="4" y1="5" x2="12" y2="5" stroke="currentColor" strokeWidth="1"/><line x1="4" y1="8" x2="12" y2="8" stroke="currentColor" strokeWidth="1"/><line x1="4" y1="11" x2="10" y2="11" stroke="currentColor" strokeWidth="1"/></svg>,
}

// ─── Main Calendar Page ──────────────────────────────────────────────────────

export default function CalendarPage() {
  const {
    view, viewDate, setView, setViewDate, navigate: navStore, goToToday,
    sidebarOpen, toggleSidebar,
  } = useCalendarStore()

  const [modal, setModal] = useState<{ date: string; event?: CalendarEvent; startTime?: string; endTime?: string } | null>(null)
  const [popoverEvent, setPopoverEvent] = useState<{ event: CalendarEvent; rect: DOMRect | null } | null>(null)
  const [showRecurring, setShowRecurring] = useState(false)
  const [showShare, setShowShare] = useState(false)
  const [showPrint, setShowPrint] = useState(false)
  const [subPanel, setSubPanel] = useState<'analytics' | 'booking' | 'focus' | 'resources' | 'automation' | null>(null)
  const [moreOpen, setMoreOpen] = useState(false)
  const [prepEventId, setPrepEventId] = useState<string | null>(null)

  const { data } = useCalendarEvents()
  const events = data?.events ?? []

  const createEvent = useCreateCalendarEvent()
  const updateEvent = useUpdateCalendarEvent()
  const deleteEvent = useDeleteCalendarEvent()

  // Swipe gesture for mobile
  const handleSwipeLeft = useCallback(() => navStore(1), [navStore])
  const handleSwipeRight = useCallback(() => navStore(-1), [navStore])
  const swipeHandlers = useSwipeGesture({ onSwipeLeft: handleSwipeLeft, onSwipeRight: handleSwipeRight, threshold: 60 })

  // Computed dates
  const getWeekStart = (d: Date) => {
    const start = new Date(d)
    start.setDate(d.getDate() - d.getDay())
    return start
  }

  const weekDates = useMemo(() => {
    const ws = getWeekStart(viewDate)
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(ws)
      d.setDate(d.getDate() + i)
      return d
    })
  }, [viewDate])

  const dayDates = useMemo(() => [new Date(viewDate)], [viewDate])

  // Event drop handler for month view
  const handleMonthEventDrop = (event: CalendarEvent, newDate: string) => {
    const oldDateStr = getDateFromIso(event.start_time)
    if (oldDateStr === newDate) return
    const oldStart = new Date(event.start_time)
    const oldEnd = event.end_time ? new Date(event.end_time) : new Date(event.start_time)
    const diff = oldEnd.getTime() - oldStart.getTime()
    const [y, m, d] = newDate.split('-').map(Number)
    const newStart = new Date(oldStart)
    newStart.setFullYear(y, m - 1, d)
    const newEnd = new Date(newStart.getTime() + diff)
    updateEvent.mutate({ id: event.id, start_time: newStart.toISOString(), end_time: newEnd.toISOString() })
  }

  // Event drop handler for time-grid views
  const handleTimeGridEventDrop = (event: CalendarEvent, newStart: string, newEnd: string) => {
    updateEvent.mutate({ id: event.id, start_time: newStart, end_time: newEnd })
  }

  const headerLabel = () => {
    if (view === 'month') return `${MONTHS_LONG[viewDate.getMonth()]} ${viewDate.getFullYear()}`
    if (view === 'year') return `${viewDate.getFullYear()}`
    if (view === 'week' || view === 'schedule') {
      const ws = getWeekStart(viewDate)
      const we = new Date(ws); we.setDate(we.getDate() + 6)
      return `${ws.toLocaleDateString('en-KE', { month: 'short', day: 'numeric' })} – ${we.toLocaleDateString('en-KE', { month: 'short', day: 'numeric', year: 'numeric' })}`
    }
    if (view === 'agenda') return `Upcoming Events`
    return viewDate.toLocaleDateString('en-KE', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
  }

  const handleSave = (payload: CreateEventPayload) => {
    if (modal?.event) {
      updateEvent.mutate({ id: modal.event.id, ...payload })
    } else {
      createEvent.mutate(payload)
    }
  }

  // Upcoming events for sidebar
  const todayStr = toDateStr(today)
  const upcomingEvents = [...events]
    .filter((e) => getDateFromIso(e.start_time) >= todayStr)
    .sort((a, b) => a.start_time.localeCompare(b.start_time))
    .slice(0, 5)

  // Mock resources for schedule view (in production, fetch from API)
  const scheduleResources = useMemo(() => {
    const uniqueOrganizers = [...new Set(events.map((e) => e.organizer_id))]
    return uniqueOrganizers.slice(0, 10).map((id) => ({
      id,
      name: `User ${id.slice(0, 6)}`,
      color: '#51459d',
    }))
  }, [events])

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

      {/* Left sidebar */}
      {sidebarOpen && (
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

          <div className="p-3 border-b border-gray-100 dark:border-gray-800">
            <MiniCalendar
              selectedDate={viewDate}
              onDateSelect={(date) => {
                setViewDate(date)
                if (view === 'year') setView('day')
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
                {upcomingEvents.map((ev) => {
                  const colors = EVENT_COLORS[ev.event_type] || EVENT_COLORS.meeting
                  return (
                    <button
                      key={ev.id}
                      onClick={() => setModal({ date: getDateFromIso(ev.start_time), event: ev })}
                      className="w-full flex items-start gap-2.5 px-2 py-2 rounded-[8px] hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-left"
                    >
                      <div className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0" style={{ backgroundColor: colors.dot }} />
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-gray-800 dark:text-gray-200 truncate">{ev.title}</p>
                        <p className="text-[10px] text-gray-400">
                          {new Date(getDateFromIso(ev.start_time) + 'T12:00:00').toLocaleDateString('en-KE', { month: 'short', day: 'numeric' })}
                          {!ev.all_day && ` · ${formatTime(ev.start_time)}`}
                        </p>
                      </div>
                      {ev.priority === 'urgent' && <span className="text-[8px] bg-red-100 text-red-700 px-1 rounded font-bold mt-1">!</span>}
                    </button>
                  )
                })}
              </div>
            )}

            <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-800">
              <MultiCalendarSidebar />
            </div>
          </div>
        </aside>
      )}

      {/* Main calendar area */}
      <div className="flex-1 flex flex-col overflow-hidden bg-white dark:bg-gray-900">
        {/* Toolbar */}
        <div className="border-b border-gray-100 dark:border-gray-800 px-3 sm:px-5 py-2 sm:py-3 flex flex-wrap items-center gap-2 sm:gap-3 shrink-0">
          {/* Sidebar toggle */}
          <button
            onClick={toggleSidebar}
            className="hidden md:block p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-[6px] text-gray-500 transition-colors"
            title="Toggle sidebar"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
          </button>

          {/* Navigation */}
          <div className="flex items-center gap-1">
            <button onClick={() => navStore(-1)} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-[6px] text-gray-500 transition-colors">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            </button>
            <button onClick={goToToday} className="px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-[8px] transition-colors">
              Today
            </button>
            <button onClick={() => navStore(1)} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-[6px] text-gray-500 transition-colors">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            </button>
          </div>

          <h2 className="text-sm sm:text-base font-semibold text-gray-900 dark:text-gray-100 flex-1">{headerLabel()}</h2>

          {/* Action buttons */}
          <button onClick={() => setShowShare(true)} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-[6px] text-gray-500 transition-colors" title="Share calendar">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
          </button>
          <button onClick={() => setShowPrint(true)} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-[6px] text-gray-500 transition-colors" title="Print view">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2z" /></svg>
          </button>

          {/* View switcher */}
          <div className="flex items-center border border-gray-200 dark:border-gray-700 rounded-[8px] overflow-hidden">
            {(['day', 'week', 'month', 'year', 'schedule', 'agenda'] as CalView[]).map((v) => (
              <button
                key={v}
                onClick={() => { setView(v); setSubPanel(null) }}
                className={`px-2.5 py-2 sm:py-1.5 text-xs font-medium capitalize transition-colors flex items-center gap-1.5
                  ${view === v && !subPanel ? 'bg-[#51459d] text-white' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'}`}
                title={v}
              >
                {VIEW_ICONS[v]}
                <span className="hidden lg:inline">{v}</span>
              </button>
            ))}
          </div>

          {/* More features dropdown */}
          <div className="relative">
            <button
              onClick={() => setMoreOpen(!moreOpen)}
              className={`px-2.5 py-1.5 text-xs font-medium rounded-[8px] border transition-colors flex items-center gap-1 ${
                subPanel
                  ? 'bg-[#51459d] text-white border-[#51459d]'
                  : 'text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'
              }`}
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0zM12.75 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0zM18.75 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" />
              </svg>
              <span className="hidden sm:inline">More</span>
            </button>
            {moreOpen && (
              <div
                className="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg z-50 py-1"
                onMouseLeave={() => setMoreOpen(false)}
              >
                {([
                  { key: 'analytics', label: 'Analytics', icon: 'M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z' },
                  { key: 'booking', label: 'Booking Pages', icon: 'M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5' },
                  { key: 'focus', label: 'Focus Time', icon: 'M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z' },
                  { key: 'resources', label: 'Resource Booking', icon: 'M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21' },
                  { key: 'automation', label: 'Automations', icon: 'M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z' },
                ] as { key: typeof subPanel & string; label: string; icon: string }[]).map((item) => (
                  <button
                    key={item.key}
                    onClick={() => { setSubPanel(subPanel === item.key ? null : (item.key as typeof subPanel)); setMoreOpen(false) }}
                    className={`w-full flex items-center gap-2 px-3 py-2 text-xs transition-colors ${
                      subPanel === item.key
                        ? 'bg-[#51459d]/10 text-[#51459d] font-medium'
                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
                    }`}
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
                    </svg>
                    {item.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Sub-panels (Analytics, Booking, Focus, Resources, Automation) */}
        {subPanel === 'analytics' && <CalendarAnalytics />}
        {subPanel === 'booking' && <BookingPageBuilder />}
        {subPanel === 'focus' && <FocusTimeManager />}
        {subPanel === 'resources' && <ResourceBooking />}
        {subPanel === 'automation' && <AutomationBuilder />}

        {/* Meeting Prep Card overlay */}
        {prepEventId && (
          <div className="absolute right-4 top-20 z-50 w-96">
            <MeetingPrepCard eventId={prepEventId} onClose={() => setPrepEventId(null)} />
          </div>
        )}

        {/* Calendar views — with touch swipe for mobile */}
        {!subPanel && <div {...swipeHandlers} className="flex-1 flex flex-col overflow-hidden">
          {/* Day view — time grid, single column */}
          {view === 'day' && (
            <TimeGrid
              dates={dayDates}
              events={events}
              onEventClick={(ev) => setModal({ date: getDateFromIso(ev.start_time), event: ev })}
              onSlotClick={(date, hour, minute) => setModal({ date, startTime: padTime(hour, minute), endTime: padTime(hour + 1, minute) })}
              onSlotSelect={(date, sh, sm, eh, em) => setModal({ date, startTime: padTime(sh, sm), endTime: padTime(eh, em) })}
              onEventDrop={handleTimeGridEventDrop}
            />
          )}

          {/* Week view — time grid, 7 columns */}
          {view === 'week' && (
            <TimeGrid
              dates={weekDates}
              events={events}
              onEventClick={(ev) => setModal({ date: getDateFromIso(ev.start_time), event: ev })}
              onSlotClick={(date, hour, minute) => setModal({ date, startTime: padTime(hour, minute), endTime: padTime(hour + 1, minute) })}
              onSlotSelect={(date, sh, sm, eh, em) => setModal({ date, startTime: padTime(sh, sm), endTime: padTime(eh, em) })}
              onEventDrop={handleTimeGridEventDrop}
              compact
            />
          )}

          {/* Month view */}
          {view === 'month' && (
            <MonthView
              events={events}
              year={viewDate.getFullYear()}
              month={viewDate.getMonth()}
              onDayClick={(date) => setModal({ date })}
              onEventClick={(ev) => setModal({ date: getDateFromIso(ev.start_time), event: ev })}
              onEventDrop={handleMonthEventDrop}
            />
          )}

          {/* Year view — heat map */}
          {view === 'year' && (
            <YearView
              year={viewDate.getFullYear()}
              events={events}
              onDayClick={(date) => {
                setViewDate(new Date(date + 'T12:00:00'))
                setView('day')
              }}
              onMonthClick={(month) => {
                setViewDate(new Date(viewDate.getFullYear(), month, 1))
                setView('month')
              }}
            />
          )}

          {/* Schedule / Timeline view */}
          {view === 'schedule' && (
            <ScheduleView
              weekStart={getWeekStart(viewDate)}
              events={events}
              resources={scheduleResources}
              onEventClick={(ev) => setModal({ date: getDateFromIso(ev.start_time), event: ev })}
              onSlotClick={(_resourceId, date, hour) => setModal({ date, startTime: padTime(hour, 0), endTime: padTime(hour + 1, 0) })}
            />
          )}

          {/* Agenda view */}
          {view === 'agenda' && (
            <AgendaView />
          )}
        </div>}
      </div>

      {/* Modals & overlays */}
      {modal && (
        <EventModal
          date={modal.date}
          event={modal.event}
          startTime={modal.startTime}
          endTime={modal.endTime}
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

      <CalendarShareDialog open={showShare} onClose={() => setShowShare(false)} />

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
