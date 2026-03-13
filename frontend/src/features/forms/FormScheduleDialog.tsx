import { useState, useEffect } from 'react'
import apiClient from '@/api/client'

type RecurrenceOption = 'once' | 'daily' | 'weekly' | 'monthly' | 'quarterly'
type DistributionChannel = 'email' | 'in_app' | 'both'

interface ScheduleData {
  rrule: string
  recipients: string[]
  distribution_channel: DistributionChannel
  is_active: boolean
}

interface FormScheduleDialogProps {
  formId: string
  onClose: () => void
}

const RECURRENCE_OPTIONS: { value: RecurrenceOption; label: string; rrule: string }[] = [
  { value: 'once', label: 'Once', rrule: '' },
  { value: 'daily', label: 'Daily', rrule: 'FREQ=DAILY' },
  { value: 'weekly', label: 'Weekly', rrule: 'FREQ=WEEKLY' },
  { value: 'monthly', label: 'Monthly', rrule: 'FREQ=MONTHLY' },
  { value: 'quarterly', label: 'Quarterly', rrule: 'FREQ=MONTHLY;INTERVAL=3' },
]

function rruleToRecurrence(rrule: string): RecurrenceOption {
  if (!rrule) return 'once'
  if (rrule === 'FREQ=DAILY') return 'daily'
  if (rrule === 'FREQ=WEEKLY') return 'weekly'
  if (rrule === 'FREQ=MONTHLY;INTERVAL=3') return 'quarterly'
  if (rrule.startsWith('FREQ=MONTHLY')) return 'monthly'
  return 'once'
}

