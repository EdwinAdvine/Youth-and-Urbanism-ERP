import { useState, useEffect, useCallback } from 'react'

// ─── Types (mirrored from api/booking.ts — no import needed for standalone use) ─

interface CustomQuestion {
  label: string
  type: 'text' | 'textarea' | 'select' | 'checkbox'
  required: boolean
  options?: string[]
}

interface BookingPage {
  id: string
  slug: string
  title: string
  description: string | null
  duration_minutes: number
  color: string
  welcome_message: string | null
  custom_questions: CustomQuestion[] | null
  auto_create_jitsi: boolean
  event_type: string
  is_active: boolean
  max_advance_days: number
  min_notice_hours: number
}

interface TimeSlot {
  start: string
  end: string
}

interface BookingSlot {
  id: string
  booker_name: string
  booker_email: string
  start_time: string
  end_time: string
  status: string
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface BookingWidgetProps {
  slug: string
  accentColor?: string
  compact?: boolean
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const API_BASE = '/api/v1'

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error((body as { detail?: string }).detail || `Request failed: ${res.status}`)
  }
  return res.json() as Promise<T>
}

function formatTo12h(time: string): string {
  const [hourStr, minuteStr] = time.split(':')
  const hour = parseInt(hourStr, 10)
  const minute = minuteStr || '00'
  const period = hour >= 12 ? 'PM' : 'AM'
  const display = hour % 12 === 0 ? 12 : hour % 12
  return `${display}:${minute} ${period}`
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
}

function toYMD(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function buildICS(title: string, start: string, end: string, description?: string): string {
  const fmt = (iso: string) => iso.replace(/[-:]/g, '').replace('.000Z', 'Z')
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Urban Vibes Dynamics//Era Calendar//EN',
    'BEGIN:VEVENT',
    `UID:${Date.now()}@urban-vibes-dynamics`,
    `DTSTART:${fmt(start)}`,
    `DTEND:${fmt(end)}`,
    `SUMMARY:${title}`,
    description ? `DESCRIPTION:${description.replace(/\n/g, '\\n')}` : '',
    'END:VEVENT',
    'END:VCALENDAR',
  ]
  return lines.filter(Boolean).join('\r\n')
}

