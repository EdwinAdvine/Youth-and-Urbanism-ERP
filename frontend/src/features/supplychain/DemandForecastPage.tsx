import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Button, Badge, Card, Table, Modal, Input, Pagination, toast,
} from '../../components/ui'
import {
  useForecasts, useGenerateForecasts,
  type DemandForecast, type GenerateForecastsPayload,
} from '../../api/supplychain_planning'

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}

function formatNumber(n: number) {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 }).format(n)
}

const METHOD_BADGE: Record<string, 'success' | 'info' | 'warning' | 'default' | 'primary'> = {
  arima: 'info',
  exponential_smoothing: 'primary',
  moving_average: 'default',
  ml_model: 'success',
  manual: 'warning',
}

interface GenerateFormState {
  item_id: string
  scenario_id: string
  period_type: string
  horizon_days: string
}

const defaultGenerateForm: GenerateFormState = {
  item_id: '',
  scenario_id: '',
  period_type: 'monthly',
  horizon_days: '90',
}

export default function DemandForecastPage() {
  const navigate = useNavigate()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [filterPeriod, setFilterPeriod] = useState<string>('')
  const [filterScenario, setFilterScenario] = useState<string>('')
  const [showGenerate, setShowGenerate] = useState(false)
  const [form, setForm] = useState<GenerateFormState>(defaultGenerateForm)

  const limit = 20
  const skip = (page - 1) * limit

  const { data, isLoading } = useForecasts({
    item_id: search || undefined,
    period_type: filterPeriod || undefined,
    scenario: filterScenario || undefined,
    skip,
    limit,
  })

  const generateMutation = useGenerateForecasts()

  const totalPages = data ? Math.ceil(data.total / limit) : 1

  const handleGenerate = async () => {
    const payload: GenerateForecastsPayload = {
      item_id: form.item_id.trim() || undefined,
      scenario_id: form.scenario_id.trim() || undefined,
      period_type: form.period_type || undefined,
      horizon_days: Number(form.horizon_days) || 90,
    }
    try {
      await generateMutation.mutateAsync(payload)
      toast('success', 'Forecasts generated successfully')
      setShowGenerate(false)
      setForm(defaultGenerateForm)
    } catch {
      toast('error', 'Failed to generate forecasts')
    }
  }

  const columns = [
    {
      key: 'item_id',
      label: 'Item',
      render: (row: DemandForecast) => (
        <span className="font-medium text-gray-900 dark:text-gray-100">
          {row.item_name || row.item_id}
        </span>
      ),
    },
    {
      key: 'forecast_date',
      label: 'Forecast Date',
      render: (row: DemandForecast) => <span className="text-gray-600 dark:text-gray-400">{formatDate(row.forecast_date)}</span>,
    },
    {
      key: 'predicted_quantity',
      label: 'Predicted Qty',
      render: (row: DemandForecast) => (
        <span className="font-medium text-gray-900 dark:text-gray-100">{formatNumber(row.predicted_quantity)}</span>
      ),
    },
    {
      key: 'confidence',
      label: 'Confidence Range',
      render: (row: DemandForecast) => (
        <span className="text-gray-600 dark:text-gray-400 text-xs">
          {formatNumber(row.confidence_lower)} - {formatNumber(row.confidence_upper)}
        </span>
      ),
    },
    {
      key: 'method',
      label: 'Method',
      render: (row: DemandForecast) => (
        <Badge variant={METHOD_BADGE[row.method] ?? 'default'}>
          {row.method.replace(/_/g, ' ')}
        </Badge>
      ),
    },
    {
      key: 'scenario',
      label: 'Scenario',
      render: (row: DemandForecast) => (
        <span className="text-gray-600 dark:text-gray-400">{row.scenario || 'Base'}</span>
      ),
    },
    {
      key: 'period_type',
      label: 'Period',
      render: (row: DemandForecast) => (
        <span className="text-gray-500 text-xs capitalize">{row.period_type}</span>
      ),
    },
    {
      key: 'actual_quantity',
      label: 'Actual',
      render: (row: DemandForecast) => (
        <span className="text-gray-600 dark:text-gray-400">
          {row.actual_quantity != null ? formatNumber(row.actual_quantity) : '-'}
        </span>
      ),
    },
  ]

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Demand Forecasts</h1>
          <p className="text-sm text-gray-500 mt-1">{data?.total ?? 0} total forecasts</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => navigate('/supply-chain')}>
            Dashboard
          </Button>
          <Button onClick={() => setShowGenerate(true)}>
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            Generate Forecasts
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-4">
        <div className="w-72">
          <Input
            placeholder="Search by item ID..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            leftIcon={
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            }
          />
        </div>
        <select
          value={filterPeriod}
          onChange={(e) => { setFilterPeriod(e.target.value); setPage(1) }}
          className="rounded-[10px] border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#51459d]/30 focus:border-[#51459d]"
        >
          <option value="">All Periods</option>
          <option value="daily">Daily</option>
          <option value="weekly">Weekly</option>
          <option value="monthly">Monthly</option>
          <option value="quarterly">Quarterly</option>
        </select>
        <Input
          placeholder="Scenario filter..."
          value={filterScenario}
          onChange={(e) => { setFilterScenario(e.target.value); setPage(1) }}
          className="w-48"
        />
        <span className="text-sm text-gray-500">{data?.total ?? 0} forecasts</span>
      </div>

      {/* Table */}
      <Card padding={false}>
        <Table<DemandForecast>
          columns={columns}
          data={data?.forecasts ?? []}
          loading={isLoading}
          emptyText="No forecasts found"
          keyExtractor={(row) => row.id}
        />
        {totalPages > 1 && (
          <Pagination page={page} pages={totalPages} total={data?.total ?? 0} onChange={setPage} />
        )}
      </Card>

      {/* Generate Modal */}
      <Modal open={showGenerate} onClose={() => setShowGenerate(false)} title="Generate Demand Forecasts" size="lg">
        <div className="space-y-4">
          <Input
            label="Item ID (optional)"
            value={form.item_id}
            onChange={(e) => setForm({ ...form, item_id: e.target.value })}
            placeholder="Leave empty to forecast all items"
          />
          <Input
            label="Scenario ID (optional)"
            value={form.scenario_id}
            onChange={(e) => setForm({ ...form, scenario_id: e.target.value })}
            placeholder="Scenario to use"
          />
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Period Type</label>
              <select
                value={form.period_type}
                onChange={(e) => setForm({ ...form, period_type: e.target.value })}
                className="w-full rounded-[10px] border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#51459d]/30 focus:border-[#51459d]"
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
              </select>
            </div>
            <Input
              label="Horizon (days)"
              type="number"
              min="1"
              value={form.horizon_days}
              onChange={(e) => setForm({ ...form, horizon_days: e.target.value })}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-gray-100 dark:border-gray-800">
            <Button variant="secondary" size="sm" onClick={() => setShowGenerate(false)}>Cancel</Button>
            <Button size="sm" onClick={handleGenerate} loading={generateMutation.isPending}>
              Generate
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
