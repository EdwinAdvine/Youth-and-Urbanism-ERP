import { useState, useEffect, useMemo } from 'react'

// ── Common timezone definitions ─────────────────────────────────────────────

interface TimezoneEntry {
  id: string
  label: string
  offset: string // e.g. "+3", "-5"
  city: string
}

const POPULAR_TIMEZONES: TimezoneEntry[] = [
  { id: 'America/New_York',      label: 'Eastern',          offset: '-5',  city: 'New York' },
  { id: 'America/Chicago',       label: 'Central',          offset: '-6',  city: 'Chicago' },
  { id: 'America/Denver',        label: 'Mountain',         offset: '-7',  city: 'Denver' },
  { id: 'America/Los_Angeles',   label: 'Pacific',          offset: '-8',  city: 'Los Angeles' },
  { id: 'Europe/London',         label: 'GMT',              offset: '+0',  city: 'London' },
  { id: 'Europe/Paris',          label: 'CET',              offset: '+1',  city: 'Paris' },
  { id: 'Europe/Berlin',         label: 'CET',              offset: '+1',  city: 'Berlin' },
  { id: 'Africa/Nairobi',        label: 'EAT',              offset: '+3',  city: 'Nairobi' },
  { id: 'Africa/Lagos',          label: 'WAT',              offset: '+1',  city: 'Lagos' },
  { id: 'Africa/Cairo',          label: 'EET',              offset: '+2',  city: 'Cairo' },
  { id: 'Asia/Dubai',            label: 'GST',              offset: '+4',  city: 'Dubai' },
  { id: 'Asia/Kolkata',          label: 'IST',              offset: '+5:30', city: 'Mumbai' },
  { id: 'Asia/Shanghai',         label: 'CST',              offset: '+8',  city: 'Shanghai' },
  { id: 'Asia/Tokyo',            label: 'JST',              offset: '+9',  city: 'Tokyo' },
  { id: 'Asia/Singapore',        label: 'SGT',              offset: '+8',  city: 'Singapore' },
  { id: 'Australia/Sydney',      label: 'AEST',             offset: '+11', city: 'Sydney' },
  { id: 'Pacific/Auckland',      label: 'NZST',             offset: '+13', city: 'Auckland' },
  { id: 'America/Sao_Paulo',     label: 'BRT',              offset: '-3',  city: 'Sao Paulo' },
  { id: 'America/Toronto',       label: 'Eastern',          offset: '-5',  city: 'Toronto' },
  { id: 'Asia/Hong_Kong',        label: 'HKT',              offset: '+8',  city: 'Hong Kong' },
]

const STORAGE_KEY = 'era-calendar-world-clocks'

function getStoredClocks(): string[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored ? JSON.parse(stored) : ['America/New_York', 'Europe/London', 'Africa/Nairobi', 'Asia/Tokyo']
  } catch {
    return ['America/New_York', 'Europe/London', 'Africa/Nairobi', 'Asia/Tokyo']
  }
}

function formatTimeForTz(tz: string): { time: string; date: string; period: string; hour: number } {
  const now = new Date()
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).formatToParts(now)

    const hour24 = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hour: 'numeric',
      hour12: false,
    }).format(now)

    const hourVal = parseInt(parts.find(p => p.type === 'hour')?.value || '0')
    const minute = parts.find(p => p.type === 'minute')?.value || '00'
    const period = parts.find(p => p.type === 'dayPeriod')?.value || ''

    const dateStr = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    }).format(now)

    return {
      time: `${hourVal}:${minute}`,
      date: dateStr,
      period,
      hour: parseInt(hour24),
    }
  } catch {
    return { time: '--:--', date: '', period: '', hour: 0 }
  }
}

function getTimeColor(hour: number): string {
  // Night: 0-5, Morning: 6-11, Afternoon: 12-17, Evening: 18-23
  if (hour >= 6 && hour < 12) return 'text-amber-500'     // Morning
  if (hour >= 12 && hour < 18) return 'text-[#6fd943]'    // Afternoon (working hours)
  if (hour >= 18 && hour < 22) return 'text-orange-400'   // Evening
  return 'text-indigo-400'                                  // Night
}

