import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { cn, Button, Badge, Card, Table, Spinner } from '../../components/ui'
import apiClient from '../../api/client'

// ─── Types ───────────────────────────────────────────────────────────────────

interface PickupOrder {
  id: string
  order_number: string
  ecom_order_id: string | null
  warehouse: string
  status: 'pending_prep' | 'ready' | 'picked_up' | 'cancelled'
  notes: string | null
  created_at: string
  ready_at: string | null
  picked_up_at: string | null
}

interface PickupOrdersResponse {
  orders: PickupOrder[]
  total: number
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDateTime(dateStr: string | null) {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const STATUS_BADGE: Record<PickupOrder['status'], 'warning' | 'info' | 'success' | 'danger'> = {
  pending_prep: 'warning',
  ready: 'info',
  picked_up: 'success',
  cancelled: 'danger',
}

const STATUS_LABEL: Record<PickupOrder['status'], string> = {
  pending_prep: 'Pending Prep',
  ready: 'Ready',
  picked_up: 'Picked Up',
  cancelled: 'Cancelled',
}

// ─── API Calls ───────────────────────────────────────────────────────────────

async function fetchPickupOrders(params: { status?: string }): Promise<PickupOrdersResponse> {
  const query = new URLSearchParams()
  if (params.status) query.set('status', params.status)
  const res = await apiClient.get(`/pos/pickup-orders?${query.toString()}`)
  return res.data
}

async function markOrderReady(id: string): Promise<PickupOrder> {
  const res = await apiClient.post(`/pos/pickup-orders/${id}/ready`)
  return res.data
}

async function markOrderPickedUp(id: string): Promise<PickupOrder> {
  const res = await apiClient.post(`/pos/pickup-orders/${id}/picked-up`)
  return res.data
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function PickupOrdersPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined)

  const { data, isLoading } = useQuery<PickupOrdersResponse>({
    queryKey: ['pos', 'pickup-orders', { status: statusFilter }],
    queryFn: () => fetchPickupOrders({ status: statusFilter }),
  })

  const markReadyMutation = useMutation({
    mutationFn: markOrderReady,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pos', 'pickup-orders'] })
    },
  })

  const markPickedUpMutation = useMutation({
    mutationFn: markOrderPickedUp,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pos', 'pickup-orders'] })
    },
  })

  const columns = [
    {
      key: 'order_number',
      label: 'Order #',
      render: (row: PickupOrder) => (
        <button
          className="font-medium text-[#51459d] hover:underline"
          onClick={() => navigate(`/pos/pickup-orders/${row.id}`)}
        >
          {row.order_number}
        </button>
      ),
    },
    {
      key: 'ecom_order_id',
      label: 'E-Commerce Order',
      render: (row: PickupOrder) =>
        row.ecom_order_id ? (
          <button
            className="text-sm text-[#51459d] hover:underline"
            onClick={() => navigate(`/ecommerce/orders/${row.ecom_order_id}`)}
          >
            {row.ecom_order_id}
          </button>
        ) : (
          <span className="text-gray-400 text-sm">—</span>
        ),
    },
    {
      key: 'warehouse',
      label: 'Warehouse',
      render: (row: PickupOrder) => (
        <span className="text-sm text-gray-700 dark:text-gray-300">{row.warehouse}</span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (row: PickupOrder) => (
        <Badge variant={STATUS_BADGE[row.status]}>{STATUS_LABEL[row.status]}</Badge>
      ),
    },
    {
      key: 'created_at',
      label: 'Created',
      render: (row: PickupOrder) => (
        <span className="text-sm text-gray-600 dark:text-gray-400">{formatDateTime(row.created_at)}</span>
      ),
    },
    {
      key: 'ready_at',
      label: 'Ready At',
      render: (row: PickupOrder) => (
        <span className="text-sm text-gray-600 dark:text-gray-400">{formatDateTime(row.ready_at)}</span>
      ),
    },
    {
      key: 'picked_up_at',
      label: 'Picked Up At',
      render: (row: PickupOrder) => (
        <span className="text-sm text-gray-600 dark:text-gray-400">{formatDateTime(row.picked_up_at)}</span>
      ),
    },
    {
      key: 'actions',
      label: '',
      render: (row: PickupOrder) => {
        const isMarkingReady = markReadyMutation.isPending && markReadyMutation.variables === row.id
        const isMarkingPickedUp = markPickedUpMutation.isPending && markPickedUpMutation.variables === row.id

        if (row.status === 'pending_prep') {
          return (
            <Button
              size="sm"
              variant="outline"
              disabled={isMarkingReady}
              onClick={(e) => {
                e.stopPropagation()
                markReadyMutation.mutate(row.id)
              }}
            >
              {isMarkingReady ? <Spinner size="sm" /> : 'Mark Ready'}
            </Button>
          )
        }

        if (row.status === 'ready') {
          return (
            <Button
              size="sm"
              disabled={isMarkingPickedUp}
              onClick={(e) => {
                e.stopPropagation()
                markPickedUpMutation.mutate(row.id)
              }}
            >
              {isMarkingPickedUp ? <Spinner size="sm" /> : 'Mark Picked Up'}
            </Button>
          )
        }

        return null
      },
    },
  ]

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Pickup Orders</h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage BOPIS (Buy Online, Pickup In Store) orders
          </p>
        </div>
        <Button variant="outline" onClick={() => navigate('/pos')}>
          Dashboard
        </Button>
      </div>

      {/* Status Filter Bar */}
      <div className="flex gap-2 mb-4">
        {[
          { label: 'All', value: undefined },
          { label: 'Pending Prep', value: 'pending_prep' },
          { label: 'Ready', value: 'ready' },
          { label: 'Picked Up', value: 'picked_up' },
          { label: 'Cancelled', value: 'cancelled' },
        ].map((f) => (
          <button
            key={f.label}
            onClick={() => setStatusFilter(f.value)}
            className={cn(
              'px-3 py-1 rounded-full text-xs font-medium transition-colors',
              statusFilter === f.value
                ? 'bg-[#51459d] text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Orders Table */}
      <Card padding={false}>
        <Table<PickupOrder>
          columns={columns}
          data={data?.orders ?? []}
          loading={isLoading}
          emptyText="No pickup orders found"
          keyExtractor={(row) => row.id}
          onRowClick={(row) => navigate(`/pos/pickup-orders/${row.id}`)}
        />
      </Card>
    </div>
  )
}
