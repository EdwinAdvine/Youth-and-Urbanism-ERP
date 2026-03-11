import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Button, Badge, Card, Table, Pagination, toast,
} from '../../components/ui'
import {
  useStockHealth, useAnalyzeStockHealth,
  type StockHealthScoreItem,
} from '../../api/supplychain_ops'

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}

const HEALTH_BADGE: Record<string, 'success' | 'danger' | 'warning' | 'info' | 'default'> = {
  healthy: 'success',
  slow_moving: 'warning',
  obsolete: 'danger',
  overstock: 'info',
  understock: 'danger',
}

const HEALTH_COLORS: Record<string, string> = {
  healthy: '#6fd943',
  slow_moving: '#ffa21d',
  obsolete: '#ff3a6e',
  overstock: '#3ec9d6',
  understock: '#ff3a6e',
}

export default function StockHealthPage() {
  const navigate = useNavigate()
  const [page, setPage] = useState(1)
  const [filterStatus, setFilterStatus] = useState('')

  const limit = 20
  const skip = (page - 1) * limit

  const { data, isLoading } = useStockHealth({
    health_status: filterStatus || undefined,
    skip,
    limit,
  })
  const analyzeMutation = useAnalyzeStockHealth()

  const totalPages = data ? Math.ceil(data.total / limit) : 1

  // Calculate summary counts
  const allScores = data?.scores ?? []
  const total = data?.total ?? 0

  const healthCounts: Record<string, number> = {}
  for (const s of allScores) {
    healthCounts[s.health_status] = (healthCounts[s.health_status] || 0) + 1
  }

  const handleAnalyze = async () => {
    try {
      const result = await analyzeMutation.mutateAsync()
      toast('success', `Analysis complete: ${result.analyzed} items analyzed`)
    } catch {
      toast('error', 'Stock health analysis failed')
    }
  }

  const summaryCards = [
    { label: 'Healthy', key: 'healthy', color: HEALTH_COLORS.healthy },
    { label: 'Slow Moving', key: 'slow_moving', color: HEALTH_COLORS.slow_moving },
    { label: 'Obsolete', key: 'obsolete', color: HEALTH_COLORS.obsolete },
    { label: 'Overstock', key: 'overstock', color: HEALTH_COLORS.overstock },
    { label: 'Understock', key: 'understock', color: HEALTH_COLORS.understock },
  ]

  const columns = [
    {
      key: 'item_id',
      label: 'Item',
      render: (row: StockHealthScoreItem) => (
        <span className="font-medium text-[#51459d]">{row.item_id.slice(0, 8)}...</span>
      ),
    },
    {
      key: 'warehouse_id',
      label: 'Warehouse',
      render: (row: StockHealthScoreItem) => (
        <span className="text-gray-600 dark:text-gray-400">{row.warehouse_id ? row.warehouse_id.slice(0, 8) + '...' : '-'}</span>
      ),
    },
    {
      key: 'health_status',
      label: 'Status',
      render: (row: StockHealthScoreItem) => (
        <Badge variant={HEALTH_BADGE[row.health_status] ?? 'default'}>
          {row.health_status.replace(/_/g, ' ')}
        </Badge>
      ),
    },
    {
      key: 'days_of_stock',
      label: 'Days of Stock',
      render: (row: StockHealthScoreItem) => (
        <span className="text-gray-700 dark:text-gray-300 font-medium">{row.days_of_stock}</span>
      ),
    },
    {
      key: 'turnover_rate',
      label: 'Turnover',
      render: (row: StockHealthScoreItem) => (
        <span className="text-gray-600 dark:text-gray-400">{Number(row.turnover_rate || 0).toFixed(2)}</span>
      ),
    },
    {
      key: 'last_movement_date',
      label: 'Last Movement',
      render: (row: StockHealthScoreItem) => (
        <span className="text-gray-500 text-xs">{row.last_movement_date ? formatDate(row.last_movement_date) : '-'}</span>
      ),
    },
    {
      key: 'recommended_action',
      label: 'Action',
      render: (row: StockHealthScoreItem) => (
        <span className="text-sm text-gray-600 dark:text-gray-400 capitalize">{row.recommended_action.replace(/_/g, ' ')}</span>
      ),
    },
    {
      key: 'calculated_at',
      label: 'Analyzed',
      render: (row: StockHealthScoreItem) => (
        <span className="text-gray-500 text-xs">{formatDate(row.calculated_at)}</span>
      ),
    },
  ]

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Stock Health</h1>
          <p className="text-sm text-gray-500 mt-1">{total} items scored</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => navigate('/supply-chain')}>
            Dashboard
          </Button>
          <Button onClick={handleAnalyze} loading={analyzeMutation.isPending}>
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            Run Analysis
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        {summaryCards.map((card) => (
          <button
            key={card.key}
            onClick={() => { setFilterStatus(filterStatus === card.key ? '' : card.key); setPage(1) }}
            className={`rounded-[10px] border p-4 text-left transition-all ${
              filterStatus === card.key
                ? 'border-[#51459d] ring-2 ring-[#51459d]/20'
                : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
            } bg-white dark:bg-gray-800`}
          >
            <div className="flex items-center gap-2 mb-1">
              <div className="h-3 w-3 rounded-full" style={{ backgroundColor: card.color }} />
              <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">{card.label}</span>
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              {healthCounts[card.key] || 0}
            </p>
          </button>
        ))}
      </div>

      {/* Table */}
      <Card padding={false}>
        <Table<StockHealthScoreItem>
          columns={columns}
          data={allScores}
          loading={isLoading}
          emptyText="No stock health data. Run analysis to generate scores."
          keyExtractor={(row) => row.id}
        />
        {totalPages > 1 && (
          <Pagination page={page} pages={totalPages} total={total} onChange={setPage} />
        )}
      </Card>
    </div>
  )
}
