import { useState } from 'react'
import { Button, Card, Table, Modal, Input, Select, Badge, toast } from '../../components/ui'
import {
  useQualityInspections,
  useCreateQualityInspection,
  type QualityInspection,
  type CreateQualityInspectionPayload,
} from '../../api/supplychain_ext'

const statusColors: Record<string, 'default' | 'warning' | 'success' | 'danger' | 'info'> = {
  pending: 'warning',
  in_progress: 'info',
  passed: 'success',
  failed: 'danger',
  partial: 'warning',
}

const emptyForm: CreateQualityInspectionPayload = {
  reference_type: 'grn',
  reference_id: '',
  total_inspected: 0,
  total_passed: 0,
  total_failed: 0,
  notes: '',
}

export default function QualityInspectionPage() {
  const [statusFilter, setStatusFilter] = useState('')
  const [page, setPage] = useState(1)
  const limit = 20
  const { data, isLoading, error } = useQualityInspections({ status: statusFilter || undefined, skip: (page - 1) * limit, limit })
  const createInspection = useCreateQualityInspection()

  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState<CreateQualityInspectionPayload>(emptyForm)

  const resetForm = () => { setForm(emptyForm); setShowModal(false) }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await createInspection.mutateAsync(form)
      toast('success', 'Inspection recorded')
      resetForm()
    } catch {
      toast('error', 'Failed to create inspection')
    }
  }

  if (error) return <div className="p-6 text-danger">Failed to load inspections</div>

  const columns = [
    { key: 'inspection_number', label: 'Inspection #', render: (r: QualityInspection) => <span className="font-mono font-medium text-gray-900">{r.inspection_number}</span> },
    { key: 'reference_type', label: 'Type', render: (r: QualityInspection) => <Badge variant="primary">{r.reference_type.toUpperCase()}</Badge> },
    { key: 'inspector', label: 'Inspector', render: (r: QualityInspection) => <span className="text-sm">{r.inspector_name || r.inspector_id}</span> },
    { key: 'inspected', label: 'Inspected', render: (r: QualityInspection) => <span className="text-sm font-medium">{r.total_inspected}</span> },
    {
      key: 'results',
      label: 'Pass / Fail',
      render: (r: QualityInspection) => (
        <div className="flex gap-2 text-sm">
          <span className="text-green-600 font-medium">{r.total_passed}</span>
          <span className="text-gray-300">/</span>
          <span className="text-red-600 font-medium">{r.total_failed}</span>
        </div>
      ),
    },
    {
      key: 'pass_rate',
      label: 'Pass Rate',
      render: (r: QualityInspection) => {
        const rate = r.total_inspected > 0 ? (r.total_passed / r.total_inspected) * 100 : 0
        return (
          <div className="flex items-center gap-2">
            <div className="w-16 bg-gray-100 rounded-full h-2">
              <div className={`h-full rounded-full ${rate >= 80 ? 'bg-green-500' : rate >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`} style={{ width: `${rate}%` }} />
            </div>
            <span className="text-xs text-gray-500">{rate.toFixed(0)}%</span>
          </div>
        )
      },
    },
    { key: 'status', label: 'Status', render: (r: QualityInspection) => <Badge variant={statusColors[r.status]}>{r.status.replace(/_/g, ' ')}</Badge> },
    { key: 'date', label: 'Date', render: (r: QualityInspection) => <span className="text-sm text-gray-500">{r.inspected_at ? new Date(r.inspected_at).toLocaleDateString() : '-'}</span> },
  ]

  return (
    <div className="p-4 sm:p-6 space-y-5 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Quality Inspections</h1>
          <p className="text-sm text-gray-500 mt-0.5">Track inspection results and quality metrics</p>
        </div>
        <div className="flex gap-3">
          <Select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}
            options={[
              { value: '', label: 'All Status' },
              { value: 'pending', label: 'Pending' },
              { value: 'in_progress', label: 'In Progress' },
              { value: 'passed', label: 'Passed' },
              { value: 'failed', label: 'Failed' },
            ]}
          />
          <Button onClick={() => setShowModal(true)}>New Inspection</Button>
        </div>
      </div>

      <Card padding={false}>
        <Table columns={columns} data={data?.inspections ?? []} loading={isLoading} keyExtractor={(r) => r.id} emptyText="No inspections found" />
        {data && data.total > limit && (
          <div className="flex justify-center gap-2 p-4 border-t border-gray-100 dark:border-gray-800">
            <Button size="sm" variant="ghost" disabled={page === 1} onClick={() => setPage(page - 1)}>Previous</Button>
            <span className="text-sm text-gray-500 self-center">Page {page} of {Math.ceil(data.total / limit)}</span>
            <Button size="sm" variant="ghost" disabled={page * limit >= data.total} onClick={() => setPage(page + 1)}>Next</Button>
          </div>
        )}
      </Card>

      <Modal open={showModal} onClose={resetForm} title="New Quality Inspection" size="lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select label="Reference Type" value={form.reference_type} onChange={(e) => setForm({ ...form, reference_type: e.target.value as 'grn' | 'shipment' | 'production' })}
              options={[{ value: 'grn', label: 'GRN' }, { value: 'shipment', label: 'Shipment' }, { value: 'production', label: 'Production' }]} />
            <Input label="Reference ID" value={form.reference_id} onChange={(e) => setForm({ ...form, reference_id: e.target.value })} required />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Input label="Total Inspected" type="number" min="0" value={form.total_inspected} onChange={(e) => setForm({ ...form, total_inspected: parseInt(e.target.value) || 0 })} required />
            <Input label="Total Passed" type="number" min="0" value={form.total_passed} onChange={(e) => setForm({ ...form, total_passed: parseInt(e.target.value) || 0 })} required />
            <Input label="Total Failed" type="number" min="0" value={form.total_failed} onChange={(e) => setForm({ ...form, total_failed: parseInt(e.target.value) || 0 })} required />
          </div>
          <Input label="Notes" value={form.notes || ''} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="ghost" type="button" onClick={resetForm}>Cancel</Button>
            <Button type="submit" loading={createInspection.isPending}>Submit</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
