import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import apiClient from '../../api/client'

interface CalendarRule {
  id: string
  name: string
  rule_type: string
  conditions: Record<string, unknown>
  actions: Record<string, unknown>
  is_active: boolean
  created_at: string
}

const RULE_TYPES = [
  { value: 'auto_accept', label: 'Auto-Accept', desc: 'Automatically accept meeting invites matching conditions' },
  { value: 'auto_decline', label: 'Auto-Decline', desc: 'Automatically decline meeting invites matching conditions' },
  { value: 'auto_schedule', label: 'Auto-Schedule', desc: 'Auto-create events when ERP conditions are met' },
  { value: 'auto_remind', label: 'Auto-Remind', desc: 'Send reminders based on event conditions' },
]

const CONDITION_TEMPLATES: Record<string, { label: string; fields: { key: string; label: string; type: string; options?: string[] }[] }> = {
  auto_accept: {
    label: 'Accept when',
    fields: [
      { key: 'from_vip', label: 'From VIP contacts', type: 'checkbox' },
      { key: 'max_duration', label: 'Max duration (min)', type: 'number' },
      { key: 'max_attendees', label: 'Max attendees', type: 'number' },
      { key: 'keywords', label: 'Title contains', type: 'text' },
    ],
  },
  auto_decline: {
    label: 'Decline when',
    fields: [
      { key: 'daily_meeting_limit', label: 'Daily meetings exceed', type: 'number' },
      { key: 'during_focus_time', label: 'During focus time', type: 'checkbox' },
      { key: 'min_duration', label: 'Duration over (min)', type: 'number' },
      { key: 'exclude_organizers', label: 'Exclude organizers (IDs)', type: 'text' },
    ],
  },
  auto_schedule: {
    label: 'Schedule when',
    fields: [
      { key: 'trigger_event', label: 'Trigger', type: 'select', options: ['invoice.overdue', 'ticket.sla_warning', 'deal.stage_changed', 'task.deadline_approaching'] },
      { key: 'days_before', label: 'Days before deadline', type: 'number' },
      { key: 'event_type', label: 'Event type', type: 'select', options: ['meeting', 'reminder', 'task', 'deadline'] },
      { key: 'duration_minutes', label: 'Duration (min)', type: 'number' },
    ],
  },
  auto_remind: {
    label: 'Remind when',
    fields: [
      { key: 'minutes_before', label: 'Minutes before event', type: 'number' },
      { key: 'channel', label: 'Channel', type: 'select', options: ['notification', 'email', 'both'] },
      { key: 'event_types', label: 'Event types', type: 'text' },
    ],
  },
}

function useCalendarRules() {
  return useQuery({
    queryKey: ['calendar-rules'],
    queryFn: async () => {
      const { data } = await apiClient.get<{ rules: CalendarRule[] }>('/calendar/automation/rules')
      return data.rules
    },
  })
}

function useCreateRule() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: Omit<CalendarRule, 'id' | 'created_at'>) => {
      const { data } = await apiClient.post<CalendarRule>('/calendar/automation/rules', payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['calendar-rules'] }),
  })
}

