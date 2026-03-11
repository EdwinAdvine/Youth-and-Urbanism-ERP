import { useState } from 'react'
import { Card, Spinner, Input, Badge } from '../../components/ui'
import { useHRReports, useHRKPIs } from '../../api/hr'

function formatCurrency(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n)
}

function BarChart({ data, labelKey, valueKey, color = 'bg-primary' }: {
  data: Record<string, unknown>[]
  labelKey: string
  valueKey: string
  color?: string
}) {
  if (!data || data.length === 0) return <p className="text-sm text-gray-400 text-center py-4">No data</p>
  const max = Math.max(...data.map((d) => Number(d[valueKey]) || 0), 1)

  return (
    <div className="space-y-3">
      {data.map((item, i) => {
        const val = Number(item[valueKey]) || 0
        const pct = (val / max) * 100
        return (
          <div key={i} className="flex items-center gap-3">
            <span className="text-sm text-gray-600 w-32 truncate">{String(item[labelKey])}</span>
            <div className="flex-1 h-7 bg-gray-100 rounded-full overflow-hidden">
              <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${pct}%` }} />
            </div>
            <span className="text-sm font-medium text-gray-700 w-24 text-right">{formatCurrency(val)}</span>
          </div>
        )
      })}
    </div>
  )
}

export default function PayrollReportsPage() {
  const [periodStart, setPeriodStart] = useState('')
  const [periodEnd, setPeriodEnd] = useState('')

  const { data: reports, isLoading: reportsLoading } = useHRReports({
    period_start: periodStart || undefined,
    period_end: periodEnd || undefined,
  })
  const { data: kpis, isLoading: kpisLoading } = useHRKPIs()

  if (reportsLoading || kpisLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Spinner size="lg" />
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Payroll Reports</h1>
        <p className="text-sm text-gray-500 mt-1">Payroll costs, tax summaries, and department breakdowns</p>
      </div>

      <div className="flex gap-4 items-end">
        <Input label="Period Start" type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} className="w-48" />
        <Input label="Period End" type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} className="w-48" />
      </div>

      {/* KPI Cards */}
      {kpis && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <p className="text-sm text-gray-500">Total Employees</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{kpis.total_employees}</p>
          </Card>
          <Card>
            <p className="text-sm text-gray-500">Total Payroll Cost</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{formatCurrency(kpis.total_payroll_cost)}</p>
          </Card>
          <Card>
            <p className="text-sm text-gray-500">Average Salary</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{formatCurrency(kpis.avg_salary)}</p>
          </Card>
          <Card>
            <p className="text-sm text-gray-500">Overtime Hours (Month)</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{kpis.overtime_hours_this_month}</p>
          </Card>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Cost by Department */}
        <Card>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Cost by Department</h3>
          <BarChart
            data={reports?.cost_by_department ?? []}
            labelKey="department"
            valueKey="total_cost"
            color="bg-primary"
          />
        </Card>

        {/* Payroll Summary */}
        <Card>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Payroll Summary by Period</h3>
          {reports?.payroll_summary && reports.payroll_summary.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500 uppercase">Period</th>
                    <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500 uppercase">Gross</th>
                    <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500 uppercase">Deductions</th>
                    <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500 uppercase">Net</th>
                  </tr>
                </thead>
                <tbody>
                  {reports.payroll_summary.map((row, i) => (
                    <tr key={i} className="border-b border-gray-50">
                      <td className="py-2 px-3 font-medium">{row.period}</td>
                      <td className="py-2 px-3 text-right">{formatCurrency(row.gross)}</td>
                      <td className="py-2 px-3 text-right text-danger">{formatCurrency(row.deductions)}</td>
                      <td className="py-2 px-3 text-right font-semibold">{formatCurrency(row.net)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-gray-400 text-center py-8">No payroll data for selected period</p>
          )}
        </Card>

        {/* Tax Summary */}
        <Card>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Tax Summary</h3>
          {reports?.tax_summary && reports.tax_summary.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500 uppercase">Tax</th>
                    <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500 uppercase">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {reports.tax_summary.map((row, i) => (
                    <tr key={i} className="border-b border-gray-50">
                      <td className="py-2 px-3">{row.tax_name}</td>
                      <td className="py-2 px-3 text-right font-medium">{formatCurrency(row.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-gray-400 text-center py-8">No tax data</p>
          )}
        </Card>

        {/* Leave Summary */}
        <Card>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Leave Summary</h3>
          {reports?.leave_summary && reports.leave_summary.length > 0 ? (
            <div className="space-y-2">
              {reports.leave_summary.map((row, i) => (
                <div key={i} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                  <div className="flex items-center gap-2">
                    <Badge variant="primary">{row.leave_type}</Badge>
                    <span className="text-xs text-gray-500">{row.count} requests</span>
                  </div>
                  <span className="font-medium text-sm">{row.total_days} days</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400 text-center py-8">No leave data</p>
          )}
        </Card>
      </div>
    </div>
  )
}
