/**
 * CalendarView — Groups database rows by date property and renders a month grid.
 */
import { useState } from 'react'
import { useDatabaseRows, type DatabaseProperty, type DatabaseRow } from '../../../api/noteDatabases'

// Helper to get YYYY-MM-DD from row values
function getRowDate(row: DatabaseRow, dateProp: DatabaseProperty | undefined): string | null {
  if (!dateProp) return null
  const val = (row.values as Record<string, any>)[dateProp.name]
  return val ? String(val).slice(0, 10) : null
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate()
}

function getFirstDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 1).getDay()
}

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December']
const DAY_NAMES = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']

export default function CalendarView({
  databaseId,
  properties,
  filteredRows,
}: {
  databaseId: string
  properties: DatabaseProperty[]
  filteredRows?: DatabaseRow[]
}) {
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())
  const { data: allRows = [] } = useDatabaseRows(databaseId)
  const rows = filteredRows ?? allRows

  const dateProp = properties.find(p => p.property_type === 'date')
  const titleProp = properties.find(p => p.property_type === 'text' || p.name === 'Name' || p.name === 'Title')

  const daysInMonth = getDaysInMonth(year, month)
  const firstDay = getFirstDayOfMonth(year, month)

  // Build a map: YYYY-MM-DD → rows
  const rowsByDate: Record<string, DatabaseRow[]> = {}
  rows.forEach(row => {
    const d = getRowDate(row, dateProp)
    if (d) {
      if (!rowsByDate[d]) rowsByDate[d] = []
      rowsByDate[d].push(row)
    }
  })

  const prevMonth = () => {
    if (month === 0) { setYear(y => y - 1); setMonth(11) } else setMonth(m => m - 1)
  }
  const nextMonth = () => {
    if (month === 11) { setYear(y => y + 1); setMonth(0) } else setMonth(m => m + 1)
  }

  // Build calendar grid: 6 weeks × 7 days
  const cells: (number | null)[] = Array(firstDay).fill(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)
  while (cells.length % 7 !== 0) cells.push(null)

  return (
    <div className="flex-1 flex flex-col overflow-hidden p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <button onClick={prevMonth} className="p-1.5 rounded-[6px] hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
          <svg className="h-4 w-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
        </button>
        <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">{MONTH_NAMES[month]} {year}</h3>
        <button onClick={nextMonth} className="p-1.5 rounded-[6px] hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
          <svg className="h-4 w-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
        </button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 mb-1">
        {DAY_NAMES.map(d => (
          <div key={d} className="text-[10px] font-medium text-gray-400 text-center py-1">{d}</div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="flex-1 grid grid-cols-7 gap-px bg-gray-200 dark:bg-gray-700 rounded-[8px] overflow-hidden">
        {cells.map((day, i) => {
          const dateStr = day ? `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}` : ''
          const dayRows = day ? (rowsByDate[dateStr] ?? []) : []
          const isToday = day === today.getDate() && month === today.getMonth() && year === today.getFullYear()

          return (
            <div key={i} className={`bg-white dark:bg-gray-900 p-1.5 min-h-[80px] ${!day ? 'opacity-30' : ''}`}>
              {day && (
                <>
                  <div className={`w-5 h-5 text-[11px] font-medium flex items-center justify-center rounded-full mb-1 ${isToday ? 'bg-[#51459d] text-white' : 'text-gray-600 dark:text-gray-400'}`}>
                    {day}
                  </div>
                  <div className="space-y-0.5">
                    {dayRows.slice(0, 3).map(row => (
                      <div key={row.id} className="text-[9px] bg-[#51459d]/10 text-[#51459d] rounded px-1 truncate">
                        {titleProp ? String((row.values as any)[titleProp.name] ?? '') || 'Untitled' : row.id.slice(0, 6)}
                      </div>
                    ))}
                    {dayRows.length > 3 && (
                      <div className="text-[9px] text-gray-400">+{dayRows.length - 3} more</div>
                    )}
                  </div>
                </>
              )}
            </div>
          )
        })}
      </div>

      {!dateProp && (
        <p className="text-center text-xs text-gray-400 mt-3">Add a Date property to use Calendar view</p>
      )}
    </div>
  )
}
