import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Card, Button, Input, Select } from '../../../components/ui'
import { toast } from '../../../components/ui'
import {
  useWorkflow,
  useCreateWorkflow,
  useUpdateWorkflow,
  type WorkflowTriggerType,
  type WorkflowStepType,
  type WorkflowStep,
  type WorkflowStepConfig,
  type WorkflowTriggerConfig,
} from '../../../api/hr_phase3'

// ─── Types ────────────────────────────────────────────────────────────────────

interface WorkflowFormData {
  name: string
  description: string
  trigger_type: WorkflowTriggerType
  trigger_config: WorkflowTriggerConfig
  category: string
  is_template: boolean
  is_active: boolean
}

const defaultForm: WorkflowFormData = {
  name: '',
  description: '',
  trigger_type: 'manual',
  trigger_config: {},
  category: '',
  is_template: false,
  is_active: true,
}

const TRIGGER_OPTIONS: { value: WorkflowTriggerType; label: string }[] = [
  { value: 'employee_created', label: 'Employee Created' },
  { value: 'status_changed', label: 'Status Changed' },
  { value: 'date_based', label: 'Date Based' },
  { value: 'manual', label: 'Manual' },
  { value: 'goal_completed', label: 'Goal Completed' },
  { value: 'review_submitted', label: 'Review Submitted' },
]

const STEP_TYPE_OPTIONS: { value: WorkflowStepType; label: string }[] = [
  { value: 'send_notification', label: 'Send Notification' },
  { value: 'update_field', label: 'Update Field' },
  { value: 'create_task', label: 'Create Task' },
  { value: 'send_email', label: 'Send Email' },
  { value: 'require_approval', label: 'Require Approval' },
  { value: 'delay', label: 'Delay' },
  { value: 'condition', label: 'Condition' },
]

// ─── Toggle Switch ─────────────────────────────────────────────────────────────

function ToggleSwitch({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <label className="flex items-center gap-3 cursor-pointer">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={[
          'relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary/40',
          checked ? 'bg-[#51459d]' : 'bg-gray-200 dark:bg-gray-700',
        ].join(' ')}
      >
        <span
          className={[
            'pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow transition duration-200',
            checked ? 'translate-x-4' : 'translate-x-0',
          ].join(' ')}
        />
      </button>
      <span className="text-sm text-gray-700 dark:text-gray-300">{label}</span>
    </label>
  )
}

// ─── Trigger Config Fields ────────────────────────────────────────────────────

function TriggerConfigFields({
  triggerType,
  config,
  onChange,
}: {
  triggerType: WorkflowTriggerType
  config: WorkflowTriggerConfig
  onChange: (c: WorkflowTriggerConfig) => void
}) {
  if (triggerType === 'date_based') {
    return (
      <div className="space-y-3">
        <Input
          label="Days After Hire"
          type="number"
          min={0}
          value={config.days_after_hire ?? ''}
          onChange={(e) => onChange({ ...config, days_after_hire: Number(e.target.value) })}
          placeholder="e.g. 30"
        />
        <Input
          label="Date Field (optional)"
          value={config.date_field ?? ''}
          onChange={(e) => onChange({ ...config, date_field: e.target.value })}
          placeholder="e.g. probation_end_date"
        />
      </div>
    )
  }
  if (triggerType === 'status_changed') {
    return (
      <div className="space-y-3">
        <Input
          label="From Status"
          value={config.from_status ?? ''}
          onChange={(e) => onChange({ ...config, from_status: e.target.value })}
          placeholder="e.g. probation"
        />
        <Input
          label="To Status"
          value={config.to_status ?? ''}
          onChange={(e) => onChange({ ...config, to_status: e.target.value })}
          placeholder="e.g. permanent"
        />
      </div>
    )
  }
  if (triggerType === 'goal_completed') {
    return (
      <Input
        label="Goal Type (optional)"
        value={config.goal_type ?? ''}
        onChange={(e) => onChange({ ...config, goal_type: e.target.value })}
        placeholder="e.g. quarterly"
      />
    )
  }
  return (
    <p className="text-xs text-gray-400 dark:text-gray-500 italic">
      No additional configuration needed for this trigger.
    </p>
  )
}

// ─── Step Config Fields ───────────────────────────────────────────────────────

