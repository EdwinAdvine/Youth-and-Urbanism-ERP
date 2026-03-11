import { useState } from 'react'
import {
  cn,
  Button,
  Card,
  Spinner,
  Table,
} from '../../components/ui'
import {
  useAgedReceivables,
  useAgedPayables,
  type AgedItem,
  type AgedReport,
} from '../../api/finance'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)
}

// ─── Aged Table ──────────────────────────────────────────────────────────────

function AgedTable({ data, isLoading, error }: { data?: AgedReport; isLoading: boolean; error: unknown }) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Spinner size="lg" />
      </div>
    )
  }

  if (error) {
    return <p className="text-sm text-danger py-4">Failed to load report.</p>
  }

  if (!data || data.items.length === 0) {
    return <p className="text-sm text-gray-400 py-4">No outstanding items found.</p>
  }

  const columns = [
    {
      key: 'name',
      label: 'Name',
      render: (row: AgedItem) => (
        <div>
          <span className="font-medium text-gray-900 dark:text-gray-100">{row.name}</span>
          <p className="text-xs text-gray-500">{row.reference}</p>
        </div>
      ),
    },
    {
      key: 'current',
      label: 'Current',
      render: (row: AgedItem) => (
        <span className={cn('text-sm', row.current > 0 ? 'text-green-700 font-medium' : 'text-gray-400')}>
          {formatCurrency(row.current)}
        </span>
      ),
    },
    {
      key: 'days_30',
      label: '1-30 Days',
      render: (row: AgedItem) => (
        <span className={cn('text-sm', row.days_30 > 0 ? 'text-amber-600 font-medium' : 'text-gray-400')}>
          {formatCurrency(row.days_30)}
        </span>
      ),
    },
    {
      key: 'days_60',
      label: '31-60 Days',
      render: (row: AgedItem) => (
        <span className={cn('text-sm', row.days_60 > 0 ? 'text-orange-600 font-medium' : 'text-gray-400')}>
          {formatCurrency(row.days_60)}
        </span>
      ),
    },
    {
      key: 'days_90',
      label: '61-90 Days',
      render: (row: AgedItem) => (
        <span className={cn('text-sm', row.days_90 > 0 ? 'text-red-500 font-medium' : 'text-gray-400')}>
          {formatCurrency(row.days_90)}
        </span>
      ),
    },
    {
      key: 'days_120_plus',
      label: '90+ Days',
      render: (row: AgedItem) => (
        <span className={cn('text-sm', row.days_120_plus > 0 ? 'text-danger font-bold' : 'text-gray-400')}>
          {formatCurrency(row.days_120_plus)}
        </span>
      ),
    },
    {
      key: 'total',
      label: 'Total',
      render: (row: AgedItem) => (
        <span className="font-semibold text-gray-900 dark:text-gray-100">{formatCurrency(row.total)}</span>
      ),
    },
  ]

  return (
    <div>
      <Card padding={false}>
        <Table<AgedItem>
          columns={columns}
          data={data.items}
          emptyText="No items"
          keyExtractor={(row) => row.id}
        />
      </Card>

      {/* Totals row */}
      <Card className="mt-4">
        <div className="grid grid-cols-7 gap-4 text-center">
          <div>
            <p className="text-xs text-gray-500 mb-1">Total</p>
            <p className="text-lg font-bold text-gray-900 dark:text-gray-100">{formatCurrency(data.totals.total)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">Current</p>
            <p className="text-lg font-bold text-green-700">{formatCurrency(data.totals.current)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">1-30 Days</p>
            <p className="text-lg font-bold text-amber-600">{formatCurrency(data.totals.days_30)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">31-60 Days</p>
            <p className="text-lg font-bold text-orange-600">{formatCurrency(data.totals.days_60)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">61-90 Days</p>
            <p className="text-lg font-bold text-red-500">{formatCurrency(data.totals.days_90)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">90+ Days</p>
            <p className="text-lg font-bold text-danger">{formatCurrency(data.totals.days_120_plus)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">As of</p>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{data.as_of}</p>
          </div>
        </div>
      </Card>
    </div>
  )
}

// ─── AgedReportPage ──────────────────────────────────────────────────────────

export default function AgedReportPage() {
  const [tab, setTab] = useState<'receivables' | 'payables'>('receivables')

  const receivables = useAgedReceivables()
  const payables = useAgedPayables()

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Aged Report</h1>
          <p className="text-sm text-gray-500 mt-1">Outstanding receivables and payables by aging bucket</p>
        </div>
      </div>

      {/* Tab selector */}
      <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-900 rounded-[10px] p-1 w-fit mb-6">
        <button
          onClick={() => setTab('receivables')}
          className={cn(
            'px-4 py-2 text-sm font-medium rounded-[8px] transition-colors',
            tab === 'receivables'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          )}
        >
          Receivables
        </button>
        <button
          onClick={() => setTab('payables')}
          className={cn(
            'px-4 py-2 text-sm font-medium rounded-[8px] transition-colors',
            tab === 'payables'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          )}
        >
          Payables
        </button>
      </div>

      {/* Content */}
      {tab === 'receivables' ? (
        <AgedTable
          data={receivables.data}
          isLoading={receivables.isLoading}
          error={receivables.error}
        />
      ) : (
        <AgedTable
          data={payables.data}
          isLoading={payables.isLoading}
          error={payables.error}
        />
      )}
    </div>
  )
}
