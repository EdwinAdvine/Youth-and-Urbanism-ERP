import { useState, useEffect } from 'react'
import apiClient from '@/api/client'

// ─── Types ────────────────────────────────────────────────────────────────────

type TriggerType =
  | 'form_submitted'
  | 'response_approved'
  | 'response_rejected'
  | 'scheduled'

type ActionType =
  | 'create_crm_lead'
  | 'send_email'
  | 'create_invoice'
  | 'create_support_ticket'
  | 'create_calendar_event'
  | 'assign_hr_task'
  | 'update_inventory'
  | 'create_po'

interface AutomationCondition {
  field: string
  operator: string
  value: string
}

interface AutomationAction {
  type: ActionType
  config: string  // JSON string
}

interface Automation {
  id: string
  name: string
  trigger: TriggerType
  conditions: AutomationCondition[]
  actions: AutomationAction[]
  is_active: boolean
  created_at?: string
}

interface FormAutomationBuilderProps {
  formId: string
}

// ─── Constants ────────────────────────────────────────────────────────────────

const TRIGGERS: { value: TriggerType; label: string }[] = [
  { value: 'form_submitted', label: 'Form Submitted' },
  { value: 'response_approved', label: 'Response Approved' },
  { value: 'response_rejected', label: 'Response Rejected' },
  { value: 'scheduled', label: 'Scheduled' },
]

const ACTION_TYPES: { value: ActionType; label: string }[] = [
  { value: 'create_crm_lead', label: 'Create CRM Lead' },
  { value: 'send_email', label: 'Send Email' },
  { value: 'create_invoice', label: 'Create Invoice' },
  { value: 'create_support_ticket', label: 'Create Support Ticket' },
  { value: 'create_calendar_event', label: 'Create Calendar Event' },
  { value: 'assign_hr_task', label: 'Assign HR Task' },
  { value: 'update_inventory', label: 'Update Inventory' },
  { value: 'create_po', label: 'Create PO' },
]

const TRIGGER_COLORS: Record<TriggerType, string> = {
  form_submitted: '#51459d',
  response_approved: '#6fd943',
  response_rejected: '#ff3a6e',
  scheduled: '#ffa21d',
}

// ─── Empty Automation Factory ─────────────────────────────────────────────────

