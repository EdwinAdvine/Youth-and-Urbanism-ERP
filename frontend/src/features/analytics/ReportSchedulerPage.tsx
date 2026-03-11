import { useState } from 'react'
import { Button, Card, Badge, Table, Modal, Input, Select, Spinner, toast } from '../../components/ui'
import { useReports, useCreateReport, useUpdateReport, useDeleteReport, useRunReport, type Report } from '../../api/analytics_ext'

interface ReportForm {
  name: string
  description: string
  query: string
  schedule: string
  format: string
  recipients: string
  is_active: boolean
}

const emptyForm: ReportForm = {
  name: '', description: '', query: '', schedule: 'weekly',
  format: 'pdf', recipients: '', is_active: true,
}

const SCHEDULE_OPTIONS = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
]

const FORMAT_OPTIONS = [
  { value: 'pdf', label: 'PDF' },
  { value: 'csv', label: 'CSV' },
  { value: 'xlsx', label: 'Excel (XLSX)' },
]

export default function ReportSchedulerPage() {
  const { data: reports, isLoading, error } = useReports()
  const createReport = useCreateReport()
  const updateReport = useUpdateReport()
  const deleteReport = useDeleteReport()
  const runReport = useRunReport()

  const [showModal, setShowModal] = useState(false)
  const [editReport, setEditReport] = useState<Report | null>(null)
  const [form, setForm] = useState<ReportForm>(emptyForm)

  const openCreate = () => {
    setEditReport(null)
    setForm(emptyForm)
    setShowModal(true)
  }

  const openEdit = (r: Report) => {
    setEditReport(r)
    setForm({
      name: r.name,
      description: r.description || '',
      query: r.query || '',
      schedule: r.schedule || 'weekly',
      format: r.format || 'pdf',
      recipients: r.recipients?.join(', ') || '',
      is_active: r.is_active,
    })
    setShowModal(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) { toast('error', 'Report name is required'); return }
    if (!form.recipients.trim()) { toast('error', 'At least one recipient is required'); return }

    const payload = {
      name: form.name,
      description: form.description || undefined,
      query: form.query || undefined,
      schedule: form.schedule,
      format: form.format,
      recipients: form.recipients.split(',').map((r) => r.trim()).filter(Boolean),
      is_active: form.is_active,
    }

    try {
      if (editReport) {
        await updateReport.mutateAsync({ id: editReport.id, ...payload })
        toast('success', 'Report schedule updated')
      } else {
        await createReport.mutateAsync(payload)
        toast('success', 'Report scheduled')
      }
      setShowModal(false)
    } catch {
      toast('error', 'Failed to save report')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this scheduled report?')) return
    try {
      await deleteReport.mutateAsync(id)
      toast('success', 'Report deleted')
    } catch {
      toast('error', 'Failed to delete')
    }
  }

  const handleRunNow = async (id: string) => {
    try {
      await runReport.mutateAsync(id)
      toast('success', 'Report is being generated')
    } catch {
      toast('error', 'Failed to run report')
    }
  }

  if (error) return <div className="p-6 text-danger">Failed to load reports</div>

  const columns = [
    {
      key: 'name',
      label: 'Report Name',
      render: (row: Report) => (
        <button className="text-primary font-medium hover:underline" onClick={() => openEdit(row)}>
          {row.name}
        </button>
      ),
    },
    {
      key: 'schedule',
      label: 'Schedule',
      render: (row: Report) => <Badge variant="primary">{row.schedule || 'Manual'}</Badge>,
    },
    {
      key: 'format',
      label: 'Format',
      render: (row: Report) => <Badge variant="default">{(row.format || 'pdf').toUpperCase()}</Badge>,
    },
    {
      key: 'recipients',
      label: 'Recipients',
      render: (row: Report) => (
        <span className="text-gray-600 text-xs truncate max-w-[200px] block">
          {row.recipients?.join(', ') || '-'}
        </span>
      ),
    },
    {
      key: 'is_active',
      label: 'Status',
      render: (row: Report) => (
        <Badge variant={row.is_active ? 'success' : 'default'}>
          {row.is_active ? 'Active' : 'Paused'}
        </Badge>
      ),
    },
    {
      key: 'last_run',
      label: 'Last Run',
      render: (row: Report) => (
        <span className="text-gray-400 text-xs">
          {row.last_run_at ? new Date(row.last_run_at).toLocaleDateString() : 'Never'}
        </span>
      ),
    },
    {
      key: 'actions',
      label: '',
      render: (row: Report) => (
        <div className="flex gap-1 justify-end">
          <Button size="sm" variant="ghost" onClick={() => handleRunNow(row.id)} loading={runReport.isPending}>
            Run Now
          </Button>
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
          <h1 className="text-2xl font-bold text-gray-900">Report Scheduler</h1>
          <p className="text-sm text-gray-500 mt-1">Schedule automated report generation and delivery</p>
        </div>
        <Button onClick={openCreate}>
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Schedule Report
        </Button>
      </div>

      {/* Summary Cards */}
      {reports && (
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <Card>
            <p className="text-sm text-gray-500">Total Reports</p>
            <p className="text-2xl font-bold text-gray-900">{reports.length}</p>
          </Card>
          <Card>
            <p className="text-sm text-gray-500">Active</p>
            <p className="text-2xl font-bold text-green-600">{reports.filter((r) => r.is_active).length}</p>
          </Card>
          <Card>
            <p className="text-sm text-gray-500">Paused</p>
            <p className="text-2xl font-bold text-gray-400">{reports.filter((r) => !r.is_active).length}</p>
          </Card>
          <Card>
            <p className="text-sm text-gray-500">Daily</p>
            <p className="text-2xl font-bold text-primary">{reports.filter((r) => r.schedule === 'daily').length}</p>
          </Card>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-20"><Spinner size="lg" /></div>
      ) : (
        <Card padding={false}>
          <Table<Report>
            columns={columns}
            data={reports || []}
            emptyText="No scheduled reports yet"
            keyExtractor={(row) => row.id}
          />
        </Card>
      )}

      <Modal open={showModal} onClose={() => setShowModal(false)} title={editReport ? 'Edit Schedule' : 'Schedule Report'} size="lg">
        <form onSubmit={handleSave} className="space-y-4">
          <Input
            label="Report Name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
            placeholder="e.g., Monthly Revenue Report"
          />
          <Input
            label="Description"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="Optional description"
          />
          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Schedule"
              options={SCHEDULE_OPTIONS}
              value={form.schedule}
              onChange={(e) => setForm({ ...form, schedule: e.target.value })}
            />
            <Select
              label="Format"
              options={FORMAT_OPTIONS}
              value={form.format}
              onChange={(e) => setForm({ ...form, format: e.target.value })}
            />
          </div>
          <Input
            label="Recipients (comma-separated emails)"
            value={form.recipients}
            onChange={(e) => setForm({ ...form, recipients: e.target.value })}
            required
            placeholder="user@company.com, admin@company.com"
          />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Query (optional)</label>
            <textarea
              className="w-full rounded-[10px] border border-gray-200 px-4 py-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/30 min-h-[100px]"
              value={form.query}
              onChange={(e) => setForm({ ...form, query: e.target.value })}
              placeholder="SELECT * FROM ..."
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="report-active"
              checked={form.is_active}
              onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
              className="rounded"
            />
            <label htmlFor="report-active" className="text-sm text-gray-700">Active</label>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" type="button" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button type="submit" loading={createReport.isPending || updateReport.isPending}>
              {editReport ? 'Update' : 'Schedule'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
