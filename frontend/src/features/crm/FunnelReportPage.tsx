import { useState } from 'react'
import { useFunnelReport } from '@/api/crm_workflows'
import { Button, Card, Spinner, Input } from '@/components/ui'

interface FunnelStage {
  stage: string
  count: number
  total_value: number
}

export default function FunnelReportPage() {
  const [pipelineId, setPipelineId] = useState<string | undefined>(undefined)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const { data, isLoading, refetch } = useFunnelReport({
    pipeline_id: pipelineId,
    date_from: dateFrom || undefined,
    date_to: dateTo || undefined,
  })

  const stages: FunnelStage[] = data?.stages ?? data ?? []
  const maxCount = Math.max(...stages.map((s) => s.count), 1)

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(value)

  // Generate progressively lighter shades of primary (#51459d)
  const getStageColor = (index: number, total: number) => {
    const lightness = 35 + (index / Math.max(total - 1, 1)) * 35
    return `hsl(250, 38%, ${lightness}%)`
  }

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100">
            Pipeline Funnel Report
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Visualize deal progression through your pipeline stages
          </p>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <div className="flex flex-wrap items-end gap-4">
          <Input
            label="Pipeline ID (optional)"
            value={pipelineId ?? ''}
            onChange={(e) => setPipelineId(e.target.value || undefined)}
            placeholder="Leave empty for all"
          />
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
          <Button variant="secondary" onClick={() => refetch()}>
            Refresh
          </Button>
        </div>
      </Card>

      {/* Funnel Visualization */}
      {isLoading ? (
        <div className="flex items-center justify-center min-h-[40vh]">
          <Spinner size="lg" />
        </div>
      ) : stages.length === 0 ? (
        <Card className="text-center py-16">
          <p className="text-gray-400">No funnel data available. Check your pipeline has deals.</p>
        </Card>
      ) : (
        <Card>
          <div className="space-y-3">
            {stages.map((stage, index) => {
              const widthPercent = Math.max(8, (stage.count / maxCount) * 100)
              const color = getStageColor(index, stages.length)
              return (
                <div key={stage.stage} className="group">
                  <div className="flex items-center gap-4">
                    {/* Stage name */}
                    <div className="w-36 flex-shrink-0 text-right">
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        {stage.stage}
                      </span>
                    </div>

                    {/* Bar */}
                    <div className="flex-1 relative">
                      <div
                        className="h-12 rounded-[10px] flex items-center px-4 transition-all duration-500 ease-out"
                        style={{
                          width: `${widthPercent}%`,
                          background: `linear-gradient(135deg, ${color}, ${color}dd)`,
                          minWidth: '80px',
                        }}
                      >
                        <span className="text-white text-sm font-bold whitespace-nowrap">
                          {stage.count}
                        </span>
                      </div>
                    </div>

                    {/* Value */}
                    <div className="w-32 flex-shrink-0 text-right">
                      <span className="text-sm font-semibold" style={{ color: '#51459d' }}>
                        {formatCurrency(stage.total_value)}
                      </span>
                    </div>
                  </div>

                  {/* Conversion rate between stages */}
                  {index < stages.length - 1 && stages[index].count > 0 && (
                    <div className="ml-36 pl-4 py-1">
                      <span className="text-xs text-gray-400">
                        {((stages[index + 1].count / stage.count) * 100).toFixed(1)}% conversion
                      </span>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Summary */}
          <div className="mt-6 pt-4 border-t border-gray-100 dark:border-gray-700 grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold" style={{ color: '#51459d' }}>
                {stages[0]?.count ?? 0}
              </p>
              <p className="text-xs text-gray-500">Top of Funnel</p>
            </div>
            <div>
              <p className="text-2xl font-bold" style={{ color: '#6fd943' }}>
                {stages[stages.length - 1]?.count ?? 0}
              </p>
              <p className="text-xs text-gray-500">Bottom of Funnel</p>
            </div>
            <div>
              <p className="text-2xl font-bold" style={{ color: '#3ec9d6' }}>
                {stages[0]?.count > 0
                  ? ((stages[stages.length - 1]?.count / stages[0].count) * 100).toFixed(1)
                  : '0'}%
              </p>
              <p className="text-xs text-gray-500">Overall Conversion</p>
            </div>
          </div>
        </Card>
      )}
    </div>
  )
}
