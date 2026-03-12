import { useState, useRef, useCallback, useMemo } from 'react'
import type { CalendarEvent } from '../../api/calendar'
import { useCalendarStore } from '../../store/calendar'

// ─── Types ───────────────────────────────────────────────────────────────────

interface TimeGridProps {
  /** Dates to render as columns (1 for day view, 7 for week view) */
  dates: Date[]
  events: CalendarEvent[]
  onEventClick: (event: CalendarEvent) => void
  onSlotClick: (date: string, hour: number, minute: number) => void
  onEventDrop?: (event: CalendarEvent, newStart: string, newEnd: string) => void
  onSlotSelect?: (date: string, startHour: number, startMinute: number, endHour: number, endMinute: number) => void
  /** Show current time indicator */
  showNowLine?: boolean
  /** Compact mode for smaller widths */
  compact?: boolean
}

interface PositionedEvent {
  event: CalendarEvent
  top: number
  height: number
  left: number
  width: number
  column: number
  totalColumns: number
}

// ─── Constants ───────────────────────────────────────────────────────────────

const SLOT_HEIGHT = 48 // px per 30-min slot
const HOUR_HEIGHT = SLOT_HEIGHT * 2 // 96px per hour
const MIN_EVENT_HEIGHT = 20

const EVENT_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  meeting:  { bg: 'bg-[#51459d]/90',   border: 'border-[#51459d]', text: 'text-white' },
  task:     { bg: 'bg-[#6fd943]/90',   border: 'border-[#6fd943]', text: 'text-white' },
  reminder: { bg: 'bg-[#ffa21d]/90',   border: 'border-[#ffa21d]', text: 'text-white' },
  holiday:  { bg: 'bg-[#ff3a6e]/90',   border: 'border-[#ff3a6e]', text: 'text-white' },
  focus:    { bg: 'bg-indigo-500/20',   border: 'border-indigo-400', text: 'text-indigo-700 dark:text-indigo-300' },
  booking:  { bg: 'bg-teal-500/90',     border: 'border-teal-500', text: 'text-white' },
  deadline: { bg: 'bg-rose-600/90',     border: 'border-rose-600', text: 'text-white' },
}