export default function FormScheduleDialog({ formId, onClose }: FormScheduleDialogProps) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasExisting, setHasExisting] = useState(false)

  const [recurrence, setRecurrence] = useState<RecurrenceOption>('once')
  const [recipientsRaw, setRecipientsRaw] = useState('')
  const [channel, setChannel] = useState<DistributionChannel>('email')
  const [isActive, setIsActive] = useState(true)

  useEffect(() => {
    async function fetchSchedule() {
      try {
        const res = await apiClient.get<ScheduleData>(`/forms/${formId}/schedule`)
        const d = res.data
        setRecurrence(rruleToRecurrence(d.rrule))
        setRecipientsRaw((d.recipients ?? []).join('\n'))
        setChannel(d.distribution_channel ?? 'email')
        setIsActive(d.is_active ?? true)
        setHasExisting(true)
      } catch {
        // No existing schedule — defaults
      } finally {
        setLoading(false)
      }
    }
    fetchSchedule()
  }, [formId])

  async function handleSave() {
    setSaving(true)
    setError(null)
    const rruleEntry = RECURRENCE_OPTIONS.find((o) => o.value === recurrence)
    const recipients = recipientsRaw
      .split('\n')
      .map((e) => e.trim())
      .filter(Boolean)
    try {
      await apiClient.post(`/forms/${formId}/schedule`, {
        rrule: rruleEntry?.rrule ?? '',
        recipients,
        distribution_channel: channel,
        is_active: isActive,
      })
      onClose()
    } catch {
      setError('Failed to save schedule. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    setDeleting(true)
    try {
      await apiClient.delete(`/forms/${formId}/schedule`)
      onClose()
    } catch {
      setError('Failed to delete schedule.')
    } finally {
      setDeleting(false)
      setConfirmDelete(false)
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/30 z-50" onClick={onClose} />

      {/* Dialog */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ fontFamily: 'Open Sans, sans-serif' }}>
        <div
          className="bg-white dark:bg-gray-800 rounded-[10px] shadow-2xl w-full max-w-lg flex flex-col max-h-[90vh]"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
              Schedule Distribution
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xl leading-none"
            >
              ×
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
            {loading ? (
              <div className="flex justify-center py-10">
                <div
                  className="h-7 w-7 rounded-full border-4 border-t-transparent animate-spin"
                  style={{ borderColor: '#51459d', borderTopColor: 'transparent' }}
                />
              </div>
            ) : (
              <>
                {/* Recurrence */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2 uppercase tracking-wide">
                    Recurrence
                  </label>
                  <div className="grid grid-cols-5 gap-2">
                    {RECURRENCE_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setRecurrence(opt.value)}
                        className={`py-2 text-xs font-medium rounded-[10px] border transition-colors ${
                          recurrence === opt.value
                            ? 'text-white border-transparent'
                            : 'text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 hover:border-[#51459d]'
                        }`}
                        style={recurrence === opt.value ? { backgroundColor: '#51459d', borderColor: '#51459d' } : {}}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                  {recurrence !== 'once' && (
                    <p className="mt-1.5 text-xs text-gray-400 dark:text-gray-500">
                      RRULE: {RECURRENCE_OPTIONS.find((o) => o.value === recurrence)?.rrule || '—'}
                    </p>
                  )}
                </div>

                {/* Recipients */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2 uppercase tracking-wide">
                    Recipients
                  </label>
                  <textarea
                    value={recipientsRaw}
                    onChange={(e) => setRecipientsRaw(e.target.value)}
                    rows={4}
                    placeholder="Enter one email address per line..."
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-[10px] text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#51459d] resize-none"
                  />
                  <p className="mt-1 text-xs text-gray-400">One email per line</p>
                </div>

                {/* Distribution Channel */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2 uppercase tracking-wide">
                    Distribution Channel
                  </label>
                  <div className="flex rounded-[10px] overflow-hidden border border-gray-200 dark:border-gray-600">
                    {(
                      [
                        { value: 'email', label: 'Email' },
                        { value: 'in_app', label: 'In-App' },
                        { value: 'both', label: 'Both' },
                      ] as { value: DistributionChannel; label: string }[]
                    ).map((opt, idx, arr) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setChannel(opt.value)}
                        className={`flex-1 py-2 text-sm font-medium transition-colors ${
                          idx < arr.length - 1 ? 'border-r border-gray-200 dark:border-gray-600' : ''
                        } ${
                          channel === opt.value
                            ? 'text-white'
                            : 'text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600'
                        }`}
                        style={channel === opt.value ? { backgroundColor: '#51459d' } : {}}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Active Toggle */}
                <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-[10px]">
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Active</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      Enable or pause this schedule
                    </p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={isActive}
                    onClick={() => setIsActive(!isActive)}
                    className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ${
                      isActive ? 'bg-[#51459d]' : 'bg-gray-200 dark:bg-gray-600'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform transition duration-200 ${
                        isActive ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                {error && (
                  <p className="text-sm text-red-500 dark:text-red-400">{error}</p>
                )}

                {/* Confirm Delete */}
                {confirmDelete && (
                  <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-[10px]">
                    <p className="text-sm font-medium text-red-700 dark:text-red-300 mb-3">
                      Delete this schedule? This action cannot be undone.
                    </p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={handleDelete}
                        disabled={deleting}
                        className="px-4 py-2 text-sm font-semibold text-white rounded-[10px] bg-[#ff3a6e] hover:opacity-90 disabled:opacity-50"
                      >
                        {deleting ? 'Deleting…' : 'Yes, Delete'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDelete(false)}
                        className="px-4 py-2 text-sm font-semibold text-gray-700 dark:text-gray-200 rounded-[10px] bg-gray-100 dark:bg-gray-600 hover:bg-gray-200 dark:hover:bg-gray-500"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Footer */}
          {!loading && (
            <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <div>
                {hasExisting && !confirmDelete && (
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(true)}
                    className="px-4 py-2 text-sm font-semibold rounded-[10px] text-[#ff3a6e] border border-[#ff3a6e] hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                  >
                    Delete Schedule
                  </button>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-sm font-semibold text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 rounded-[10px] hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="px-5 py-2 text-sm font-semibold text-white rounded-[10px] transition-opacity hover:opacity-90 disabled:opacity-50"
                  style={{ backgroundColor: '#51459d' }}
                >
                  {saving ? 'Saving…' : 'Save Schedule'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
