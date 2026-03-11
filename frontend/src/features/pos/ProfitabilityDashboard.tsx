import { useState } from 'react'
import { Button, Card, Spinner, Input, Table, Badge } from '../../components/ui'
import { useProfitabilityReport, type ProfitabilityProduct } from '../../api/pos'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(value: string | number): string {
  const n = typeof value === 'string' ? parseFloat(value) : value
  return isNaN(n) ? '0.00' : n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function marginBadge(pct: string) {
  const n = parseFloat(pct)
  if (n >= 50) return <Badge variant="success">{fmt(pct)}%</Badge>
  if (n >= 20) return <Badge variant="warning">{fmt(pct)}%</Badge>
  return <Badge variant="danger">{fmt(pct)}%</Badge>
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function ProfitabilityDashboard() {
  const today = new Date().toISOString().slice(0, 10)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)

  const [dateFrom, setDateFrom] = useState(thirtyDaysAgo)
  const [dateTo, setDateTo] = useState(today)

  const { data, isLoading } = useProfitabilityReport({
    date_from: dateFrom,
    date_to: dateTo,
    limit: 100,
  })

  const summary = data?.summary
  const products = data?.products ?? []

  const columns = [
    {
      key: 'item_name',
      label: 'Product',
      render: (p: ProfitabilityProduct) => (
        <div>
          <p className="font-medium text-gray-900 dark:text-gray-100">{p.item_name}</p>
          <p className="text-xs text-gray-400">{p.item_sku}</p>
        </div>
      ),
    },
    {
      key: 'category',
      label: 'Category',
      render: (p: ProfitabilityProduct) => (
        <span className="text-sm text-gray-600 dark:text-gray-300">{p.category ?? '--'}</span>
      ),
    },
    {
      key: 'quantity_sold',
      label: 'Qty Sold',
      className: 'text-right',
      render: (p: ProfitabilityProduct) => (
        <span className="text-sm text-gray-900 dark:text-gray-100">{p.quantity_sold}</span>
      ),
    },
    {
      key: 'revenue',
      label: 'Revenue',
      className: 'text-right',
      render: (p: ProfitabilityProduct) => (
        <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{fmt(p.revenue)}</span>
      ),
    },
    {
      key: 'cogs',
      label: 'COGS',
      className: 'text-right',
      render: (p: ProfitabilityProduct) => (
        <span className="text-sm text-gray-600 dark:text-gray-300">{fmt(p.cogs)}</span>
      ),
    },
    {
      key: 'gross_margin',
      label: 'Gross Margin',
      className: 'text-right',
      render: (p: ProfitabilityProduct) => (
        <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{fmt(p.gross_margin)}</span>
      ),
    },
    {
      key: 'margin_percentage',
      label: 'Margin %',
      className: 'text-right',
      render: (p: ProfitabilityProduct) => marginBadge(p.margin_percentage),
    },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Profitability Analysis</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          COGS vs Revenue vs Margin breakdown by product.
        </p>
      </div>

      {/* Date Range Filter */}
      <Card>
        <div className="flex flex-wrap items-end gap-4">
          <Input
            label="From"
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
          />
          <Input
            label="To"
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
          />
          <Button
            variant="secondary"
            onClick={() => {
              setDateFrom(thirtyDaysAgo)
              setDateTo(today)
            }}
          >
            Reset
          </Button>
        </div>
      </Card>

      {/* Summary Cards */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Spinner size="lg" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Total Revenue</p>
              <p className="text-3xl font-bold text-gray-900 dark:text-gray-100 mt-1">{fmt(summary?.total_revenue ?? '0')}</p>
            </Card>
            <Card>
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Total COGS</p>
              <p className="text-3xl font-bold text-gray-900 dark:text-gray-100 mt-1">{fmt(summary?.total_cogs ?? '0')}</p>
            </Card>
            <Card>
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Gross Margin</p>
              <p className="text-3xl font-bold text-[#6fd943] mt-1">{fmt(summary?.total_gross_margin ?? '0')}</p>
            </Card>
            <Card>
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Margin %</p>
              <p className="text-3xl font-bold text-[#51459d] mt-1">
                {fmt(summary?.overall_margin_percentage ?? '0')}%
              </p>
            </Card>
          </div>

          {/* Product Table */}
          <Card padding={false}>
            <Table
              columns={columns}
              data={products}
              keyExtractor={(p) => p.item_id}
              emptyText="No profitability data for the selected period."
            />
          </Card>
        </>
      )}
    </div>
  )
}
