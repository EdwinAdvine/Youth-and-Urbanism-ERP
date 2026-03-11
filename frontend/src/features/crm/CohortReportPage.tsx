import { useState } from 'react'
import { useCohortReport } from '@/api/crm_workflows'
import { Button, Card, Spinner, Select } from '@/components/ui'

interface CohortRow {
  period: string
  total_leads: number
  converted_leads: number
  conversion_rate: number
}

const PERIOD_OPTIONS = [
  { value: '6m', label: 'Last 6 Months' },
  { value: '12m', label: 'Last 12 Months' },
  { value: 'all', label: 'All Time' },
]

function getPeriodParams(period: string): { date_from?: string; date_to?: string } {
  const now = new Date()
  const to = now.toISOString().slice(0, 10)
  if (period === '6m') {
    const from = new Date(now.getFullYear(), now.getMonth() - 6, 1)
    return { date_from: from.toISOString().slice(0, 10), date_to: to }
  }
  if (period === '12m') {
    const from = new Date(now.getFullYear() - 1, now.getMonth(), 1)
    return { date_from: from.toISOString().slice(0, 10), date_to: to }
  }
  return {}
}

function conversionColor(rate: number): string {
  if (rate >= 50) return '#166534' // dark green
  if (rate >= 30) return '#15803d' // green
  if (rate >= 20) return '#65a30d' // lime
  if (rate >= 10) return '#ca8a04' // yellow
  if (rate >= 5) return '#ea580c'  // orange
  return '#dc2626'                 // red
}

function conversionBg(rate: number): string {
  if (rate >= 50) return '#dcfce7' // green-100
  if (rate >= 30) return '#d9f99d' // lime-200
  if (rate >= 20) return '#fef9c3' // yellow-100
  if (rate >= 10) return '#ffedd5' // orange-100
  if (rate >= 5) return '#fee2e2'  // red-100
  return '#fecaca'                 // red-200
}

export default function CohortReportPage() {
  const [period, setPeriod] = useState('12m')
  const params = getPeriodParams(period)
  const { data, isLoading, refetch } = useCohortReport({
    cohort_type: 'monthly',
    period: period === 'all' ? undefined : period,
    ...params,
  })

  const cohorts: CohortRow[] = data?.cohorts ?? data ?? []

  const totalLeads = cohorts.reduce((sum, c) => sum + c.total_leads, 0)
  const totalConverted = cohorts.reduce((sum, c) => sum + c.converted_leads, 0)
  const avgConversion = totalLeads > 0 ? (totalConverted / totalLeads) * 100 : 0

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100">
            Lead Cohort Analysis
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Track lead conversion rates across monthly cohorts
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            options={PERIOD_OPTIONS}
          />
          <Button variant="secondary" onClick={() => refetch()}>
            Refresh
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="text-center py-4">
          <p className="text-2xl font-bold" style={{ color: '#51459d' }}>{totalLeads}</p>
          <p className="text-xs text-gray-500">Total Leads</p>
        </Card>
        <Card className="text-center py-4">
          <p className="text-2xl font-bold" style={{ color: '#6fd943' }}>{totalConverted}</p>
          <p className="text-xs text-gray-500">Converted</p>
        </Card>
        <Card className="text-center py-4">
          <p className="text-2xl font-bold" style={{ color: '#3ec9d6' }}>{avgConversion.toFixed(1)}%</p>
          <p className="text-xs text-gray-500">Avg Conversion Rate</p>
        </Card>
      </div>

      {/* Cohort Table / Heatmap */}
      {isLoading ? (
        <div className="flex items-center justify-center min-h-[40vh]">
          <Spinner size="lg" />
        </div>
      ) : cohorts.length === 0 ? (
        <Card className="text-center py-16">
          <p className="text-gray-400">No cohort data available for the selected period.</p>
        </Card>
      ) : (
        <Card padding={false}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-800">
                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                    Cohort Period
                  </th>
                  <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                    Total Leads
                  </th>
                  <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                    Converted
                  </th>
                  <th className="text-center py-3 px-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                    Conversion Rate
                  </th>
                  <th className="py-3 px-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide" style={{ width: '30%' }}>
                    Visual
                  </th>
                </tr>
              </thead>
              <tbody>
                {cohorts.map((cohort) => {
                  const rate = cohort.conversion_rate ?? (cohort.total_leads > 0
                    ? (cohort.converted_leads / cohort.total_leads) * 100
                    : 0)
                  return (
                    <tr
                      key={cohort.period}
                      className="border-b border-gray-50 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/60 transition-colors"
                    >
                      <td className="py-3 px-4">
                        <span className="font-medium text-gray-900 dark:text-gray-100">
                          {cohort.period}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right text-gray-600 dark:text-gray-400">
                        {cohort.total_leads.toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-right text-gray-600 dark:text-gray-400">
                        {cohort.converted_leads.toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className="inline-block px-3 py-1 rounded-full text-xs font-bold"
                          style={{
                            backgroundColor: conversionBg(rate),
                            color: conversionColor(rate),
                          }}
                        >
                          {rate.toFixed(1)}%
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-3 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-500"
                              style={{
                                width: `${Math.min(100, rate)}%`,
                                backgroundColor: rate >= 20 ? '#6fd943' : rate >= 10 ? '#ffa21d' : '#ff3a6e',
                              }}
                            />
                          </div>
                          <span className="text-xs text-gray-400 w-8 text-right">{rate.toFixed(0)}%</span>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  )
}
