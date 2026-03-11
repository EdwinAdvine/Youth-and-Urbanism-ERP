import { useState } from 'react'
import { Card, Button, Input, Select, Badge, Modal, Spinner, toast } from '@/components/ui'
import {
  useOnboardingTemplates,
  useCreateOnboardingTemplate,
  useUpdateOnboardingTemplate,
  useDeleteOnboardingTemplate,
  useStartOnboarding,
  useOffboardEmployee,
  type OnboardingTemplate,
} from '@/api/hr_engagement'

// ─── Types ────────────────────────────────────────────────────────────────────

type TemplateType = OnboardingTemplate['template_type']
type TaskCategory = 'it_setup' | 'paperwork' | 'training' | 'access' | 'equipment'

interface DraftTask {
  localId: string
  title: string
  category: TaskCategory
  due_days_offset: number
  assigned_to: string
}

const CATEGORY_OPTIONS: { value: TaskCategory; label: string }[] = [
  { value: 'it_setup',   label: 'IT Setup' },
  { value: 'paperwork',  label: 'Paperwork' },
  { value: 'training',   label: 'Training' },
  { value: 'access',     label: 'Access & Permissions' },
  { value: 'equipment',  label: 'Equipment' },
]

const CATEGORY_COLORS: Record<TaskCategory, string> = {
  it_setup:  'bg-blue-100 text-blue-700',
  paperwork: 'bg-amber-100 text-amber-700',
  training:  'bg-purple-100 text-purple-700',
  access:    'bg-cyan-100 text-cyan-700',
  equipment: 'bg-green-100 text-green-700',
}

// ─── Task Builder Row ─────────────────────────────────────────────────────────

function TaskRow({
  task,
  onChange,
  onRemove,
}: {
  task: DraftTask
  onChange: (updated: DraftTask) => void
  onRemove: () => void
}) {
  return (
    <div className="grid grid-cols-12 gap-2 items-end">
      <div className="col-span-4">
        <Input
          placeholder="Task title"
          value={task.title}
          onChange={(e) => onChange({ ...task, title: e.target.value })}
        />
      </div>
      <div className="col-span-3">
        <Select
          value={task.category}
          onChange={(e) => onChange({ ...task, category: e.target.value as TaskCategory })}
          options={CATEGORY_OPTIONS}
        />
      </div>
      <div className="col-span-2">
        <Input
          type="number"
          placeholder="Days"
          value={task.due_days_offset}
          onChange={(e) => onChange({ ...task, due_days_offset: Number(e.target.value) })}
          title="Due days offset from start date"
        />
      </div>
      <div className="col-span-2">
        <Input
          placeholder="Assignee ID"
          value={task.assigned_to}
          onChange={(e) => onChange({ ...task, assigned_to: e.target.value })}
        />
      </div>
      <div className="col-span-1 flex justify-end">
        <Button variant="ghost" size="sm" onClick={onRemove}>
          <svg className="h-4 w-4 text-danger" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </Button>
      </div>
    </div>
  )
}

// ─── Create/Edit Template Modal ───────────────────────────────────────────────

interface TemplateFormModalProps {
  open: boolean
  onClose: () => void
  initial?: OnboardingTemplate | null
}

