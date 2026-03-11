import { useState } from 'react'
import { Card, Button, Spinner, Table, Modal, Input, Select, Badge, toast } from '../../components/ui'
import {
  useSuccessionPlans,
  useCreateSuccessionPlan,
  useUpdateSuccessionPlan,
  useDeleteSuccessionPlan,
  type SuccessionPlan,
  type SuccessionPlanCreatePayload,
} from '../../api/hr_phase1'
import { useEmployees } from '../../api/hr'

const readinessVariant: Record<string, 'success' | 'info' | 'warning' | 'default'> = {
  ready_now: 'success',
  ready_1yr: 'info',
  ready_2yr: 'warning',
  developing: 'default',
}

const readinessLabels: Record<string, string> = {
  ready_now: 'Ready Now',
  ready_1yr: 'Ready 1 Year',
  ready_2yr: 'Ready 2 Years',
  developing: 'Developing',
}

const priorityVariant: Record<string, 'danger' | 'warning' | 'info' | 'default'> = {
  critical: 'danger',
  high: 'warning',
  medium: 'info',
  low: 'default',
}

const defaultForm: SuccessionPlanCreatePayload = {
  position_title: '',
  department_id: '',
  current_holder_id: '',
  successor_id: '',
  readiness: 'developing',
  priority: 'medium',
  development_notes: '',
}

