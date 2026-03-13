/**
 * TimelineView — Horizontal Gantt chart for rows with start/end date properties.
 */
import { useState } from 'react'
import { useDatabaseRows, type DatabaseProperty, type DatabaseRow } from '../../../api/noteDatabases'

const COLORS = ['bg-[#51459d]', 'bg-[#3ec9d6]', 'bg-[#6fd943]', 'bg-[#ffa21d]', 'bg-[#ff3a6e]']

function addDays(date: Date, days: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

function formatShort(date: Date): string {
  return date.toLocaleDateString('en-KE', { day: 'numeric', month: 'short' })
}

export default function TimelineView({
  databaseId,
  properties,
  filteredRows,
}: {
  databaseId: string
  properties: DatabaseProperty[]
  filteredRows?: DatabaseRow[]
}) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const [windowStart, setWindowStart] = useState(() => {
    const d = new Date(today)
    d.setDate(d.getDate() - 7)
    return d
  })
  const DAYS = 30

  const { data: allRows = [] } = useDatabaseRows(databaseId)
  const rows = filteredRows ?? allRows

  const dateProps = properties.filter(p => p.property_type === 'date')
  const startProp = dateProps[0]
  const endProp = dateProps[1] ?? dateProps[0]
  const titleProp = properties.find(p => p.name === 'Name' || p.name === 'Title' || p.property_type === 'text')

  // Build day headers
  const days: Date[] = []
  for (let i = 0; i < DAYS; i++) days.push(addDays(windowStart, i))

  const colWidth = 40 // px per day

  return (
    <div className="flex-1 flex flex-col overflow-hidden p-4">
      {/* Navigation */}
      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => setWindowStart(d => addDays(d, -7))} className="text-xs px-2 py-1 border border-gray-200 dark:border-gray-700 rounded-[6px] hover:bg-gray-50 dark:hover:bg-gray-800">← 1w</button>
        <button onClick={() => setWindowStart(d => addDays(d, 7))} className="text-xs px-2 py-1 border border-gray-200 dark:border-gray-700 rounded-[6px] hover:bg-gray-50 dark:hover:bg-gray-800">1w →</button>
        <button onClick={() => setWindowStart(addDays(today, -7))} className="text-xs px-2 py-1 bg-[#51459d]/10 text-[#51459d] rounded-[6px] hover:bg-[#51459d]/20">Today</button>
        <span className="text-xs text-gray-400">{formatShort(windowStart)} — {formatShort(addDays(windowStart, DAYS - 1))}</span>
      </div>

      <div className="flex-1 overflow-auto">
        <div style={{ minWidth: `${200 + DAYS * colWidth}px` }}>
          {/* Day header row */}
          <div className="flex border-b border-gray-100 dark:border-gray-800 sticky top-0 bg-white dark:bg-gray-900 z-10">
            <div className="w-48 shrink-0 px-3 py-1.5 text-[10px] font-medium text-gray-500">Name</div>
            {days.map((d, i) => {
              const isToday = d.toDateString() === today.toDateString()
              const isWeekend = d.getDay() === 0 || d.getDay() === 6
              return (
                <div key={i} style={{ width: colWidth }} className={`shrink-0 text-center text-[9px] py-1.5 border-l border-gray-100 dark:border-gray-800 ${isToday ? 'bg-[#51459d]/5 text-[#51459d] font-bold' : isWeekend ? 'text-gray-300' : 'text-gray-400'}`}>
                  {d.getDate()}
                  {d.getDate() === 1 && <div className="text-[8px]">{d.toLocaleDateString('en', { month: 'short' })}</div>}
                </div>
              )
            })}
          </div>

          {/* Rows */}
          {rows.map((row, rowIdx) => {
            const vals = row.values as Record<string, any>
            const title = titleProp ? String(vals[titleProp.name] ?? '') || 'Untitled' : 'Row'
            const startStr = startProp ? String(vals[startProp.name] ?? '') : ''
            const endStr = endProp ? String(vals[endProp.name] ?? startStr) : startStr

            const startDate = startStr ? new Date(startStr) : null
            const endDate = endStr ? new Date(endStr) : startDate

            // Calculate bar position
            let barLeft = -1
            let barWidth = 0
            if (startDate && endDate) {
              const startOffset = Math.floor((startDate.getTime() - windowStart.getTime()) / 86400000)
              const endOffset = Math.ceil((endDate.getTime() - windowStart.getTime()) / 86400000)
              barLeft = Math.max(0, startOffset)
              barWidth = Math.min(DAYS, endOffset) - barLeft
            }

            return (
              <div key={row.id} className="flex items-center border-b border-gray-50 dark:border-gray-800/50 hover:bg-gray-50/50 dark:hover:bg-gray-800/20">
                <div className="w-48 shrink-0 px-3 py-2 text-[11px] text-gray-700 dark:text-gray-300 truncate">{title}</div>
                <div className="flex-1 relative h-8" style={{ width: `${DAYS * colWidth}px` }}>
                  {/* Background grid */}
                  {days.map((d, i) => (
                    <div
                      key={i}
                      style={{ left: i * colWidth, width: colWidth }}
                      className={`absolute inset-y-0 border-l border-gray-100 dark:border-gray-800 ${d.toDateString() === today.toDateString() ? 'bg-[#51459d]/5' : ''}`}
                    />
                  ))}
                  {/* Bar */}
                  {barLeft >= 0 && barWidth > 0 && (
                    <div
                      style={{ left: barLeft * colWidth + 2, width: barWidth * colWidth - 4 }}
                      className={`absolute top-1.5 h-5 rounded-[4px] ${COLORS[rowIdx % COLORS.length]} opacity-80 flex items-center px-1.5`}
                    >
                      <span className="text-[9px] text-white truncate">{title}</span>
                    </div>
                  )}
                </div>
              </div>
            )
          })}

          {rows.length === 0 && (
            <div className="text-center py-8 text-sm text-gray-400">No rows to display</div>
          )}
        </div>
      </div>

      {!startProp && (
        <p className="text-center text-xs text-gray-400 mt-3">Add Date properties to use Timeline view</p>
      )}
    </div>
  )
}
