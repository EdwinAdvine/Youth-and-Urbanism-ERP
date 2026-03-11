import { useCalendarEvents, type CalendarEvent } from '../../api/calendar'

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

function formatTime(iso: string) {
  const d = new Date(iso)
  const h = d.getHours()
  const m = d.getMinutes()
  const period = h >= 12 ? 'PM' : 'AM'
  const hour = h % 12 || 12
  return `${hour}:${String(m).padStart(2, '0')} ${period}`
}

function toDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

interface PrintViewProps {
  year: number
  month: number
  onClose: () => void
}

export default function PrintView({ year, month, onClose }: PrintViewProps) {
  const { data } = useCalendarEvents()
  const events = data?.events ?? []

  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  const startPad = firstDay.getDay()
  const totalCells = Math.ceil((startPad + lastDay.getDate()) / 7) * 7

  const cells = Array.from({ length: totalCells }, (_, i) => {
    const dayNum = i - startPad + 1
    if (dayNum < 1 || dayNum > lastDay.getDate()) return null
    return toDateStr(new Date(year, month, dayNum))
  })

  const eventsForDate = (dateStr: string): CalendarEvent[] => {
    return events.filter((e) => e.start_time.slice(0, 10) === dateStr)
  }

  const handlePrint = () => {
    window.print()
  }

  return (
    <div className="fixed inset-0 z-50 bg-white overflow-auto">
      {/* Controls (hidden in print) */}
      <div className="print:hidden sticky top-0 bg-white border-b border-gray-100 px-6 py-3 flex items-center gap-3 z-10">
        <button
          onClick={onClose}
          className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-800 transition-colors"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to calendar
        </button>
        <div className="flex-1" />
        <button
          onClick={handlePrint}
          className="flex items-center gap-1.5 px-4 py-2 text-xs bg-[#51459d] text-white rounded-[8px] hover:bg-[#3d3480] transition-colors"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2z" />
          </svg>
          Print
        </button>
      </div>

      {/* Print content */}
      <div className="max-w-[1100px] mx-auto p-8">
        {/* Title */}
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900" style={{ fontFamily: 'Open Sans, sans-serif' }}>
            {MONTHS[month]} {year}
          </h1>
          <p className="text-xs text-gray-400 mt-1">Urban ERP Calendar</p>
        </div>

        {/* Calendar grid */}
        <table className="w-full border-collapse border border-gray-300">
          <thead>
            <tr>
              {DAYS.map((day) => (
                <th
                  key={day}
                  className="border border-gray-300 px-2 py-2 text-xs font-semibold text-gray-600 bg-gray-50 text-center"
                >
                  {day}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: totalCells / 7 }, (_, weekIdx) => (
              <tr key={weekIdx}>
                {Array.from({ length: 7 }, (_, dayIdx) => {
                  const cellIdx = weekIdx * 7 + dayIdx
                  const dateStr = cells[cellIdx]
                  if (!dateStr) {
                    return (
                      <td
                        key={dayIdx}
                        className="border border-gray-300 bg-gray-50 h-24 align-top p-1"
                      />
                    )
                  }
                  const dayNum = parseInt(dateStr.split('-')[2])
                  const dayEvents = eventsForDate(dateStr)

                  return (
                    <td
                      key={dayIdx}
                      className="border border-gray-300 h-24 align-top p-1"
                    >
                      <div className="text-xs font-semibold text-gray-700 mb-1">
                        {dayNum}
                      </div>
                      {dayEvents.slice(0, 4).map((ev) => (
                        <div
                          key={ev.id}
                          className="text-[9px] leading-tight text-gray-600 mb-0.5 truncate"
                        >
                          {!ev.all_day && (
                            <span className="font-medium text-gray-500">
                              {formatTime(ev.start_time)}{' '}
                            </span>
                          )}
                          {ev.title}
                        </div>
                      ))}
                      {dayEvents.length > 4 && (
                        <div className="text-[8px] text-gray-400">
                          +{dayEvents.length - 4} more
                        </div>
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>

        {/* Events list for the month */}
        <div className="mt-8 print:break-before-page">
          <h2 className="text-sm font-semibold text-gray-700 mb-3 border-b border-gray-200 pb-1">
            Events in {MONTHS[month]} {year}
          </h2>
          {events
            .filter((e) => {
              const d = new Date(e.start_time)
              return d.getFullYear() === year && d.getMonth() === month
            })
            .sort((a, b) => a.start_time.localeCompare(b.start_time))
            .map((ev) => (
              <div key={ev.id} className="flex items-baseline gap-3 py-1 text-xs border-b border-gray-50">
                <span className="w-20 text-gray-400 shrink-0">
                  {new Date(ev.start_time).toLocaleDateString('en-KE', { month: 'short', day: 'numeric' })}
                </span>
                <span className="w-16 text-gray-400 shrink-0">
                  {ev.all_day ? 'All day' : formatTime(ev.start_time)}
                </span>
                <span className="text-gray-700 font-medium">{ev.title}</span>
                {ev.location && (
                  <span className="text-gray-400 ml-auto">@ {ev.location}</span>
                )}
              </div>
            ))}
        </div>
      </div>
    </div>
  )
}
