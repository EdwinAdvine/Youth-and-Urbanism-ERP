import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Button, Badge, Card, Table, Modal, Input, Pagination, toast,
} from '../../components/ui'
import {
  useCompliance, useCreateCompliance,
  useESGMetrics, useCreateESGMetric, useESGSummary,
  type ComplianceRecordItem, type ESGMetricItem,
} from '../../api/supplychain_ops'

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}

const STATUS_BADGE: Record<string, 'success' | 'danger' | 'warning' | 'info' | 'default'> = {
  compliant: 'success',
  non_compliant: 'danger',
  pending_review: 'warning',
  expired: 'danger',
  exempt: 'default',
}

const ENTITY_TYPES = ['supplier', 'product', 'shipment', 'warehouse', 'contract']
const COMPLIANCE_STATUSES = ['compliant', 'non_compliant', 'pending_review', 'expired', 'exempt']
const METRIC_TYPES = ['carbon_footprint', 'water_usage', 'waste_reduction', 'energy_efficiency', 'social_score', 'governance_score']

const METRIC_COLORS: Record<string, string> = {
  carbon_footprint: '#ff3a6e',
  water_usage: '#3ec9d6',
  waste_reduction: '#6fd943',
  energy_efficiency: '#ffa21d',
  social_score: '#51459d',
  governance_score: '#8b5cf6',
}

// ─── Compliance Form ─────────────────────────────────────────────────────────

interface ComplianceFormState {
  entity_type: string
  entity_id: string
  compliance_type: string
  status: string
  expiry_date: string
}

const defaultComplianceForm: ComplianceFormState = {
  entity_type: 'supplier',
  entity_id: '',
  compliance_type: '',
  status: 'pending_review',
  expiry_date: '',
}

// ─── ESG Form ────────────────────────────────────────────────────────────────

interface ESGFormState {
  supplier_id: string
  metric_type: string
  period: string
  value: string
  unit: string
  benchmark: string
  source: string
}

const defaultESGForm: ESGFormState = {
  supplier_id: '',
  metric_type: 'carbon_footprint',
  period: '',
  value: '',
  unit: 'kg_co2',
  benchmark: '',
  source: '',
}

type TabId = 'compliance' | 'esg'