export default function SuccessionPlanningPage() {
  const [departmentFilter, setDepartmentFilter] = useState('')
  const [priorityFilter, setPriorityFilter] = useState('')
  const [readinessFilter, setReadinessFilter] = useState('')

  const { data: plans, isLoading } = useSuccessionPlans({
    department_id: departmentFilter || undefined,
    priority: priorityFilter || undefined,
    readiness: readinessFilter || undefined,
  })
  const { data: empData } = useEmployees({ limit: 500 })
  const createPlan = useCreateSuccessionPlan()
  const updatePlan = useUpdateSuccessionPlan()
  const deletePlan = useDeleteSuccessionPlan()

  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<SuccessionPlan | null>(null)
  const [form, setForm] = useState<SuccessionPlanCreatePayload>(defaultForm)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null)

  const employees = empData?.items ?? []

  function openCreate() {
    setEditing(null)
    setForm(defaultForm)
    setShowModal(true)
  }

  function openEdit(plan: SuccessionPlan) {
    setEditing(plan)
    setForm({
      position_title: plan.position_title,
      department_id: plan.department_id,
      current_holder_id: plan.current_holder_id ?? '',
      successor_id: plan.successor_id,
      readiness: plan.readiness,
      priority: plan.priority,
      development_notes: plan.development_notes ?? '',
    })
    setShowModal(true)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (editing) {
      updatePlan.mutate(
        {
          planId: editing.id,
          data: {
            position_title: form.position_title,
            successor_id: form.successor_id,
            readiness: form.readiness,
            priority: form.priority,
            development_notes: form.development_notes,
          },
        },
        {
          onSuccess: () => { toast('success', 'Succession plan updated'); setShowModal(false) },
          onError: () => toast('error', 'Failed to update succession plan'),
        }
      )
    } else {
      const payload: SuccessionPlanCreatePayload = {
        ...form,
        current_holder_id: form.current_holder_id || undefined,
        development_notes: form.development_notes || undefined,
      }
      createPlan.mutate(payload, {
        onSuccess: () => { toast('success', 'Succession plan created'); setShowModal(false) },
        onError: () => toast('error', 'Failed to create succession plan'),
      })
    }
  }

  function handleDelete(planId: string) {
    deletePlan.mutate(planId, {
      onSuccess: () => { toast('success', 'Plan deleted'); setShowDeleteConfirm(null) },
      onError: () => toast('error', 'Failed to delete plan'),
    })
  }

  function getEmployeeName(id: string | null) {
    if (!id) return '-'
    const emp = employees.find((e: { id: string; first_name: string; last_name: string }) => e.id === id)
    return emp ? `${emp.first_name} ${emp.last_name}` : id
  }

  const columns = [
    {
      key: 'position_title',
      label: 'Position',
      render: (r: SuccessionPlan) => (
        <span className="font-medium text-gray-900 dark:text-gray-100">{r.position_title}</span>
      ),
    },
    {
      key: 'department_name',
      label: 'Department',
      render: (r: SuccessionPlan) => (
        <span className="text-gray-700 dark:text-gray-300">{r.department_name ?? r.department_id}</span>
      ),
    },
    {
      key: 'current_holder_id',
      label: 'Current Holder',
      render: (r: SuccessionPlan) => getEmployeeName(r.current_holder_id),
    },
    {
      key: 'successor_id',
      label: 'Successor',
      render: (r: SuccessionPlan) => (
        <span className="font-medium text-gray-900 dark:text-gray-100">{getEmployeeName(r.successor_id)}</span>
      ),
    },
    {
      key: 'readiness',
      label: 'Readiness',
      render: (r: SuccessionPlan) => (
        <Badge variant={readinessVariant[r.readiness] ?? 'default'}>
          {readinessLabels[r.readiness] ?? r.readiness}
        </Badge>
      ),
    },
    {
      key: 'priority',
      label: 'Priority',
      render: (r: SuccessionPlan) => (
        <Badge variant={priorityVariant[r.priority] ?? 'default'}>
          {r.priority}
        </Badge>
      ),
    },
    {
      key: 'actions',
      label: '',
      className: 'text-right',
      render: (r: SuccessionPlan) => (
        <div className="flex gap-1 justify-end">
          <Button variant="ghost" size="sm" onClick={() => openEdit(r)}>Edit</Button>
          <Button variant="ghost" size="sm" onClick={() => setShowDeleteConfirm(r.id)}>
            <span className="text-red-500">Delete</span>
          </Button>
        </div>
      ),
    },
  ]

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Spinner size="lg" />
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Succession Planning</h1>
          <p className="text-sm text-gray-500 mt-1">Manage succession plans for key positions</p>
        </div>
        <Button onClick={openCreate}>Add Succession Plan</Button>
      </div>

      <div className="flex gap-3 flex-wrap">
        <Select
          options={[
            { value: '', label: 'All Departments' },
          ]}
          value={departmentFilter}
          onChange={(e) => setDepartmentFilter(e.target.value)}
          className="w-48"
        />
        <Select
          options={[
            { value: '', label: 'All Priorities' },
            { value: 'critical', label: 'Critical' },
            { value: 'high', label: 'High' },
            { value: 'medium', label: 'Medium' },
            { value: 'low', label: 'Low' },
          ]}
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value)}
          className="w-48"
        />
        <Select
          options={[
            { value: '', label: 'All Readiness' },
            { value: 'ready_now', label: 'Ready Now' },
            { value: 'ready_1yr', label: 'Ready 1 Year' },
            { value: 'ready_2yr', label: 'Ready 2 Years' },
            { value: 'developing', label: 'Developing' },
          ]}
          value={readinessFilter}
          onChange={(e) => setReadinessFilter(e.target.value)}
          className="w-48"
        />
      </div>

      <Card padding={false}>
        <Table
          columns={columns}
          data={(plans as SuccessionPlan[]) ?? []}
          keyExtractor={(r) => r.id}
          emptyText="No succession plans found."
        />
      </Card>

      {/* Create / Edit Modal */}
      <Modal open={showModal} onClose={() => setShowModal(false)} title={editing ? 'Edit Succession Plan' : 'Create Succession Plan'} size="lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Position Title"
            required
            placeholder="e.g., VP of Engineering"
            value={form.position_title}
            onChange={(e) => setForm((p) => ({ ...p, position_title: e.target.value }))}
          />
          {!editing && (
            <Input
              label="Department ID"
              required
              placeholder="Department identifier"
              value={form.department_id}
              onChange={(e) => setForm((p) => ({ ...p, department_id: e.target.value }))}
            />
          )}
          <Select
            label="Current Holder"
            options={[
              { value: '', label: 'Select employee (optional)...' },
              ...employees.map((e: { id: string; first_name: string; last_name: string }) => ({
                value: e.id,
                label: `${e.first_name} ${e.last_name}`,
              })),
            ]}
            value={form.current_holder_id ?? ''}
            onChange={(e) => setForm((p) => ({ ...p, current_holder_id: e.target.value }))}
          />
          <Select
            label="Successor"
            required
            options={[
              { value: '', label: 'Select successor...' },
              ...employees.map((e: { id: string; first_name: string; last_name: string }) => ({
                value: e.id,
                label: `${e.first_name} ${e.last_name}`,
              })),
            ]}
            value={form.successor_id}
            onChange={(e) => setForm((p) => ({ ...p, successor_id: e.target.value }))}
          />
          <Select
            label="Readiness"
            options={[
              { value: 'ready_now', label: 'Ready Now' },
              { value: 'ready_1yr', label: 'Ready in 1 Year' },
              { value: 'ready_2yr', label: 'Ready in 2 Years' },
              { value: 'developing', label: 'Developing' },
            ]}
            value={form.readiness}
            onChange={(e) => setForm((p) => ({ ...p, readiness: e.target.value }))}
          />
          <Select
            label="Priority"
            options={[
              { value: 'critical', label: 'Critical' },
              { value: 'high', label: 'High' },
              { value: 'medium', label: 'Medium' },
              { value: 'low', label: 'Low' },
            ]}
            value={form.priority}
            onChange={(e) => setForm((p) => ({ ...p, priority: e.target.value }))}
          />
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Development Notes</label>
            <textarea
              className="w-full rounded-[10px] border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              rows={4}
              placeholder="Notes on development plan for successor..."
              value={form.development_notes ?? ''}
              onChange={(e) => setForm((p) => ({ ...p, development_notes: e.target.value }))}
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" type="button" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button type="submit" loading={createPlan.isPending || updatePlan.isPending}>
              {editing ? 'Update' : 'Create'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal open={!!showDeleteConfirm} onClose={() => setShowDeleteConfirm(null)} title="Delete Succession Plan" size="sm">
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Are you sure you want to delete this succession plan? This action cannot be undone.
        </p>
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setShowDeleteConfirm(null)}>Cancel</Button>
          <Button
            variant="danger"
            loading={deletePlan.isPending}
            onClick={() => showDeleteConfirm && handleDelete(showDeleteConfirm)}
          >
            Delete
          </Button>
        </div>
      </Modal>
    </div>
  )
}
