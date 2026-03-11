import { useState } from 'react'
import { useCreateMeeting } from '../../api/meetings'

type RecurrenceType = 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'custom'
type EndType = 'never' | 'on_date' | 'after'

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

interface RecurringMeetingSetupProps {
  open: boolean
  onClose: () => void
  onCreated?: () => void
}

export default function RecurringMeetingSetup({
  open,
  onClose,
  onCreated,
}: RecurringMeetingSetupProps) {
  const createMeeting = useCreateMeeting()

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [startTime, setStartTime] = useState('09:00')
  const [endTime, setEndTime] = useState('10:00')
  const [startDate, setStartDate] = useState('')
  const [recurrence, setRecurrence] = useState<RecurrenceType>('weekly')
  const [weekdays, setWeekdays] = useState<number[]>([1]) // Monday
  const [interval, setCustomInterval] = useState(1)
  const [endType, setEndType] = useState<EndType>('never')
  const [endDate, setEndDate] = useState('')
  const [endCount, setEndCount] = useState(10)
  const [attendeeInput, setAttendeeInput] = useState('')
  const [attendees, setAttendees] = useState<string[]>([])

  if (!open) return null

  const toggleWeekday = (day: number) => {
    setWeekdays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort()
    )
  }

  const addAttendee = () => {
    const trimmed = attendeeInput.trim()
    if (!trimmed || attendees.includes(trimmed)) return
    setAttendees([...attendees, trimmed])
    setAttendeeInput('')
  }

  const getRecurrenceDescription = () => {
    switch (recurrence) {
      case 'daily': return `Every ${interval > 1 ? interval + ' ' : ''}day${interval > 1 ? 's' : ''}`
      case 'weekly': return `Every ${interval > 1 ? interval + ' ' : ''}week${interval > 1 ? 's' : ''} on ${weekdays.map(d => WEEKDAY_LABELS[d]).join(', ')}`
      case 'biweekly': return `Every 2 weeks on ${weekdays.map(d => WEEKDAY_LABELS[d]).join(', ')}`
      case 'monthly': return `Every ${interval > 1 ? interval + ' ' : ''}month${interval > 1 ? 's' : ''}`
      case 'custom': return `Custom: every ${interval} week${interval > 1 ? 's' : ''} on ${weekdays.map(d => WEEKDAY_LABELS[d]).join(', ')}`
    }
  }

  const handleCreate = () => {
    if (!title.trim() || !startDate) return

    const start_time = `${startDate}T${startTime}:00`
    const end_time = `${startDate}T${endTime}:00`

    createMeeting.mutate(
      {
        title,
        description: description || undefined,
        start_time,
        end_time,
        attendees: attendees.length > 0 ? attendees : undefined,
      },
      {
        onSuccess: () => {
          onCreated?.()
          onClose()
        },
      }
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-[10px] shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-[8px] bg-[#51459d]/10 flex items-center justify-center">
              <svg className="h-4 w-4 text-[#51459d]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </div>
            <h3 className="text-sm font-semibold text-gray-900">Recurring Meeting</h3>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-[6px] text-gray-500">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Title */}
          <div>
            <label className="text-xs font-medium text-gray-700 block mb-1.5">Meeting title</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Weekly Team Sync"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-[8px] focus:outline-none focus:ring-1 focus:ring-[#51459d]/40"
              autoFocus
            />
          </div>

          {/* Description */}
          <div>
            <label className="text-xs font-medium text-gray-700 block mb-1.5">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Meeting agenda..."
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-[8px] focus:outline-none focus:ring-1 focus:ring-[#51459d]/40 resize-none"
              rows={2}
            />
          </div>

          {/* Date & time */}
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="text-xs font-medium text-gray-700 block mb-1.5">Start date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-[8px] focus:outline-none"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-700 block mb-1.5">Start</label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-[8px] focus:outline-none"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-700 block mb-1.5">End</label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-[8px] focus:outline-none"
              />
            </div>
          </div>

          {/* Recurrence type */}
          <div>
            <label className="text-xs font-medium text-gray-700 block mb-2">Repeats</label>
            <div className="flex flex-wrap gap-1.5">
              {([
                { value: 'daily', label: 'Daily' },
                { value: 'weekly', label: 'Weekly' },
                { value: 'biweekly', label: 'Biweekly' },
                { value: 'monthly', label: 'Monthly' },
                { value: 'custom', label: 'Custom' },
              ] as { value: RecurrenceType; label: string }[]).map((r) => (
                <button
                  key={r.value}
                  onClick={() => setRecurrence(r.value)}
                  className={`px-3 py-1.5 text-xs rounded-[8px] border transition-colors ${
                    recurrence === r.value
                      ? 'bg-[#51459d] text-white border-[#51459d]'
                      : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          {/* Custom interval */}
          {(recurrence === 'custom' || recurrence === 'daily' || recurrence === 'monthly') && (
            <div>
              <label className="text-xs font-medium text-gray-700 block mb-1.5">
                Every
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  max={52}
                  value={interval}
                  onChange={(e) => setCustomInterval(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-20 px-3 py-2 text-sm border border-gray-200 rounded-[8px] focus:outline-none"
                />
                <span className="text-xs text-gray-500">
                  {recurrence === 'daily' ? 'day(s)' : recurrence === 'monthly' ? 'month(s)' : 'week(s)'}
                </span>
              </div>
            </div>
          )}

          {/* Weekday picker */}
          {(recurrence === 'weekly' || recurrence === 'biweekly' || recurrence === 'custom') && (
            <div>
              <label className="text-xs font-medium text-gray-700 block mb-2">On days</label>
              <div className="flex gap-1">
                {WEEKDAY_LABELS.map((label, i) => (
                  <button
                    key={i}
                    onClick={() => toggleWeekday(i)}
                    className={`w-9 h-9 rounded-full text-[11px] font-medium transition-colors ${
                      weekdays.includes(i)
                        ? 'bg-[#51459d] text-white'
                        : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                    }`}
                  >
                    {label.charAt(0)}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* End condition */}
          <div>
            <label className="text-xs font-medium text-gray-700 block mb-2">Ends</label>
            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" name="meetEndType" checked={endType === 'never'} onChange={() => setEndType('never')} className="text-[#51459d]" />
                <span className="text-xs text-gray-600">Never</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" name="meetEndType" checked={endType === 'on_date'} onChange={() => setEndType('on_date')} className="text-[#51459d]" />
                <span className="text-xs text-gray-600">On</span>
                {endType === 'on_date' && (
                  <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="ml-2 px-2 py-1 text-xs border border-gray-200 rounded-[6px] focus:outline-none" />
                )}
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" name="meetEndType" checked={endType === 'after'} onChange={() => setEndType('after')} className="text-[#51459d]" />
                <span className="text-xs text-gray-600">After</span>
                {endType === 'after' && (
                  <>
                    <input type="number" min={1} max={365} value={endCount} onChange={(e) => setEndCount(parseInt(e.target.value) || 1)} className="w-16 px-2 py-1 text-xs border border-gray-200 rounded-[6px] focus:outline-none" />
                    <span className="text-xs text-gray-500">meetings</span>
                  </>
                )}
              </label>
            </div>
          </div>

          {/* Attendees */}
          <div>
            <label className="text-xs font-medium text-gray-700 block mb-1.5">Attendees</label>
            <div className="flex gap-2 mb-2">
              <input
                value={attendeeInput}
                onChange={(e) => setAttendeeInput(e.target.value)}
                placeholder="Email address"
                className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-[8px] focus:outline-none focus:ring-1 focus:ring-[#51459d]/40"
                onKeyDown={(e) => e.key === 'Enter' && addAttendee()}
              />
              <button
                onClick={addAttendee}
                disabled={!attendeeInput.trim()}
                className="px-3 py-2 text-xs border border-gray-200 rounded-[8px] hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                Add
              </button>
            </div>
            {attendees.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {attendees.map((a) => (
                  <span key={a} className="inline-flex items-center gap-1 bg-[#51459d]/10 text-[#51459d] text-[10px] px-2 py-0.5 rounded-full">
                    {a}
                    <button onClick={() => setAttendees(attendees.filter((x) => x !== a))} className="hover:text-red-500">
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Summary */}
          <div className="bg-gray-50 rounded-[8px] p-3">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Summary</p>
            <p className="text-xs text-gray-600">
              {getRecurrenceDescription()}
              {endType === 'on_date' && endDate && <>, until {endDate}</>}
              {endType === 'after' && <>, {endCount} meetings</>}
              {startTime && <> at {startTime} - {endTime}</>}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-gray-100 flex justify-end gap-2 shrink-0">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-[8px] transition-colors">
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={!title.trim() || !startDate || createMeeting.isPending}
            className="px-4 py-2 text-sm bg-[#51459d] text-white rounded-[8px] hover:bg-[#3d3480] transition-colors disabled:opacity-50 flex items-center gap-1.5"
          >
            {createMeeting.isPending ? (
              <>
                <svg className="animate-spin h-3.5 w-3.5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
                Creating...
              </>
            ) : (
              'Create Recurring Meeting'
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
