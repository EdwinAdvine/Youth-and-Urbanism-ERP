import { useState, useEffect } from 'react'
import apiClient from '@/api/client'

interface ApprovalStep {
  name: string
  approver_type: 'specific_user' | 'role' | 'form_owner' | 'any_admin'
  approver_value: string
  order: number
  escalation_hours: number
  allow_parallel: boolean
}

interface WorkflowData {
  id?: string
  steps: ApprovalStep[]
  is_active: boolean
  current_step: number
}

interface FormApprovalWorkflowBuilderProps {
  formId: string
}

const APPROVER_TYPES = [
  { value: 'form_owner', label: 'Form Owner' },
  { value: 'any_admin', label: 'Any Admin' },
  { value: 'role', label: 'By Role' },
  { value: 'specific_user', label: 'Specific User (email)' },
]

const EMPTY_STEP: ApprovalStep = {
  name: '',
  approver_type: 'form_owner',
  approver_value: '',
  order: 0,
  escalation_hours: 48,
  allow_parallel: false,
}

export default function FormApprovalWorkflowBuilder({ formId }: FormApprovalWorkflowBuilderProps) {
  const [workflow, setWorkflow] = useState<WorkflowData | null>(null)
  const [steps, setSteps] = useState<ApprovalStep[]>([])
  const [isActive, setIsActive] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savedMsg, setSavedMsg] = useState(false)

  useEffect(() => {
    async function load() {
      try {
        const res = await apiClient.get<WorkflowData>(`/forms/${formId}/approval-workflow`)
        if (res.data) {
          setWorkflow(res.data)
          setSteps(res.data.steps || [])
          setIsActive(res.data.is_active ?? false)
        }
      } catch {
        // No workflow yet
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [formId])

  function addStep() {
    setSteps((prev) => [...prev, { ...EMPTY_STEP, order: prev.length }])
  }

  function removeStep(idx: number) {
    setSteps((prev) => prev.filter((_, i) => i !== idx).map((s, i) => ({ ...s, order: i })))
  }

  function updateStep(idx: number, patch: Partial<ApprovalStep>) {
    setSteps((prev) => prev.map((s, i) => (i === idx ? { ...s, ...patch } : s)))
  }

  function moveStep(idx: number, dir: -1 | 1) {
    const next = idx + dir
    if (next < 0 || next >= steps.length) return
    const arr = [...steps]
    ;[arr[idx], arr[next]] = [arr[next], arr[idx]]
    setSteps(arr.map((s, i) => ({ ...s, order: i })))
  }

  async function handleSave() {
    setSaving(true)
    try {
      const payload = { steps, is_active: isActive }
      if (workflow?.id) {
        await apiClient.put(`/forms/${formId}/approval-workflow`, payload)
      } else {
        const res = await apiClient.post(`/forms/${formId}/approval-workflow`, payload)
        setWorkflow(res.data)
      }
      setSavedMsg(true)
      setTimeout(() => setSavedMsg(false), 2500)
    } catch {
      // ignore
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-10" style={{ fontFamily: 'Open Sans, sans-serif' }}>
        <div
          className="h-7 w-7 rounded-full border-4 animate-spin"
          style={{ borderColor: '#51459d', borderTopColor: 'transparent' }}
        />
      </div>
    )
  }

  return (
    <div className="space-y-6" style={{ fontFamily: 'Open Sans, sans-serif' }}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            Approval Workflow Builder
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Define multi-step approvals for form responses
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Active toggle */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 dark:text-gray-400">Active</span>
            <button
              type="button"
              role="switch"
              aria-checked={isActive}
              onClick={() => setIsActive((v) => !v)}
              className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ${
                isActive ? 'bg-[#51459d]' : 'bg-gray-200 dark:bg-gray-600'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transform transition duration-200 ${
                  isActive ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
          <button
            type="button"
            disabled={saving}
            onClick={handleSave}
            className="px-4 py-1.5 text-xs font-semibold text-white rounded-[8px] transition-opacity hover:opacity-90 disabled:opacity-50"
            style={{ backgroundColor: '#51459d' }}
          >
            {saving ? 'Saving…' : savedMsg ? 'Saved ✓' : 'Save Workflow'}
          </button>
        </div>
      </div>

      {/* Status badge */}
      {workflow?.id && (
        <div className="flex items-center gap-2 p-3 rounded-[8px] border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
          <span
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: isActive ? '#6fd943' : '#ffa21d' }}
          />
          <span className="text-xs text-gray-600 dark:text-gray-400">
            {isActive ? 'Workflow is active — responses require approval before processing' : 'Workflow saved but inactive'}
          </span>
        </div>
      )}

      {/* Steps */}
      <div className="space-y-3">
        {steps.length === 0 ? (
          <div className="text-center py-8 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-[10px]">
            <p className="text-sm text-gray-400 dark:text-gray-500 mb-3">No approval steps defined</p>
            <p className="text-xs text-gray-400 mb-4">Add steps to create a sequential approval chain</p>
            <button
              type="button"
              onClick={addStep}
              className="px-4 py-2 text-xs font-semibold text-white rounded-[8px]"
              style={{ backgroundColor: '#51459d' }}
            >
              + Add First Step
            </button>
          </div>
        ) : (
          <>
            {steps.map((step, idx) => (
              <div
                key={idx}
                className="border border-gray-200 dark:border-gray-700 rounded-[10px] overflow-hidden"
              >
                {/* Step header */}
                <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
                  <span
                    className="w-5 h-5 rounded-full text-[10px] font-bold text-white flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: '#51459d' }}
                  >
                    {idx + 1}
                  </span>
                  <input
                    type="text"
                    value={step.name}
                    onChange={(e) => updateStep(idx, { name: e.target.value })}
                    placeholder={`Step ${idx + 1} name (e.g. Manager Review)`}
                    className="flex-1 bg-transparent text-xs font-medium text-gray-800 dark:text-gray-200 placeholder-gray-400 focus:outline-none"
                  />
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={() => moveStep(idx, -1)}
                      className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                      title="Move up"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      disabled={idx === steps.length - 1}
                      onClick={() => moveStep(idx, 1)}
                      className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                      title="Move down"
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      onClick={() => removeStep(idx)}
                      className="p-1 text-red-400 hover:text-red-600"
                      title="Remove step"
                    >
                      ✕
                    </button>
                  </div>
                </div>

                {/* Step config */}
                <div className="p-3 grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase mb-1">
                      Approver Type
                    </label>
                    <select
                      value={step.approver_type}
                      onChange={(e) => updateStep(idx, { approver_type: e.target.value as ApprovalStep['approver_type'] })}
                      className="w-full px-2.5 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded-[6px] bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-[#51459d]"
                    >
                      {APPROVER_TYPES.map((t) => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </select>
                  </div>

                  {(step.approver_type === 'role' || step.approver_type === 'specific_user') && (
                    <div>
                      <label className="block text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase mb-1">
                        {step.approver_type === 'role' ? 'Role Name' : 'User Email'}
                      </label>
                      <input
                        type="text"
                        value={step.approver_value}
                        onChange={(e) => updateStep(idx, { approver_value: e.target.value })}
                        placeholder={step.approver_type === 'role' ? 'e.g. finance_admin' : 'approver@company.com'}
                        className="w-full px-2.5 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded-[6px] bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-[#51459d]"
                      />
                    </div>
                  )}

                  <div>
                    <label className="block text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase mb-1">
                      Escalate After (hours)
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={step.escalation_hours}
                      onChange={(e) => updateStep(idx, { escalation_hours: Number(e.target.value) })}
                      className="w-full px-2.5 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded-[6px] bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-[#51459d]"
                    />
                  </div>

                  <div className="flex items-center gap-2 pt-4">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={step.allow_parallel}
                      onClick={() => updateStep(idx, { allow_parallel: !step.allow_parallel })}
                      className={`relative inline-flex h-4 w-8 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ${
                        step.allow_parallel ? 'bg-[#3ec9d6]' : 'bg-gray-200 dark:bg-gray-600'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-3 w-3 rounded-full bg-white shadow transform transition duration-200 ${
                          step.allow_parallel ? 'translate-x-4' : 'translate-x-0'
                        }`}
                      />
                    </button>
                    <span className="text-xs text-gray-600 dark:text-gray-400">Allow parallel with next</span>
                  </div>
                </div>
              </div>
            ))}

            <button
              type="button"
              onClick={addStep}
              className="w-full py-2 text-xs font-medium border-2 border-dashed border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 rounded-[10px] hover:border-[#51459d] hover:text-[#51459d] transition-colors"
            >
              + Add Step
            </button>
          </>
        )}
      </div>

      {/* Flow preview */}
      {steps.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase mb-2">
            Workflow Preview
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <div className="px-2 py-1 text-[10px] rounded-[6px] bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400">
              Response Submitted
            </div>
            {steps.map((step, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <span className="text-gray-400 text-xs">→</span>
                <div
                  className="px-2 py-1 text-[10px] font-medium rounded-[6px] text-white"
                  style={{ backgroundColor: '#51459d' }}
                >
                  {step.name || `Step ${idx + 1}`}
                  <span className="ml-1 opacity-70 text-[9px]">
                    ({APPROVER_TYPES.find((t) => t.value === step.approver_type)?.label})
                  </span>
                </div>
              </div>
            ))}
            <span className="text-gray-400 text-xs">→</span>
            <div className="px-2 py-1 text-[10px] rounded-[6px] bg-[#6fd943]/20 text-[#6fd943] font-medium">
              Approved ✓
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
