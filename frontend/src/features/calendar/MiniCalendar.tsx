import { useState } from 'react'

const DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

interface MiniCalendarProps {
  selectedDate?: Date
  onDateSelect?: (date: Date) => void
}

export default function MiniCalendar({ selectedDate, onDateSelect }: MiniCalendarProps) {
  const today = new Date()
  const [viewDate, setViewDate] = useState(selectedDate ?? today)
  const year = viewDate.getFullYear()
  const month = viewDate.getMonth()

  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  const startPad = firstDay.getDay()
  const totalCells = Math.ceil((startPad + lastDay.getDate()) / 7) * 7

  const cells = Array.from({ length: totalCells }, (_, i) => {
    const dayNum = i - startPad + 1
    if (dayNum < 1 || dayNum > lastDay.getDate()) return null
    return new Date(year, month, dayNum)
  })

  const isSameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()

  const navigate = (dir: 1 | -1) => {
    const d = new Date(viewDate)
    d.setMonth(d.getMonth() + dir)
    setViewDate(d)
  }

  return (
    <div className="select-none">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <button
          onClick={() => navigate(-1)}
          className="p-1 hover:bg-gray-100 rounded-[6px] text-gray-400 transition-colors"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <span className="text-xs font-semibold text-gray-700">
          {MONTHS[month]} {year}
        </span>
        <button
          onClick={() => navigate(1)}
          className="p-1 hover:bg-gray-100 rounded-[6px] text-gray-400 transition-colors"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 mb-1">
        {DAYS.map((d) => (
          <div key={d} className="text-center text-[10px] font-semibold text-gray-400 py-1">
            {d}
          </div>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7">
        {cells.map((date, i) => {
          if (!date) {
            return <div key={i} className="h-7" />
          }
          const isToday = isSameDay(date, today)
          const isSelected = selectedDate && isSameDay(date, selectedDate)

          return (
            <button
              key={i}
              onClick={() => onDateSelect?.(date)}
              className={`h-7 w-7 mx-auto flex items-center justify-center text-[11px] rounded-full transition-colors
                ${isSelected
                  ? 'bg-[#51459d] text-white font-semibold'
                  : isToday
                    ? 'bg-[#51459d]/10 text-[#51459d] font-semibold'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
            >
              {date.getDate()}
            </button>
          )
        })}
      </div>
    </div>
  )
}
