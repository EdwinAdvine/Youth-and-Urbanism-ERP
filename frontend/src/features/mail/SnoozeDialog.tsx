import { useState } from 'react'
import { useSnoozeMail } from '../../api/mail'

interface SnoozeDialogProps {
  messageId: string
  onClose: () => void
}

const QUICK_OPTIONS = [
  { label: 'Later today', hours: 3 },
  { label: 'Tomorrow morning', hours: 18 },
  { label: 'Tomorrow afternoon', hours: 24 },
  { label: 'This weekend', hours: 72 },
  { label: 'Next week', hours: 168 },
  { label: 'In 2 weeks', hours: 336 },
]

export default function SnoozeDialog({ messageId, onClose }: SnoozeDialogProps) {
  const [customDate, setCustomDate] = useState('')
  const [customTime, setCustomTime] = useState('09:00')
  const snoozeMail = useSnoozeMail()

  const handleSnooze = (snoozeUntil: Date) => {
    snoozeMail.mutate(
      { messageId, snooze_until: snoozeUntil.toISOString() },
      { onSuccess: () => onClose() },
    )
  }

  const handleQuickSnooze = (hours: number) => {
    const d = new Date()
    d.setHours(d.getHours() + hours)
    handleSnooze(d)
  }

  const handleCustomSnooze = () => {
    if (!customDate) return
    const [y, m, d] = customDate.split('-').map(Number)
    const [h, min] = customTime.split(':').map(Number)
    const dt = new Date(y, m - 1, d, h, min)
    if (dt <= new Date()) return
    handleSnooze(dt)
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-50" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          className="bg-white dark:bg-gray-800 rounded-[10px] shadow-2xl w-full max-w-sm"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-800">
            <div className="flex items-center gap-2">
              <svg className="h-4 w-4 text-[#51459d]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Snooze Email</h2>
            </div>
            <button onClick={onClose} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-[6px] text-gray-400">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Quick options */}
          <div className="p-3 space-y-0.5">
            {QUICK_OPTIONS.map((opt) => (
              <button
                key={opt.label}
                onClick={() => handleQuickSnooze(opt.hours)}
                disabled={snoozeMail.isPending}
                className="w-full text-left px-3 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-[#51459d]/5 hover:text-[#51459d] rounded-[8px] transition-colors disabled:opacity-50"
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Custom date/time */}
          <div className="border-t border-gray-100 dark:border-gray-800 p-4 space-y-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Pick date & time</p>
            <div className="flex gap-2">
              <input
                type="date"
                value={customDate}
                onChange={(e) => setCustomDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                className="flex-1 px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-[8px] focus:outline-none focus:border-[#51459d]"
              />
              <input
                type="time"
                value={customTime}
                onChange={(e) => setCustomTime(e.target.value)}
                className="w-28 px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-[8px] focus:outline-none focus:border-[#51459d]"
              />
            </div>
            <button
              onClick={handleCustomSnooze}
              disabled={!customDate || snoozeMail.isPending}
              className="w-full bg-[#51459d] text-white text-sm font-medium py-2.5 rounded-[8px] hover:bg-[#3d3480] disabled:opacity-50 transition-colors"
            >
              {snoozeMail.isPending ? 'Snoozing...' : 'Snooze until selected time'}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
