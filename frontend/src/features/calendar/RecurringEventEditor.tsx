import { useState } from 'react'

export type RecurrenceFrequency = 'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom'
export type RecurrenceEndType = 'never' | 'on_date' | 'after_count'

export interface RecurrenceConfig {
  frequency: RecurrenceFrequency
  interval: number
  weekdays: number[] // 0=Sun ... 6=Sat
  endType: RecurrenceEndType
  endDate: string
  endCount: number
}

interface RecurringEventEditorProps {
  open: boolean
  onClose: () => void
  onApply: (config: RecurrenceConfig, ruleString: string) => void
  initialConfig?: Partial<RecurrenceConfig>
}

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function buildRRuleString(config: RecurrenceConfig): string {
  const freq = config.frequency === 'custom' ? 'WEEKLY' : config.frequency.toUpperCase()
  let rule = `FREQ=${freq};INTERVAL=${config.interval}`

  if ((config.frequency === 'weekly' || config.frequency === 'custom') && config.weekdays.length > 0) {
    const dayMap = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA']
    rule += `;BYDAY=${config.weekdays.map((d) => dayMap[d]).join(',')}`
  }

  if (config.endType === 'on_date' && config.endDate) {
    rule += `;UNTIL=${config.endDate.replace(/-/g, '')}T235959Z`
  } else if (config.endType === 'after_count' && config.endCount > 0) {
    rule += `;COUNT=${config.endCount}`
  }

  return rule
}

export default function RecurringEventEditor({
  open,
  onClose,
  onApply,
  initialConfig,
}: RecurringEventEditorProps) {
  const [frequency, setFrequency] = useState<RecurrenceFrequency>(
    initialConfig?.frequency ?? 'weekly'
  )
  const [interval, setInterval] = useState(initialConfig?.interval ?? 1)
  const [weekdays, setWeekdays] = useState<number[]>(initialConfig?.weekdays ?? [1]) // Monday
  const [endType, setEndType] = useState<RecurrenceEndType>(initialConfig?.endType ?? 'never')
  const [endDate, setEndDate] = useState(initialConfig?.endDate ?? '')
  const [endCount, setEndCount] = useState(initialConfig?.endCount ?? 10)

  if (!open) return null

  const toggleWeekday = (day: number) => {
    setWeekdays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort()
    )
  }

  const handleApply = () => {
    const config: RecurrenceConfig = {
      frequency,
      interval,
      weekdays,
      endType,
      endDate,
      endCount,
    }
    onApply(config, buildRRuleString(config))
    onClose()
  }

  const frequencyLabel =
    frequency === 'daily'
      ? interval === 1 ? 'day' : `${interval} days`
      : frequency === 'weekly' || frequency === 'custom'
        ? interval === 1 ? 'week' : `${interval} weeks`
        : frequency === 'monthly'
          ? interval === 1 ? 'month' : `${interval} months`
          : interval === 1 ? 'year' : `${interval} years`

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-[10px] shadow-2xl w-full max-w-md">
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900">Recurring Event</h3>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-[6px] text-gray-500">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Frequency */}
          <div>
            <label className="text-xs font-medium text-gray-700 block mb-2">Repeat</label>
            <div className="flex flex-wrap gap-1.5">
              {(['daily', 'weekly', 'monthly', 'yearly', 'custom'] as RecurrenceFrequency[]).map(
                (f) => (
                  <button
                    key={f}
                    onClick={() => setFrequency(f)}
                    className={`px-3 py-1.5 text-xs rounded-[8px] border capitalize transition-colors ${
                      frequency === f
                        ? 'bg-[#51459d] text-white border-[#51459d]'
                        : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {f}
                  </button>
                )
              )}
            </div>
          </div>

          {/* Interval */}
          <div>
            <label className="text-xs font-medium text-gray-700 block mb-1.5">
              Every
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                max={99}
                value={interval}
                onChange={(e) => setInterval(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-20 px-3 py-2 text-sm border border-gray-200 rounded-[8px] focus:outline-none focus:ring-1 focus:ring-[#51459d]/40"
              />
              <span className="text-xs text-gray-500">{frequencyLabel}</span>
            </div>
          </div>

          {/* Weekday picker for weekly/custom */}
          {(frequency === 'weekly' || frequency === 'custom') && (
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
                <input
                  type="radio"
                  name="endType"
                  checked={endType === 'never'}
                  onChange={() => setEndType('never')}
                  className="text-[#51459d] focus:ring-[#51459d]/40"
                />
                <span className="text-xs text-gray-600">Never</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="endType"
                  checked={endType === 'on_date'}
                  onChange={() => setEndType('on_date')}
                  className="text-[#51459d] focus:ring-[#51459d]/40"
                />
                <span className="text-xs text-gray-600">On date</span>
                {endType === 'on_date' && (
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="ml-2 px-2 py-1 text-xs border border-gray-200 rounded-[6px] focus:outline-none focus:ring-1 focus:ring-[#51459d]/40"
                  />
                )}
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="endType"
                  checked={endType === 'after_count'}
                  onChange={() => setEndType('after_count')}
                  className="text-[#51459d] focus:ring-[#51459d]/40"
                />
                <span className="text-xs text-gray-600">After</span>
                {endType === 'after_count' && (
                  <>
                    <input
                      type="number"
                      min={1}
                      max={999}
                      value={endCount}
                      onChange={(e) => setEndCount(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-16 px-2 py-1 text-xs border border-gray-200 rounded-[6px] focus:outline-none focus:ring-1 focus:ring-[#51459d]/40"
                    />
                    <span className="text-xs text-gray-500">occurrences</span>
                  </>
                )}
              </label>
            </div>
          </div>

          {/* Preview */}
          <div className="bg-gray-50 rounded-[8px] p-3">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">
              Preview
            </p>
            <p className="text-xs text-gray-600">
              Repeats every {frequencyLabel}
              {(frequency === 'weekly' || frequency === 'custom') && weekdays.length > 0 && (
                <> on {weekdays.map((d) => WEEKDAY_LABELS[d]).join(', ')}</>
              )}
              {endType === 'on_date' && endDate && <>, until {endDate}</>}
              {endType === 'after_count' && <>, {endCount} times</>}
              {endType === 'never' && <>, indefinitely</>}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-gray-100 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-[8px] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleApply}
            className="px-4 py-2 text-sm bg-[#51459d] text-white rounded-[8px] hover:bg-[#3d3480] transition-colors"
          >
            Apply Recurrence
          </button>
        </div>
      </div>
    </div>
  )
}