export default function CompliancePage() {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<TabId>('compliance')

  // ─── Compliance state ────────────────────────────────────────────────────
  const [compPage, setCompPage] = useState(1)
  const [compSearch, setCompSearch] = useState('')
  const [filterEntityType, setFilterEntityType] = useState('')
  const [filterCompStatus, setFilterCompStatus] = useState('')
  const [showComplianceCreate, setShowComplianceCreate] = useState(false)
  const [compForm, setCompForm] = useState<ComplianceFormState>(defaultComplianceForm)

  // ─── ESG state ───────────────────────────────────────────────────────────
  const [esgPage, setEsgPage] = useState(1)
  const [esgSearch, setEsgSearch] = useState('')
  const [filterMetricType, setFilterMetricType] = useState('')
  const [showESGCreate, setShowESGCreate] = useState(false)
  const [esgForm, setEsgForm] = useState<ESGFormState>(defaultESGForm)

  const limit = 20
  const compSkip = (compPage - 1) * limit
  const esgSkip = (esgPage - 1) * limit

  // ─── Queries ─────────────────────────────────────────────────────────────
  const { data: compData, isLoading: compLoading } = useCompliance({
    entity_type: filterEntityType || undefined,
    status: filterCompStatus || undefined,
    skip: compSkip,
    limit,
  })

  const { data: esgData, isLoading: esgLoading } = useESGMetrics({
    metric_type: filterMetricType || undefined,
    skip: esgSkip,
    limit,
  })

  const { data: esgSummary } = useESGSummary()

  const createCompMutation = useCreateCompliance()
  const createESGMutation = useCreateESGMetric()

  const compPages = compData ? Math.ceil(compData.total / limit) : 1
  const esgPages = esgData ? Math.ceil(esgData.total / limit) : 1

  // ─── Compliance handlers ────────────────────────────────────────────────
  const handleCreateCompliance = async () => {
    if (!compForm.entity_id.trim() || !compForm.compliance_type.trim()) {
      toast('warning', 'Entity ID and compliance type are required')
      return
    }
    try {
      await createCompMutation.mutateAsync({
        entity_type: compForm.entity_type,
        entity_id: compForm.entity_id.trim(),
        compliance_type: compForm.compliance_type.trim(),
        status: compForm.status,
        expiry_date: compForm.expiry_date || undefined,
      })
      toast('success', 'Compliance record created')
      setShowComplianceCreate(false)
      setCompForm(defaultComplianceForm)
    } catch {
      toast('error', 'Failed to create compliance record')
    }
  }

  // ─── ESG handlers ──────────────────────────────────────────────────────
  const handleCreateESG = async () => {
    if (!esgForm.metric_type.trim() || !esgForm.period.trim() || !esgForm.value) {
      toast('warning', 'Metric type, period and value are required')
      return
    }
    try {
      await createESGMutation.mutateAsync({
        supplier_id: esgForm.supplier_id.trim() || undefined,
        metric_type: esgForm.metric_type.trim(),
        period: esgForm.period.trim(),
        value: Number(esgForm.value),
        unit: esgForm.unit.trim(),
        benchmark: esgForm.benchmark ? Number(esgForm.benchmark) : undefined,
        source: esgForm.source.trim() || undefined,
      })
      toast('success', 'ESG metric created')
      setShowESGCreate(false)
      setEsgForm(defaultESGForm)
    } catch {
      toast('error', 'Failed to create ESG metric')
    }
  }

  // ─── Filtered data ──────────────────────────────────────────────────────
  const filteredCompliance = compData?.records?.filter((r) =>
    !compSearch || r.compliance_type.toLowerCase().includes(compSearch.toLowerCase()) ||
    r.entity_type.toLowerCase().includes(compSearch.toLowerCase()) ||
    r.entity_id.toLowerCase().includes(compSearch.toLowerCase())
  ) ?? []

  const filteredESG = esgData?.metrics?.filter((m) =>
    !esgSearch || m.metric_type.toLowerCase().includes(esgSearch.toLowerCase()) ||
    m.unit.toLowerCase().includes(esgSearch.toLowerCase()) ||
    (m.source && m.source.toLowerCase().includes(esgSearch.toLowerCase()))
  ) ?? []

  // ─── Compliance columns ─────────────────────────────────────────────────
  const compColumns = [
    {
      key: 'compliance_type',
      label: 'Compliance Type',
      render: (row: ComplianceRecordItem) => (
        <span className="text-[#51459d] font-medium">{row.compliance_type}</span>
      ),
    },
    {
      key: 'entity_type',
      label: 'Entity Type',
      render: (row: ComplianceRecordItem) => (
        <span className="font-medium text-gray-900 dark:text-gray-100 capitalize">{row.entity_type}</span>
      ),
    },
    {
      key: 'entity_id',
      label: 'Entity',
      render: (row: ComplianceRecordItem) => (
        <span className="text-gray-500 text-xs">{row.entity_id.slice(0, 8)}...</span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (row: ComplianceRecordItem) => (
        <Badge variant={STATUS_BADGE[row.status] ?? 'default'}>
          {row.status.replace(/_/g, ' ')}
        </Badge>
      ),
    },
    {
      key: 'expiry_date',
      label: 'Expiry',
      render: (row: ComplianceRecordItem) => {
        if (!row.expiry_date) return <span className="text-gray-400">-</span>
        const isExpired = new Date(row.expiry_date) < new Date()
        return (
          <span className={isExpired ? 'text-[#ff3a6e] font-medium' : 'text-gray-600 dark:text-gray-400'}>
            {formatDate(row.expiry_date)}
          </span>
        )
      },
    },
    {
      key: 'reviewed_at',
      label: 'Reviewed',
      render: (row: ComplianceRecordItem) => (
        <span className="text-gray-500 text-xs">{row.reviewed_at ? formatDate(row.reviewed_at) : 'Not reviewed'}</span>
      ),
    },
    {
      key: 'created_at',
      label: 'Created',
      render: (row: ComplianceRecordItem) => (
        <span className="text-gray-500 text-xs">{formatDate(row.created_at)}</span>
      ),
    },
  ]

  // ─── ESG columns ────────────────────────────────────────────────────────
  const esgColumns = [
    {
      key: 'metric_type',
      label: 'Metric',
      render: (row: ESGMetricItem) => (
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full" style={{ backgroundColor: METRIC_COLORS[row.metric_type] || '#51459d' }} />
          <span className="font-medium text-gray-900 dark:text-gray-100 capitalize">{row.metric_type.replace(/_/g, ' ')}</span>
        </div>
      ),
    },
    {
      key: 'period',
      label: 'Period',
      render: (row: ESGMetricItem) => (
        <span className="text-[#51459d] font-medium">{row.period}</span>
      ),
    },
    {
      key: 'value',
      label: 'Value',
      render: (row: ESGMetricItem) => (
        <span className="text-gray-700 dark:text-gray-300 font-medium">{Number(row.value).toFixed(2)}</span>
      ),
    },
    {
      key: 'unit',
      label: 'Unit',
      render: (row: ESGMetricItem) => (
        <span className="text-gray-600 dark:text-gray-400">{row.unit}</span>
      ),
    },
    {
      key: 'benchmark',
      label: 'Benchmark',
      render: (row: ESGMetricItem) => (
        row.benchmark != null ? (
          <span className="text-gray-600 dark:text-gray-400">{Number(row.benchmark).toFixed(2)}</span>
        ) : (
          <span className="text-gray-400">-</span>
        )
      ),
    },
    {
      key: 'supplier_id',
      label: 'Supplier',
      render: (row: ESGMetricItem) => (
        <span className="text-gray-500 text-xs">{row.supplier_id ? row.supplier_id.slice(0, 8) + '...' : 'Global'}</span>
      ),
    },
    {
      key: 'source',
      label: 'Source',
      render: (row: ESGMetricItem) => (
        <span className="text-gray-500 text-xs capitalize">{row.source || '-'}</span>
      ),
    },
    {
      key: 'created_at',
      label: 'Created',
      render: (row: ESGMetricItem) => (
        <span className="text-gray-500 text-xs">{formatDate(row.created_at)}</span>
      ),
    },
  ]

  const esgSummaryItems = esgSummary?.summary ?? []

  const tabClass = (tab: TabId) =>
    `px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
      activeTab === tab
        ? 'text-[#51459d] border-[#51459d]'
        : 'text-gray-500 border-transparent hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
    }`

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Compliance & ESG</h1>
          <p className="text-sm text-gray-500 mt-1">Regulatory compliance and environmental metrics</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => navigate('/supply-chain')}>
            Dashboard
          </Button>
          {activeTab === 'compliance' ? (
            <Button onClick={() => setShowComplianceCreate(true)}>
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              New Record
            </Button>
          ) : (
            <Button onClick={() => setShowESGCreate(true)}>
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              New Metric
            </Button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700 mb-6">
        <div className="flex gap-0">
          <button className={tabClass('compliance')} onClick={() => setActiveTab('compliance')}>
            Compliance Records ({compData?.total ?? 0})
          </button>
          <button className={tabClass('esg')} onClick={() => setActiveTab('esg')}>
            ESG Metrics ({esgData?.total ?? 0})
          </button>
        </div>
      </div>

      {/* ─── Compliance Tab ──────────────────────────────────────────────── */}
      {activeTab === 'compliance' && (
        <>
          {/* Filters */}
          <div className="flex items-center gap-3 mb-4 flex-wrap">
            <div className="w-60">
              <Input
                placeholder="Search compliance..."
                value={compSearch}
                onChange={(e) => { setCompSearch(e.target.value); setCompPage(1) }}
                leftIcon={
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                }
              />
            </div>
            <select
              value={filterEntityType}
              onChange={(e) => { setFilterEntityType(e.target.value); setCompPage(1) }}
              className="rounded-[10px] border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#51459d]/30 focus:border-[#51459d]"
            >
              <option value="">All Entity Types</option>
              {ENTITY_TYPES.map((t) => (
                <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
              ))}
            </select>
            <select
              value={filterCompStatus}
              onChange={(e) => { setFilterCompStatus(e.target.value); setCompPage(1) }}
              className="rounded-[10px] border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#51459d]/30 focus:border-[#51459d]"
            >
              <option value="">All Statuses</option>
              {COMPLIANCE_STATUSES.map((s) => (
                <option key={s} value={s}>{s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}</option>
              ))}
            </select>
            <span className="text-sm text-gray-500">{compData?.total ?? 0} records</span>
          </div>

          {/* Compliance Table */}
          <Card padding={false}>
            <Table<ComplianceRecordItem>
              columns={compColumns}
              data={filteredCompliance}
              loading={compLoading}
              emptyText="No compliance records found"
              keyExtractor={(row) => row.id}
            />
            {compPages > 1 && (
              <Pagination page={compPage} pages={compPages} total={compData?.total ?? 0} onChange={setCompPage} />
            )}
          </Card>
        </>
      )}

      {/* ─── ESG Tab ─────────────────────────────────────────────────────── */}
      {activeTab === 'esg' && (
        <>
          {/* ESG Summary Cards */}
          {esgSummaryItems.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
              {esgSummaryItems.map((item) => (
                <button
                  key={item.metric_type}
                  onClick={() => { setFilterMetricType(filterMetricType === item.metric_type ? '' : item.metric_type); setEsgPage(1) }}
                  className={`rounded-[10px] border p-4 text-left transition-all ${
                    filterMetricType === item.metric_type
                      ? 'border-[#51459d] ring-2 ring-[#51459d]/20'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                  } bg-white dark:bg-gray-800`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <div className="h-3 w-3 rounded-full" style={{ backgroundColor: METRIC_COLORS[item.metric_type] || '#51459d' }} />
                    <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                      {item.metric_type.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <p className="text-xl font-bold text-gray-900 dark:text-gray-100">
                    {item.avg_value.toFixed(2)}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">{item.count} records</p>
                </button>
              ))}
            </div>
          )}

          {/* Filters */}
          <div className="flex items-center gap-3 mb-4 flex-wrap">
            <div className="w-60">
              <Input
                placeholder="Search ESG metrics..."
                value={esgSearch}
                onChange={(e) => { setEsgSearch(e.target.value); setEsgPage(1) }}
                leftIcon={
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                }
              />
            </div>
            <select
              value={filterMetricType}
              onChange={(e) => { setFilterMetricType(e.target.value); setEsgPage(1) }}
              className="rounded-[10px] border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#51459d]/30 focus:border-[#51459d]"
            >
              <option value="">All Metric Types</option>
              {METRIC_TYPES.map((t) => (
                <option key={t} value={t}>{t.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}</option>
              ))}
            </select>
            <span className="text-sm text-gray-500">{esgData?.total ?? 0} metrics</span>
          </div>

          {/* ESG Table */}
          <Card padding={false}>
            <Table<ESGMetricItem>
              columns={esgColumns}
              data={filteredESG}
              loading={esgLoading}
              emptyText="No ESG metrics found"
              keyExtractor={(row) => row.id}
            />
            {esgPages > 1 && (
              <Pagination page={esgPage} pages={esgPages} total={esgData?.total ?? 0} onChange={setEsgPage} />
            )}
          </Card>
        </>
      )}

      {/* ─── Create Compliance Modal ────────────────────────────────────── */}
      <Modal open={showComplianceCreate} onClose={() => setShowComplianceCreate(false)} title="New Compliance Record" size="lg">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Entity Type *</label>
              <select
                value={compForm.entity_type}
                onChange={(e) => setCompForm({ ...compForm, entity_type: e.target.value })}
                className="w-full rounded-[10px] border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#51459d]/30 focus:border-[#51459d]"
              >
                {ENTITY_TYPES.map((t) => (
                  <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                ))}
              </select>
            </div>
            <Input
              label="Entity ID *"
              value={compForm.entity_id}
              onChange={(e) => setCompForm({ ...compForm, entity_id: e.target.value })}
              placeholder="UUID of the entity"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Compliance Type *"
              value={compForm.compliance_type}
              onChange={(e) => setCompForm({ ...compForm, compliance_type: e.target.value })}
              placeholder="e.g. ISO_9001, GDPR, RoHS"
            />
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Status</label>
              <select
                value={compForm.status}
                onChange={(e) => setCompForm({ ...compForm, status: e.target.value })}
                className="w-full rounded-[10px] border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#51459d]/30 focus:border-[#51459d]"
              >
                {COMPLIANCE_STATUSES.map((s) => (
                  <option key={s} value={s}>{s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}</option>
                ))}
              </select>
            </div>
          </div>
          <Input
            label="Expiry Date"
            type="date"
            value={compForm.expiry_date}
            onChange={(e) => setCompForm({ ...compForm, expiry_date: e.target.value })}
          />
          <div className="flex justify-end gap-2 pt-2 border-t border-gray-100 dark:border-gray-800">
            <Button variant="secondary" size="sm" onClick={() => setShowComplianceCreate(false)}>Cancel</Button>
            <Button size="sm" onClick={handleCreateCompliance} loading={createCompMutation.isPending}>
              Create Record
            </Button>
          </div>
        </div>
      </Modal>

      {/* ─── Create ESG Metric Modal ────────────────────────────────────── */}
      <Modal open={showESGCreate} onClose={() => setShowESGCreate(false)} title="New ESG Metric" size="lg">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Metric Type *</label>
              <select
                value={esgForm.metric_type}
                onChange={(e) => setEsgForm({ ...esgForm, metric_type: e.target.value })}
                className="w-full rounded-[10px] border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#51459d]/30 focus:border-[#51459d]"
              >
                {METRIC_TYPES.map((t) => (
                  <option key={t} value={t}>{t.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}</option>
                ))}
              </select>
            </div>
            <Input
              label="Period *"
              value={esgForm.period}
              onChange={(e) => setEsgForm({ ...esgForm, period: e.target.value })}
              placeholder="e.g. 2026-Q1, 2026-03"
            />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <Input
              label="Value *"
              type="number"
              value={esgForm.value}
              onChange={(e) => setEsgForm({ ...esgForm, value: e.target.value })}
              placeholder="Metric value"
            />
            <Input
              label="Unit *"
              value={esgForm.unit}
              onChange={(e) => setEsgForm({ ...esgForm, unit: e.target.value })}
              placeholder="e.g. kg_co2, liters"
            />
            <Input
              label="Benchmark"
              type="number"
              value={esgForm.benchmark}
              onChange={(e) => setEsgForm({ ...esgForm, benchmark: e.target.value })}
              placeholder="Industry benchmark"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Supplier ID"
              value={esgForm.supplier_id}
              onChange={(e) => setEsgForm({ ...esgForm, supplier_id: e.target.value })}
              placeholder="Optional supplier UUID"
            />
            <Input
              label="Source"
              value={esgForm.source}
              onChange={(e) => setEsgForm({ ...esgForm, source: e.target.value })}
              placeholder="e.g. manual, supplier_report, audit"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-gray-100 dark:border-gray-800">
            <Button variant="secondary" size="sm" onClick={() => setShowESGCreate(false)}>Cancel</Button>
            <Button size="sm" onClick={handleCreateESG} loading={createESGMutation.isPending}>
              Create Metric
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
