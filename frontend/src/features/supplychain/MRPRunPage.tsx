import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button, Card, Table, Modal, Input, Badge, Spinner, toast } from '../../components/ui'
import apiClient from '@/api/client'

interface MRPRun {
  id: string
  run_number: string
  status: string
  planning_horizon_days: number
  total_demand_lines: number | null
  planned_orders_count: number | null
  exceptions_count: number | null
  started_at: string | null
  completed_at: string | null
  created_at: string
}

interface MRPLine {
  id: string
  product_name: string
  sku: string
  demand_quantity: number
  planned_order_quantity: number
  planned_order_date: string | null
  exception_type: string | null
}

const statusVariant: Record<string, 'default' | 'warning' | 'info' | 'success' | 'danger'> = {
  draft: 'default',
  running: 'info',
  completed: 'success',
  failed: 'danger',
}

export default function MRPRunPage() {
  const qc = useQueryClient()
  const [showCreate, setShowCreate] = useState(false)
  const [horizonDays, setHorizonDays] = useState('30')
  const [productIds, setProductIds] = useState('')
  const [expandedRunId, setExpandedRunId] = useState<string | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['sc', 'mrp-runs'],
    queryFn: () => apiClient.get('/supply-chain/mrp/runs').then((r) => r.data),
    refetchInterval: 10000,
  })

  const { data: linesData, isLoading: linesLoading } = useQuery({
    queryKey: ['sc', 'mrp-lines', expandedRunId],
    queryFn: () =>
      apiClient.get(`/supply-chain/mrp/runs/${expandedRunId}/lines`).then((r) => r.data),
    enabled: !!expandedRunId,
  })

  const createRun = useMutation({
    mutationFn: (payload: { planning_horizon_days: number; product_ids?: string[] }) =>
      apiClient.post('/supply-chain/mrp/runs', payload).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sc', 'mrp-runs'] })
      toast('success', 'MRP run started')
      setShowCreate(false)
      setHorizonDays('30')
      setProductIds('')
    },
    onError: () => toast('error', 'Failed to start MRP run'),
  })

  const runs: MRPRun[] = data?.items ?? data ?? []
  const lines: MRPLine[] = linesData?.items ?? linesData ?? []

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault()
    const payload: { planning_horizon_days: number; product_ids?: string[] } = {
      planning_horizon_days: parseInt(horizonDays),
    }
    if (productIds.trim()) {
      payload.product_ids = productIds.split(',').map((s) => s.trim()).filter(Boolean)
    }
    createRun.mutate(payload)
  }

  const columns = [
    {
      key: 'run_number',
      label: 'Run #',
      render: (r: MRPRun) => (
        <span className="font-mono font-medium text-gray-900 dark:text-gray-100">{r.run_number}</span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (r: MRPRun) => (
        <div className="flex items-center gap-2">
          <Badge variant={statusVariant[r.status] ?? 'default'}>{r.status}</Badge>
          {r.status === 'running' && <Spinner />}
        </div>
      ),
    },
    {
      key: 'horizon',
      label: 'Horizon (days)',
      render: (r: MRPRun) => <span className="text-sm">{r.planning_horizon_days}</span>,
    },
    {
      key: 'demand',
      label: 'Demand Lines',
      render: (r: MRPRun) => (
        <span className="text-sm">{r.total_demand_lines ?? '-'}</span>
      ),
    },
    {
      key: 'orders',
      label: 'Planned Orders',
      render: (r: MRPRun) => (
        <span className="text-sm font-medium text-success">
          {r.planned_orders_count ?? '-'}
        </span>
      ),
    },
    {
      key: 'exceptions',
      label: 'Exceptions',
      render: (r: MRPRun) => (
        <span className={`text-sm font-medium ${(r.exceptions_count ?? 0) > 0 ? 'text-danger' : 'text-gray-500'}`}>
          {r.exceptions_count ?? '-'}
        </span>
      ),
    },
    {
      key: 'completed',
      label: 'Completed',
      render: (r: MRPRun) => (
        <span className="text-sm text-gray-500">
          {r.completed_at ? new Date(r.completed_at).toLocaleString() : '-'}
        </span>
      ),
    },
    {
      key: 'actions',
      label: '',
      render: (r: MRPRun) =>
        r.status === 'completed' ? (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setExpandedRunId(expandedRunId === r.id ? null : r.id)}
          >
            {expandedRunId === r.id ? 'Collapse' : 'View Lines'}
          </Button>
        ) : null,
    },
  ]

  const lineColumns = [
    {
      key: 'product',
      label: 'Product',
      render: (r: MRPLine) => (
        <div>
          <p className="font-medium text-sm text-gray-900 dark:text-gray-100">{r.product_name}</p>
          <p className="text-xs text-gray-500 font-mono">{r.sku}</p>
        </div>
      ),
    },
    {
      key: 'demand',
      label: 'Demand Qty',
      render: (r: MRPLine) => <span className="text-sm">{r.demand_quantity}</span>,
    },
    {
      key: 'planned',
      label: 'Planned Order Qty',
      render: (r: MRPLine) => <span className="text-sm font-medium">{r.planned_order_quantity}</span>,
    },
    {
      key: 'date',
      label: 'Planned Date',
      render: (r: MRPLine) => (
        <span className="text-sm text-gray-500">
          {r.planned_order_date ? new Date(r.planned_order_date).toLocaleDateString() : '-'}
        </span>
      ),
    },
    {
      key: 'exception',
      label: 'Exception',
      render: (r: MRPLine) =>
        r.exception_type ? (
          <Badge variant="warning">{r.exception_type.replace(/_/g, ' ')}</Badge>
        ) : (
          <span className="text-gray-400 text-sm">-</span>
        ),
    },
  ]

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">MRP Runs</h1>
          <p className="text-sm text-gray-500 mt-1">Material Requirements Planning execution history</p>
        </div>
        <Button onClick={() => setShowCreate(true)}>Run MRP</Button>
      </div>

      <Card padding={false}>
        <Table
          columns={columns}
          data={runs}
          loading={isLoading}
          keyExtractor={(r) => r.id}
          emptyText="No MRP runs found"
        />
      </Card>

      {/* Expanded MRP Lines */}
      {expandedRunId && (
        <Card padding={false}>
          <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">MRP Lines</h2>
          </div>
          {linesLoading ? (
            <div className="flex justify-center py-8"><Spinner /></div>
          ) : (
            <Table
              columns={lineColumns}
              data={lines}
              keyExtractor={(r) => r.id}
              emptyText="No MRP lines found"
            />
          )}
        </Card>
      )}

      {/* Create Modal */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Run MRP" size="md">
        <form onSubmit={handleCreate} className="space-y-4">
          <Input
            label="Planning Horizon (days)"
            type="number"
            min="1"
            max="365"
            value={horizonDays}
            onChange={(e) => setHorizonDays(e.target.value)}
            required
          />
          <div>
            <Input
              label="Product IDs (optional, comma-separated)"
              value={productIds}
              onChange={(e) => setProductIds(e.target.value)}
              placeholder="e.g. uuid1, uuid2"
            />
            <p className="text-xs text-gray-400 mt-1">Leave blank to run for all products</p>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" type="button" onClick={() => setShowCreate(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={createRun.isPending}>
              Start Run
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
