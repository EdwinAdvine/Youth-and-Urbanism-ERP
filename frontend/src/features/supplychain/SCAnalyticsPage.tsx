import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Button, Card, Spinner,
} from '../../components/ui'
import {
  useCostToServe,
  useCarbonFootprint,
  useRiskHeatmap,
  useAISummary,
} from '../../api/supplychain_ops'

const SEVERITY_BG: Record<string, string> = {
  critical: '#ff3a6e',
  high: '#ffa21d',
  medium: '#3ec9d6',
  low: '#6fd943',
}

function formatDateInput(d: Date) {
  return d.toISOString().slice(0, 10)
}

export default function SCAnalyticsPage() {
  const navigate = useNavigate()

  const now = new Date()
  const thirtyDaysAgo = new Date(now)
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const [dateFrom, setDateFrom] = useState(formatDateInput(thirtyDaysAgo))
  const [dateTo, setDateTo] = useState(formatDateInput(now))

  const costToServe = useCostToServe()
  const carbonFootprint = useCarbonFootprint()
  const riskHeatmap = useRiskHeatmap()
  const aiSummary = useAISummary()

  const isLoading =
    costToServe.isLoading || carbonFootprint.isLoading || riskHeatmap.isLoading || aiSummary.isLoading

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Spinner size="lg" />
      </div>
    )
  }

  // Build unique risk types and severities for heatmap grid
  const heatmapData = riskHeatmap.data?.heatmap ?? []
  const riskTypes = [...new Set(heatmapData.map((h) => h.risk_type))]
  const severities = ['critical', 'high', 'medium', 'low']
  const heatmapLookup = new Map(
    heatmapData.map((h) => [`${h.risk_type}::${h.severity}`, h.count]),
  )

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Supply Chain Analytics
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Cost, carbon, risk and AI-driven insights
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => navigate('/supply-chain')}>
            Dashboard
          </Button>
          <Button variant="outline" onClick={() => navigate('/supply-chain/control-tower')}>
            Control Tower
          </Button>
        </div>
      </div>

      {/* Date Range Filters */}
      <Card>
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">From</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="rounded-[10px] border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-1.5 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-[#51459d]"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">To</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="rounded-[10px] border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-1.5 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-[#51459d]"
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              costToServe.refetch()
              carbonFootprint.refetch()
              riskHeatmap.refetch()
              aiSummary.refetch()
            }}
          >
            Apply
          </Button>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        {/* Cost to Serve */}
        <Card>
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-4">
            Cost to Serve
          </h2>
          {costToServe.data ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="text-left py-2 px-3 text-gray-500 font-medium">Metric</th>
                    <th className="text-right py-2 px-3 text-gray-500 font-medium">Value</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-gray-100 dark:border-gray-800">
                    <td className="py-2 px-3 text-gray-900 dark:text-gray-100">
                      Total Units Received
                    </td>
                    <td className="py-2 px-3 text-right font-semibold text-gray-900 dark:text-gray-100">
                      {costToServe.data.total_units_received.toLocaleString()}
                    </td>
                  </tr>
                  {costToServe.data.note && (
                    <tr>
                      <td colSpan={2} className="py-2 px-3 text-xs text-gray-500 italic">
                        {costToServe.data.note}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-gray-500">No cost data available</p>
          )}
        </Card>

        {/* Carbon Footprint */}
        <Card>
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-4">
            Carbon Footprint
          </h2>
          {carbonFootprint.data ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="text-left py-2 px-3 text-gray-500 font-medium">Metric</th>
                    <th className="text-right py-2 px-3 text-gray-500 font-medium">Value</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-gray-100 dark:border-gray-800">
                    <td className="py-2 px-3 text-gray-900 dark:text-gray-100">
                      Total Carbon (kg CO2e)
                    </td>
                    <td className="py-2 px-3 text-right font-semibold text-gray-900 dark:text-gray-100">
                      {carbonFootprint.data.total_carbon.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3 text-gray-900 dark:text-gray-100">
                      Avg Carbon per Supplier
                    </td>
                    <td className="py-2 px-3 text-right font-semibold text-gray-900 dark:text-gray-100">
                      {carbonFootprint.data.avg_carbon_per_supplier.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-gray-500">No carbon data available</p>
          )}
        </Card>

        {/* Risk Heatmap */}
        <Card>
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-4">
            Risk Heatmap
          </h2>
          {heatmapData.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="text-left py-2 px-3 text-gray-500 font-medium">Risk Type</th>
                    {severities.map((sev) => (
                      <th key={sev} className="text-center py-2 px-3 text-gray-500 font-medium capitalize">
                        {sev}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {riskTypes.map((riskType) => (
                    <tr key={riskType} className="border-b border-gray-100 dark:border-gray-800">
                      <td className="py-2 px-3 text-gray-900 dark:text-gray-100 font-medium">
                        {riskType}
                      </td>
                      {severities.map((sev) => {
                        const count = heatmapLookup.get(`${riskType}::${sev}`) ?? 0
                        return (
                          <td key={sev} className="py-2 px-3 text-center">
                            {count > 0 ? (
                              <span
                                className="inline-flex items-center justify-center min-w-[28px] px-2 py-0.5 rounded-full text-xs font-bold text-white"
                                style={{
                                  backgroundColor: SEVERITY_BG[sev] ?? '#9ca3af',
                                  opacity: Math.min(0.4 + count * 0.15, 1),
                                }}
                              >
                                {count}
                              </span>
                            ) : (
                              <span className="text-gray-300 dark:text-gray-600">-</span>
                            )}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="flex items-center gap-3 mt-3 pt-3 border-t border-gray-100 dark:border-gray-800">
                <span className="text-xs text-gray-500">Legend:</span>
                {severities.map((sev) => (
                  <div key={sev} className="flex items-center gap-1">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: SEVERITY_BG[sev] }}
                    />
                    <span className="text-xs text-gray-500 capitalize">{sev}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-500">No risk data available</p>
          )}
        </Card>

        {/* AI Summary */}
        <Card>
          <div className="flex items-center gap-2 mb-4">
            <div
              className="flex-shrink-0 p-1.5 rounded-[10px]"
              style={{ backgroundColor: '#51459d15', color: '#51459d' }}
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714a2.25 2.25 0 00.659 1.591L19 14.5M14.25 3.104c.251.023.501.05.75.082M19 14.5l-2.47 2.47a2.25 2.25 0 01-1.591.659H9.061a2.25 2.25 0 01-1.591-.659L5 14.5m14 0V17a2.25 2.25 0 01-2.25 2.25H7.25A2.25 2.25 0 015 17v-2.5"
                />
              </svg>
            </div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
              AI Summary
            </h2>
          </div>
          {aiSummary.data ? (
            <div>
              <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap text-gray-800 dark:text-gray-200 leading-relaxed">
                {aiSummary.data.summary}
              </div>
              {aiSummary.data.note && (
                <p className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800 text-xs text-gray-500 italic">
                  {aiSummary.data.note}
                </p>
              )}
            </div>
          ) : (
            <p className="text-sm text-gray-500">No AI summary available</p>
          )}
        </Card>
      </div>
    </div>
  )
}
