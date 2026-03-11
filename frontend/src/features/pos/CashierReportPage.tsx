import { useState } from 'react'
import { Card, Table, Spinner } from '../../components/ui'
import { useCashierReport, type CashierReportData } from '../../api/pos_ext'

function formatCurrency(amount: number | null) {
  if (amount === null || amount === undefined) return '-'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)
}

function getDefaultDates() {
  const end = new Date()
  const start = new Date()
  start.setDate(start.getDate() - 30)
  return {
    start_date: start.toISOString().slice(0, 10),
    end_date: end.toISOString().slice(0, 10),
  }
}

export default function CashierReportPage() {
  const defaults = getDefaultDates()
  const [startDate, setStartDate] = useState(defaults.start_date)
  const [endDate, setEndDate] = useState(defaults.end_date)

  const { data: cashierData, isLoading } = useCashierReport({
    start_date: startDate,
    end_date: endDate,
  })

  const rows = cashierData ?? []

  // Summary totals
  const totalTransactions = rows.reduce((sum, c) => sum + c.transaction_count, 0)
  const totalSales = rows.reduce((sum, c) => sum + c.total_sales, 0)
  const totalRefunds = rows.reduce((sum, c) => sum + c.refund_count, 0)
  const totalItemsSold = rows.reduce((sum, c) => sum + c.items_sold, 0)
  const overallAvg = totalTransactions > 0 ? totalSales / totalTransactions : 0

  // Find top performer
  const topCashier = rows.length > 0
    ? rows.reduce((best, c) => (c.total_sales > best.total_sales ? c : best), rows[0])
    : null

  const maxSales = Math.max(...rows.map((c) => c.total_sales), 1)

  const columns = [
    {
      key: 'cashier_name',
      label: 'Cashier',
      render: (row: CashierReportData) => (
        <span className="font-medium text-gray-900">{row.cashier_name}</span>
      ),
    },
    {
      key: 'transaction_count',
      label: 'Transactions',
      render: (row: CashierReportData) => (
        <span className="text-sm text-gray-700">{row.transaction_count.toLocaleString()}</span>
      ),
    },
    {
      key: 'total_sales',
      label: 'Total Sales',
      render: (row: CashierReportData) => (
        <span className="font-semibold text-gray-900">{formatCurrency(row.total_sales)}</span>
      ),
    },
    {
      key: 'avg_transaction',
      label: 'Avg Transaction',
      render: (row: CashierReportData) => (
        <span className="text-sm text-gray-600">{formatCurrency(row.avg_transaction)}</span>
      ),
    },
    {
      key: 'items_sold',
      label: 'Items Sold',
      render: (row: CashierReportData) => (
        <span className="text-sm text-gray-700">{row.items_sold.toLocaleString()}</span>
      ),
    },
    {
      key: 'refund_count',
      label: 'Refunds',
      render: (row: CashierReportData) => (
        <span className={`text-sm ${row.refund_count > 0 ? 'text-red-600 font-medium' : 'text-gray-400'}`}>
          {row.refund_count > 0 ? row.refund_count : '-'}
        </span>
      ),
    },
    {
      key: 'performance',
      label: 'Performance',
      render: (row: CashierReportData) => {
        const pct = (row.total_sales / maxSales) * 100
        return (
          <div className="w-32">
            <div className="w-full bg-gray-100 rounded-full h-2">
              <div
                className="bg-primary h-full rounded-full transition-all duration-500"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        )
      },
    },
  ]

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Cashier Performance Report</h1>
          <p className="text-sm text-gray-500 mt-1">Per-cashier sales and transaction metrics</p>
        </div>
        <div className="flex gap-3 items-center">
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600">From</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="rounded-[10px] border border-gray-200 dark:border-gray-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600">To</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="rounded-[10px] border border-gray-200 dark:border-gray-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          { label: 'Total Cashiers', value: rows.length.toString(), color: 'text-primary' },
          { label: 'Total Transactions', value: totalTransactions.toLocaleString(), color: 'text-blue-600' },
          { label: 'Total Sales', value: formatCurrency(totalSales), color: 'text-green-600' },
          { label: 'Avg Transaction', value: formatCurrency(overallAvg), color: 'text-orange-600' },
          { label: 'Total Items Sold', value: totalItemsSold.toLocaleString(), color: 'text-gray-900' },
        ].map((kpi) => (
          <Card key={kpi.label}>
            <p className="text-sm text-gray-500">{kpi.label}</p>
            <p className={`text-2xl font-bold mt-1 ${kpi.color}`}>{kpi.value}</p>
          </Card>
        ))}
      </div>

      {/* Top Performer Highlight */}
      {topCashier && (
        <Card className="bg-primary/5 border-primary/20">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
              <svg className="h-6 w-6 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
              </svg>
            </div>
            <div>
              <p className="text-sm text-gray-500">Top Performer</p>
              <p className="text-lg font-bold text-gray-900">{topCashier.cashier_name}</p>
              <p className="text-sm text-gray-600">
                {formatCurrency(topCashier.total_sales)} across {topCashier.transaction_count} transactions
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Cashier Sales Comparison */}
      {!isLoading && rows.length > 0 && (
        <Card>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Sales Comparison</h2>
          <div className="space-y-3">
            {[...rows]
              .sort((a, b) => b.total_sales - a.total_sales)
              .map((c) => {
                const pct = (c.total_sales / maxSales) * 100
                return (
                  <div key={c.cashier_id} className="flex items-center gap-3">
                    <span className="text-sm text-gray-700 w-32 shrink-0 truncate font-medium">
                      {c.cashier_name}
                    </span>
                    <div className="flex-1 bg-gray-100 rounded-full h-6 relative overflow-hidden">
                      <div
                        className="bg-primary h-full rounded-full transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-sm font-medium text-gray-900 w-24 text-right">
                      {formatCurrency(c.total_sales)}
                    </span>
                    <span className="text-xs text-gray-400 w-16 text-right">
                      {c.transaction_count} txns
                    </span>
                  </div>
                )
              })}
          </div>
        </Card>
      )}

      {/* Detailed Table */}
      <Card padding={false}>
        <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800">
          <h2 className="text-sm font-semibold text-gray-700">Cashier Details</h2>
        </div>
        <Table<CashierReportData>
          columns={columns}
          data={rows}
          loading={isLoading}
          emptyText="No cashier data for selected period"
          keyExtractor={(row) => row.cashier_id}
        />
      </Card>
    </div>
  )
}
