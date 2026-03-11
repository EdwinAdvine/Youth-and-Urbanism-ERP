import { Input, Select, cn } from '@/components/ui'

interface StepData {
  step_type: string
  delay_days: number
  delay_hours: number
  config: Record<string, any> | null
  [key: string]: any
}

interface SequenceStepEditorProps {
  value: StepData
  onChange: (value: StepData) => void
  className?: string
}

const STEP_TYPES = [
  { value: 'email', label: 'Send Email' },
  { value: 'wait', label: 'Wait / Delay' },
  { value: 'task', label: 'Create Task' },
  { value: 'condition', label: 'Condition Check' },
]

export default function SequenceStepEditor({ value, onChange, className }: SequenceStepEditorProps) {
  const updateField = <K extends keyof StepData>(key: K, val: StepData[K]) => {
    onChange({ ...value, [key]: val })
  }

  const updateConfig = (key: string, val: any) => {
    onChange({
      ...value,
      config: { ...(value.config ?? {}), [key]: val },
    })
  }

  return (
    <div className={cn('space-y-4', className)}>
      <Select
        label="Step Type"
        required
        value={value.step_type}
        onChange={(e) => updateField('step_type', e.target.value)}
        options={STEP_TYPES}
      />

      <div className="grid grid-cols-2 gap-4">
        <Input
          label="Delay Days"
          type="number"
          min={0}
          value={value.delay_days}
          onChange={(e) => updateField('delay_days', parseInt(e.target.value) || 0)}
        />
        <Input
          label="Delay Hours"
          type="number"
          min={0}
          max={23}
          value={value.delay_hours}
          onChange={(e) => updateField('delay_hours', parseInt(e.target.value) || 0)}
        />
      </div>

      {/* Type-specific config */}
      {value.step_type === 'email' && (
        <div className="space-y-3 p-3 border border-gray-200 dark:border-gray-700 rounded-[10px] bg-gray-50 dark:bg-gray-900">
          <p className="text-xs font-semibold text-gray-500 uppercase">Email Configuration</p>
          <Input
            label="Template ID"
            value={value.config?.template_id ?? ''}
            onChange={(e) => updateConfig('template_id', e.target.value)}
            placeholder="Enter email template ID"
          />
          <Input
            label="Subject Override (optional)"
            value={value.config?.subject_override ?? ''}
            onChange={(e) => updateConfig('subject_override', e.target.value || undefined)}
            placeholder="Leave blank to use template subject"
          />
        </div>
      )}

      {value.step_type === 'wait' && (
        <div className="p-3 border border-gray-200 dark:border-gray-700 rounded-[10px] bg-gray-50 dark:bg-gray-900">
          <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Wait Configuration</p>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            This step will pause the sequence for the specified delay before proceeding to the next step.
          </p>
        </div>
      )}

      {value.step_type === 'task' && (
        <div className="space-y-3 p-3 border border-gray-200 dark:border-gray-700 rounded-[10px] bg-gray-50 dark:bg-gray-900">
          <p className="text-xs font-semibold text-gray-500 uppercase">Task Configuration</p>
          <Input
            label="Task Title"
            value={value.config?.title ?? ''}
            onChange={(e) => updateConfig('title', e.target.value)}
            placeholder="e.g. Follow up call"
          />
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Description
            </label>
            <textarea
              className="w-full rounded-[10px] border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              rows={2}
              value={value.config?.description ?? ''}
              onChange={(e) => updateConfig('description', e.target.value)}
              placeholder="Task description..."
            />
          </div>
          <Input
            label="Assign To (User ID)"
            value={value.config?.assign_to ?? ''}
            onChange={(e) => updateConfig('assign_to', e.target.value || undefined)}
            placeholder="Optional"
          />
        </div>
      )}

      {value.step_type === 'condition' && (
        <div className="space-y-3 p-3 border border-gray-200 dark:border-gray-700 rounded-[10px] bg-gray-50 dark:bg-gray-900">
          <p className="text-xs font-semibold text-gray-500 uppercase">Condition Configuration</p>
          <Input
            label="Field to Check"
            value={value.config?.check_field ?? ''}
            onChange={(e) => updateConfig('check_field', e.target.value)}
            placeholder="e.g. email_opened"
          />
          <Select
            label="Operator"
            value={value.config?.operator ?? 'equals'}
            onChange={(e) => updateConfig('operator', e.target.value)}
            options={[
              { value: 'equals', label: 'Equals' },
              { value: 'not_equals', label: 'Not Equals' },
              { value: 'greater_than', label: 'Greater Than' },
              { value: 'less_than', label: 'Less Than' },
              { value: 'is_true', label: 'Is True' },
              { value: 'is_false', label: 'Is False' },
            ]}
          />
          <Input
            label="Expected Value"
            value={value.config?.expected_value ?? ''}
            onChange={(e) => updateConfig('expected_value', e.target.value)}
            placeholder="Value to compare against"
          />
        </div>
      )}
    </div>
  )
}
