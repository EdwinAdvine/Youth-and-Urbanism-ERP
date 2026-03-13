import { useState, useEffect } from 'react'
import { Button, Card, Input, Select, toast } from '../../components/ui'
import {
  useAutomation,
  useCreateAutomation,
  useUpdateAutomation,
  type SupportAutomation,
} from '@/api/support_phase2'

const TRIGGER_OPTIONS = [
  { value: 'support.ticket.created', label: 'Ticket Created' },
  { value: 'support.comment.added', label: 'Comment Added' },
  { value: 'support.sla.breached', label: 'SLA Breached' },
  { value: 'support.ticket.resolved', label: 'Ticket Resolved' },
]

const ACTION_TYPE_OPTIONS = [
  { value: 'assign_to_user', label: 'Assign to User' },
  { value: 'set_priority', label: 'Set Priority' },
  { value: 'set_status', label: 'Set Status' },
  { value: 'add_tag', label: 'Add Tag' },
  { value: 'send_email', label: 'Send Email' },
  { value: 'add_comment', label: 'Add Comment' },
  { value: 'webhook', label: 'Call Webhook' },
]

interface ActionItem {
  type: string
  value: string
}

interface Props {
  automationId?: string
  onSaved?: (automation: SupportAutomation) => void
}

export default function AutomationBuilder({ automationId, onSaved }: Props) {
  const { data: existing } = useAutomation(automationId ?? '')
  const createMutation = useCreateAutomation()
  const updateMutation = useUpdateAutomation()

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [triggerEvent, setTriggerEvent] = useState('support.ticket.created')
  const [conditionsJson, setConditionsJson] = useState('{}')
  const [conditionsError, setConditionsError] = useState('')
  const [actions, setActions] = useState<ActionItem[]>([{ type: 'assign_to_user', value: '' }])

  useEffect(() => {
    if (existing) {
      setName(existing.name)
      setDescription(existing.description ?? '')
      setTriggerEvent(existing.trigger_event)
      setConditionsJson(JSON.stringify(existing.conditions ?? {}, null, 2))
      const raw = existing.actions ?? []
      setActions(
        raw.length > 0
          ? raw.map((a: Record<string, unknown>) => ({ type: String(a.type ?? ''), value: String(a.value ?? '') }))
          : [{ type: 'assign_to_user', value: '' }],
      )
    }
  }, [existing])

  const addAction = () => setActions([...actions, { type: 'assign_to_user', value: '' }])

  const removeAction = (i: number) => setActions(actions.filter((_, idx) => idx !== i))

  const updateAction = (i: number, field: keyof ActionItem, value: string) => {
    const next = [...actions]
    next[i] = { ...next[i], [field]: value }
    setActions(next)
  }

  const validateConditions = (json: string): Record<string, unknown> | null => {
    try {
      const parsed = JSON.parse(json)
      setConditionsError('')
      return parsed
    } catch {
      setConditionsError('Invalid JSON — please fix syntax')
      return null
    }
  }

  const handleSave = async () => {
    if (!name.trim()) { toast('error', 'Name is required'); return }
    const conditions = validateConditions(conditionsJson)
    if (conditions === null) return

    const payload: Partial<SupportAutomation> = {
      name,
      description,
      trigger_event: triggerEvent,
      conditions,
      actions: actions.filter((a) => a.type) as unknown as Array<Record<string, unknown>>,
    }

    try {
      let result: SupportAutomation
      if (automationId) {
        result = await updateMutation.mutateAsync({ id: automationId, ...payload })
        toast('success', 'Automation updated')
      } else {
        result = await createMutation.mutateAsync(payload)
        toast('success', 'Automation created')
      }
      onSaved?.(result)
    } catch {
      toast('error', 'Failed to save automation')
    }
  }

  const isPending = createMutation.isPending || updateMutation.isPending

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100">
          {automationId ? 'Edit Automation' : 'New Automation'}
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">Configure trigger, conditions, and actions</p>
      </div>

      <div className="space-y-5">
        {/* Basic Info */}
        <Card>
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-4">Basic Info</h2>
          <div className="space-y-4">
            <Input
              label="Automation Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Auto-escalate SLA breaches"
            />
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Description</label>
              <textarea
                className="w-full rounded-[10px] border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary min-h-[72px]"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What does this automation do?"
              />
            </div>
          </div>
        </Card>

        {/* Trigger */}
        <Card>
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-4">Trigger</h2>
          <Select
            label="Trigger Event"
            options={TRIGGER_OPTIONS}
            value={triggerEvent}
            onChange={(e) => setTriggerEvent(e.target.value)}
          />
          <p className="mt-2 text-xs text-gray-400">This automation fires whenever this event occurs in the support module.</p>
        </Card>

        {/* Conditions */}
        <Card>
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-1">Conditions</h2>
          <p className="text-xs text-gray-400 mb-3">JSON object of conditions that must be true for this automation to run. Use <code>{'{}'}</code> to always run.</p>
          <div className="space-y-1">
            <textarea
              className={`w-full rounded-[10px] border font-mono text-xs bg-gray-50 dark:bg-gray-900 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/30 min-h-[120px] ${
                conditionsError
                  ? 'border-[#ff3a6e] focus:border-[#ff3a6e]'
                  : 'border-gray-200 dark:border-gray-700 focus:border-primary'
              }`}
              value={conditionsJson}
              onChange={(e) => {
                setConditionsJson(e.target.value)
                setConditionsError('')
              }}
              onBlur={() => validateConditions(conditionsJson)}
              spellCheck={false}
            />
            {conditionsError && (
              <p className="text-xs text-[#ff3a6e]">{conditionsError}</p>
            )}
          </div>
          <p className="mt-2 text-xs text-gray-400">Example: <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">{"{ \"priority\": \"urgent\" }"}</code></p>
        </Card>

        {/* Actions */}
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">Actions</h2>
            <Button variant="outline" size="sm" onClick={addAction}>
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Action
            </Button>
          </div>

          {actions.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">No actions yet. Add at least one action.</p>
          ) : (
            <div className="space-y-3">
              {actions.map((action, i) => (
                <div
                  key={i}
                  className="flex items-start gap-3 p-3 rounded-[10px] border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900"
                >
                  <div className="flex items-center justify-center h-7 w-7 rounded-full bg-primary/10 text-primary text-xs font-bold flex-shrink-0 mt-1">
                    {i + 1}
                  </div>
                  <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">Action Type</label>
                      <select
                        className="w-full rounded-[10px] border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/30"
                        value={action.type}
                        onChange={(e) => updateAction(i, 'type', e.target.value)}
                      >
                        {ACTION_TYPE_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">Value</label>
                      <input
                        type="text"
                        className="w-full rounded-[10px] border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/30"
                        value={action.value}
                        onChange={(e) => updateAction(i, 'value', e.target.value)}
                        placeholder="e.g. user@example.com"
                      />
                    </div>
                  </div>
                  <button
                    onClick={() => removeAction(i)}
                    className="mt-1 text-gray-400 hover:text-[#ff3a6e] transition-colors flex-shrink-0"
                    title="Remove action"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Save */}
        <div className="flex justify-end gap-3 pb-4">
          <Button variant="secondary" onClick={() => window.history.back()}>Cancel</Button>
          <Button onClick={handleSave} loading={isPending}>
            {automationId ? 'Save Changes' : 'Create Automation'}
          </Button>
        </div>
      </div>
    </div>
  )
}
