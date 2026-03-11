import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  cn, Button, Spinner, Badge, Card, Table, toast,
} from '../../components/ui'
import {
  useSupplyPlan, useExecuteSupplyPlan,
  type SupplyPlanLine,
} from '../../api/supplychain_planning'

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}

function formatCurrency(value: string | number) {
  const num = typeof value === 'string' ? parseFloat(value) : value
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(num)
}

const STATUS_BADGE: Record<string, 'success' | 'info' | 'warning' | 'default' | 'primary'> = {
  draft: 'default',
  active: 'success',
  executed: 'primary',
  archived: 'info',
  planned: 'default',
  ordered: 'info',
  received: 'success',
  cancelled: 'danger' as 'info', // coerce for simplicity
}

const LINE_STATUS_BADGE: Record<string, 'success' | 'info' | 'warning' | 'default' | 'danger'> = {
  planned: 'default',
  ordered: 'info',
  received: 'success',
  cancelled: 'danger',
}

type TabId = 'info' | 'lines'

export default function SupplyPlanDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<TabId>('lines')

  const { data: plan, isLoading } = useSupplyPlan(id ?? '')
  const executeMutation = useExecuteSupplyPlan()

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Spinner size="lg" />
      </div>
    )
  }

  if (!plan) {
    return (
      <div className="p-6 text-center">
        <p className="text-gray-500">Supply Plan not found</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate('/supply-chain/supply-plans')}>
          Back to Supply Plans
        </Button>
      </div>
    )
  }

  const handleExecute = async () => {
    try {
      await executeMutation.mutateAsync({ id: plan.id })
      toast('success', 'Supply plan executed — purchase orders created')
    } catch {
      toast('error', 'Failed to execute supply plan')
    }
  }

  const tabs: { id: TabId; label: string }[] = [
    { id: 'info', label: 'Plan Info' },
    { id: 'lines', label: `Lines (${plan.lines?.length ?? plan.line_count})` },
  ]

  const lineColumns = [
    {
      key: 'item',
      label: 'Item',
      render: (row: SupplyPlanLine) => (
        <span className="font-medium text-gray-900 dark:text-gray-100">
          {row.item_name || row.item_id}
        </span>
      ),
    },
    {
      key: 'supplier',
      label: 'Supplier',
      render: (row: SupplyPlanLine) => (
        <span className="text-gray-600 dark:text-gray-400">
          {row.supplier_name || row.supplier_id || '-'}
        </span>
      ),
    },
    {
      key: 'planned_order_date',
      label: 'Order Date',
      render: (row: SupplyPlanLine) => <span className="text-gray-600 dark:text-gray-400">{formatDate(row.planned_order_date)}</span>,
    },
    {
      key: 'planned_delivery_date',
      label: 'Delivery Date',
      render: (row: SupplyPlanLine) => <span className="text-gray-600 dark:text-gray-400">{formatDate(row.planned_delivery_date)}</span>,
    },
    {
      key: 'quantity',
      label: 'Quantity',
      render: (row: SupplyPlanLine) => (
        <span className="font-medium text-gray-900 dark:text-gray-100">{row.quantity}</span>
      ),
    },
    {
      key: 'unit_cost',
      label: 'Unit Cost',
      render: (row: SupplyPlanLine) => <span className="text-gray-600 dark:text-gray-400">{formatCurrency(row.unit_cost)}</span>,
    },
    {
      key: 'total_cost',
      label: 'Total Cost',
      render: (row: SupplyPlanLine) => (
        <span className="font-medium text-gray-900 dark:text-gray-100">{formatCurrency(row.total_cost)}</span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (row: SupplyPlanLine) => (
        <Badge variant={LINE_STATUS_BADGE[row.status] ?? 'default'}>
          {row.status}
        </Badge>
      ),
    },
  ]

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/supply-chain/supply-plans')}
            className="p-2 rounded-[10px] hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Supply Plan</h1>
              <Badge variant={STATUS_BADGE[plan.status] ?? 'default'}>
                {plan.status}
              </Badge>
            </div>
            <p className="text-sm text-gray-500 mt-1">
              Generated {formatDate(plan.generated_at)} &middot; {plan.plan_horizon_days}-day horizon &middot; {plan.lines?.length ?? plan.line_count} lines
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {plan.status === 'draft' && (
            <Button onClick={handleExecute} loading={executeMutation.isPending}>
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Execute Plan
            </Button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700 mb-6">
        <div className="flex gap-0">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'px-4 py-3 text-sm font-medium border-b-2 transition-colors',
                activeTab === tab.id
                  ? 'text-[#51459d] border-[#51459d]'
                  : 'text-gray-500 border-transparent hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'info' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-4">Plan Details</h2>
            <dl className="space-y-3">
              {[
                { label: 'Status', value: plan.status },
                { label: 'Horizon', value: `${plan.plan_horizon_days} days` },
                { label: 'Lines', value: String(plan.lines?.length ?? plan.line_count) },
                { label: 'Generated', value: formatDate(plan.generated_at) },
                { label: 'S&OP Plan', value: plan.sop_id || '-' },
                { label: 'Scenario', value: plan.scenario_id || '-' },
              ].map((item) => (
                <div key={item.label} className="flex justify-between">
                  <dt className="text-sm text-gray-500">{item.label}</dt>
                  <dd className="text-sm font-medium text-gray-900 dark:text-gray-100 capitalize">{item.value}</dd>
                </div>
              ))}
            </dl>
          </Card>
          {plan.notes && (
            <Card>
              <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-2">Notes</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap">{plan.notes}</p>
            </Card>
          )}
          <Card className="lg:col-span-2">
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-2">Meta</h2>
            <dl className="flex gap-8">
              <div>
                <dt className="text-xs text-gray-500">Created</dt>
                <dd className="text-sm text-gray-700 dark:text-gray-300">{formatDate(plan.created_at)}</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500">Updated</dt>
                <dd className="text-sm text-gray-700 dark:text-gray-300">{formatDate(plan.updated_at)}</dd>
              </div>
            </dl>
          </Card>
        </div>
      )}

      {activeTab === 'lines' && (
        <Card padding={false}>
          <div className="p-5 border-b border-gray-100 dark:border-gray-800">
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
              Supply Plan Lines ({plan.lines?.length ?? 0})
            </h2>
          </div>
          <Table<SupplyPlanLine>
            columns={lineColumns}
            data={plan.lines ?? []}
            loading={false}
            emptyText="No supply plan lines"
            keyExtractor={(row) => row.id}
          />
        </Card>
      )}
    </div>
  )
}
