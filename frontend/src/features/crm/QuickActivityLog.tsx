import { useState } from 'react'
import { Button, Modal, Input, Select } from '../../components/ui'
import { toast } from '../../components/ui'
import apiClient from '../../api/client'
import { useQueryClient } from '@tanstack/react-query'

type ActivityType = 'call' | 'email' | 'note' | 'meeting'

const ACTIVITY_OPTIONS: { value: ActivityType; label: string; icon: string }[] = [
  { value: 'call', label: 'Call', icon: 'M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z' },
  { value: 'email', label: 'Email', icon: 'M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z' },
  { value: 'note', label: 'Note', icon: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z' },
  { value: 'meeting', label: 'Meeting', icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' },
]

interface QuickActivityLogProps {
  contactId?: string
  contactName?: string
}

export default function QuickActivityLog({ contactId, contactName }: QuickActivityLogProps) {
  const [open, setOpen] = useState(false)
  const [selectedType, setSelectedType] = useState<ActivityType | null>(null)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const qc = useQueryClient()

  function reset() {
    setSelectedType(null)
    setTitle('')
    setDescription('')
  }

  function handleClose() {
    setOpen(false)
    reset()
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedType || !title.trim()) return

    setSubmitting(true)
    try {
      // Log as timeline event if contact context available
      if (contactId) {
        await apiClient.post(`/crm/contacts/${contactId}/timeline`, {
          event_type: selectedType,
          title: title.trim(),
          description: description.trim() || null,
        })
      } else {
        // General activity log
        await apiClient.post('/crm/activities', {
          activity_type: selectedType,
          title: title.trim(),
          description: description.trim() || null,
        })
      }
      toast('success', 'Activity logged')
      qc.invalidateQueries({ queryKey: ['crm'] })
      handleClose()
    } catch {
      toast('error', 'Failed to log activity')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      {/* FAB - only visible on mobile */}
      <button
        onClick={() => setOpen(true)}
        className="md:hidden fixed bottom-6 right-6 z-40 w-14 h-14 rounded-full bg-primary text-white shadow-lg hover:shadow-xl active:scale-95 transition-all flex items-center justify-center"
        aria-label="Quick activity log"
      >
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
      </button>

      {/* Activity Dialog */}
      <Modal open={open} onClose={handleClose} title="Log Activity" size="sm">
        {!selectedType ? (
          <div className="space-y-3">
            {contactName && (
              <p className="text-sm text-gray-500 -mt-1 mb-2">
                For: <span className="font-medium text-gray-700 dark:text-gray-300">{contactName}</span>
              </p>
            )}
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">What type of activity?</p>
            <div className="grid grid-cols-2 gap-3">
              {ACTIVITY_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setSelectedType(opt.value)}
                  className="flex flex-col items-center gap-2 p-4 rounded-[10px] border border-gray-200 dark:border-gray-700 hover:border-primary hover:bg-primary/5 transition-colors min-h-[80px] active:scale-95"
                >
                  <svg className="w-6 h-6 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={opt.icon} />
                  </svg>
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{opt.label}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <button
                type="button"
                onClick={() => setSelectedType(null)}
                className="text-gray-400 hover:text-gray-600 min-h-[44px] min-w-[44px] flex items-center justify-center"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300 capitalize">{selectedType}</span>
              {contactName && (
                <span className="text-xs text-gray-400 ml-auto truncate max-w-[120px]">{contactName}</span>
              )}
            </div>

            <Input
              label="Title"
              required
              placeholder={`${selectedType === 'call' ? 'Called about...' : selectedType === 'email' ? 'Email about...' : selectedType === 'meeting' ? 'Met to discuss...' : 'Note about...'}`}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="min-h-[44px]"
            />

            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Details (optional)</label>
              <textarea
                className="w-full rounded-[10px] border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary min-h-[88px]"
                placeholder="Add any additional details..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <Button
              type="submit"
              loading={submitting}
              className="w-full min-h-[48px] text-base font-semibold"
            >
              Log {selectedType.charAt(0).toUpperCase() + selectedType.slice(1)}
            </Button>
          </form>
        )}
      </Modal>
    </>
  )
}
