import { useState } from 'react'

export interface CalendarSource {
  id: string
  name: string
  color: string
  enabled: boolean
}

const DEFAULT_CALENDARS: CalendarSource[] = [
  { id: 'personal', name: 'Personal', color: '#51459d', enabled: true },
  { id: 'team', name: 'Team', color: '#3ec9d6', enabled: true },
  { id: 'holidays', name: 'Holidays', color: '#ff3a6e', enabled: true },
  { id: 'birthdays', name: 'Birthdays', color: '#ffa21d', enabled: false },
  { id: 'tasks', name: 'Tasks', color: '#6fd943', enabled: true },
]

interface MultiCalendarSidebarProps {
  calendars?: CalendarSource[]
  onChange?: (calendars: CalendarSource[]) => void
}

export default function MultiCalendarSidebar({
  calendars: externalCalendars,
  onChange,
}: MultiCalendarSidebarProps) {
  const [internalCalendars, setInternalCalendars] = useState(DEFAULT_CALENDARS)
  const calendars = externalCalendars ?? internalCalendars

  const toggle = (id: string) => {
    const updated = calendars.map((c) =>
      c.id === id ? { ...c, enabled: !c.enabled } : c
    )
    if (onChange) {
      onChange(updated)
    } else {
      setInternalCalendars(updated)
    }
  }

  const enabledCount = calendars.filter((c) => c.enabled).length

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
          My Calendars
        </p>
        <span className="text-[10px] text-gray-400">{enabledCount}/{calendars.length}</span>
      </div>
      <div className="space-y-1">
        {calendars.map((cal) => (
          <button
            key={cal.id}
            onClick={() => toggle(cal.id)}
            className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-[6px] hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-left group"
          >
            <div
              className={`w-4 h-4 rounded-[4px] border-2 flex items-center justify-center transition-colors ${ cal.enabled ? 'border-transparent' : 'border-gray-300' }`}
              style={cal.enabled ? { backgroundColor: cal.color } : undefined}
            >
              {cal.enabled && (
                <svg className="h-2.5 w-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </div>
            <span
              className={`text-xs transition-colors ${ cal.enabled ? 'text-gray-700 font-medium' : 'text-gray-400' }`}
            >
              {cal.name}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}
