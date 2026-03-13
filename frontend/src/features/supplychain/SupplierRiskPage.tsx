import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Button, Badge, Card, Table, Modal, Input, Pagination, toast,
} from '../../components/ui'
import {
  useSupplierRisks, useCreateSupplierRisk,
  type SupplierRiskItem,
} from '../../api/supplychain_ops'

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}

const SEVERITY_BADGE: Record<string, 'danger' | 'warning' | 'info' | 'default'> = {
  critical: 'danger',
  high: 'warning',
  medium: 'info',
  low: 'default',
}

const RISK_TYPE_ICONS: Record<string, string> = {
  financial: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  operational: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z',
  compliance: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z',
  geopolitical: 'M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  environmental: 'M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z',
}

const STATUS_BADGE: Record<string, 'danger' | 'warning' | 'success' | 'default'> = {
  active: 'danger',
  mitigated: 'success',
  monitoring: 'warning',
  closed: 'default',
}

interface RiskFormState {
  supplier_id: string
  risk_type: string
  severity: string
  description: string
  source: string
  mitigation_notes: string
}

const defaultForm: RiskFormState = {
  supplier_id: '',
  risk_type: 'operational',
  severity: 'medium',
  description: '',
  source: 'manual',
  mitigation_notes: '',
}

export default function SupplierRiskPage() {
  const navigate = useNavigate()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [filterSeverity, setFilterSeverity] = useState('')
  const [filterRiskType, setFilterRiskType] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState<RiskFormState>(defaultForm)

  const limit = 20
  const skip = (page - 1) * limit

  const { data, isLoading } = useSupplierRisks({
    severity: filterSeverity || undefined,
    risk_type: filterRiskType || undefined,
    status: filterStatus || undefined,
    skip,
    limit,
  })

  const createMutation = useCreateSupplierRisk()

  const totalPages = data ? Math.ceil(data.total / limit) : 1

  const handleCreate = async () => {
    if (!form.supplier_id.trim()) {
      toast('warning', 'Supplier ID is required')
      return
    }
    if (!form.description.trim()) {
      toast('warning', 'Description is required')
      return
    }
    try {
      await createMutation.mutateAsync({
        supplier_id: form.supplier_id.trim(),
        risk_type: form.risk_type,
        severity: form.severity,
        description: form.description.trim(),
        source: form.source.trim() || undefined,
        mitigation_notes: form.mitigation_notes.trim() || undefined,
      })
      toast('success', 'Risk created')
      setShowCreate(false)
      setForm(defaultForm)
    } catch {
      toast('error', 'Failed to create risk')
    }
  }

  const filteredRisks = data?.risks?.filter((r) =>
    !search || r.description.toLowerCase().includes(search.toLowerCase()) ||
    r.risk_type.toLowerCase().includes(search.toLowerCase())
  ) ?? []

  const columns = [
    {
      key: 'risk_type',
      label: 'Type',
      render: (row: SupplierRiskItem) => (
        <div className="flex items-center gap-2">
          <svg className="h-4 w-4 text-[#51459d]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={RISK_TYPE_ICONS[row.risk_type] || RISK_TYPE_ICONS.operational} />
          </svg>
          <span className="font-medium text-gray-900 dark:text-gray-100 capitalize">{row.risk_type.replace(/_/g, ' ')}</span>
        </div>
      ),
    },
    {
      key: 'severity',
      label: 'Severity',
      render: (row: SupplierRiskItem) => (
        <Badge variant={SEVERITY_BADGE[row.severity] ?? 'default'}>{row.severity}</Badge>
      ),
    },
    {
      key: 'description',
      label: 'Description',
      render: (row: SupplierRiskItem) => (
        <span className="text-gray-600 dark:text-gray-400 text-sm line-clamp-2">{row.description}</span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (row: SupplierRiskItem) => (
        <Badge variant={STATUS_BADGE[row.status] ?? 'default'}>{row.status}</Badge>
      ),
    },
    {
      key: 'supplier_id',
      label: 'Supplier',
      render: (row: SupplierRiskItem) => (
        <span className="text-gray-500 text-xs">{row.supplier_id.slice(0, 8)}...</span>
      ),
    },
    {
      key: 'detected_at',
      label: 'Detected',
      render: (row: SupplierRiskItem) => (
        <span className="text-gray-500 text-xs">{formatDate(row.detected_at)}</span>
      ),
    },
  ]

  return (
    <div className="p-3 sm:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 sm:mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100">Supplier Risks</h1>
          <p className="text-sm text-gray-500 mt-1">{data?.total ?? 0} total risks</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={() => navigate('/supply-chain')}>
            Dashboard
          </Button>
          <Button onClick={() => setShowCreate(true)}>
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Risk
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="w-60">
          <Input
            placeholder="Search risks..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            leftIcon={
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            }
          />
        </div>
        <select
          value={filterSeverity}
          onChange={(e) => { setFilterSeverity(e.target.value); setPage(1) }}
          className="rounded-[10px] border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#51459d]/30 focus:border-[#51459d]"
        >
          <option value="">All Severities</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
        <select
          value={filterRiskType}
          onChange={(e) => { setFilterRiskType(e.target.value); setPage(1) }}
          className="rounded-[10px] border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#51459d]/30 focus:border-[#51459d]"
        >
          <option value="">All Types</option>
          <option value="financial">Financial</option>
          <option value="operational">Operational</option>
          <option value="compliance">Compliance</option>
          <option value="geopolitical">Geopolitical</option>
          <option value="environmental">Environmental</option>
        </select>
        <select
          value={filterStatus}
          onChange={(e) => { setFilterStatus(e.target.value); setPage(1) }}
          className="rounded-[10px] border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#51459d]/30 focus:border-[#51459d]"
        >
          <option value="">All Statuses</option>
          <option value="active">Active</option>
          <option value="mitigated">Mitigated</option>
          <option value="monitoring">Monitoring</option>
          <option value="closed">Closed</option>
        </select>
        <span className="text-sm text-gray-500">{data?.total ?? 0} risks</span>
      </div>

      {/* Table */}
      <Card padding={false}>
        <Table<SupplierRiskItem>
          columns={columns}
          data={filteredRisks}
          loading={isLoading}
          emptyText="No supplier risks found"
          keyExtractor={(row) => row.id}
        />
        {totalPages > 1 && (
          <Pagination page={page} pages={totalPages} total={data?.total ?? 0} onChange={setPage} />
        )}
      </Card>

      {/* Create Modal */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="New Supplier Risk" size="lg">
        <div className="space-y-4">
          <Input
            label="Supplier ID *"
            value={form.supplier_id}
            onChange={(e) => setForm({ ...form, supplier_id: e.target.value })}
            placeholder="UUID of the supplier"
          />
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Risk Type *</label>
              <select
                value={form.risk_type}
                onChange={(e) => setForm({ ...form, risk_type: e.target.value })}
                className="w-full rounded-[10px] border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#51459d]/30 focus:border-[#51459d]"
              >
                <option value="financial">Financial</option>
                <option value="operational">Operational</option>
                <option value="compliance">Compliance</option>
                <option value="geopolitical">Geopolitical</option>
                <option value="environmental">Environmental</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Severity *</label>
              <select
                value={form.severity}
                onChange={(e) => setForm({ ...form, severity: e.target.value })}
                className="w-full rounded-[10px] border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#51459d]/30 focus:border-[#51459d]"
              >
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
          </div>
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Description *</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={3}
              className="w-full rounded-[10px] border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#51459d]/30 focus:border-[#51459d] placeholder:text-gray-400"
              placeholder="Describe the risk..."
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Source"
              value={form.source}
              onChange={(e) => setForm({ ...form, source: e.target.value })}
              placeholder="e.g. manual, ai_scan"
            />
            <Input
              label="Mitigation Notes"
              value={form.mitigation_notes}
              onChange={(e) => setForm({ ...form, mitigation_notes: e.target.value })}
              placeholder="Mitigation plan"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-gray-100 dark:border-gray-800">
            <Button variant="secondary" size="sm" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button size="sm" onClick={handleCreate} loading={createMutation.isPending}>
              Create Risk
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