function getTimeBg(hour: number): string {
  if (hour >= 9 && hour < 17) return 'bg-[#6fd943]/10'    // Business hours
  if (hour >= 6 && hour < 9) return 'bg-amber-500/10'     // Early morning
  if (hour >= 17 && hour < 22) return 'bg-orange-400/10'  // Evening
  return 'bg-indigo-400/10'                                 // Night
}

// ── Analog clock face ───────────────────────────────────────────────────────

function ClockFace({ hour, minute }: { hour: number; minute: number }) {
  const hourAngle = ((hour % 12) + minute / 60) * 30
  const minuteAngle = minute * 6

  return (
    <svg width="32" height="32" viewBox="0 0 32 32" className="shrink-0">
      <circle cx="16" cy="16" r="14" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-gray-300 dark:text-gray-600" />
      {/* Hour markers */}
      {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map(i => {
        const angle = i * 30 - 90
        const rad = (angle * Math.PI) / 180
        const x1 = 16 + 11 * Math.cos(rad)
        const y1 = 16 + 11 * Math.sin(rad)
        const x2 = 16 + 13 * Math.cos(rad)
        const y2 = 16 + 13 * Math.sin(rad)
        return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="currentColor" strokeWidth="1" className="text-gray-400 dark:text-gray-500" />
      })}
      {/* Hour hand */}
      <line
        x1="16" y1="16"
        x2={16 + 7 * Math.cos(((hourAngle - 90) * Math.PI) / 180)}
        y2={16 + 7 * Math.sin(((hourAngle - 90) * Math.PI) / 180)}
        stroke="currentColor" strokeWidth="2" strokeLinecap="round"
        className="text-gray-700 dark:text-gray-200"
      />
      {/* Minute hand */}
      <line
        x1="16" y1="16"
        x2={16 + 10 * Math.cos(((minuteAngle - 90) * Math.PI) / 180)}
        y2={16 + 10 * Math.sin(((minuteAngle - 90) * Math.PI) / 180)}
        stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"
        className="text-[#51459d]"
      />
      {/* Center dot */}
      <circle cx="16" cy="16" r="1.5" fill="currentColor" className="text-[#51459d]" />
    </svg>
  )
}

// ── 24h bar visualization ───────────────────────────────────────────────────

function DayBar({ hour }: { hour: number }) {
  const segments = 24
  return (
    <div className="flex h-1.5 w-full rounded-full overflow-hidden mt-1">
      {Array.from({ length: segments }).map((_, i) => (
        <div
          key={i}
          className={`flex-1 ${
            i >= 9 && i < 17
              ? 'bg-[#6fd943]/60'   // Business hours — green
              : i >= 6 && i < 9
              ? 'bg-amber-400/40'    // Early morning
              : i >= 17 && i < 22
              ? 'bg-orange-400/40'   // Evening
              : 'bg-indigo-400/30'   // Night
          } ${i === hour ? 'ring-1 ring-[#51459d] ring-offset-0' : ''}`}
        />
      ))}
    </div>
  )
}

// ── Main Component ──────────────────────────────────────────────────────────

interface WorldClockSidebarProps {
  open: boolean
  onClose: () => void
}

