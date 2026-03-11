import { useState } from 'react'
import { Button, Card, Input, Spinner, Badge } from '../../components/ui'
import { usePnLReport } from '../../api/finance'

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)
}

export default function PnLReport() {
  const today = new Date()
  const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0]
  const todayStr = today.toISOString().split('T')[0]

  const [fromDate, setFromDate] = useState(firstOfMonth)
  const [toDate, setToDate] = useState(todayStr)
  const [queryDates, setQueryDates] = useState({ from: firstOfMonth, to: todayStr })

  const { data: report, isLoading } = usePnLReport(queryDates.from, queryDates.to)

  function handleGenerate() {
    setQueryDates({ from: fromDate, to: toDate })
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Profit & Loss Statement</h1>
        <p className="text-sm text-gray-500 mt-1">Income statement for a specified period</p>
      </div>

      {/* Date Range Selector */}
      <Card>
        <div className="flex items-end gap-4">
          <Input label="From" type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
          <Input label="To" type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
          <Button size="sm" onClick={handleGenerate}>Generate</Button>
        </div>
      </Card>

      {isLoading ? (
        <div className="flex items-center justify-center min-h-[40vh]">
          <Spinner size="lg" />
        </div>
      ) : report ? (
        <div className="space-y-6">
          {/* Revenue Section */}
          <Card>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Revenue</h2>
            {report.revenue.length === 0 ? (
              <p className="text-sm text-gray-400">No revenue entries for this period</p>
            ) : (
              <div className="space-y-2">
                {report.revenue.map((r) => (
                  <div key={r.account_id} className="flex items-center justify-between py-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-gray-400">{r.account_code}</span>
                      <span className="text-sm text-gray-700">{r.account_name}</span>
                    </div>
                    <span className="text-sm font-medium text-green-600">{formatCurrency(r.amount)}</span>
                  </div>
                ))}
                <div className="border-t border-gray-200 pt-2 mt-2 flex items-center justify-between">
                  <span className="text-sm font-semibold text-gray-900">Total Revenue</span>
                  <span className="text-base font-bold text-green-600">{formatCurrency(report.total_revenue)}</span>
                </div>
              </div>
            )}
          </Card>

          {/* Expenses Section */}
          <Card>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Expenses</h2>
            {report.expenses.length === 0 ? (
              <p className="text-sm text-gray-400">No expense entries for this period</p>
            ) : (
              <div className="space-y-2">
                {report.expenses.map((e) => (
                  <div key={e.account_id} className="flex items-center justify-between py-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-gray-400">{e.account_code}</span>
                      <span className="text-sm text-gray-700">{e.account_name}</span>
                    </div>
                    <span className="text-sm font-medium text-red-600">{formatCurrency(e.amount)}</span>
                  </div>
                ))}
                <div className="border-t border-gray-200 pt-2 mt-2 flex items-center justify-between">
                  <span className="text-sm font-semibold text-gray-900">Total Expenses</span>
                  <span className="text-base font-bold text-red-600">{formatCurrency(report.total_expenses)}</span>
                </div>
              </div>
            )}
          </Card>

          {/* Net Income */}
          <Card>
            <div className="flex items-center justify-between">
              <span className="text-lg font-bold text-gray-900">Net Income</span>
              <div className="flex items-center gap-3">
                <span className={`text-2xl font-bold ${report.net_income >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatCurrency(report.net_income)}
                </span>
                <Badge variant={report.net_income >= 0 ? 'success' : 'danger'}>
                  {report.net_income >= 0 ? 'Profit' : 'Loss'}
                </Badge>
              </div>
            </div>
          </Card>
        </div>
      ) : null}
    </div>
  )
}
