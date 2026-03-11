import { useState } from 'react'
import type { FormField } from '../../api/forms'

export interface ConditionalRule {
  id: string
  targetFieldId: string
  action: 'show' | 'hide'
  conditions: ConditionEntry[]
  logic: 'all' | 'any'
}

export interface ConditionEntry {
  fieldId: string
  operator: 'equals' | 'not_equals' | 'contains' | 'not_contains' | 'is_empty' | 'is_not_empty'
  value: string
}

interface Props {
  fields: FormField[]
  rules: ConditionalRule[]
  onChange: (rules: ConditionalRule[]) => void
}

const OPERATORS = [
  { value: 'equals', label: 'Equals' },
  { value: 'not_equals', label: 'Does not equal' },
  { value: 'contains', label: 'Contains' },
  { value: 'not_contains', label: 'Does not contain' },
  { value: 'is_empty', label: 'Is empty' },
  { value: 'is_not_empty', label: 'Is not empty' },
]

const VALUE_OPERATORS = new Set(['equals', 'not_equals', 'contains', 'not_contains'])

export default function ConditionalLogicBuilder({ fields, rules, onChange }: Props) {
  const [expandedRule, setExpandedRule] = useState<string | null>(null)

  const addRule = () => {
    if (fields.length < 2) return
    const newRule: ConditionalRule = {
      id: Math.random().toString(36).slice(2),
      targetFieldId: fields[0].id,
      action: 'show',
      logic: 'all',
      conditions: [
        {
          fieldId: fields[1]?.id ?? fields[0].id,
          operator: 'equals',
          value: '',
        },
      ],
    }
    onChange([...rules, newRule])
    setExpandedRule(newRule.id)
  }

  const updateRule = (ruleId: string, updates: Partial<ConditionalRule>) => {
    onChange(rules.map((r) => (r.id === ruleId ? { ...r, ...updates } : r)))
  }

  const removeRule = (ruleId: string) => {
    onChange(rules.filter((r) => r.id !== ruleId))
  }

  const addCondition = (ruleId: string) => {
    const rule = rules.find((r) => r.id === ruleId)
    if (!rule) return
    updateRule(ruleId, {
      conditions: [
        ...rule.conditions,
        { fieldId: fields[0].id, operator: 'equals', value: '' },
      ],
    })
  }

  const updateCondition = (ruleId: string, condIdx: number, updates: Partial<ConditionEntry>) => {
    const rule = rules.find((r) => r.id === ruleId)
    if (!rule) return
    const newConditions = rule.conditions.map((c, i) => (i === condIdx ? { ...c, ...updates } : c))
    updateRule(ruleId, { conditions: newConditions })
  }

  const removeCondition = (ruleId: string, condIdx: number) => {
    const rule = rules.find((r) => r.id === ruleId)
    if (!rule || rule.conditions.length <= 1) return
    updateRule(ruleId, { conditions: rule.conditions.filter((_, i) => i !== condIdx) })
  }

  const getFieldLabel = (fieldId: string) => fields.find((f) => f.id === fieldId)?.label ?? 'Unknown'

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Conditional Logic</h3>
          <p className="text-[11px] text-gray-400 mt-0.5">
            Show or hide fields based on other field values
          </p>
        </div>
        <button
          onClick={addRule}
          disabled={fields.length < 2}
          className="flex items-center gap-1.5 text-xs bg-[#51459d] text-white px-3 py-1.5 rounded-[8px] hover:bg-[#3d3480] disabled:opacity-50 transition-colors"
        >
          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Rule
        </button>
      </div>

      {rules.length === 0 ? (
        <div className="text-center py-6 bg-gray-50 dark:bg-gray-950 rounded-[10px] border border-dashed border-gray-200 dark:border-gray-700">
          <svg className="h-6 w-6 text-gray-300 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 9l4-4 4 4m0 6l-4 4-4-4" />
          </svg>
          <p className="text-xs text-gray-400">No rules configured</p>
        </div>
      ) : (
        <div className="space-y-2">
          {rules.map((rule) => {
            const isExpanded = expandedRule === rule.id
            return (
              <div
                key={rule.id}
                className="border border-gray-200 dark:border-gray-700 rounded-[10px] bg-white dark:bg-gray-800 overflow-hidden"
              >
                {/* Rule header */}
                <div
                  className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  onClick={() => setExpandedRule(isExpanded ? null : rule.id)}
                >
                  <div className="flex items-center gap-2 text-xs">
                    <span className={`px-1.5 py-0.5 rounded font-medium ${rule.action === 'show' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {rule.action.toUpperCase()}
                    </span>
                    <span className="text-gray-600 dark:text-gray-400">
                      "{getFieldLabel(rule.targetFieldId)}"
                    </span>
                    <span className="text-gray-400">when</span>
                    <span className="text-gray-600 dark:text-gray-400">
                      {rule.conditions.length} condition{rule.conditions.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={(e) => { e.stopPropagation(); removeRule(rule.id) }}
                      className="p-1 text-gray-300 hover:text-red-500 rounded transition-colors"
                    >
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                    <svg
                      className={`h-4 w-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                      fill="none" viewBox="0 0 24 24" stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>

                {/* Rule body */}
                {isExpanded && (
                  <div className="px-4 pb-4 border-t border-gray-100 dark:border-gray-800 pt-3 space-y-3">
                    {/* Target field + action */}
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] font-medium text-gray-500 mb-1">Action</label>
                        <select
                          value={rule.action}
                          onChange={(e) => updateRule(rule.id, { action: e.target.value as 'show' | 'hide' })}
                          className="w-full px-2.5 py-1.5 text-xs border border-gray-200 dark:border-gray-700 rounded-[8px] bg-white dark:bg-gray-800 focus:outline-none focus:border-[#51459d]"
                        >
                          <option value="show">Show field</option>
                          <option value="hide">Hide field</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] font-medium text-gray-500 mb-1">Target Field</label>
                        <select
                          value={rule.targetFieldId}
                          onChange={(e) => updateRule(rule.id, { targetFieldId: e.target.value })}
                          className="w-full px-2.5 py-1.5 text-xs border border-gray-200 dark:border-gray-700 rounded-[8px] bg-white dark:bg-gray-800 focus:outline-none focus:border-[#51459d]"
                        >
                          {fields.map((f) => (
                            <option key={f.id} value={f.id}>{f.label}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Logic toggle */}
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-gray-500">Match</span>
                      <div className="flex border border-gray-200 dark:border-gray-700 rounded-[6px] overflow-hidden">
                        {(['all', 'any'] as const).map((l) => (
                          <button
                            key={l}
                            onClick={() => updateRule(rule.id, { logic: l })}
                            className={`px-2.5 py-1 text-[10px] font-medium transition-colors ${
                              rule.logic === l ? 'bg-[#51459d] text-white' : 'text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700'
                            }`}
                          >
                            {l.toUpperCase()}
                          </button>
                        ))}
                      </div>
                      <span className="text-[10px] text-gray-500">conditions</span>
                    </div>

                    {/* Conditions */}
                    {rule.conditions.map((cond, idx) => (
                      <div key={idx} className="flex items-end gap-2 bg-gray-50 dark:bg-gray-950 p-2.5 rounded-[8px]">
                        <div className="flex-1">
                          <label className="block text-[10px] text-gray-500 mb-1">Field</label>
                          <select
                            value={cond.fieldId}
                            onChange={(e) => updateCondition(rule.id, idx, { fieldId: e.target.value })}
                            className="w-full px-2 py-1.5 text-xs border border-gray-200 dark:border-gray-700 rounded-[6px] bg-white dark:bg-gray-800 focus:outline-none focus:border-[#51459d]"
                          >
                            {fields.filter((f) => f.id !== rule.targetFieldId).map((f) => (
                              <option key={f.id} value={f.id}>{f.label}</option>
                            ))}
                          </select>
                        </div>
                        <div className="flex-1">
                          <label className="block text-[10px] text-gray-500 mb-1">Operator</label>
                          <select
                            value={cond.operator}
                            onChange={(e) => updateCondition(rule.id, idx, { operator: e.target.value as ConditionEntry['operator'] })}
                            className="w-full px-2 py-1.5 text-xs border border-gray-200 dark:border-gray-700 rounded-[6px] bg-white dark:bg-gray-800 focus:outline-none focus:border-[#51459d]"
                          >
                            {OPERATORS.map((op) => (
                              <option key={op.value} value={op.value}>{op.label}</option>
                            ))}
                          </select>
                        </div>
                        {VALUE_OPERATORS.has(cond.operator) && (
                          <div className="flex-1">
                            <label className="block text-[10px] text-gray-500 mb-1">Value</label>
                            <input
                              value={cond.value}
                              onChange={(e) => updateCondition(rule.id, idx, { value: e.target.value })}
                              placeholder="Value"
                              className="w-full px-2 py-1.5 text-xs border border-gray-200 dark:border-gray-700 rounded-[6px] focus:outline-none focus:border-[#51459d]"
                            />
                          </div>
                        )}
                        {rule.conditions.length > 1 && (
                          <button
                            onClick={() => removeCondition(rule.id, idx)}
                            className="p-1.5 text-gray-300 hover:text-red-500 rounded transition-colors shrink-0"
                          >
                            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        )}
                      </div>
                    ))}

                    <button
                      onClick={() => addCondition(rule.id)}
                      className="text-xs text-[#51459d] hover:underline"
                    >
                      + Add condition
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
