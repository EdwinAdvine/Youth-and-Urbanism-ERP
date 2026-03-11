import { useState } from 'react'
import { Button, Card, Badge, Table, Modal, Input, Select, Spinner, toast } from '../../components/ui'
import { useAlerts, useCreateAlert, useUpdateAlert, useDeleteAlert, type DataAlert } from '../../api/analytics_ext'

interface AlertForm {
  name: string
  metric: string
  condition: string
  threshold: number
  notification_channels: string
  is_active: boolean
}

const emptyForm: AlertForm = {
  name: '', metric: 'revenue_daily', condition: 'above',
  threshold: 0, notification_channels: 'email', is_active: true,
}

const METRIC_OPTIONS = [
  { value: 'revenue_daily', label: 'Daily Revenue' },
  { value: 'revenue_monthly', label: 'Monthly Revenue' },
  { value: 'open_tickets', label: 'Open Tickets Count' },
  { value: 'inventory_low', label: 'Low Stock Items' },
  { value: 'invoice_overdue', label: 'Overdue Invoices' },
  { value: 'employee_attendance', label: 'Attendance Rate (%)' },
  { value: 'csat_score', label: 'CSAT Score' },
  { value: 'deal_pipeline', label: 'Pipeline Value' },
  { value: 'expense_daily', label: 'Daily Expenses' },
  { value: 'sla_compliance', label: 'SLA Compliance (%)' },
]

const CONDITION_OPTIONS = [
  { value: 'above', label: 'Goes Above' },
  { value: 'below', label: 'Goes Below' },
  { value: 'equals', label: 'Equals' },
  { value: 'changes_by', label: 'Changes By (%)' },
]

const NOTIFICATION_OPTIONS = [
  { value: 'email', label: 'Email' },
  { value: 'in_app', label: 'In-App' },
  { value: 'both', label: 'Email + In-App' },
]

