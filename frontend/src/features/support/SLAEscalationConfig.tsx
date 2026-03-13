import { useState } from 'react'
import { Button, Card, Modal, Input, Select, Badge, toast } from '../../components/ui'
import {
  useEscalationChain,
  useAddEscalationLevel,
  useDeleteEscalationLevel,
  type EscalationChain,
} from '@/api/support_phase2'

const ACTION_OPTIONS = [
  { value: 'notify', label: 'Notify' },
  { value: 'reassign', label: 'Reassign' },
  { value: 'escalate', label: 'Escalate' },
]

const CHANNEL_OPTIONS = [
  { value: 'email', label: 'Email' },
  { value: 'slack', label: 'Slack' },
  { value: 'sms', label: 'SMS' },
  { value: 'in_app', label: 'In-App' },
]

const ACTION_BADGE_VARIANT: Record<string, 'info' | 'warning' | 'danger' | 'default'> = {
  notify: 'info',
  reassign: 'warning',
  escalate: 'danger',
}

interface Props {
  slaPolicyId: string
  slaPolicyName?: string
}

const emptyLevel = {
  trigger_minutes_before_breach: 30,
  action: 'notify',
  notify_channel: 'email',
  target_user_id: '',
}

export default function SLAEscalationConfig({ slaPolicyId, slaPolicyName }: Props) {
  const { data: chain, isLoading } = useEscalationChain(slaPolicyId)
  const addLevel = useAddEscalationLevel()
  const deleteLevel = useDeleteEscalationLevel()

  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState(emptyLevel)

  const levels: EscalationChain[] = (chain ?? []).sort(
    (a: EscalationChain, b: EscalationChain) => a.level - b.level,
  )

  const handleAdd = async () => {
    if (form.trigger_minutes_before_breach <= 0) {
      toast('error', 'Minutes must be greater than 0')
      return
    }
    try {
      await addLevel.mutateAsync({
        slaPolicyId,
        trigger_minutes_before_breach: form.trigger_minutes_before_breach,
        action: form.action,
        notify_channel: form.notify_channel,
        target_user_id: form.target_user_id || undefined,
      })
      toast('success', 'Escalation level added')
      setShowAdd(false)
      setForm(emptyLevel)
    } catch {
      toast('error', 'Failed to add escalation level')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Remove this escalation level?')) return
    try {
      await deleteLevel.mutateAsync(id)
      toast('success', 'Level removed')
    } catch {
      toast('error', 'Failed to remove level')
    }
  }

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100">Escalation Chain</h1>
          {slaPolicyName && (
            <p className="text-sm text-gray-500 mt-0.5">
              SLA Policy: <span className="font-medium">{slaPolicyName}</span>
            </p>
          )}
        </div>
        <Button onClick={() => setShowAdd(true)}>
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Level
        </Button>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-gray-400">Loading escalation chain...</div>
      ) : levels.length === 0 ? (
        <Card className="text-center py-12">
          <svg className="mx-auto h-12 w-12 text-gray-300 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          <p className="text-gray-500 font-medium">No escalation levels configured</p>
          <p className="text-sm text-gray-400 mt-1">
            Add levels to automatically escalate tickets before SLA breach
          </p>
          <Button className="mt-4" onClick={() => setShowAdd(true)}>
            Add First Level
          </Button>
        </Card>
      ) : (
        <div className="relative">
          {/* Vertical connector line */}
          {levels.length > 1 && (
            <div
              className="absolute left-[27px] top-10 w-0.5 bg-gray-200 dark:bg-gray-700"
              style={{ height: `calc(100% - 80px)` }}
            />
          )}

          <div className="space-y-4">
            {levels.map((lvl: EscalationChain) => (
              <div key={lvl.id} className="flex items-start gap-4">
                {/* Level badge */}
                <div className="flex-shrink-0 flex items-center justify-center h-14 w-14 rounded-full border-2 border-[#51459d] bg-white dark:bg-gray-900 text-[#51459d] font-bold text-lg z-10">
                  {lvl.level}
                </div>

                {/* Level card */}
                <Card className="flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <Badge variant={ACTION_BADGE_VARIANT[lvl.action] ?? 'default'}>
                          {lvl.action.charAt(0).toUpperCase() + lvl.action.slice(1)}
                        </Badge>
                        <span className="text-xs text-gray-500 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-full">
                          via {lvl.notify_channel}
                        </span>
                      </div>

                      <div className="space-y-1 text-sm">
                        <div className="flex items-center gap-2">
                          <svg className="h-4 w-4 text-[#ffa21d] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span className="text-gray-700 dark:text-gray-300">
                            Trigger{' '}
                            <span className="font-semibold">{lvl.trigger_minutes_before_breach} minutes</span>{' '}
                            before breach
                          </span>
                        </div>

                        {lvl.target_user_name && (
                          <div className="flex items-center gap-2">
                            <svg className="h-4 w-4 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                            <span className="text-gray-600 dark:text-gray-400">
                              Target:{' '}
                              <span className="font-medium">{lvl.target_user_name}</span>
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    <button
                      onClick={() => handleDelete(lvl.id)}
                      className="text-gray-400 hover:text-[#ff3a6e] transition-colors flex-shrink-0"
                      title="Remove level"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </Card>
              </div>
            ))}

            {/* End marker — SLA breach */}
            <div className="flex items-center gap-4">
              <div className="flex-shrink-0 flex items-center justify-center h-14 w-14 rounded-full border-2 border-[#ff3a6e] bg-[#ff3a6e]/5">
                <svg className="h-5 w-5 text-[#ff3a6e]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <span className="text-sm text-[#ff3a6e] font-medium">SLA Breach</span>
            </div>
          </div>
        </div>
      )}

      {/* Add Level Modal */}
      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Add Escalation Level" size="md">
        <div className="space-y-4">
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Minutes Before Breach
            </label>
            <input
              type="number"
              min={1}
              className="w-full rounded-[10px] border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/30"
              value={form.trigger_minutes_before_breach}
              onChange={(e) => setForm({ ...form, trigger_minutes_before_breach: Number(e.target.value) })}
            />
            <p className="text-xs text-gray-400">
              How many minutes before the SLA breach this level triggers
            </p>
          </div>
          <Select
            label="Action"
            options={ACTION_OPTIONS}
            value={form.action}
            onChange={(e) => setForm({ ...form, action: e.target.value })}
          />
          <Select
            label="Notification Channel"
            options={CHANNEL_OPTIONS}
            value={form.notify_channel}
            onChange={(e) => setForm({ ...form, notify_channel: e.target.value })}
          />
          <Input
            label="Target User ID (optional)"
            value={form.target_user_id}
            onChange={(e) => setForm({ ...form, target_user_id: e.target.value })}
            placeholder="Leave blank to notify ticket assignee"
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button onClick={handleAdd} loading={addLevel.isPending}>Add Level</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
