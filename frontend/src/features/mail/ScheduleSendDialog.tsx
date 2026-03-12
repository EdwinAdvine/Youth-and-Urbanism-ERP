/**
 * Schedule Send Dialog — allows scheduling a draft for future delivery.
 */
import { useState } from 'react'
import { useScheduleSend, useCancelScheduledSend } from '../../api/mail'

interface ScheduleSendDialogProps {
  messageId: string
  currentScheduledAt?: string | null
  onClose: () => void
}

const QUICK_OPTIONS = [
  { label: 'Tomorrow morning', hours: getHoursUntil(9, 1) },
  { label: 'Tomorrow afternoon', hours: getHoursUntil(14, 1) },
  { label: 'Monday morning', hours: getHoursUntilNextMonday() },
]

function getHoursUntil(hour: number, daysAhead: number): number {
  const now = new Date()
  const target = new Date(now)
  target.setDate(target.getDate() + daysAhead)
  target.setHours(hour, 0, 0, 0)
  return Math.max(1, Math.round((target.getTime() - now.getTime()) / (1000 * 60 * 60)))
}

function getHoursUntilNextMonday(): number {
  const now = new Date()
  const daysUntilMonday = ((8 - now.getDay()) % 7) || 7
  const target = new Date(now)
  target.setDate(target.getDate() + daysUntilMonday)
  target.setHours(9, 0, 0, 0)
  return Math.max(1, Math.round((target.getTime() - now.getTime()) / (1000 * 60 * 60)))
}

export default function ScheduleSendDialog({ messageId, currentScheduledAt, onClose }: ScheduleSendDialogProps) {
  const [customDate, setCustomDate] = useState('')
  const [customTime, setCustomTime] = useState('09:00')
  const scheduleSend = useScheduleSend()
  const cancelSchedule = useCancelScheduledSend()

  const handleQuickSchedule = (hoursFromNow: number) => {
    const scheduledAt = new Date(Date.now() + hoursFromNow * 60 * 60 * 1000).toISOString()
    scheduleSend.mutate({ message_id: messageId, scheduled_at: scheduledAt }, { onSuccess: onClose })
  }

  const handleCustomSchedule = () => {
    if (!customDate) return
    const scheduledAt = new Date(`${customDate}T${customTime}:00`).toISOString()
    scheduleSend.mutate({ message_id: messageId, scheduled_at: scheduledAt }, { onSuccess: onClose })
  }

  const handleCancel = () => {
    cancelSchedule.mutate(messageId, { onSuccess: onClose })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-[380px] overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-sm font-semibold">Schedule Send</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-5 space-y-4">
          {currentScheduledAt && (
            <div className="flex items-center justify-between p-3 bg-[#51459d]/5 rounded-lg">
              <div>
                <p className="text-xs font-medium text-[#51459d]">Currently scheduled</p>
                <p className="text-xs text-gray-500">{new Date(currentScheduledAt).toLocaleString()}</p>
              </div>
              <button
                onClick={handleCancel}
                disabled={cancelSchedule.isPending}
                className="text-xs text-[#ff3a6e] hover:underline"
              >
                Cancel
              </button>
            </div>
          )}

          {/* Quick options */}
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-gray-500">Quick schedule</p>
            {QUICK_OPTIONS.map((opt) => (
              <button
                key={opt.label}
                onClick={() => handleQuickSchedule(opt.hours)}
                disabled={scheduleSend.isPending}
                className="w-full flex items-center justify-between px-3 py-2 text-sm border rounded-lg hover:border-[#51459d] hover:bg-[#51459d]/5 transition"
              >
                <span>{opt.label}</span>
                <span className="text-xs text-gray-400">
                  {new Date(Date.now() + opt.hours * 60 * 60 * 1000).toLocaleString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                  })}
                </span>
              </button>
            ))}
          </div>

          {/* Custom date/time */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-gray-500">Custom date & time</p>
            <div className="flex gap-2">
              <input
                type="date"
                value={customDate}
                onChange={(e) => setCustomDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                className="flex-1 px-3 py-2 text-sm border rounded-lg focus:ring-1 focus:ring-[#51459d]"
              />
              <input
                type="time"
                value={customTime}
                onChange={(e) => setCustomTime(e.target.value)}
                className="w-28 px-3 py-2 text-sm border rounded-lg focus:ring-1 focus:ring-[#51459d]"
              />
            </div>
            <button
              onClick={handleCustomSchedule}
              disabled={scheduleSend.isPending || !customDate}
              className="w-full py-2 bg-[#51459d] text-white text-sm font-medium rounded-lg hover:bg-[#413780] disabled:opacity-50 transition"
            >
              {scheduleSend.isPending ? 'Scheduling...' : 'Schedule'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