export default function WorldClockSidebar({ open, onClose }: WorldClockSidebarProps) {
  const [selectedTzIds, setSelectedTzIds] = useState<string[]>(getStoredClocks)
  const [now, setNow] = useState(new Date())
  const [showAdd, setShowAdd] = useState(false)
  const [search, setSearch] = useState('')

  // Tick every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(interval)
  }, [])

  // Persist selection
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(selectedTzIds))
  }, [selectedTzIds])

  const clockData = useMemo(() => {
    return selectedTzIds.map(tzId => {
      const entry = POPULAR_TIMEZONES.find(t => t.id === tzId)
      const { time, date, period, hour } = formatTimeForTz(tzId)
      const minuteStr = time.split(':')[1] || '00'
      return {
        id: tzId,
        city: entry?.city || tzId.split('/').pop()?.replace(/_/g, ' ') || tzId,
        label: entry?.label || '',
        offset: entry?.offset || '',
        time,
        date,
        period,
        hour,
        minute: parseInt(minuteStr),
        colorClass: getTimeColor(hour),
        bgClass: getTimeBg(hour),
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTzIds, now])

  const filteredTzs = useMemo(() => {
    if (!search) return POPULAR_TIMEZONES
    const q = search.toLowerCase()
    return POPULAR_TIMEZONES.filter(
      tz => tz.city.toLowerCase().includes(q) || tz.label.toLowerCase().includes(q) || tz.id.toLowerCase().includes(q)
    )
  }, [search])

  const addTz = (tzId: string) => {
    if (!selectedTzIds.includes(tzId)) {
      setSelectedTzIds(prev => [...prev, tzId])
    }
    setShowAdd(false)
    setSearch('')
  }

  const removeTz = (tzId: string) => {
    setSelectedTzIds(prev => prev.filter(id => id !== tzId))
  }

  if (!open) return null

  return (
    <div className="fixed right-0 top-0 h-full w-72 bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-700 shadow-xl z-40 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5 text-[#51459d]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">World Clock</h3>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Clock list */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1">
        {clockData.map(tz => (
          <div
            key={tz.id}
            className={`${tz.bgClass} rounded-lg p-3 group relative`}
          >
            <button
              onClick={() => removeTz(tz.id)}
              className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-400"
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <div className="flex items-center gap-3">
              <ClockFace hour={tz.hour} minute={tz.minute} />
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-1.5">
                  <span className={`text-lg font-bold ${tz.colorClass}`}>
                    {tz.time}
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">{tz.period}</span>
                </div>
                <div className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate">
                  {tz.city}
                  {tz.offset && (
                    <span className="ml-1 text-gray-400 dark:text-gray-500">
                      UTC{tz.offset.startsWith('-') ? '' : '+'}{tz.offset}
                    </span>
                  )}
                </div>
                <div className="text-[10px] text-gray-400 dark:text-gray-500">{tz.date}</div>
              </div>
            </div>
            <DayBar hour={tz.hour} />
          </div>
        ))}

        {clockData.length === 0 && (
          <div className="text-center text-xs text-gray-400 py-8">
            No clocks added. Click + to add time zones.
          </div>
        )}
      </div>

      {/* Add timezone */}
      {showAdd ? (
        <div className="border-t border-gray-200 dark:border-gray-700 p-3">
          <input
            type="text"
            placeholder="Search city or timezone..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            autoFocus
            className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-1 focus:ring-[#51459d] focus:border-[#51459d] outline-none"
          />
          <div className="mt-2 max-h-40 overflow-y-auto space-y-0.5">
            {filteredTzs.map(tz => (
              <button
                key={tz.id}
                onClick={() => addTz(tz.id)}
                disabled={selectedTzIds.includes(tz.id)}
                className={`w-full text-left px-2 py-1.5 text-xs rounded hover:bg-gray-100 dark:hover:bg-gray-800 ${
                  selectedTzIds.includes(tz.id) ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'
                }`}
              >
                <span className="font-medium text-gray-700 dark:text-gray-200">{tz.city}</span>
                <span className="text-gray-400 ml-1">({tz.label})</span>
              </button>
            ))}
          </div>
          <button
            onClick={() => { setShowAdd(false); setSearch('') }}
            className="mt-2 w-full text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
          >
            Cancel
          </button>
        </div>
      ) : (
        <div className="border-t border-gray-200 dark:border-gray-700 p-3">
          <button
            onClick={() => setShowAdd(true)}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-[#51459d] border border-dashed border-[#51459d]/40 rounded-lg hover:bg-[#51459d]/5 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Add Time Zone
          </button>
        </div>
      )}

      {/* Legend */}
      <div className="border-t border-gray-200 dark:border-gray-700 px-4 py-2">
        <div className="flex items-center gap-3 text-[9px] text-gray-400">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#6fd943]/60" />Business</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400/60" />Morning</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-400/60" />Evening</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-indigo-400/40" />Night</span>
        </div>
      </div>
    </div>
  )
}