function useDeleteRule() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/calendar/automation/rules/${id}`)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['calendar-rules'] }),
  })
}

function useToggleRule() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      await apiClient.put(`/calendar/automation/rules/${id}`, { is_active })
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['calendar-rules'] }),
  })
}

export default function AutomationBuilder() {
  const { data: rules = [], isLoading } = useCalendarRules()
  const createRule = useCreateRule()
  const deleteRule = useDeleteRule()
  const toggleRule = useToggleRule()
  const [showForm, setShowForm] = useState(false)
  const [ruleType, setRuleType] = useState('auto_accept')
  const [ruleName, setRuleName] = useState('')
  const [conditions, setConditions] = useState<Record<string, unknown>>({})

  const template = CONDITION_TEMPLATES[ruleType]

  const handleCreate = () => {
    createRule.mutate(
      {
        name: ruleName,
        rule_type: ruleType,
        conditions,
        actions: { type: ruleType },
        is_active: true,
      },
      {
        onSuccess: () => {
          setShowForm(false)
          setRuleName('')
          setConditions({})
        },
      }
    )
  }

  const updateCondition = (key: string, value: unknown) => {
    setConditions((prev) => ({ ...prev, [key]: value }))
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Calendar Automations</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Rules that auto-accept, decline, or schedule events
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 text-sm font-medium text-white bg-[#51459d] rounded-lg hover:bg-[#51459d]/90 transition-colors"
        >
          {showForm ? 'Cancel' : '+ New Rule'}
        </button>
      </div>

      {showForm && (
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Rule Name</label>
            <input
              type="text"
              value={ruleName}
              onChange={(e) => setRuleName(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-[#51459d]"
              placeholder="e.g. Accept VIP meetings"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-2">Rule Type</label>
            <div className="grid grid-cols-2 gap-2">
              {RULE_TYPES.map((rt) => (
                <button
                  key={rt.value}
                  onClick={() => { setRuleType(rt.value); setConditions({}) }}
                  className={`text-left p-3 rounded-lg border transition-colors ${
                    ruleType === rt.value
                      ? 'border-[#51459d] bg-[#51459d]/5'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                  }`}
                >
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{rt.label}</p>
                  <p className="text-[10px] text-gray-500 mt-0.5">{rt.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {template && (
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-2">{template.label}</label>
              <div className="space-y-3">
                {template.fields.map((field) => (
                  <div key={field.key} className="flex items-center gap-3">
                    {field.type === 'checkbox' ? (
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={!!conditions[field.key]}
                          onChange={(e) => updateCondition(field.key, e.target.checked)}
                          className="w-4 h-4 rounded border-gray-300 text-[#51459d] focus:ring-[#51459d]"
                        />
                        <span className="text-sm text-gray-700 dark:text-gray-300">{field.label}</span>
                      </label>
                    ) : field.type === 'select' ? (
                      <div className="flex-1">
                        <label className="block text-xs text-gray-500 mb-1">{field.label}</label>
                        <select
                          value={(conditions[field.key] as string) || ''}
                          onChange={(e) => updateCondition(field.key, e.target.value)}
                          className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                        >
                          <option value="">Select...</option>
                          {field.options?.map((opt) => (
                            <option key={opt} value={opt}>{opt.replace(/[._]/g, ' ')}</option>
                          ))}
                        </select>
                      </div>
                    ) : (
                      <div className="flex-1">
                        <label className="block text-xs text-gray-500 mb-1">{field.label}</label>
                        <input
                          type={field.type}
                          value={(conditions[field.key] as string) || ''}
                          onChange={(e) => updateCondition(field.key, field.type === 'number' ? Number(e.target.value) : e.target.value)}
                          className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <button
            onClick={handleCreate}
            disabled={!ruleName.trim() || createRule.isPending}
            className="w-full px-4 py-2.5 text-sm font-medium text-white bg-[#51459d] rounded-lg hover:bg-[#51459d]/90 disabled:opacity-50 transition-colors"
          >
            {createRule.isPending ? 'Creating...' : 'Create Rule'}
          </button>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="h-20 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : rules.length === 0 ? (
        <div className="text-center py-12 text-gray-400 text-sm">
          No automation rules configured. Create one to automate your calendar management.
        </div>
      ) : (
        <div className="space-y-3">
          {rules.map((rule) => {
            const typeInfo = RULE_TYPES.find((rt) => rt.value === rule.rule_type)
            return (
              <div
                key={rule.id}
                className={`bg-white dark:bg-gray-900 border rounded-xl p-4 transition-all ${
                  rule.is_active
                    ? 'border-gray-200 dark:border-gray-700'
                    : 'border-gray-200 dark:border-gray-700 opacity-60'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-gray-900 dark:text-white">{rule.name}</p>
                      <span className="text-[10px] px-2 py-0.5 bg-[#51459d]/10 text-[#51459d] rounded-full font-medium">
                        {typeInfo?.label || rule.rule_type}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {Object.entries(rule.conditions)
                        .filter(([, v]) => v)
                        .map(([k, v]) => `${k.replace(/_/g, ' ')}: ${v}`)
                        .join(' · ') || 'No conditions set'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => toggleRule.mutate({ id: rule.id, is_active: !rule.is_active })}
                      className={`relative w-10 h-5 rounded-full transition-colors ${
                        rule.is_active ? 'bg-[#51459d]' : 'bg-gray-300 dark:bg-gray-600'
                      }`}
                    >
                      <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                        rule.is_active ? 'left-5' : 'left-0.5'
                      }`} />
                    </button>
                    <button
                      onClick={() => deleteRule.mutate(rule.id)}
                      className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