function downloadICS(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December']
const DAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

// ─── Sub-components ───────────────────────────────────────────────────────────

function Spinner({ accent }: { accent: string }) {
  return (
    <div className="flex items-center justify-center py-8">
      <div
        className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin"
        style={{ borderColor: `${accent}40`, borderTopColor: accent }}
      />
    </div>
  )
}

function StepIndicator({
  step,
  accent,
  compact,
}: {
  step: 1 | 2 | 3
  accent: string
  compact: boolean
}) {
  const steps = [
    { n: 1, label: 'Date' },
    { n: 2, label: 'Time' },
    { n: 3, label: 'Details' },
  ]
  return (
    <div className="flex items-center justify-center gap-2 mb-4">
      {steps.map(({ n, label }, i) => {
        const active = step === n
        const done = step > n
        return (
          <div key={n} className="flex items-center gap-2">
            <div className="flex items-center gap-1.5">
              <div
                className="flex items-center justify-center rounded-full text-xs font-semibold transition-all"
                style={{
                  width: compact ? 22 : 26,
                  height: compact ? 22 : 26,
                  backgroundColor: active || done ? accent : '#e5e7eb',
                  color: active || done ? '#fff' : '#6b7280',
                }}
              >
                {done ? (
                  <svg viewBox="0 0 12 12" fill="none" className="w-3 h-3">
                    <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ) : n}
              </div>
              {!compact && (
                <span
                  className="text-xs font-medium"
                  style={{ color: active ? accent : '#9ca3af' }}
                >
                  {label}
                </span>
              )}
            </div>
            {i < steps.length - 1 && (
              <div
                className="h-px transition-all"
                style={{
                  width: compact ? 20 : 28,
                  backgroundColor: done ? accent : '#e5e7eb',
                }}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Step 1: Calendar ─────────────────────────────────────────────────────────

function CalendarStep({
  page,
  accent,
  compact,
  onSelect,
}: {
  page: BookingPage
  accent: string
  compact: boolean
  onSelect: (date: Date) => void
}) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const maxDate = new Date(today)
  maxDate.setDate(maxDate.getDate() + page.max_advance_days)

  const [viewYear, setViewYear] = useState(today.getFullYear())
  const [viewMonth, setViewMonth] = useState(today.getMonth())
  // Map of "YYYY-MM-DD" -> slot count (null = not fetched yet)
  const [slotCounts, setSlotCounts] = useState<Record<string, number>>({})
  const [loadingMonth, setLoadingMonth] = useState(false)

  const fetchMonthSlots = useCallback(async (year: number, month: number) => {
    setLoadingMonth(true)
    // Fetch slots for each day of the month in parallel (up to max_advance_days)
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const fetches: Promise<void>[] = []
    const counts: Record<string, number> = {}

    for (let d = 1; d <= daysInMonth; d++) {
      const dayDate = new Date(year, month, d)
      if (dayDate < today || dayDate > maxDate) continue
      const ymd = toYMD(dayDate)
      fetches.push(
        apiFetch<{ date: string; slots: TimeSlot[] }>(
          `/booking/public/${page.slug}/available-slots?date=${ymd}`
        )
          .then((res) => { counts[ymd] = res.slots.length })
          .catch(() => { counts[ymd] = 0 })
      )
    }

    await Promise.all(fetches)
    setSlotCounts((prev) => ({ ...prev, ...counts }))
    setLoadingMonth(false)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page.slug, page.max_advance_days])

  useEffect(() => {
    fetchMonthSlots(viewYear, viewMonth)
  }, [fetchMonthSlots, viewYear, viewMonth])

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear((y) => y - 1) }
    else setViewMonth((m) => m - 1)
  }
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear((y) => y + 1) }
    else setViewMonth((m) => m + 1)
  }

  const canGoPrev = !(viewYear === today.getFullYear() && viewMonth === today.getMonth())
  const canGoNext = new Date(viewYear, viewMonth + 1, 1) <= maxDate

  const firstDayOfMonth = new Date(viewYear, viewMonth, 1).getDay()
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()

  const cellSize = compact ? 32 : 38

  return (
    <div>
      {/* Month nav */}
      <div className="flex items-center justify-between mb-3">
        <button
          onClick={prevMonth}
          disabled={!canGoPrev}
          className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-gray-600">
            <path fillRule="evenodd" d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z" clipRule="evenodd" />
          </svg>
        </button>
        <span className="text-sm font-semibold text-gray-800">
          {MONTH_NAMES[viewMonth]} {viewYear}
        </span>
        <button
          onClick={nextMonth}
          disabled={!canGoNext}
          className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-gray-600">
            <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
          </svg>
        </button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 mb-1">
        {DAY_LABELS.map((l) => (
          <div key={l} className="text-center text-[10px] font-medium text-gray-400 py-1">{l}</div>
        ))}
      </div>

      {/* Calendar grid */}
      {loadingMonth ? (
        <Spinner accent={accent} />
      ) : (
        <div className="grid grid-cols-7 gap-0.5">
          {Array.from({ length: firstDayOfMonth }).map((_, i) => (
            <div key={`empty-${i}`} style={{ height: cellSize }} />
          ))}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const d = i + 1
            const date = new Date(viewYear, viewMonth, d)
            const ymd = toYMD(date)
            const isPast = date < today
            const isFuture = date > maxDate
            const slots = slotCounts[ymd]
            const hasSlots = typeof slots === 'number' && slots > 0
            const isDisabled = isPast || isFuture || slots === 0

            return (
              <button
                key={d}
                onClick={() => !isDisabled && onSelect(date)}
                disabled={isDisabled}
                className="rounded-lg flex items-center justify-center text-sm font-medium transition-all relative"
                style={{
                  height: cellSize,
                  backgroundColor: hasSlots ? `${accent}15` : 'transparent',
                  color: isDisabled ? '#d1d5db' : hasSlots ? accent : '#374151',
                  cursor: isDisabled ? 'not-allowed' : 'pointer',
                }}
                onMouseEnter={(e) => {
                  if (!isDisabled) (e.currentTarget as HTMLButtonElement).style.backgroundColor = `${accent}30`
                }}
                onMouseLeave={(e) => {
                  if (!isDisabled) (e.currentTarget as HTMLButtonElement).style.backgroundColor = hasSlots ? `${accent}15` : 'transparent'
                }}
                title={hasSlots ? `${slots} slot${slots !== 1 ? 's' : ''} available` : undefined}
              >
                {d}
                {hasSlots && (
                  <span
                    className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full"
                    style={{ backgroundColor: accent }}
                  />
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Step 2: Time Slots ───────────────────────────────────────────────────────

function TimeStep({
  slug,
  date,
  accent,
  compact,
  onSelect,
  onBack,
}: {
  slug: string
  date: Date
  accent: string
  compact: boolean
  onSelect: (slot: TimeSlot) => void
  onBack: () => void
}) {
  const [slots, setSlots] = useState<TimeSlot[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    const ymd = toYMD(date)
    apiFetch<{ date: string; slots: TimeSlot[] }>(
      `/booking/public/${slug}/available-slots?date=${ymd}`
    )
      .then((res) => setSlots(res.slots))
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Failed to load slots'))
      .finally(() => setLoading(false))
  }, [slug, date])

  const handleSelect = (slot: TimeSlot) => {
    setSelected(slot.start)
    onSelect(slot)
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <button
          onClick={onBack}
          className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-500"
        >
          <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
            <path fillRule="evenodd" d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z" clipRule="evenodd" />
          </svg>
        </button>
        <p className="text-sm font-medium text-gray-700">{formatDate(date)}</p>
      </div>

      {loading ? (
        <Spinner accent={accent} />
      ) : error ? (
        <p className="text-sm text-red-500 text-center py-4">{error}</p>
      ) : slots.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-sm text-gray-400">No available slots for this date.</p>
          <button onClick={onBack} className="mt-2 text-sm underline" style={{ color: accent }}>
            Choose another day
          </button>
        </div>
      ) : (
        <div className={`grid gap-2 ${compact ? 'grid-cols-3' : 'grid-cols-3'}`}>
          {slots.map((slot) => {
            const isSelected = selected === slot.start
            return (
              <button
                key={slot.start}
                onClick={() => handleSelect(slot)}
                className="py-2.5 px-2 rounded-lg text-sm font-medium transition-all border"
                style={{
                  backgroundColor: isSelected ? accent : 'transparent',
                  borderColor: isSelected ? accent : '#e5e7eb',
                  color: isSelected ? '#fff' : '#374151',
                }}
              >
                {formatTo12h(slot.start.includes('T') ? slot.start.split('T')[1].substring(0, 5) : slot.start)}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Step 3: Booking Form ─────────────────────────────────────────────────────

function BookingForm({
  slug,
  page,
  slot,
  date,
  accent,
  compact,
  onSuccess,
  onBack,
}: {
  slug: string
  page: BookingPage
  slot: TimeSlot
  date: Date
  accent: string
  compact: boolean
  onSuccess: (booked: BookingSlot) => void
  onBack: () => void
}) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const questions = page.custom_questions || []

  const slotTime = slot.start.includes('T')
    ? slot.start.split('T')[1].substring(0, 5)
    : slot.start
  const displayTime = formatTo12h(slotTime)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)

    // Build ISO start_time: combine selected date + slot start time
    const ymd = toYMD(date)
    const startISO = `${ymd}T${slotTime.substring(0, 5)}:00`

    // Convert custom answers
    const answersPayload: Record<string, unknown> = {}
    questions.forEach((q) => {
      if (answers[q.label] !== undefined) {
        answersPayload[q.label] = q.type === 'checkbox' ? answers[q.label] === 'true' : answers[q.label]
      }
    })

    try {
      const booked = await apiFetch<BookingSlot>(`/booking/public/${slug}/book`, {
        method: 'POST',
        body: JSON.stringify({
          booker_name: name,
          booker_email: email,
          start_time: startISO,
          answers: Object.keys(answersPayload).length > 0 ? answersPayload : undefined,
        }),
      })
      onSuccess(booked)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Booking failed. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const inputCls = `w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white text-gray-900 placeholder-gray-400 outline-none transition-all focus:border-transparent`

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <button
          type="button"
          onClick={onBack}
          className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-500"
        >
          <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
            <path fillRule="evenodd" d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z" clipRule="evenodd" />
          </svg>
        </button>
        <div>
          <p className="text-sm font-medium text-gray-700">{formatDate(date)}</p>
          <p className="text-xs text-gray-400">{displayTime} &middot; {page.duration_minutes} min</p>
        </div>
      </div>

      {/* Name */}
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">Your name <span className="text-red-400">*</span></label>
        <input
          type="text"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Jane Smith"
          className={inputCls}
          style={{ '--tw-ring-color': accent } as React.CSSProperties}
          onFocus={(e) => (e.target.style.boxShadow = `0 0 0 2px ${accent}40`)}
          onBlur={(e) => (e.target.style.boxShadow = 'none')}
        />
      </div>

      {/* Email */}
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">Email address <span className="text-red-400">*</span></label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="jane@example.com"
          className={inputCls}
          onFocus={(e) => (e.target.style.boxShadow = `0 0 0 2px ${accent}40`)}
          onBlur={(e) => (e.target.style.boxShadow = 'none')}
        />
      </div>

      {/* Custom questions */}
      {questions.map((q) => {
        const val = answers[q.label] || ''
        const setVal = (v: string) => setAnswers((prev) => ({ ...prev, [q.label]: v }))

        return (
          <div key={q.label}>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              {q.label}
              {q.required && <span className="text-red-400 ml-0.5">*</span>}
            </label>

            {q.type === 'textarea' ? (
              <textarea
                required={q.required}
                value={val}
                onChange={(e) => setVal(e.target.value)}
                rows={compact ? 2 : 3}
                className={`${inputCls} resize-none`}
                onFocus={(e) => (e.target.style.boxShadow = `0 0 0 2px ${accent}40`)}
                onBlur={(e) => (e.target.style.boxShadow = 'none')}
              />
            ) : q.type === 'select' && q.options ? (
              <select
                required={q.required}
                value={val}
                onChange={(e) => setVal(e.target.value)}
                className={inputCls}
                onFocus={(e) => (e.target.style.boxShadow = `0 0 0 2px ${accent}40`)}
                onBlur={(e) => (e.target.style.boxShadow = 'none')}
              >
                <option value="">Select an option</option>
                {q.options.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            ) : q.type === 'checkbox' ? (
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={val === 'true'}
                  onChange={(e) => setVal(e.target.checked ? 'true' : 'false')}
                  className="w-4 h-4 rounded border-gray-300"
                  style={{ accentColor: accent }}
                />
                <span className="text-sm text-gray-700">{q.label}</span>
              </label>
            ) : (
              <input
                type="text"
                required={q.required}
                value={val}
                onChange={(e) => setVal(e.target.value)}
                className={inputCls}
                onFocus={(e) => (e.target.style.boxShadow = `0 0 0 2px ${accent}40`)}
                onBlur={(e) => (e.target.style.boxShadow = 'none')}
              />
            )}
          </div>
        )
      })}

      {error && (
        <p className="text-xs text-red-500 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={submitting || !name.trim() || !email.trim()}
        className="w-full py-2.5 rounded-lg text-sm font-semibold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        style={{ backgroundColor: accent }}
      >
        {submitting ? 'Confirming...' : 'Confirm Booking'}
      </button>
    </form>
  )
}

// ─── Confirmation ─────────────────────────────────────────────────────────────

function ConfirmationView({
  booking,
  page,
  accent,
}: {
  booking: BookingSlot
  page: BookingPage
  accent: string
  compact?: boolean
}) {
  const startDate = new Date(booking.start_time)
  const endDate = new Date(booking.end_time)

  const handleAddToCalendar = () => {
    const ics = buildICS(
      page.title,
      booking.start_time,
      booking.end_time,
      page.description || undefined
    )
    downloadICS(`${page.slug}-booking.ics`, ics)
  }

  return (
    <div className="text-center py-2">
      {/* Checkmark */}
      <div
        className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4"
        style={{ backgroundColor: `${accent}15` }}
      >
        <svg viewBox="0 0 24 24" fill="none" className="w-7 h-7" style={{ color: accent }}>
          <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>

      <h3 className="text-base font-bold text-gray-900 mb-1">You're confirmed!</h3>
      <p className="text-sm text-gray-500 mb-5">
        A confirmation has been sent to {booking.booker_email}
      </p>

      {/* Booking details card */}
      <div className="bg-gray-50 rounded-xl p-4 text-left space-y-3 mb-5">
        <div className="flex items-start gap-3">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
            style={{ backgroundColor: `${accent}20` }}
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4" style={{ color: accent }}>
              <path fillRule="evenodd" d="M5.75 2a.75.75 0 01.75.75V4h7V2.75a.75.75 0 011.5 0V4h.25A2.75 2.75 0 0118 6.75v8.5A2.75 2.75 0 0115.25 18H4.75A2.75 2.75 0 012 15.25v-8.5A2.75 2.75 0 014.75 4H5V2.75A.75.75 0 015.75 2zm-1 5.5c-.69 0-1.25.56-1.25 1.25v6.5c0 .69.56 1.25 1.25 1.25h10.5c.69 0 1.25-.56 1.25-1.25v-6.5c0-.69-.56-1.25-1.25-1.25H4.75z" clipRule="evenodd" />
            </svg>
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500">Event</p>
            <p className="text-sm font-semibold text-gray-800">{page.title}</p>
          </div>
        </div>

        <div className="flex items-start gap-3">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
            style={{ backgroundColor: `${accent}20` }}
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4" style={{ color: accent }}>
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm.75-13a.75.75 0 00-1.5 0v5c0 .414.336.75.75.75h4a.75.75 0 000-1.5h-3.25V5z" clipRule="evenodd" />
            </svg>
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500">Date &amp; Time</p>
            <p className="text-sm font-semibold text-gray-800">{formatDate(startDate)}</p>
            <p className="text-xs text-gray-500">
              {formatTo12h(startDate.toTimeString().substring(0, 5))} –{' '}
              {formatTo12h(endDate.toTimeString().substring(0, 5))}
              {' '}({page.duration_minutes} min)
            </p>
          </div>
        </div>

        {page.auto_create_jitsi && (
          <div className="flex items-start gap-3">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
              style={{ backgroundColor: `${accent}20` }}
            >
              <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4" style={{ color: accent }}>
                <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z" />
              </svg>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500">Meeting Link</p>
              <p className="text-xs text-gray-500">Video link will be emailed to you</p>
            </div>
          </div>
        )}
      </div>

      <button
        onClick={handleAddToCalendar}
        className="w-full py-2.5 rounded-lg text-sm font-medium border transition-all flex items-center justify-center gap-2"
        style={{ borderColor: accent, color: accent }}
      >
        <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
          <path d="M10.75 2.75a.75.75 0 00-1.5 0v8.614L6.295 8.235a.75.75 0 10-1.09 1.03l4.25 4.5a.75.75 0 001.09 0l4.25-4.5a.75.75 0 00-1.09-1.03l-2.955 3.129V2.75z" />
          <path d="M3.5 12.75a.75.75 0 00-1.5 0v2.5A2.75 2.75 0 004.75 18h10.5A2.75 2.75 0 0018 15.25v-2.5a.75.75 0 00-1.5 0v2.5c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-2.5z" />
        </svg>
        Add to Calendar (.ics)
      </button>
    </div>
  )
}

// ─── Main Widget ──────────────────────────────────────────────────────────────

export default function BookingWidget({
  slug,
  accentColor = '#51459d',
  compact = false,
}: BookingWidgetProps) {
  const [page, setPage] = useState<BookingPage | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null)
  const [booking, setBooking] = useState<BookingSlot | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    apiFetch<BookingPage>(`/booking/public/${slug}`)
      .then(setPage)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Booking page not found.'))
      .finally(() => setLoading(false))
  }, [slug])

  const handleDateSelect = (date: Date) => {
    setSelectedDate(date)
    setSelectedSlot(null)
    setStep(2)
  }

  const handleSlotSelect = (slot: TimeSlot) => {
    setSelectedSlot(slot)
    setStep(3)
  }

  const handleBooked = (booked: BookingSlot) => {
    setBooking(booked)
  }

  const accent = accentColor

  const padX = compact ? 'px-4' : 'px-5'
  const padY = compact ? 'py-4' : 'py-5'

  return (
    <div
      className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden font-sans"
      style={{ maxWidth: 480, minWidth: 280, width: '100%' }}
    >
      {/* Header */}
      {loading ? (
        <div className={`${padX} ${padY}`}>
          <div className="h-5 w-40 bg-gray-100 rounded animate-pulse mb-2" />
          <div className="h-3.5 w-56 bg-gray-100 rounded animate-pulse" />
        </div>
      ) : error ? null : page ? (
        <div className={`${padX} ${padY} border-b border-gray-100`} style={{ backgroundColor: `${accent}08` }}>
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
              style={{ backgroundColor: accent }}
            >
              {page.duration_minutes}m
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-bold text-gray-900 truncate">{page.title}</h2>
              {page.description && !compact && (
                <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{page.description}</p>
              )}
            </div>
          </div>
          {page.welcome_message && !compact && (
            <p className="text-xs text-gray-500 mt-3 italic leading-relaxed">{page.welcome_message}</p>
          )}
        </div>
      ) : null}

      {/* Body */}
      <div className={`${padX} ${padY}`}>
        {loading ? (
          <Spinner accent={accent} />
        ) : error ? (
          <div className="text-center py-8">
            <p className="text-sm text-red-500">{error}</p>
          </div>
        ) : !page ? null : booking ? (
          <ConfirmationView booking={booking} page={page} accent={accent} compact={compact} />
        ) : (
          <>
            <StepIndicator step={step} accent={accent} compact={compact} />

            {step === 1 && (
              <CalendarStep
                page={page}
                accent={accent}
                compact={compact}
                onSelect={handleDateSelect}
              />
            )}

            {step === 2 && selectedDate && (
              <TimeStep
                slug={slug}
                date={selectedDate}
                accent={accent}
                compact={compact}
                onSelect={handleSlotSelect}
                onBack={() => setStep(1)}
              />
            )}

            {step === 3 && selectedDate && selectedSlot && (
              <BookingForm
                slug={slug}
                page={page}
                slot={selectedSlot}
                date={selectedDate}
                accent={accent}
                compact={compact}
                onSuccess={handleBooked}
                onBack={() => setStep(2)}
              />
            )}
          </>
        )}
      </div>

      {/* Footer */}
      <div className="px-5 py-3 border-t border-gray-100 flex justify-center">
        <a
          href="https://urban-vibes-dynamics.local/calendar"
          target="_blank"
          rel="noopener noreferrer"
          className="text-[10px] text-gray-400 hover:text-gray-500 transition-colors"
        >
          Powered by <span className="font-semibold">Era Calendar</span>
        </a>
      </div>
    </div>
  )
}
