import { useMemo } from 'react'
import type { CalendarEvent } from '../../api/calendar'

// ─── Types ───────────────────────────────────────────────────────────────────

interface YearViewProps {
  year: number
  events: CalendarEvent[]
  onDayClick: (date: string) => void
  onMonthClick: (month: number) => void
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const DAYS_SHORT = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

function toDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function getHeatColor(count: number): string {
  if (count === 0) return 'bg-gray-100 dark:bg-gray-800'
  if (count === 1) return 'bg-[#51459d]/20'
  if (count === 2) return 'bg-[#51459d]/40'
  if (count <= 4) return 'bg-[#51459d]/60'
  return 'bg-[#51459d]/80'
}

// ─── MiniMonth ───────────────────────────────────────────────────────────────

function MiniMonth({ year, month, eventCountByDate, onDayClick, onMonthClick }: {
  year: number
  month: number
  eventCountByDate: Record<string, number>
  onDayClick: (date: string) => void
  onMonthClick: (month: number) => void
}) {
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  const startPad = firstDay.getDay()
  const totalCells = Math.ceil((startPad + lastDay.getDate()) / 7) * 7
  const todayStr = toDateStr(new Date())

  const cells = Array.from({ length: totalCells }, (_, i) => {
    const dayNum = i - startPad + 1
    if (dayNum < 1 || dayNum > lastDay.getDate()) return null
    return toDateStr(new Date(year, month, dayNum))
  })

  return (
    <div className="p-2">
      <button
        onClick={() => onMonthClick(month)}
        className="text-xs font-bold text-gray-700 dark:text-gray-300 hover:text-[#51459d] mb-1 block"
      >
        {MONTHS[month]}
      </button>
      <div className="grid grid-cols-7 gap-0">
        {DAYS_SHORT.map((d, i) => (
          <div key={i} className="text-center text-[8px] text-gray-400 font-medium py-0.5">{d}</div>
        ))}
        {cells.map((dateStr, i) => {
          if (!dateStr) return <div key={i} className="w-5 h-5" />
          const count = eventCountByDate[dateStr] || 0
          const isToday = dateStr === todayStr
          const dayNum = parseInt(dateStr.split('-')[2])

          return (
            <button
              key={i}
              onClick={() => onDayClick(dateStr)}
              className={`w-5 h-5 flex items-center justify-center text-[9px] rounded-[3px] transition-colors
                ${isToday ? 'ring-1 ring-[#51459d] font-bold text-[#51459d]' : ''}
                ${count > 0 ? getHeatColor(count) : 'hover:bg-gray-50 dark:hover:bg-gray-700'}
              `}
              title={count > 0 ? `${count} event${count !== 1 ? 's' : ''}` : undefined}
            >
              {dayNum}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ─── Year View ───────────────────────────────────────────────────────────────

export default function YearView({ year, events, onDayClick, onMonthClick }: YearViewProps) {
  // Build event count map
  const eventCountByDate = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const event of events) {
      const date = event.start_time.slice(0, 10)
      counts[date] = (counts[date] || 0) + 1
    }
    return counts
  }, [events])

  // Total events this year
  const totalEvents = events.filter((e) => e.start_time.startsWith(String(year))).length

  return (
    <div className="flex-1 overflow-auto p-4">
      <div className="max-w-5xl mx-auto">
        {/* Stats bar */}
        <div className="flex items-center gap-4 mb-4 px-2">
          <span className="text-xs text-gray-500">{totalEvents} events in {year}</span>
          <div className="flex items-center gap-1 text-[9px] text-gray-400">
            <span>Less</span>
            <div className="w-3 h-3 rounded-sm bg-gray-100 dark:bg-gray-800" />
            <div className="w-3 h-3 rounded-sm bg-[#51459d]/20" />
            <div className="w-3 h-3 rounded-sm bg-[#51459d]/40" />
            <div className="w-3 h-3 rounded-sm bg-[#51459d]/60" />
            <div className="w-3 h-3 rounded-sm bg-[#51459d]/80" />
            <span>More</span>
          </div>
        </div>

        {/* 4x3 month grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
          {Array.from({ length: 12 }, (_, i) => (
            <MiniMonth
              key={i}
              year={year}
              month={i}
              eventCountByDate={eventCountByDate}
              onDayClick={onDayClick}
              onMonthClick={onMonthClick}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