function TemplateFormModal({ open, onClose, initial }: TemplateFormModalProps) {
  const createTemplate = useCreateOnboardingTemplate()
  const updateTemplate = useUpdateOnboardingTemplate()

  const [name, setName]               = useState(initial?.name ?? '')
  const [templateType, setType]       = useState<TemplateType>(initial?.template_type ?? 'onboarding')
  const [department, setDept]         = useState(initial?.department_id ?? '')
  const [description, setDesc]        = useState(initial?.description ?? '')
  const [tasks, setTasks]             = useState<DraftTask[]>(
    initial?.tasks?.map((t) => ({
      localId:        t.id,
      title:          t.title,
      category:       (t.category as TaskCategory) ?? 'it_setup',
      due_days_offset: 0,
      assigned_to:    t.assigned_to ?? '',
    })) ?? []
  )

  function addTask() {
    setTasks((p) => [
      ...p,
      {
        localId:        crypto.randomUUID(),
        title:          '',
        category:       'it_setup',
        due_days_offset: tasks.length + 1,
        assigned_to:    '',
      },
    ])
  }

  function updateTask(localId: string, updated: DraftTask) {
    setTasks((p) => p.map((t) => (t.localId === localId ? updated : t)))
  }

  function removeTask(localId: string) {
    setTasks((p) => p.filter((t) => t.localId !== localId))
  }

  async function handleSubmit() {
    if (!name.trim()) { toast('error', 'Template name is required'); return }

    const payload = {
      name:           name.trim(),
      template_type:  templateType,
      department_id:  department.trim() || null,
      description:    description.trim() || null,
      is_active:      true,
      tasks:          tasks
        .filter((t) => t.title.trim())
        .map((t, i) => ({
          id:              t.localId,
          template_id:     initial?.id ?? null,
          employee_id:     null,
          task_type:       templateType,
          title:           t.title.trim(),
          description:     null,
          category:        t.category,
          assigned_to:     t.assigned_to.trim() || null,
          due_date:        null,
          status:          'pending' as const,
          completed_at:    null,
          order_index:     i,
        })),
    }

    try {
      if (initial) {
        await updateTemplate.mutateAsync({ id: initial.id, ...payload })
        toast('success', 'Template updated')
      } else {
        await createTemplate.mutateAsync(payload)
        toast('success', 'Template created')
      }
      onClose()
    } catch {
      toast('error', 'Failed to save template')
    }
  }

  const isBusy = createTemplate.isPending || updateTemplate.isPending

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initial ? 'Edit Template' : 'Create Template'}
      size="xl"
    >
      <div className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input
            label="Template Name"
            placeholder="e.g., Engineering Onboarding"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Select
            label="Type"
            value={templateType}
            onChange={(e) => setType(e.target.value as TemplateType)}
            options={[
              { value: 'onboarding',  label: 'Onboarding' },
              { value: 'offboarding', label: 'Offboarding' },
            ]}
          />
          <Input
            label="Department ID (optional)"
            placeholder="dept-001"
            value={department}
            onChange={(e) => setDept(e.target.value)}
          />
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Description
            </label>
            <textarea
              className="w-full rounded-[10px] border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary resize-none"
              rows={2}
              placeholder="Optional description"
              value={description}
              onChange={(e) => setDesc(e.target.value)}
            />
          </div>
        </div>

        {/* Task Builder */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              Tasks ({tasks.length})
            </h3>
            <Button variant="outline" size="sm" onClick={addTask}>
              + Add Task
            </Button>
          </div>

          {tasks.length > 0 && (
            <div className="grid grid-cols-12 gap-2 px-0">
              <div className="col-span-4 text-xs font-medium text-gray-500 uppercase tracking-wide">Title</div>
              <div className="col-span-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Category</div>
              <div className="col-span-2 text-xs font-medium text-gray-500 uppercase tracking-wide">Due (days)</div>
              <div className="col-span-2 text-xs font-medium text-gray-500 uppercase tracking-wide">Assignee</div>
              <div className="col-span-1" />
            </div>
          )}

          {tasks.length === 0 ? (
            <div className="rounded-[10px] border-2 border-dashed border-gray-200 dark:border-gray-700 py-6 text-center text-sm text-gray-400">
              No tasks yet. Click "Add Task" to build the checklist.
            </div>
          ) : (
            <div className="space-y-2">
              {tasks.map((task) => (
                <TaskRow
                  key={task.localId}
                  task={task}
                  onChange={(u) => updateTask(task.localId, u)}
                  onRemove={() => removeTask(task.localId)}
                />
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-gray-100 dark:border-gray-700">
          <Button variant="secondary" onClick={onClose} disabled={isBusy}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} loading={isBusy}>
            {initial ? 'Save Changes' : 'Create Template'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

// ─── Use Template Modal ───────────────────────────────────────────────────────

interface UseTemplateModalProps {
  open: boolean
  template: OnboardingTemplate | null
  onClose: () => void
}

function UseTemplateModal({ open, template, onClose }: UseTemplateModalProps) {
  const startOnboarding  = useStartOnboarding()
  const offboardEmployee = useOffboardEmployee()

  const [employeeId, setEmployeeId] = useState('')

  async function handleUse() {
    if (!employeeId.trim() || !template) { toast('error', 'Employee ID is required'); return }
    try {
      if (template.template_type === 'onboarding') {
        await startOnboarding.mutateAsync({ id: employeeId.trim(), template_id: template.id })
        toast('success', 'Onboarding started successfully')
      } else {
        await offboardEmployee.mutateAsync({ id: employeeId.trim(), template_id: template.id })
        toast('success', 'Offboarding started successfully')
      }
      setEmployeeId('')
      onClose()
    } catch {
      toast('error', 'Failed to start process')
    }
  }

  const isBusy = startOnboarding.isPending || offboardEmployee.isPending

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Use Template: ${template?.name ?? ''}`}
      size="sm"
    >
      <div className="space-y-4">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          This will create tasks from the{' '}
          <strong>{template?.name}</strong> template for the selected employee.
        </p>
        <Input
          label="Employee ID"
          placeholder="emp-001"
          value={employeeId}
          onChange={(e) => setEmployeeId(e.target.value)}
        />
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={isBusy}>
            Cancel
          </Button>
          <Button onClick={handleUse} loading={isBusy}>
            Start {template?.template_type === 'onboarding' ? 'Onboarding' : 'Offboarding'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

// ─── Template Card ────────────────────────────────────────────────────────────

interface TemplateCardProps {
  template: OnboardingTemplate
  onEdit: () => void
  onDelete: () => void
  onUse: () => void
  onToggleActive: () => void
}

function TemplateCard({ template, onEdit, onDelete, onUse, onToggleActive }: TemplateCardProps) {
  const taskCount = template.tasks?.length ?? 0

  return (
    <Card className="hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100 truncate">
              {template.name}
            </h3>
            <Badge variant={template.template_type === 'onboarding' ? 'primary' : 'warning'} className="capitalize">
              {template.template_type}
            </Badge>
            <Badge variant={template.is_active ? 'success' : 'default'}>
              {template.is_active ? 'Active' : 'Inactive'}
            </Badge>
          </div>
          {template.department_id && (
            <p className="text-xs text-gray-400 mb-1">Dept: {template.department_id}</p>
          )}
          {template.description && (
            <p className="text-sm text-gray-500 dark:text-gray-400 text-sm leading-snug mb-2">
              {template.description}
            </p>
          )}
          <p className="text-xs text-gray-400">{taskCount} task{taskCount !== 1 ? 's' : ''}</p>
        </div>

        {/* Active toggle */}
        <button
          onClick={onToggleActive}
          className="mt-1 flex-shrink-0"
          title={template.is_active ? 'Deactivate' : 'Activate'}
        >
          <div
            className={`relative h-5 w-9 rounded-full transition-colors ${
              template.is_active ? 'bg-primary' : 'bg-gray-200 dark:bg-gray-600'
            }`}
          >
            <div
              className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${
                template.is_active ? 'translate-x-4' : 'translate-x-0.5'
              }`}
            />
          </div>
        </button>
      </div>

      {/* Actions */}
      <div className="mt-4 flex gap-2 flex-wrap">
        <Button size="sm" onClick={onUse}>
          Use Template
        </Button>
        <Button variant="outline" size="sm" onClick={onEdit}>
          Edit
        </Button>
        <Button variant="ghost" size="sm" onClick={onDelete} className="text-danger hover:text-danger">
          Delete
        </Button>
      </div>
    </Card>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function OnboardingTemplatesPage() {
  const [activeTab, setTab]         = useState<TemplateType>('onboarding')
  const [createOpen, setCreateOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<OnboardingTemplate | null>(null)
  const [useTarget, setUseTarget]   = useState<OnboardingTemplate | null>(null)

  const { data, isLoading }    = useOnboardingTemplates({ template_type: activeTab })
  const updateTemplate         = useUpdateOnboardingTemplate()
  const deleteTemplate         = useDeleteOnboardingTemplate()

  const templates = data?.items ?? []

  function handleToggleActive(template: OnboardingTemplate) {
    updateTemplate.mutate(
      { id: template.id, is_active: !template.is_active },
      {
        onSuccess: () => toast('success', `Template ${template.is_active ? 'deactivated' : 'activated'}`),
        onError:   () => toast('error', 'Failed to update'),
      }
    )
  }

  function handleDelete(id: string) {
    if (!confirm('Delete this template?')) return
    deleteTemplate.mutate(id, {
      onSuccess: () => toast('success', 'Template deleted'),
      onError:   () => toast('error', 'Failed to delete'),
    })
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Onboarding Templates
          </h1>
          <p className="text-sm text-gray-500">
            Manage reusable task checklists for onboarding and offboarding
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          + Create Template
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-[10px] bg-gray-100 dark:bg-gray-800 p-1 w-fit">
        {(['onboarding', 'offboarding'] as TemplateType[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setTab(tab)}
            className={`rounded-[8px] px-5 py-2 text-sm font-medium transition-colors capitalize ${
              activeTab === tab
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm'
                : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Template Grid */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Spinner size="lg" />
        </div>
      ) : templates.length === 0 ? (
        <Card>
          <div className="flex flex-col items-center justify-center py-14 text-center">
            <svg className="mb-3 h-12 w-12 text-gray-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <p className="text-gray-500 mb-3">No {activeTab} templates yet</p>
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              Create First Template
            </Button>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {templates.map((template) => (
            <TemplateCard
              key={template.id}
              template={template}
              onEdit={() => setEditTarget(template)}
              onDelete={() => handleDelete(template.id)}
              onUse={() => setUseTarget(template)}
              onToggleActive={() => handleToggleActive(template)}
            />
          ))}
        </div>
      )}

      {/* Create Modal */}
      <TemplateFormModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
      />

      {/* Edit Modal */}
      {editTarget && (
        <TemplateFormModal
          open={Boolean(editTarget)}
          initial={editTarget}
          onClose={() => setEditTarget(null)}
        />
      )}

      {/* Use Template Modal */}
      <UseTemplateModal
        open={Boolean(useTarget)}
        template={useTarget}
        onClose={() => setUseTarget(null)}
      />
    </div>
  )
}