const ERP_BADGE_COLORS: Record<string, string> = {
  invoice_id: 'bg-emerald-100 text-emerald-700',
  ticket_id: 'bg-orange-100 text-orange-700',
  deal_id: 'bg-blue-100 text-blue-700',
  project_id: 'bg-purple-100 text-purple-700',
  task_id: 'bg-green-100 text-green-700',
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function formatHour(hour: number): string {
  if (hour === 0 || hour === 24) return '12 AM'
  if (hour === 12) return '12 PM'
  return hour < 12 ? `${hour} AM` : `${hour - 12} PM`
}

function formatTimeShort(iso: string): string {
  const d = new Date(iso)
  const h = d.getHours()
  const m = d.getMinutes()
  const period = h >= 12 ? 'p' : 'a'
  const hour = h % 12 || 12
  return m === 0 ? `${hour}${period}` : `${hour}:${String(m).padStart(2, '0')}${period}`
}

function getEventTopAndHeight(
  event: CalendarEvent,
  dayStartHour: number,
  dayEndHour: number,
): { top: number; height: number } {
  const start = new Date(event.start_time)
  const end = new Date(event.end_time)

  const startMinutes = start.getHours() * 60 + start.getMinutes()
  const endMinutes = end.getHours() * 60 + end.getMinutes()
  const dayStartMinutes = dayStartHour * 60
  const dayEndMinutes = dayEndHour * 60

  const clampedStart = Math.max(startMinutes, dayStartMinutes)
  const clampedEnd = Math.min(endMinutes || dayEndMinutes, dayEndMinutes)

  const top = ((clampedStart - dayStartMinutes) / 60) * HOUR_HEIGHT
  const height = Math.max(((clampedEnd - clampedStart) / 60) * HOUR_HEIGHT, MIN_EVENT_HEIGHT)

  return { top, height }
}

/** Resolve overlapping events into columns */
function layoutEventsForDay(
  events: CalendarEvent[],
  dayStartHour: number,
  dayEndHour: number,
): PositionedEvent[] {
  if (events.length === 0) return []

  const sorted = [...events].sort((a, b) => {
    const aStart = new Date(a.start_time).getTime()
    const bStart = new Date(b.start_time).getTime()
    if (aStart !== bStart) return aStart - bStart
    return new Date(b.end_time).getTime() - new Date(a.end_time).getTime()
  })

  // Group overlapping events
  const groups: CalendarEvent[][] = []
  let currentGroup: CalendarEvent[] = []
  let groupEnd = 0

  for (const event of sorted) {
    const start = new Date(event.start_time).getTime()
    const end = new Date(event.end_time).getTime()

    if (currentGroup.length === 0 || start < groupEnd) {
      currentGroup.push(event)
      groupEnd = Math.max(groupEnd, end)
    } else {
      groups.push(currentGroup)
      currentGroup = [event]
      groupEnd = end
    }
  }
  if (currentGroup.length > 0) groups.push(currentGroup)

  // Assign columns within each group
  const positioned: PositionedEvent[] = []

  for (const group of groups) {
    const columns: CalendarEvent[][] = []

    for (const event of group) {
      const eventStart = new Date(event.start_time).getTime()
      let placed = false

      for (let col = 0; col < columns.length; col++) {
        const lastInCol = columns[col][columns[col].length - 1]
        if (new Date(lastInCol.end_time).getTime() <= eventStart) {
          columns[col].push(event)
          placed = true
          break
        }
      }

      if (!placed) {
        columns.push([event])
      }
    }

    const totalColumns = columns.length

    for (let col = 0; col < columns.length; col++) {
      for (const event of columns[col]) {
        const { top, height } = getEventTopAndHeight(event, dayStartHour, dayEndHour)
        positioned.push({
          event,
          top,
          height,
          left: (col / totalColumns) * 100,
          width: (1 / totalColumns) * 100,
          column: col,
          totalColumns,
        })
      }
    }
  }

  return positioned
}

// ─── All-day events bar ─────────────────────────────────────────────────────

function AllDayBar({ dates, events, onEventClick }: {
  dates: Date[]
  events: CalendarEvent[]
  onEventClick: (event: CalendarEvent) => void
}) {
  const allDayEvents = events.filter((e) => e.all_day)
  if (allDayEvents.length === 0) return null

  return (
    <div className="border-b border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50">
      <div className="flex">
        {/* Gutter */}
        <div className="w-16 shrink-0 px-2 py-1 text-[10px] text-gray-400 text-right">
          all-day
        </div>
        {/* Day columns */}
        <div className="flex-1 grid" style={{ gridTemplateColumns: `repeat(${dates.length}, 1fr)` }}>
          {dates.map((date) => {
            const dateStr = toDateStr(date)
            const dayAllDay = allDayEvents.filter((e) => {
              const eDate = e.start_time.slice(0, 10)
              const eEnd = e.end_time.slice(0, 10)
              return dateStr >= eDate && dateStr <= eEnd
            })
            return (
              <div key={dateStr} className="border-l border-gray-200 dark:border-gray-700 p-0.5 min-h-[28px]">
                {dayAllDay.map((ev) => {
                  const colors = EVENT_COLORS[ev.event_type] || EVENT_COLORS.meeting
                  return (
                    <button
                      key={ev.id}
                      onClick={() => onEventClick(ev)}
                      className={`w-full text-left text-[10px] font-medium px-1.5 py-0.5 rounded-[3px] truncate ${colors.bg} ${colors.text} border-l-2 ${colors.border} mb-0.5`}
                    >
                      {ev.title}
                    </button>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ─── Now line indicator ──────────────────────────────────────────────────────

function NowLine({ dayStartHour }: { dayStartHour: number }) {
  const now = new Date()
  const minutes = now.getHours() * 60 + now.getMinutes()
  const top = ((minutes - dayStartHour * 60) / 60) * HOUR_HEIGHT

  if (top < 0) return null

  return (
    <div
      className="absolute left-0 right-0 z-20 pointer-events-none"
      style={{ top: `${top}px` }}
    >
      <div className="flex items-center">
        <div className="w-2 h-2 rounded-full bg-red-500 -ml-1" />
        <div className="flex-1 h-[2px] bg-red-500" />
      </div>
    </div>
  )
}

// ─── ERP Badge ───────────────────────────────────────────────────────────────

function ERPBadges({ erp_context }: { erp_context: CalendarEvent['erp_context'] }) {
  if (!erp_context) return null

  const badges: { key: string; label: string }[] = []
  if (erp_context.invoice_id) badges.push({ key: 'invoice_id', label: erp_context.invoice_number ? `INV ${erp_context.invoice_number}` : 'Invoice' })
  if (erp_context.ticket_id) badges.push({ key: 'ticket_id', label: erp_context.ticket_subject || 'Ticket' })
  if (erp_context.deal_id) badges.push({ key: 'deal_id', label: erp_context.deal_name || 'Deal' })
  if (erp_context.project_id) badges.push({ key: 'project_id', label: erp_context.project_name || 'Project' })
  if (erp_context.task_id) badges.push({ key: 'task_id', label: erp_context.task_title || 'Task' })

  if (badges.length === 0) return null

  return (
    <div className="flex flex-wrap gap-0.5 mt-0.5">
      {badges.map(({ key, label }) => (
        <span
          key={key}
          className={`inline-block text-[8px] font-semibold px-1 py-0 rounded ${ERP_BADGE_COLORS[key] || 'bg-gray-100 text-gray-600'}`}
        >
          {label}
        </span>
      ))}
    </div>
  )
}

// ─── Single event chip in the time grid ──────────────────────────────────────

function EventChip({ positioned, onClick, compact }: {
  positioned: PositionedEvent
  onClick: (event: CalendarEvent) => void
  compact?: boolean
}) {
  const { event, top, height, left, width } = positioned
  const colors = EVENT_COLORS[event.event_type] || EVENT_COLORS.meeting
  const isShort = height < 40
  const isTiny = height < 28

  return (
    <button
      className={`absolute rounded-[6px] overflow-hidden border-l-[3px] ${colors.border} ${colors.bg} ${colors.text}
        hover:brightness-110 hover:shadow-md transition-all cursor-pointer text-left group z-10`}
      style={{
        top: `${top}px`,
        height: `${height}px`,
        left: `calc(${left}% + 2px)`,
        width: `calc(${width}% - 4px)`,
        minHeight: `${MIN_EVENT_HEIGHT}px`,
      }}
      onClick={(e) => { e.stopPropagation(); onClick(event) }}
      title={`${event.title}\n${formatTimeShort(event.start_time)} - ${formatTimeShort(event.end_time)}`}
    >
      <div className={`px-1.5 ${isTiny ? 'py-0' : 'py-1'} h-full overflow-hidden`}>
        {isTiny ? (
          <p className="text-[9px] font-semibold truncate leading-tight">{event.title}</p>
        ) : isShort ? (
          <div className="flex items-center gap-1">
            <span className="text-[9px] font-bold opacity-80">{formatTimeShort(event.start_time)}</span>
            <span className="text-[10px] font-semibold truncate">{event.title}</span>
          </div>
        ) : (
          <>
            <p className="text-[11px] font-semibold truncate leading-tight">{event.title}</p>
            <p className="text-[9px] opacity-80 leading-tight">
              {formatTimeShort(event.start_time)} – {formatTimeShort(event.end_time)}
            </p>
            {event.location && !compact && (
              <p className="text-[9px] opacity-70 truncate mt-0.5">
                <span className="inline-block w-2.5 h-2.5 align-middle mr-0.5">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </span>
                {event.location}
              </p>
            )}
            {!compact && event.erp_context && <ERPBadges erp_context={event.erp_context} />}
            {event.priority === 'urgent' && (
              <span className="inline-block text-[8px] bg-red-100 text-red-700 font-bold px-1 rounded mt-0.5">URGENT</span>
            )}
          </>
        )}
      </div>
    </button>
  )
}

// ─── Main TimeGrid component ─────────────────────────────────────────────────

export default function TimeGrid({
  dates,
  events,
  onEventClick,
  onSlotClick,
  onEventDrop,
  onSlotSelect,
  showNowLine = true,
  compact = false,
}: TimeGridProps) {
  const { dayStartHour, dayEndHour } = useCalendarStore()
  const gridRef = useRef<HTMLDivElement>(null)
  const [dragSelection, setDragSelection] = useState<{
    dateStr: string
    startMinute: number
    endMinute: number
  } | null>(null)
  const isDragging = useRef(false)

  const totalHours = dayEndHour - dayStartHour
  const hours = useMemo(
    () => Array.from({ length: totalHours }, (_, i) => dayStartHour + i),
    [dayStartHour, totalHours]
  )

  const todayStr = toDateStr(new Date())
  const isMultiDay = dates.length > 1

  // Get timed events (non all-day) per date
  const eventsByDate = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {}
    for (const date of dates) {
      const dateStr = toDateStr(date)
      map[dateStr] = events.filter((e) => {
        if (e.all_day) return false
        const eDate = e.start_time.slice(0, 10)
        return eDate === dateStr
      })
    }
    return map
  }, [dates, events])

  // Get positioned events per date
  const positionedByDate = useMemo(() => {
    const map: Record<string, PositionedEvent[]> = {}
    for (const [dateStr, dayEvents] of Object.entries(eventsByDate)) {
      map[dateStr] = layoutEventsForDay(dayEvents, dayStartHour, dayEndHour)
    }
    return map
  }, [eventsByDate, dayStartHour, dayEndHour])

  // Drag-to-create handlers
  const getSlotFromMouseEvent = useCallback((e: React.MouseEvent, dateStr: string) => {
    const col = (e.currentTarget as HTMLElement)
    const rect = col.getBoundingClientRect()
    const y = e.clientY - rect.top + col.scrollTop
    const totalMinutes = (y / HOUR_HEIGHT) * 60 + dayStartHour * 60
    const snapped = Math.round(totalMinutes / 15) * 15
    return { dateStr, minute: snapped }
  }, [dayStartHour])

  const handleMouseDown = useCallback((e: React.MouseEvent, dateStr: string) => {
    if (e.button !== 0) return
    const slot = getSlotFromMouseEvent(e, dateStr)
    isDragging.current = true
    setDragSelection({ dateStr, startMinute: slot.minute, endMinute: slot.minute + 30 })
  }, [getSlotFromMouseEvent])

  const handleMouseMove = useCallback((e: React.MouseEvent, dateStr: string) => {
    if (!isDragging.current || !dragSelection || dragSelection.dateStr !== dateStr) return
    const slot = getSlotFromMouseEvent(e, dateStr)
    setDragSelection((prev) => prev ? { ...prev, endMinute: Math.max(slot.minute, prev.startMinute + 15) } : null)
  }, [dragSelection, getSlotFromMouseEvent])

  const handleMouseUp = useCallback(() => {
    if (isDragging.current && dragSelection) {
      const startH = Math.floor(dragSelection.startMinute / 60)
      const startM = dragSelection.startMinute % 60
      const endH = Math.floor(dragSelection.endMinute / 60)
      const endM = dragSelection.endMinute % 60

      if (onSlotSelect) {
        onSlotSelect(dragSelection.dateStr, startH, startM, endH, endM)
      } else {
        onSlotClick(dragSelection.dateStr, startH, startM)
      }
    }
    isDragging.current = false
    setDragSelection(null)
  }, [dragSelection, onSlotClick, onSlotSelect])

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* All-day events */}
      <AllDayBar dates={dates} events={events} onEventClick={onEventClick} />

      {/* Column headers (for multi-day / week view) */}
      {isMultiDay && (
        <div className="flex border-b border-gray-200 dark:border-gray-700 shrink-0">
          <div className="w-16 shrink-0" />
          <div className="flex-1 grid" style={{ gridTemplateColumns: `repeat(${dates.length}, 1fr)` }}>
            {dates.map((date) => {
              const dateStr = toDateStr(date)
              const isToday = dateStr === todayStr
              const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
              return (
                <div
                  key={dateStr}
                  className={`text-center py-2 border-l border-gray-200 dark:border-gray-700 ${isToday ? 'bg-[#51459d]/5' : ''}`}
                >
                  <p className="text-[10px] text-gray-400 uppercase font-medium">{dayNames[date.getDay()]}</p>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold mx-auto
                    ${isToday ? 'bg-[#51459d] text-white' : 'text-gray-700 dark:text-gray-300'}`}>
                    {date.getDate()}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Scrollable time grid */}
      <div ref={gridRef} className="flex-1 overflow-y-auto overflow-x-hidden" onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}>
        <div className="flex relative" style={{ height: `${totalHours * HOUR_HEIGHT}px` }}>
          {/* Time gutter */}
          <div className="w-16 shrink-0 relative">
            {hours.map((hour) => (
              <div
                key={hour}
                className="absolute w-full text-right pr-2"
                style={{ top: `${(hour - dayStartHour) * HOUR_HEIGHT}px` }}
              >
                <span className="text-[10px] text-gray-400 font-medium -mt-2 block">
                  {formatHour(hour)}
                </span>
              </div>
            ))}
          </div>

          {/* Day columns */}
          <div className="flex-1 grid relative" style={{ gridTemplateColumns: `repeat(${dates.length}, 1fr)` }}>
            {dates.map((date) => {
              const dateStr = toDateStr(date)
              const isToday = dateStr === todayStr
              const positioned = positionedByDate[dateStr] || []

              return (
                <div
                  key={dateStr}
                  className={`relative border-l border-gray-200 dark:border-gray-700 ${isToday ? 'bg-[#51459d]/[0.02]' : ''}`}
                  onMouseDown={(e) => handleMouseDown(e, dateStr)}
                  onMouseMove={(e) => handleMouseMove(e, dateStr)}
                  onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move' }}
                  onDrop={(e) => {
                    e.preventDefault()
                    const eventId = e.dataTransfer.getData('text/plain')
                    const droppedEvent = events.find((ev) => ev.id === eventId)
                    if (droppedEvent && onEventDrop) {
                      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
                      const y = e.clientY - rect.top
                      const minuteOffset = Math.round(((y / HOUR_HEIGHT) * 60) / 15) * 15
                      const startMinutes = dayStartHour * 60 + minuteOffset
                      const duration = new Date(droppedEvent.end_time).getTime() - new Date(droppedEvent.start_time).getTime()
                      const newStartH = Math.floor(startMinutes / 60)
                      const newStartM = startMinutes % 60
                      const [y2, m, d] = dateStr.split('-').map(Number)
                      const newStart = new Date(y2, m - 1, d, newStartH, newStartM)
                      const newEnd = new Date(newStart.getTime() + duration)
                      onEventDrop(droppedEvent, newStart.toISOString(), newEnd.toISOString())
                    }
                  }}
                >
                  {/* Hour gridlines */}
                  {hours.map((hour) => (
                    <div
                      key={hour}
                      className="absolute w-full border-t border-gray-100 dark:border-gray-800"
                      style={{ top: `${(hour - dayStartHour) * HOUR_HEIGHT}px`, height: `${HOUR_HEIGHT}px` }}
                    >
                      {/* Half-hour line */}
                      <div className="absolute w-full border-t border-gray-50 dark:border-gray-850 border-dashed" style={{ top: `${SLOT_HEIGHT}px` }} />
                    </div>
                  ))}

                  {/* Drag selection highlight */}
                  {dragSelection && dragSelection.dateStr === dateStr && (
                    <div
                      className="absolute left-1 right-1 bg-[#51459d]/15 border border-[#51459d]/30 rounded-[4px] z-30 pointer-events-none"
                      style={{
                        top: `${((dragSelection.startMinute - dayStartHour * 60) / 60) * HOUR_HEIGHT}px`,
                        height: `${((dragSelection.endMinute - dragSelection.startMinute) / 60) * HOUR_HEIGHT}px`,
                      }}
                    />
                  )}

                  {/* Now line */}
                  {showNowLine && isToday && <NowLine dayStartHour={dayStartHour} />}

                  {/* Events */}
                  {positioned.map((p) => (
                    <EventChip
                      key={p.event.id}
                      positioned={p}
                      onClick={onEventClick}
                      compact={compact}
                    />
                  ))}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
