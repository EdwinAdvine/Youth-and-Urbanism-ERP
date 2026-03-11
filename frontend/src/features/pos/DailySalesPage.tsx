import { useState } from 'react'
import { Card, Table, Spinner } from '../../components/ui'
import { useDailySalesReport, type DailySalesData } from '../../api/pos_ext'

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

export default function DailySalesPage() {
  const defaults = getDefaultDates()
  const [startDate, setStartDate] = useState(defaults.start_date)
  const [endDate, setEndDate] = useState(defaults.end_date)

  const { data: salesData, isLoading } = useDailySalesReport({
    start_date: startDate,
    end_date: endDate,
  })

  const rows = salesData ?? []

  // Summary calculations
  const totalSales = rows.reduce((sum, d) => sum + d.total_sales, 0)
  const totalTransactions = rows.reduce((sum, d) => sum + d.transaction_count, 0)
  const avgTicket = totalTransactions > 0 ? totalSales / totalTransactions : 0
  const totalRefunds = rows.reduce((sum, d) => sum + d.refund_total, 0)
  const netSales = rows.reduce((sum, d) => sum + d.net_sales, 0)

  // Bar chart max
  const maxDaySales = Math.max(...rows.map((d) => d.total_sales), 1)

  const columns = [
    {
      key: 'date',
      label: 'Date',
      render: (row: DailySalesData) => (
        <span className="font-medium text-gray-900">
          {new Date(row.date).toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
          })}
        </span>
      ),
    },
    {
      key: 'total_sales',
      label: 'Total Sales',
      render: (row: DailySalesData) => (
        <span className="font-semibold text-gray-900">{formatCurrency(row.total_sales)}</span>
      ),
    },
    {
      key: 'transaction_count',
      label: 'Transactions',
      render: (row: DailySalesData) => (
        <span className="text-sm text-gray-700">{row.transaction_count}</span>
      ),
    },
    {
      key: 'avg_transaction',
      label: 'Avg Ticket',
      render: (row: DailySalesData) => (
        <span className="text-sm text-gray-600">{formatCurrency(row.avg_transaction)}</span>
      ),
    },
    {
      key: 'refund_count',
      label: 'Refunds',
      render: (row: DailySalesData) => (
        <span className="text-sm text-gray-500">
          {row.refund_count > 0 ? `${row.refund_count} (${formatCurrency(row.refund_total)})` : '-'}
        </span>
      ),
    },
    {
      key: 'net_sales',
      label: 'Net Sales',
      render: (row: DailySalesData) => (
        <span className="font-semibold text-green-600">{formatCurrency(row.net_sales)}</span>
      ),
    },
  ]

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Daily Sales Report</h1>
          <p className="text-sm text-gray-500 mt-1">POS sales performance by day</p>
        </div>
        <div className="flex gap-3 items-center">
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600">From</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="rounded-[10px] border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600">To</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="rounded-[10px] border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          { label: 'Total Sales', value: formatCurrency(totalSales), color: 'text-primary' },
          { label: 'Transactions', value: totalTransactions.toLocaleString(), color: 'text-blue-600' },
          { label: 'Avg Ticket', value: formatCurrency(avgTicket), color: 'text-green-600' },
          { label: 'Refunds', value: formatCurrency(totalRefunds), color: 'text-red-600' },
          { label: 'Net Sales', value: formatCurrency(netSales), color: 'text-gray-900' },
        ].map((kpi) => (
          <Card key={kpi.label}>
            <p className="text-sm text-gray-500">{kpi.label}</p>
            <p className={`text-2xl font-bold mt-1 ${kpi.color}`}>{kpi.value}</p>
          </Card>
        ))}
      </div>

      {/* Sales Bar Chart */}
      <Card>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Sales by Day</h2>
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Spinner />
          </div>
        ) : rows.length === 0 ? (
          <p className="text-center text-gray-400 py-12">No sales data for selected period</p>
        ) : (
          <div className="space-y-2">
            {rows.map((d) => {
              const pct = (d.total_sales / maxDaySales) * 100
              return (
                <div key={d.date} className="flex items-center gap-3">
                  <span className="text-sm text-gray-500 w-20 shrink-0 text-right">
                    {new Date(d.date).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                    })}
                  </span>
                  <div className="flex-1 bg-gray-100 rounded-full h-6 relative overflow-hidden">
                    <div
                      className="bg-primary h-full rounded-full transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-sm font-medium text-gray-900 w-24 text-right">
                    {formatCurrency(d.total_sales)}
                  </span>
                  <span className="text-xs text-gray-400 w-16 text-right">
                    {d.transaction_count} txns
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </Card>

      {/* Daily Breakdown Table */}
      <Card padding={false}>
        <div className="px-4 py-3 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-700">Daily Breakdown</h2>
        </div>
        <Table<DailySalesData>
          columns={columns}
          data={rows}
          loading={isLoading}
          emptyText="No sales data for selected period"
          keyExtractor={(row) => row.date}
        />
      </Card>
    </div>
  )
}
