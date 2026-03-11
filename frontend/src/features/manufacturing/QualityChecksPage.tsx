import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { cn, Button, Badge, Card, Table, Input, Modal } from '../../components/ui'
import { toast } from '../../components/ui'
import {
  useQualityChecks,
  useCreateQualityCheck,
  useWorkOrders,
  type QualityCheck,
  type CreateQualityCheckPayload,
} from '../../api/manufacturing'

function formatDate(dateStr: string | null) {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

const STATUS_BADGE: Record<string, 'default' | 'success' | 'danger' | 'info' | 'warning'> = {
  pending: 'default',
  passed: 'success',
  failed: 'danger',
  partial: 'warning',
}

const STATUS_FILTERS = ['all', 'pending', 'passed', 'failed', 'partial']

export default function QualityChecksPage() {
  const navigate = useNavigate()
  const [statusFilter, setStatusFilter] = useState('all')
  const [page, setPage] = useState(1)
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState({
    work_order_id: '',
    quantity_inspected: '',
    quantity_passed: '',
    quantity_failed: '',
    status: 'pending',
    notes: '',
  })

  const limit = 20
  const skip = (page - 1) * limit

  const { data, isLoading } = useQualityChecks({
    status: statusFilter !== 'all' ? statusFilter : undefined,
    skip,
    limit,
  })
  const { data: wos } = useWorkOrders({ limit: 100 })
  const createQC = useCreateQualityCheck()

  const handleCreate = async () => {
    if (!form.work_order_id || !form.quantity_inspected) {
      toast('error', 'Work order and quantity inspected are required')
      return
    }
    try {
      const passed = parseInt(form.quantity_passed) || 0
      const failed = parseInt(form.quantity_failed) || 0
      const payload: CreateQualityCheckPayload = {
        work_order_id: form.work_order_id,
        quantity_inspected: parseInt(form.quantity_inspected),
        quantity_passed: passed,
        quantity_failed: failed,
        status: failed > 0 && passed === 0 ? 'failed' : failed > 0 ? 'partial' : passed > 0 ? 'passed' : 'pending',
        notes: form.notes || undefined,
      }
      await createQC.mutateAsync(payload)
      toast('success', 'Quality check created')
      setModalOpen(false)
      setForm({
        work_order_id: '',
        quantity_inspected: '',
        quantity_passed: '',
        quantity_failed: '',
        status: 'pending',
        notes: '',
      })
    } catch {
      toast('error', 'Failed to create quality check')
    }
  }

  // Calculate pass/fail stats from the current page
  const checks = data?.quality_checks ?? []
  const totalInspected = checks.reduce((sum: number, c: QualityCheck) => sum + c.quantity_inspected, 0)
  const totalPassed = checks.reduce((sum: number, c: QualityCheck) => sum + c.quantity_passed, 0)
  const totalFailed = checks.reduce((sum: number, c: QualityCheck) => sum + c.quantity_failed, 0)
  const passRate = totalInspected > 0 ? ((totalPassed / totalInspected) * 100).toFixed(1) : '--'

  const columns = [
    {
      key: 'check_number',
      label: 'Check #',
      render: (row: QualityCheck) => <span className="font-mono text-sm font-medium text-primary">{row.check_number}</span>,
    },
    {
      key: 'work_order_id',
      label: 'Work Order',
      render: (row: QualityCheck) => {
        const wo = wos?.work_orders?.find((w) => w.id === row.work_order_id)
        return (
          <button
            className="text-sm text-primary hover:underline"
            onClick={() => navigate(`/manufacturing/work-orders/${row.work_order_id}`)}
          >
            {wo?.wo_number ?? row.work_order_id.slice(0, 8) + '...'}
          </button>
        )
      },
    },
    {
      key: 'quantity_inspected',
      label: 'Inspected',
      render: (row: QualityCheck) => <span className="font-medium">{row.quantity_inspected}</span>,
    },
    {
      key: 'quantity_passed',
      label: 'Passed',
      render: (row: QualityCheck) => <span className="text-green-600 font-medium">{row.quantity_passed}</span>,
    },
    {
      key: 'quantity_failed',
      label: 'Failed',
      render: (row: QualityCheck) => (
        <span className={cn('font-medium', row.quantity_failed > 0 ? 'text-red-600' : 'text-gray-400')}>
          {row.quantity_failed}
        </span>
      ),
    },
    {
      key: 'pass_rate',
      label: 'Pass Rate',
      render: (row: QualityCheck) => {
        const rate = row.quantity_inspected > 0
          ? ((row.quantity_passed / row.quantity_inspected) * 100).toFixed(1)
          : '--'
        return (
          <span className={cn(
            'text-sm font-medium',
            Number(rate) >= 95 ? 'text-green-600' : Number(rate) >= 80 ? 'text-orange-600' : 'text-red-600'
          )}>
            {rate}%
          </span>
        )
      },
    },
    {
      key: 'status',
      label: 'Status',
      render: (row: QualityCheck) => (
        <Badge variant={STATUS_BADGE[row.status] ?? 'default'} className="capitalize">{row.status}</Badge>
      ),
    },
    {
      key: 'checked_at',
      label: 'Date',
      render: (row: QualityCheck) => <span className="text-sm text-gray-500">{formatDate(row.checked_at)}</span>,
    },
    {
      key: 'notes',
      label: 'Notes',
      render: (row: QualityCheck) => (
        <span className="text-gray-500 text-xs max-w-[120px] truncate block">{row.notes ?? '--'}</span>
      ),
    },
  ]

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Quality Checks</h1>
          <p className="text-sm text-gray-500 mt-1">Inspection records for production work orders</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate('/manufacturing')}>
            Dashboard
          </Button>
          <Button onClick={() => setModalOpen(true)}>
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New QC
          </Button>
        </div>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
        <Card>
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-[10px] bg-primary/10 text-primary">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Total Checks</p>
              <p className="text-lg font-bold text-gray-900 mt-0.5">{data?.total ?? 0}</p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-[10px] bg-blue-50 text-blue-600">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
              </svg>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Total Inspected</p>
              <p className="text-lg font-bold text-gray-900 mt-0.5">{totalInspected}</p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-start gap-3">
            <div className={cn('p-2.5 rounded-[10px]', Number(passRate) >= 95 ? 'bg-green-50 text-green-600' : Number(passRate) >= 80 ? 'bg-orange-50 text-orange-600' : 'bg-red-50 text-red-600')}>
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Pass Rate</p>
              <p className={cn('text-lg font-bold mt-0.5', Number(passRate) >= 95 ? 'text-green-600' : Number(passRate) >= 80 ? 'text-orange-600' : 'text-red-600')}>
                {passRate}%
              </p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-start gap-3">
            <div className={cn('p-2.5 rounded-[10px]', totalFailed > 0 ? 'bg-red-50 text-red-600' : 'bg-gray-50 text-gray-600')}>
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Total Failed</p>
              <p className={cn('text-lg font-bold mt-0.5', totalFailed > 0 ? 'text-red-600' : 'text-gray-900')}>
                {totalFailed}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex gap-1 mb-4">
        {STATUS_FILTERS.map((sf) => (
          <Button
            key={sf}
            size="sm"
            variant={statusFilter === sf ? 'primary' : 'outline'}
            onClick={() => { setStatusFilter(sf); setPage(1) }}
          >
            {sf === 'all' ? 'All' : sf.charAt(0).toUpperCase() + sf.slice(1)}
          </Button>
        ))}
      </div>

      {/* Table */}
      <Card padding={false}>
        <Table<QualityCheck>
          columns={columns}
          data={checks}
          loading={isLoading}
          emptyText="No quality checks found"
          keyExtractor={(row) => row.id}
        />
        {(data?.total ?? 0) > limit && (
          <div className="flex justify-center p-4 border-t border-gray-100">
            <div className="flex gap-2">
              <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                Previous
              </Button>
              <span className="text-sm text-gray-500 flex items-center px-2">
                Page {page} of {Math.ceil((data?.total ?? 0) / limit)}
              </span>
              <Button
                size="sm"
                variant="outline"
                disabled={page >= Math.ceil((data?.total ?? 0) / limit)}
                onClick={() => setPage(page + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Create QC Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="New Quality Check">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Work Order *</label>
            <select
              className="w-full rounded-[10px] border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              value={form.work_order_id}
              onChange={(e) => setForm({ ...form, work_order_id: e.target.value })}
            >
              <option value="">Select work order...</option>
              {wos?.work_orders?.map((wo) => (
                <option key={wo.id} value={wo.id}>
                  {wo.wo_number} - {wo.finished_item_name ?? 'Unknown'} ({wo.status.replace('_', ' ')})
                </option>
              ))}
            </select>
          </div>
          <Input
            label="Quantity Inspected *"
            type="number"
            min="0"
            value={form.quantity_inspected}
            onChange={(e) => setForm({ ...form, quantity_inspected: e.target.value })}
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Quantity Passed"
              type="number"
              min="0"
              value={form.quantity_passed}
              onChange={(e) => setForm({ ...form, quantity_passed: e.target.value })}
            />
            <Input
              label="Quantity Failed"
              type="number"
              min="0"
              value={form.quantity_failed}
              onChange={(e) => setForm({ ...form, quantity_failed: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={2}
              className="w-full rounded-[10px] border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary placeholder:text-gray-400"
              placeholder="Optional inspection notes"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
            <Button variant="secondary" size="sm" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={handleCreate} loading={createQC.isPending}>
              Create Quality Check
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