function StepConfigFields({
  stepType,
  config,
  onChange,
  stepCount,
}: {
  stepType: WorkflowStepType
  config: WorkflowStepConfig
  onChange: (c: WorkflowStepConfig) => void
  stepCount: number
}) {
  const stepOptions = Array.from({ length: stepCount }, (_, i) => ({
    value: String(i + 1),
    label: `Step ${i + 1}`,
  }))

  if (stepType === 'send_notification') {
    return (
      <div className="space-y-2">
        <Input
          label="Message"
          value={config.message ?? ''}
          onChange={(e) => onChange({ ...config, message: e.target.value })}
          placeholder="Notification message"
        />
        <Select
          label="Recipient"
          value={config.recipient_type ?? 'employee'}
          onChange={(e) => onChange({ ...config, recipient_type: e.target.value as WorkflowStepConfig['recipient_type'] })}
        >
          <option value="employee">Employee</option>
          <option value="manager">Manager</option>
          <option value="hr_team">HR Team</option>
        </Select>
      </div>
    )
  }
  if (stepType === 'create_task') {
    return (
      <div className="space-y-2">
        <Input
          label="Task Title"
          value={config.title ?? ''}
          onChange={(e) => onChange({ ...config, title: e.target.value })}
          placeholder="Task title"
        />
        <Input
          label="Assigned To (field)"
          value={config.assigned_to ?? ''}
          onChange={(e) => onChange({ ...config, assigned_to: e.target.value })}
          placeholder="e.g. manager_id"
        />
        <Input
          label="Due Days"
          type="number"
          min={1}
          value={config.due_days ?? ''}
          onChange={(e) => onChange({ ...config, due_days: Number(e.target.value) })}
          placeholder="e.g. 7"
        />
      </div>
    )
  }
  if (stepType === 'send_email') {
    return (
      <div className="space-y-2">
        <Input
          label="Subject"
          value={config.subject ?? ''}
          onChange={(e) => onChange({ ...config, subject: e.target.value })}
          placeholder="Email subject"
        />
        <Input
          label="Recipient Field"
          value={config.recipient_field ?? ''}
          onChange={(e) => onChange({ ...config, recipient_field: e.target.value })}
          placeholder="e.g. employee.email"
        />
        <Input
          label="Template ID (optional)"
          value={config.template_id ?? ''}
          onChange={(e) => onChange({ ...config, template_id: e.target.value })}
          placeholder="template-uuid"
        />
      </div>
    )
  }
  if (stepType === 'require_approval') {
    return (
      <div className="space-y-2">
        <Select
          label="Approver Type"
          value={config.approver_type ?? 'manager'}
          onChange={(e) => onChange({ ...config, approver_type: e.target.value as WorkflowStepConfig['approver_type'] })}
        >
          <option value="manager">Manager</option>
          <option value="hr_admin">HR Admin</option>
          <option value="specific_user">Specific User</option>
        </Select>
        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Instructions</label>
          <textarea
            className="w-full text-sm rounded-[10px] border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none"
            rows={2}
            value={config.instructions ?? ''}
            onChange={(e) => onChange({ ...config, instructions: e.target.value })}
            placeholder="Instructions for the approver..."
          />
        </div>
      </div>
    )
  }
  if (stepType === 'delay') {
    return (
      <div className="space-y-2">
        <Input
          label="Delay (days)"
          type="number"
          min={1}
          value={config.days ?? ''}
          onChange={(e) => onChange({ ...config, days: Number(e.target.value) })}
          placeholder="e.g. 3"
        />
        <Input
          label="Description (optional)"
          value={config.description ?? ''}
          onChange={(e) => onChange({ ...config, description: e.target.value })}
          placeholder="Why this delay exists"
        />
      </div>
    )
  }
  if (stepType === 'condition') {
    return (
      <div className="space-y-2">
        <Input
          label="Field"
          value={config.field ?? ''}
          onChange={(e) => onChange({ ...config, field: e.target.value })}
          placeholder="e.g. employee.department"
        />
        <Select
          label="Operator"
          value={config.operator ?? 'eq'}
          onChange={(e) => onChange({ ...config, operator: e.target.value as WorkflowStepConfig['operator'] })}
        >
          <option value="eq">Equals (=)</option>
          <option value="gt">Greater Than (&gt;)</option>
          <option value="lt">Less Than (&lt;)</option>
          <option value="contains">Contains</option>
        </Select>
        <Input
          label="Value"
          value={config.value ?? ''}
          onChange={(e) => onChange({ ...config, value: e.target.value })}
          placeholder="Comparison value"
        />
        <div className="grid grid-cols-2 gap-2">
          <Select
            label="If True → Step"
            value={String(config.true_next ?? '')}
            onChange={(e) => onChange({ ...config, true_next: Number(e.target.value) })}
          >
            <option value="">End</option>
            {stepOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </Select>
          <Select
            label="If False → Step"
            value={String(config.false_next ?? '')}
            onChange={(e) => onChange({ ...config, false_next: Number(e.target.value) })}
          >
            <option value="">End</option>
            {stepOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </Select>
        </div>
      </div>
    )
  }
  if (stepType === 'update_field') {
    return (
      <div className="space-y-2">
        <Input
          label="Field Name"
          value={config.field_name ?? ''}
          onChange={(e) => onChange({ ...config, field_name: e.target.value })}
          placeholder="e.g. employment_status"
        />
        <Input
          label="New Value"
          value={config.field_value ?? ''}
          onChange={(e) => onChange({ ...config, field_value: e.target.value })}
          placeholder="New field value"
        />
      </div>
    )
  }
  return null
}

// ─── Step Card ────────────────────────────────────────────────────────────────

function StepCard({
  step,
  index,
  total,
  onChange,
  onDelete,
}: {
  step: WorkflowStep
  index: number
  total: number
  onChange: (s: WorkflowStep) => void
  onDelete: () => void
}) {
  const stepTypeLabel = STEP_TYPE_OPTIONS.find((o) => o.value === step.step_type)?.label ?? step.step_type

  return (
    <div className="relative">
      {/* Connector line */}
      {index < total - 1 && (
        <div className="absolute left-5 top-full w-0.5 h-4 bg-gray-200 dark:bg-gray-700 z-10" />
      )}

      <Card>
        <div className="space-y-3">
          {/* Step header */}
          <div className="flex items-center gap-3">
            {/* Drag handle (visual only) */}
            <div className="flex flex-col gap-0.5 cursor-grab opacity-40 shrink-0">
              <span className="block w-4 h-0.5 bg-gray-400 rounded" />
              <span className="block w-4 h-0.5 bg-gray-400 rounded" />
              <span className="block w-4 h-0.5 bg-gray-400 rounded" />
            </div>

            {/* Step number */}
            <div className="w-7 h-7 rounded-full bg-[#51459d] text-white text-xs font-bold flex items-center justify-center shrink-0">
              {index + 1}
            </div>

            {/* Step type select */}
            <div className="flex-1">
              <Select
                value={step.step_type}
                onChange={(e) =>
                  onChange({ ...step, step_type: e.target.value as WorkflowStepType, config: {} })
                }
              >
                {STEP_TYPE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </Select>
            </div>

            {/* Delete button */}
            <button
              type="button"
              onClick={onDelete}
              className="p-1.5 rounded-[10px] text-gray-400 hover:text-[#ff3a6e] hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors shrink-0"
              title="Remove step"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Step name */}
          <Input
            placeholder={`Step name (e.g. ${stepTypeLabel})`}
            value={step.name ?? ''}
            onChange={(e) => onChange({ ...step, name: e.target.value })}
          />

          {/* Config fields */}
          <div className="bg-gray-50 dark:bg-gray-800/50 rounded-[10px] p-3">
            <StepConfigFields
              stepType={step.step_type}
              config={step.config}
              onChange={(c) => onChange({ ...step, config: c })}
              stepCount={total}
            />
          </div>
        </div>
      </Card>

      {/* Arrow connector */}
      {index < total - 1 && (
        <div className="flex justify-center my-1">
          <svg className="w-4 h-4 text-gray-300 dark:text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function WorkflowBuilderPage() {
  const navigate = useNavigate()
  const { id } = useParams<{ id?: string }>()
  const isEditing = !!id

  const { data: existing, isLoading: loadingExisting } = useWorkflow(id)
  const createWorkflow = useCreateWorkflow()
  const updateWorkflow = useUpdateWorkflow()

  const [form, setForm] = useState<WorkflowFormData>(defaultForm)
  const [steps, setSteps] = useState<WorkflowStep[]>([])

  // Populate form when editing
  useEffect(() => {
    if (existing) {
      setForm({
        name: existing.name,
        description: existing.description ?? '',
        trigger_type: existing.trigger_type,
        trigger_config: existing.trigger_config ?? {},
        category: existing.category ?? '',
        is_template: existing.is_template,
        is_active: existing.is_active,
      })
      setSteps(existing.steps ?? [])
    }
  }, [existing])

  function addStep() {
    const newStep: WorkflowStep = {
      step_order: steps.length + 1,
      step_type: 'send_notification',
      config: {},
      name: '',
    }
    setSteps((prev) => [...prev, newStep])
  }

  function updateStep(index: number, updated: WorkflowStep) {
    setSteps((prev) => prev.map((s, i) => (i === index ? { ...updated, step_order: i + 1 } : s)))
  }

  function deleteStep(index: number) {
    setSteps((prev) => prev.filter((_, i) => i !== index).map((s, i) => ({ ...s, step_order: i + 1 })))
  }

  function handleSave(asTemplate = false) {
    if (!form.name.trim()) {
      toast('error', 'Workflow name is required')
      return
    }

    const payload = {
      ...form,
      is_template: asTemplate ? true : form.is_template,
      steps: steps.map((s, i) => ({ ...s, step_order: i + 1 })),
    }

    if (isEditing && id) {
      updateWorkflow.mutate(
        { id, ...payload },
        {
          onSuccess: () => {
            toast('success', 'Workflow updated successfully')
            navigate('/hr/workflows')
          },
          onError: () => toast('error', 'Failed to update workflow'),
        }
      )
    } else {
      createWorkflow.mutate(payload, {
        onSuccess: () => {
          toast('success', asTemplate ? 'Workflow saved as template' : 'Workflow created successfully')
          navigate('/hr/workflows')
        },
        onError: () => toast('error', 'Failed to create workflow'),
      })
    }
  }

  const isSaving = createWorkflow.isPending || updateWorkflow.isPending

  if (isEditing && loadingExisting) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-48 bg-gray-200 dark:bg-gray-700 rounded" />
          <div className="grid grid-cols-3 gap-6">
            <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded-[10px]" />
            <div className="col-span-2 h-64 bg-gray-200 dark:bg-gray-700 rounded-[10px]" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {isEditing ? 'Edit Workflow' : 'New Workflow'}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            {isEditing ? `Editing: ${existing?.name ?? ''}` : 'Build an automated HR workflow step by step'}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left panel: Settings */}
        <div className="lg:col-span-1 space-y-4">
          <Card>
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <svg className="w-4 h-4 text-[#51459d]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Workflow Settings
            </h2>

            <div className="space-y-4">
              <Input
                label="Name *"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. New Employee Onboarding"
              />

              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
                <textarea
                  className="w-full text-sm rounded-[10px] border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none"
                  rows={3}
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="What does this workflow do?"
                />
              </div>

              <Select
                label="Trigger Type"
                value={form.trigger_type}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    trigger_type: e.target.value as WorkflowTriggerType,
                    trigger_config: {},
                  }))
                }
              >
                {TRIGGER_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </Select>

              {/* Trigger config */}
              <div className="bg-gray-50 dark:bg-gray-800/50 rounded-[10px] p-3 space-y-2">
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                  Trigger Configuration
                </p>
                <TriggerConfigFields
                  triggerType={form.trigger_type}
                  config={form.trigger_config}
                  onChange={(c) => setForm((f) => ({ ...f, trigger_config: c }))}
                />
              </div>

              <Input
                label="Category"
                value={form.category}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                placeholder="e.g. Onboarding, Offboarding"
              />

              <div className="space-y-3 pt-1">
                <ToggleSwitch
                  label="Active"
                  checked={form.is_active}
                  onChange={(v) => setForm((f) => ({ ...f, is_active: v }))}
                />
                <ToggleSwitch
                  label="Save as Template"
                  checked={form.is_template}
                  onChange={(v) => setForm((f) => ({ ...f, is_template: v }))}
                />
              </div>
            </div>
          </Card>
        </div>

        {/* Right panel: Step builder */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <svg className="w-4 h-4 text-[#51459d]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                </svg>
                Workflow Steps
                {steps.length > 0 && (
                  <span className="text-xs text-gray-400 font-normal">({steps.length} step{steps.length !== 1 ? 's' : ''})</span>
                )}
              </h2>
              <Button size="sm" onClick={addStep}>
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add Step
              </Button>
            </div>

            {steps.length === 0 ? (
              <div className="py-12 flex flex-col items-center justify-center text-center border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-[10px]">
                <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center mb-3">
                  <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                </div>
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">No steps yet</p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                  Click "Add Step" to build your workflow
                </p>
                <Button size="sm" className="mt-4" onClick={addStep}>
                  Add First Step
                </Button>
              </div>
            ) : (
              <div className="space-y-0">
                {steps.map((step, index) => (
                  <StepCard
                    key={index}
                    step={step}
                    index={index}
                    total={steps.length}
                    onChange={(updated) => updateStep(index, updated)}
                    onDelete={() => deleteStep(index)}
                  />
                ))}
              </div>
            )}
          </Card>

          {/* Bottom action bar */}
          <div className="flex items-center gap-3 justify-end flex-wrap">
            <Button variant="outline" onClick={() => navigate('/hr/workflows')}>
              Cancel
            </Button>
            <Button
              variant="secondary"
              loading={isSaving}
              onClick={() => handleSave(true)}
            >
              Save as Template
            </Button>
            <Button loading={isSaving} onClick={() => handleSave(false)}>
              {isEditing ? 'Update Workflow' : 'Create Workflow'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