export default function AlertConfigPage() {
  const { data: alerts, isLoading, error } = useAlerts()
  const createAlert = useCreateAlert()
  const updateAlert = useUpdateAlert()
  const deleteAlert = useDeleteAlert()

  const [showModal, setShowModal] = useState(false)
  const [editAlert, setEditAlert] = useState<DataAlert | null>(null)
  const [form, setForm] = useState<AlertForm>(emptyForm)

  const openCreate = () => {
    setEditAlert(null)
    setForm(emptyForm)
    setShowModal(true)
  }

  const openEdit = (a: DataAlert) => {
    setEditAlert(a)
    setForm({
      name: a.name,
      metric: a.metric,
      condition: a.condition,
      threshold: a.threshold,
      notification_channels: a.notification_channels?.join(',') || 'email',
      is_active: a.is_active,
    })
    setShowModal(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) { toast('error', 'Alert name is required'); return }

    const payload = {
      name: form.name,
      metric: form.metric,
      condition: form.condition,
      threshold: form.threshold,
      notification_channels: form.notification_channels.split(',').map((c) => c.trim()).filter(Boolean),
      is_active: form.is_active,
    }

    try {
      if (editAlert) {
        await updateAlert.mutateAsync({ id: editAlert.id, ...payload })
        toast('success', 'Alert updated')
      } else {
        await createAlert.mutateAsync(payload)
        toast('success', 'Alert created')
      }
      setShowModal(false)
    } catch {
      toast('error', 'Failed to save alert')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this alert?')) return
    try {
      await deleteAlert.mutateAsync(id)
      toast('success', 'Alert deleted')
    } catch {
      toast('error', 'Failed to delete')
    }
  }

  const handleToggle = async (a: DataAlert) => {
    try {
      await updateAlert.mutateAsync({ id: a.id, is_active: !a.is_active })
      toast('success', a.is_active ? 'Alert paused' : 'Alert activated')
    } catch {
      toast('error', 'Failed to toggle alert')
    }
  }

  const metricLabel = (val: string) => METRIC_OPTIONS.find((m) => m.value === val)?.label ?? val
  const conditionLabel = (val: string) => CONDITION_OPTIONS.find((c) => c.value === val)?.label ?? val

  if (error) return <div className="p-6 text-danger">Failed to load alerts</div>

  const columns = [
    {
      key: 'name',
      label: 'Alert Name',
      render: (row: DataAlert) => (
        <button className="text-primary font-medium hover:underline" onClick={() => openEdit(row)}>
          {row.name}
        </button>
      ),
    },
    {
      key: 'metric',
      label: 'Metric',
      render: (row: DataAlert) => <span className="text-gray-700 text-sm">{metricLabel(row.metric)}</span>,
    },
    {
      key: 'condition',
      label: 'Condition',
      render: (row: DataAlert) => (
        <span className="text-gray-600 text-xs">
          {conditionLabel(row.condition)} <span className="font-semibold text-gray-900">{row.threshold.toLocaleString()}</span>
        </span>
      ),
    },
    {
      key: 'notification',
      label: 'Notify Via',
      render: (row: DataAlert) => (
        <div className="flex gap-1">
          {(row.notification_channels || []).map((ch) => (
            <Badge key={ch} variant="info">{ch}</Badge>
          ))}
        </div>
      ),
    },
    {
      key: 'is_active',
      label: 'Status',
      render: (row: DataAlert) => (
        <button onClick={() => handleToggle(row)}>
          <Badge variant={row.is_active ? 'success' : 'default'}>
            {row.is_active ? 'Active' : 'Inactive'}
          </Badge>
        </button>
      ),
    },
    {
      key: 'last_triggered',
      label: 'Last Triggered',
      render: (row: DataAlert) => (
        <span className="text-gray-400 text-xs">
          {row.last_triggered_at ? new Date(row.last_triggered_at).toLocaleDateString() : 'Never'}
        </span>
      ),
    },
    {
      key: 'actions',
      label: '',
      render: (row: DataAlert) => (
        <div className="flex gap-1 justify-end">
          <Button size="sm" variant="ghost" onClick={() => openEdit(row)}>Edit</Button>
          <Button size="sm" variant="ghost" className="text-red-500" onClick={() => handleDelete(row.id)}>Delete</Button>
        </div>
      ),
    },
  ]

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Alert Configuration</h1>
          <p className="text-sm text-gray-500 mt-1">Set up data-driven alerts and notifications</p>
        </div>
        <Button onClick={openCreate}>
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Alert
        </Button>
      </div>

      {/* Summary */}
      {alerts && (
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <Card>
            <p className="text-sm text-gray-500">Total Alerts</p>
            <p className="text-2xl font-bold text-gray-900">{alerts.length}</p>
          </Card>
          <Card>
            <p className="text-sm text-gray-500">Active</p>
            <p className="text-2xl font-bold text-green-600">{alerts.filter((a) => a.is_active).length}</p>
          </Card>
          <Card>
            <p className="text-sm text-gray-500">Triggered Today</p>
            <p className="text-2xl font-bold text-orange-600">
              {alerts.filter((a) => {
                if (!a.last_triggered_at) return false
                const d = new Date(a.last_triggered_at)
                const today = new Date()
                return d.toDateString() === today.toDateString()
              }).length}
            </p>
          </Card>
          <Card>
            <p className="text-sm text-gray-500">Inactive</p>
            <p className="text-2xl font-bold text-gray-400">{alerts.filter((a) => !a.is_active).length}</p>
          </Card>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-20"><Spinner size="lg" /></div>
      ) : (
        <Card padding={false}>
          <Table<DataAlert>
            columns={columns}
            data={alerts || []}
            emptyText="No alerts configured"
            keyExtractor={(row) => row.id}
          />
        </Card>
      )}

      <Modal open={showModal} onClose={() => setShowModal(false)} title={editAlert ? 'Edit Alert' : 'Create Alert'} size="lg">
        <form onSubmit={handleSave} className="space-y-4">
          <Input
            label="Alert Name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
            placeholder="e.g., Revenue Drop Alert"
          />
          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Metric"
              options={METRIC_OPTIONS}
              value={form.metric}
              onChange={(e) => setForm({ ...form, metric: e.target.value })}
            />
            <Select
              label="Condition"
              options={CONDITION_OPTIONS}
              value={form.condition}
              onChange={(e) => setForm({ ...form, condition: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Threshold"
              type="number"
              value={String(form.threshold)}
              onChange={(e) => setForm({ ...form, threshold: Number(e.target.value) })}
              required
              placeholder="e.g., 50000"
            />
            <Select
              label="Notification Method"
              options={NOTIFICATION_OPTIONS}
              value={form.notification_channels}
              onChange={(e) => setForm({ ...form, notification_channels: e.target.value })}
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="alert-active"
              checked={form.is_active}
              onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
              className="rounded"
            />
            <label htmlFor="alert-active" className="text-sm text-gray-700">Active</label>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" type="button" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button type="submit" loading={createAlert.isPending || updateAlert.isPending}>
              {editAlert ? 'Update' : 'Create'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