function emptyAutomation(): Omit<Automation, 'id'> {
  return {
    name: '',
    trigger: 'form_submitted',
    conditions: [],
    actions: [],
    is_active: true,
  }
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function FormAutomationBuilder({ formId }: FormAutomationBuilderProps) {
  const [automations, setAutomations] = useState<Automation[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<(Omit<Automation, 'id'> & { id?: string }) | null>(null)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  async function fetchAutomations() {
    setLoading(true)
    try {
      const res = await apiClient.get<{ automations: Automation[] }>(
        `/forms/${formId}/automations`
      )
      setAutomations(res.data.automations ?? [])
    } catch {
      setAutomations([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (formId) fetchAutomations()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formId])

  async function handleSave() {
    if (!editing) return
    setSaving(true)
    try {
      const payload = {
        name: editing.name,
        trigger: editing.trigger,
        conditions: editing.conditions,
        actions: editing.actions.map((a) => ({
          type: a.type,
          config: (() => {
            try { return JSON.parse(a.config) } catch { return {} }
          })(),
        })),
        is_active: editing.is_active,
      }

      if (editing.id) {
        await apiClient.put(`/forms/${formId}/automations/${editing.id}`, payload)
      } else {
        await apiClient.post(`/forms/${formId}/automations`, payload)
      }
      await fetchAutomations()
      setEditing(null)
    } catch {
      // ignore
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id)
    try {
      await apiClient.delete(`/forms/${formId}/automations/${id}`)
      setAutomations((prev) => prev.filter((a) => a.id !== id))
    } catch {
      // ignore
    } finally {
      setDeletingId(null)
    }
  }

  async function handleToggleActive(auto: Automation) {
    try {
      await apiClient.patch(`/forms/${formId}/automations/${auto.id}`, {
        is_active: !auto.is_active,
      })
      setAutomations((prev) =>
        prev.map((a) => (a.id === auto.id ? { ...a, is_active: !a.is_active } : a))
      )
    } catch {
      // ignore
    }
  }

  return (
    <div className="space-y-5" style={{ fontFamily: 'Open Sans, sans-serif' }}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
            Automations
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Automatically trigger actions when form events occur.
          </p>
        </div>
        {!editing && (
          <button
            type="button"
            onClick={() => setEditing(emptyAutomation())}
            className="px-4 py-2 text-sm font-semibold text-white rounded-[10px] transition-opacity hover:opacity-90"
            style={{ backgroundColor: '#51459d' }}
          >
            + New Automation
          </button>
        )}
      </div>

      {/* Inline Editor */}
      {editing && (
        <AutomationEditor
          value={editing}
          saving={saving}
          onChange={setEditing}
          onSave={handleSave}
          onCancel={() => setEditing(null)}
        />
      )}

      {/* Automation List */}
      {loading ? (
        <div className="flex justify-center py-10">
          <div
            className="h-7 w-7 rounded-full border-4 border-t-transparent animate-spin"
            style={{ borderColor: '#51459d', borderTopColor: 'transparent' }}
          />
        </div>
      ) : automations.length === 0 && !editing ? (
        <div className="flex flex-col items-center justify-center py-14 text-center">
          <div className="w-14 h-14 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-3 text-2xl">
            ⚡
          </div>
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
            No automations yet
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 max-w-xs">
            Add your first automation to start triggering actions from form events.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {automations.map((auto) => (
            <div
              key={auto.id}
              className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-[10px] p-4"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <span
                    className="px-2.5 py-0.5 text-[10px] font-semibold rounded-full text-white shrink-0"
                    style={{ backgroundColor: TRIGGER_COLORS[auto.trigger] }}
                  >
                    {TRIGGERS.find((t) => t.value === auto.trigger)?.label ?? auto.trigger}
                  </span>
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                    {auto.name || 'Untitled Automation'}
                  </p>
                </div>

                <div className="flex items-center gap-2 ml-3 shrink-0">
                  {/* Active toggle */}
                  <button
                    type="button"
                    onClick={() => handleToggleActive(auto)}
                    className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                      auto.is_active ? 'bg-[#51459d]' : 'bg-gray-200 dark:bg-gray-600'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 rounded-full bg-white shadow transform transition ${
                        auto.is_active ? 'translate-x-4' : 'translate-x-0'
                      }`}
                    />
                  </button>

                  <button
                    type="button"
                    onClick={() => setEditing({ ...auto })}
                    className="text-xs text-[#51459d] hover:underline"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    disabled={deletingId === auto.id}
                    onClick={() => handleDelete(auto.id)}
                    className="text-xs text-[#ff3a6e] hover:underline disabled:opacity-50"
                  >
                    {deletingId === auto.id ? '…' : 'Delete'}
                  </button>
                </div>
              </div>

              <div className="mt-2 flex items-center gap-3 flex-wrap">
                <span className="text-xs text-gray-400 dark:text-gray-500">
                  {auto.conditions.length} condition{auto.conditions.length !== 1 ? 's' : ''}
                </span>
                <span className="text-gray-300 dark:text-gray-600">·</span>
                <span className="text-xs text-gray-400 dark:text-gray-500">
                  {auto.actions.length} action{auto.actions.length !== 1 ? 's' : ''}
                </span>
                {auto.actions.slice(0, 3).map((a, i) => (
                  <span
                    key={i}
                    className="px-2 py-0.5 text-[10px] font-medium rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300"
                  >
                    {ACTION_TYPES.find((t) => t.value === a.type)?.label ?? a.type}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Automation Editor ────────────────────────────────────────────────────────

interface AutomationEditorProps {
  value: Omit<Automation, 'id'> & { id?: string }
  saving: boolean
  onChange: (v: Omit<Automation, 'id'> & { id?: string }) => void
  onSave: () => void
  onCancel: () => void
}

function AutomationEditor({ value, saving, onChange, onSave, onCancel }: AutomationEditorProps) {
  function addCondition() {
    onChange({
      ...value,
      conditions: [...value.conditions, { field: '', operator: 'equals', value: '' }],
    })
  }

  function updateCondition(i: number, patch: Partial<AutomationCondition>) {
    const conditions = value.conditions.map((c, idx) => (idx === i ? { ...c, ...patch } : c))
    onChange({ ...value, conditions })
  }

  function removeCondition(i: number) {
    onChange({ ...value, conditions: value.conditions.filter((_, idx) => idx !== i) })
  }

  function addAction() {
    onChange({
      ...value,
      actions: [...value.actions, { type: 'send_email', config: '{}' }],
    })
  }

  function updateAction(i: number, patch: Partial<AutomationAction>) {
    const actions = value.actions.map((a, idx) => (idx === i ? { ...a, ...patch } : a))
    onChange({ ...value, actions })
  }

  function removeAction(i: number) {
    onChange({ ...value, actions: value.actions.filter((_, idx) => idx !== i) })
  }

  return (
    <div className="bg-white dark:bg-gray-800 border-2 border-[#51459d]/30 rounded-[10px] p-5 space-y-5">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
          {value.id ? 'Edit Automation' : 'New Automation'}
        </h4>
        {/* Active Toggle */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500 dark:text-gray-400">Active</span>
          <button
            type="button"
            onClick={() => onChange({ ...value, is_active: !value.is_active })}
            className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
              value.is_active ? 'bg-[#51459d]' : 'bg-gray-200 dark:bg-gray-600'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 rounded-full bg-white shadow transform transition ${
                value.is_active ? 'translate-x-4' : 'translate-x-0'
              }`}
            />
          </button>
        </div>
      </div>

      {/* Name */}
      <div>
        <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5 uppercase tracking-wide">
          Name
        </label>
        <input
          type="text"
          value={value.name}
          onChange={(e) => onChange({ ...value, name: e.target.value })}
          placeholder="e.g. Send welcome email on submit"
          className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-[10px] bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#51459d]"
        />
      </div>

      {/* Trigger */}
      <div>
        <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5 uppercase tracking-wide">
          Trigger
        </label>
        <select
          value={value.trigger}
          onChange={(e) => onChange({ ...value, trigger: e.target.value as TriggerType })}
          className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-[10px] bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-[#51459d]"
        >
          {TRIGGERS.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </div>

      {/* Conditions */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
            Conditions
          </label>
          <button
            type="button"
            onClick={addCondition}
            className="text-xs font-medium text-[#51459d] hover:underline"
          >
            + Add condition
          </button>
        </div>
        {value.conditions.length === 0 ? (
          <p className="text-xs text-gray-400 dark:text-gray-500 italic">
            No conditions — automation runs on every trigger.
          </p>
        ) : (
          <div className="space-y-2">
            {value.conditions.map((cond, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  type="text"
                  value={cond.field}
                  onChange={(e) => updateCondition(i, { field: e.target.value })}
                  placeholder="Field name"
                  className="flex-1 px-2.5 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded-[6px] bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-[#51459d]"
                />
                <select
                  value={cond.operator}
                  onChange={(e) => updateCondition(i, { operator: e.target.value })}
                  className="px-2 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded-[6px] bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none"
                >
                  <option value="equals">equals</option>
                  <option value="not_equals">not equals</option>
                  <option value="contains">contains</option>
                  <option value="greater_than">greater than</option>
                  <option value="less_than">less than</option>
                </select>
                <input
                  type="text"
                  value={cond.value}
                  onChange={(e) => updateCondition(i, { value: e.target.value })}
                  placeholder="Value"
                  className="flex-1 px-2.5 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded-[6px] bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-[#51459d]"
                />
                <button
                  type="button"
                  onClick={() => removeCondition(i)}
                  className="text-gray-400 hover:text-red-500 transition-colors text-sm leading-none"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
            Actions
          </label>
          <button
            type="button"
            onClick={addAction}
            className="text-xs font-medium text-[#51459d] hover:underline"
          >
            + Add action
          </button>
        </div>
        {value.actions.length === 0 ? (
          <p className="text-xs text-gray-400 dark:text-gray-500 italic">
            No actions added yet.
          </p>
        ) : (
          <div className="space-y-3">
            {value.actions.map((action, i) => (
              <div
                key={i}
                className="border border-gray-200 dark:border-gray-600 rounded-[10px] p-3 space-y-2"
              >
                <div className="flex items-center gap-2">
                  <select
                    value={action.type}
                    onChange={(e) => updateAction(i, { type: e.target.value as ActionType })}
                    className="flex-1 px-2.5 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded-[6px] bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none"
                  >
                    {ACTION_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => removeAction(i)}
                    className="text-gray-400 hover:text-red-500 transition-colors text-sm leading-none"
                  >
                    ×
                  </button>
                </div>
                <div>
                  <p className="text-[10px] text-gray-400 mb-1">Config (JSON)</p>
                  <textarea
                    rows={3}
                    value={action.config}
                    onChange={(e) => updateAction(i, { config: e.target.value })}
                    placeholder='{"key": "value"}'
                    className="w-full px-2.5 py-1.5 text-xs font-mono border border-gray-300 dark:border-gray-600 rounded-[6px] bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-[#51459d] resize-none"
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer Buttons */}
      <div className="flex items-center justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm font-semibold text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 rounded-[10px] hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={saving || !value.name.trim()}
          onClick={onSave}
          className="px-5 py-2 text-sm font-semibold text-white rounded-[10px] transition-opacity hover:opacity-90 disabled:opacity-50"
          style={{ backgroundColor: '#51459d' }}
        >
          {saving ? 'Saving…' : 'Save Automation'}
        </button>
      </div>
    </div>
  )
}
