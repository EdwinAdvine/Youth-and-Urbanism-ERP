import { useNavigate } from 'react-router-dom'
import { cn, Button, Spinner, Badge, Card, Table } from '../../components/ui'
import {
  useSupplyChainDashboard,
  useRequisitions,
  useGRNs,
  type ProcurementRequisition,
  type GoodsReceivedNote,
} from '../../api/supplychain'

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatCurrency(value: string | number) {
  const num = typeof value === 'string' ? parseFloat(value) : value
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(num)
}

const STATUS_BADGE: Record<string, 'success' | 'danger' | 'info' | 'warning' | 'default' | 'primary'> = {
  draft: 'default',
  submitted: 'info',
  approved: 'success',
  rejected: 'danger',
  converted_to_po: 'primary',
  inspecting: 'warning',
  accepted: 'success',
  partial: 'warning',
  pending_approval: 'info',
  shipped: 'info',
  completed: 'success',
}

const PRIORITY_BADGE: Record<string, 'success' | 'danger' | 'warning' | 'info' | 'default'> = {
  low: 'default',
  medium: 'info',
  high: 'warning',
  urgent: 'danger',
}

export default function SupplyChainDashboard() {
  const navigate = useNavigate()
  const { data: stats, isLoading: statsLoading } = useSupplyChainDashboard()
  const { data: recentReqs, isLoading: reqsLoading } = useRequisitions({ limit: 5 })
  const { data: recentGRNs, isLoading: grnsLoading } = useGRNs({ limit: 5 })

  if (statsLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Spinner size="lg" />
      </div>
    )
  }

  const statCards = [
    {
      label: 'Total Suppliers',
      value: String(stats?.total_suppliers ?? 0),
      icon: (
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
      ),
      color: 'text-[#51459d] bg-[#51459d]/10',
    },
    {
      label: 'Pending Requisitions',
      value: String(stats?.pending_requisitions ?? 0),
      icon: (
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
      color: 'text-[#ffa21d] bg-[#ffa21d]/10',
    },
    {
      label: 'Open GRNs',
      value: String(stats?.open_grns ?? 0),
      icon: (
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
        </svg>
      ),
      color: 'text-[#3ec9d6] bg-[#3ec9d6]/10',
    },
    {
      label: 'Pending Returns',
      value: String(stats?.pending_returns ?? 0),
      icon: (
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
        </svg>
      ),
      color: (stats?.pending_returns ?? 0) > 0 ? 'text-[#ff3a6e] bg-[#ff3a6e]/10' : 'text-gray-600 bg-gray-50',
    },
  ]

  const reqColumns = [
    {
      key: 'requisition_number',
      label: 'Req #',
      render: (row: ProcurementRequisition) => (
        <span className="text-[#51459d] font-medium">{row.requisition_number}</span>
      ),
    },
    {
      key: 'title',
      label: 'Title',
      render: (row: ProcurementRequisition) => (
        <span className="text-gray-700 truncate max-w-[200px] block">{row.title}</span>
      ),
    },
    {
      key: 'priority',
      label: 'Priority',
      render: (row: ProcurementRequisition) => (
        <Badge variant={PRIORITY_BADGE[row.priority] ?? 'default'}>{row.priority}</Badge>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (row: ProcurementRequisition) => (
        <Badge variant={STATUS_BADGE[row.status] ?? 'default'}>
          {row.status.replace(/_/g, ' ')}
        </Badge>
      ),
    },
    {
      key: 'total_estimated',
      label: 'Est. Value',
      render: (row: ProcurementRequisition) => (
        <span className="text-gray-700">{formatCurrency(row.total_estimated)}</span>
      ),
    },
    {
      key: 'created_at',
      label: 'Created',
      render: (row: ProcurementRequisition) => (
        <span className="text-gray-500 text-xs">{formatDate(row.created_at)}</span>
      ),
    },
  ]

  const grnColumns = [
    {
      key: 'grn_number',
      label: 'GRN #',
      render: (row: GoodsReceivedNote) => (
        <span className="text-[#51459d] font-medium">{row.grn_number}</span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (row: GoodsReceivedNote) => (
        <Badge variant={STATUS_BADGE[row.status] ?? 'default'}>
          {row.status.replace(/_/g, ' ')}
        </Badge>
      ),
    },
    {
      key: 'received_date',
      label: 'Received',
      render: (row: GoodsReceivedNote) => (
        <span className="text-gray-500 text-xs">{formatDate(row.received_date)}</span>
      ),
    },
    {
      key: 'created_at',
      label: 'Created',
      render: (row: GoodsReceivedNote) => (
        <span className="text-gray-500 text-xs">{formatDate(row.created_at)}</span>
      ),
    },
  ]

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Supply Chain</h1>
          <p className="text-sm text-gray-500 mt-1">Suppliers, procurement, goods receiving, and returns</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate('/supply-chain/suppliers')}>
            Suppliers
          </Button>
          <Button onClick={() => navigate('/supply-chain/requisitions')}>
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Requisition
          </Button>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex flex-wrap gap-2 mb-6">
        {[
          { label: 'Suppliers', path: '/supply-chain/suppliers' },
          { label: 'Requisitions', path: '/supply-chain/requisitions' },
          { label: 'Goods Received', path: '/supply-chain/grn' },
          { label: 'Returns', path: '/supply-chain/returns' },
        ].map((item) => (
          <Button key={item.path} variant="outline" size="sm" onClick={() => navigate(item.path)}>
            {item.label}
          </Button>
        ))}
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {statCards.map((stat) => (
          <Card key={stat.label}>
            <div className="flex items-start gap-4">
              <div className={cn('p-3 rounded-[10px]', stat.color)}>
                {stat.icon}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{stat.label}</p>
                <p className="text-lg font-bold text-gray-900 mt-1">{stat.value}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Value Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <Card>
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-[10px] text-[#51459d] bg-[#51459d]/10">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Pending Requisition Value</p>
              <p className="text-lg font-bold text-gray-900 mt-1">
                {formatCurrency(stats?.pending_requisition_value ?? '0')}
              </p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-[10px] text-[#ff3a6e] bg-[#ff3a6e]/10">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
              </svg>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Pending Return Value</p>
              <p className="text-lg font-bold text-gray-900 mt-1">
                {formatCurrency(stats?.pending_return_value ?? '0')}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Recent Requisitions */}
      <Card padding={false} className="mb-6">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">Recent Requisitions</h2>
          <Button variant="ghost" size="sm" onClick={() => navigate('/supply-chain/requisitions')}>
            View All
          </Button>
        </div>
        <Table<ProcurementRequisition>
          columns={reqColumns}
          data={recentReqs?.requisitions ?? []}
          loading={reqsLoading}
          emptyText="No requisitions yet"
          keyExtractor={(row) => row.id}
        />
      </Card>

      {/* Recent GRNs */}
      <Card padding={false}>
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">Recent Goods Received Notes</h2>
          <Button variant="ghost" size="sm" onClick={() => navigate('/supply-chain/grn')}>
            View All
          </Button>
        </div>
        <Table<GoodsReceivedNote>
          columns={grnColumns}
          data={recentGRNs?.grns ?? []}
          loading={grnsLoading}
          emptyText="No GRNs yet"
          keyExtractor={(row) => row.id}
        />
      </Card>
    </div>
  )
}
