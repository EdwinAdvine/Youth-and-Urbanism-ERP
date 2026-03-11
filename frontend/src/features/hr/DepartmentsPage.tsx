import { useState } from 'react'
import { Card, Button, Spinner, Table, Modal, Input, Badge } from '../../components/ui'
import { toast } from '../../components/ui'
import {
  useDepartments,
  useCreateDepartment,
  useUpdateDepartment,
  useDeleteDepartment,
  type Department,
  type CreateDepartmentPayload,
} from '../../api/hr'

export default function DepartmentsPage() {
  const { data: departments, isLoading } = useDepartments()
  const createDept = useCreateDepartment()
  const updateDept = useUpdateDepartment()
  const deleteDept = useDeleteDepartment()

  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Department | null>(null)
  const [form, setForm] = useState<CreateDepartmentPayload>({ name: '', description: '' })

  function openCreate() {
    setEditing(null)
    setForm({ name: '', description: '' })
    setShowModal(true)
  }

  function openEdit(dept: Department) {
    setEditing(dept)
    setForm({ name: dept.name, description: dept.description, head_id: dept.head_id, parent_id: dept.parent_id })
    setShowModal(true)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (editing) {
      updateDept.mutate(
        { id: editing.id, ...form },
        {
          onSuccess: () => {
            toast('success', 'Department updated')
            setShowModal(false)
          },
          onError: () => toast('error', 'Failed to update department'),
        }
      )
    } else {
      createDept.mutate(form, {
        onSuccess: () => {
          toast('success', 'Department created')
          setShowModal(false)
        },
        onError: () => toast('error', 'Failed to create department'),
      })
    }
  }

  function handleDelete(id: string) {
    if (!window.confirm('Are you sure you want to delete this department?')) return
    deleteDept.mutate(id, {
      onSuccess: () => toast('success', 'Department deleted'),
      onError: () => toast('error', 'Failed to delete department'),
    })
  }

  const columns = [
    {
      key: 'name',
      label: 'Department',
      render: (d: Department) => (
        <div>
          <p className="font-medium text-gray-900">{d.name}</p>
          {d.description && <p className="text-xs text-gray-400 mt-0.5">{d.description}</p>}
        </div>
      ),
    },
    {
      key: 'head_name',
      label: 'Head',
      render: (d: Department) => d.head_name ?? <span className="text-gray-400">Unassigned</span>,
    },
    {
      key: 'employee_count',
      label: 'Employees',
      render: (d: Department) => <Badge variant="primary">{d.employee_count}</Badge>,
    },
    {
      key: 'created_at',
      label: 'Created',
      render: (d: Department) => new Date(d.created_at).toLocaleDateString(),
    },
    {
      key: 'actions',
      label: '',
      className: 'text-right',
      render: (d: Department) => (
        <div className="flex items-center justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => openEdit(d)}>
            Edit
          </Button>
          <Button variant="ghost" size="sm" className="text-danger" onClick={() => handleDelete(d.id)}>
            Delete
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
          <h1 className="text-2xl font-bold text-gray-900">Departments</h1>
          <p className="text-sm text-gray-500 mt-1">Manage organizational departments</p>
        </div>
        <Button onClick={openCreate}>Create Department</Button>
      </div>

      <Card padding={false}>
        <Table
          columns={columns}
          data={departments ?? []}
          keyExtractor={(d) => d.id}
          emptyText="No departments found. Create one to get started."
        />
      </Card>

      {/* ─── Create / Edit Modal ─────────────────────────────────────────────── */}
      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title={editing ? 'Edit Department' : 'Create Department'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Name"
            required
            value={form.name}
            onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
          />
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">Description</label>
            <textarea
              className="w-full rounded-[10px] border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              rows={3}
              value={form.description ?? ''}
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" type="button" onClick={() => setShowModal(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={createDept.isPending || updateDept.isPending}>
              {editing ? 'Update' : 'Create'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
