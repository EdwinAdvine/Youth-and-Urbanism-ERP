import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button, Badge, Card, Spinner } from '../../components/ui'
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

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDateTime(dateStr: string | null) {
  if (!dateStr) return null
  return new Date(dateStr).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
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

async function fetchPickupOrder(id: string): Promise<PickupOrder> {
  const res = await apiClient.get(`/pos/pickup-orders/${id}`)
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

// ─── Timeline Step ───────────────────────────────────────────────────────────

function TimelineStep({
  label,
  timestamp,
  isCompleted,
  isLast,
}: {
  label: string
  timestamp: string | null
  isCompleted: boolean
  isLast?: boolean
}) {
  return (
    <div className="flex items-start gap-4">
      {/* Icon + connector */}
      <div className="flex flex-col items-center">
        <div
          className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
            isCompleted
              ? 'bg-[#6fd943] text-white'
              : 'bg-gray-100 dark:bg-gray-700 text-gray-400'
          }`}
        >
          {isCompleted ? (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <div className="w-2 h-2 rounded-full bg-gray-300 dark:bg-gray-500" />
          )}
        </div>
        {!isLast && (
          <div
            className={`w-0.5 h-8 mt-1 ${
              isCompleted ? 'bg-[#6fd943]' : 'bg-gray-200 dark:bg-gray-700'
            }`}
          />
        )}
      </div>

      {/* Label + timestamp */}
      <div className="pb-6">
        <p
          className={`text-sm font-medium ${
            isCompleted ? 'text-gray-900 dark:text-gray-100' : 'text-gray-400 dark:text-gray-500'
          }`}
        >
          {label}
        </p>
        {timestamp && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{timestamp}</p>
        )}
        {!isCompleted && !timestamp && (
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Not yet</p>
        )}
      </div>
    </div>
  )
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function PickupOrderDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { data: order, isLoading, isError } = useQuery<PickupOrder>({
    queryKey: ['pos', 'pickup-orders', id],
    queryFn: () => fetchPickupOrder(id!),
    enabled: !!id,
  })

  const markReadyMutation = useMutation({
    mutationFn: markOrderReady,
    onSuccess: (updated) => {
      queryClient.setQueryData(['pos', 'pickup-orders', id], updated)
      queryClient.invalidateQueries({ queryKey: ['pos', 'pickup-orders'] })
    },
  })

  const markPickedUpMutation = useMutation({
    mutationFn: markOrderPickedUp,
    onSuccess: (updated) => {
      queryClient.setQueryData(['pos', 'pickup-orders', id], updated)
      queryClient.invalidateQueries({ queryKey: ['pos', 'pickup-orders'] })
    },
  })

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[300px]">
        <Spinner size="lg" />
      </div>
    )
  }

  if (isError || !order) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-[10px] p-4 text-sm text-red-700">
          Failed to load pickup order. Please try again.
        </div>
        <Button variant="outline" className="mt-4" onClick={() => navigate('/pos/pickup-orders')}>
          Back to Pickup Orders
        </Button>
      </div>
    )
  }

  const timelineSteps = [
    {
      label: 'Order Created',
      timestamp: formatDateTime(order.created_at),
      isCompleted: true,
    },
    {
      label: 'Ready for Pickup',
      timestamp: formatDateTime(order.ready_at),
      isCompleted: !!order.ready_at,
    },
    {
      label: 'Picked Up',
      timestamp: formatDateTime(order.picked_up_at),
      isCompleted: !!order.picked_up_at,
    },
  ]

  return (
    <div className="p-6 max-w-3xl mx-auto">
      {/* Back nav */}
      <button
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 mb-6 transition-colors"
        onClick={() => navigate('/pos/pickup-orders')}
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to Pickup Orders
      </button>

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              {order.order_number}
            </h1>
            <Badge variant={STATUS_BADGE[order.status]}>{STATUS_LABEL[order.status]}</Badge>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Created {formatDateTime(order.created_at)}
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2">
          {order.status === 'pending_prep' && (
            <Button
              disabled={markReadyMutation.isPending}
              variant="outline"
              onClick={() => markReadyMutation.mutate(order.id)}
            >
              {markReadyMutation.isPending ? (
                <>
                  <Spinner size="sm" />
                  <span className="ml-2">Updating…</span>
                </>
              ) : (
                'Mark Ready'
              )}
            </Button>
          )}
          {order.status === 'ready' && (
            <Button
              disabled={markPickedUpMutation.isPending}
              onClick={() => markPickedUpMutation.mutate(order.id)}
            >
              {markPickedUpMutation.isPending ? (
                <>
                  <Spinner size="sm" />
                  <span className="ml-2">Updating…</span>
                </>
              ) : (
                'Mark Picked Up'
              )}
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Order Info */}
        <Card>
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-4">
            Order Details
          </h2>
          <dl className="space-y-3">
            <div>
              <dt className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                E-Commerce Order
              </dt>
              <dd className="mt-1">
                {order.ecom_order_id ? (
                  <button
                    className="text-sm font-medium text-[#51459d] hover:underline"
                    onClick={() => navigate(`/ecommerce/orders/${order.ecom_order_id}`)}
                  >
                    {order.ecom_order_id}
                  </button>
                ) : (
                  <span className="text-sm text-gray-400">—</span>
                )}
              </dd>
            </div>

            <div>
              <dt className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                Warehouse
              </dt>
              <dd className="mt-1 text-sm text-gray-900 dark:text-gray-100 font-medium">
                {order.warehouse}
              </dd>
            </div>

            <div>
              <dt className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                Notes
              </dt>
              <dd className="mt-1 text-sm text-gray-700 dark:text-gray-300">
                {order.notes ? (
                  <p className="bg-gray-50 dark:bg-gray-900 rounded-[10px] p-3">{order.notes}</p>
                ) : (
                  <span className="text-gray-400">No notes</span>
                )}
              </dd>
            </div>
          </dl>
        </Card>

        {/* Timeline */}
        <Card>
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-4">
            Timeline
          </h2>
          <div className="pt-1">
            {timelineSteps.map((step, index) => (
              <TimelineStep
                key={step.label}
                label={step.label}
                timestamp={step.timestamp}
                isCompleted={step.isCompleted}
                isLast={index === timelineSteps.length - 1}
              />
            ))}
          </div>
        </Card>
      </div>
    </div>
  )
}
