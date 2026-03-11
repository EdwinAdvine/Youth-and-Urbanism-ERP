import { useState } from 'react'
import { Button, Modal, Input } from '../../components/ui'
import { toast } from '../../components/ui'
import {
  useScheduleContactFollowup,
  useScheduleDealFollowup,
} from '../../api/crm'

interface Props {
  open: boolean
  onClose: () => void
  entityType: 'contact' | 'deal'
  entityId: string
  entityName: string
}

export default function ScheduleFollowupDialog({ open, onClose, entityType, entityId, entityName }: Props) {
  const contactMutation = useScheduleContactFollowup()
  const dealMutation = useScheduleDealFollowup()
  const isPending = contactMutation.isPending || dealMutation.isPending

  const [title, setTitle] = useState('')
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [description, setDescription] = useState('')

  const reset = () => {
    setTitle('')
    setStartTime('')
    setEndTime('')
    setDescription('')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title || !startTime || !endTime) return

    try {
      if (entityType === 'contact') {
        await contactMutation.mutateAsync({
          contactId: entityId,
          title,
          start_time: new Date(startTime).toISOString(),
          end_time: new Date(endTime).toISOString(),
          description: description || undefined,
        })
      } else {
        await dealMutation.mutateAsync({
          dealId: entityId,
          title,
          start_time: new Date(startTime).toISOString(),
          end_time: new Date(endTime).toISOString(),
          description: description || undefined,
        })
      }
      toast('success', 'Follow-up scheduled and added to calendar')
      reset()
      onClose()
    } catch {
      toast('error', 'Failed to schedule follow-up')
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={`Schedule Follow-up: ${entityName}`} size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Title"
          required
          placeholder="e.g. Follow up on proposal"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Start Time"
            type="datetime-local"
            required
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
          />
          <Input
            label="End Time"
            type="datetime-local"
            required
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Description (optional)</label>
          <textarea
            className="w-full rounded-[10px] border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Add notes for this follow-up..."
          />
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <Button variant="secondary" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={isPending}>
            Schedule Follow-up
          </Button>
        </div>
      </form>
    </Modal>
  )
}
