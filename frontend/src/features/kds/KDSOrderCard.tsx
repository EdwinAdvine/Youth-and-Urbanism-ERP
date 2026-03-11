import { useState, useEffect } from 'react'
import { Badge, Button, Card } from '@/components/ui'
import type { KDSOrder, KDSOrderItem } from '@/api/kds'

interface KDSOrderCardProps {
  order: KDSOrder
  onStart: (orderId: string) => void
  onReady: (orderId: string) => void
  onServed: (orderId: string) => void
  onCancel: (orderId: string) => void
}

const STATUS_BORDER: Record<string, string> = {
  new: 'border-l-4 border-l-blue-500',
  in_progress: 'border-l-4 border-l-[#ffa21d]',
  ready: 'border-l-4 border-l-[#6fd943]',
  served: 'border-l-4 border-l-gray-300',
  cancelled: 'border-l-4 border-l-gray-300',
}

const STATUS_BADGE_VARIANT: Record<string, 'info' | 'warning' | 'success' | 'default' | 'danger'> = {
  new: 'info',
  in_progress: 'warning',
  ready: 'success',
  served: 'default',
  cancelled: 'danger',
}

const STATUS_LABEL: Record<string, string> = {
  new: 'New',
  in_progress: 'In Progress',
  ready: 'Ready',
  served: 'Served',
  cancelled: 'Cancelled',
}

const ITEM_STATUS_DOT: Record<string, string> = {
  pending: 'bg-gray-400',
  in_progress: 'bg-[#ffa21d]',
  done: 'bg-[#6fd943]',
}

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

function ElapsedTimer({ createdAt }: { createdAt: string }) {
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    const created = new Date(createdAt).getTime()
    const tick = () => setElapsed(Math.floor((Date.now() - created) / 1000))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [createdAt])

  const isOverdue = elapsed >= 900 // 15 minutes

  return (
    <span className={`text-xs font-mono font-semibold tabular-nums ${isOverdue ? 'text-[#ff3a6e]' : 'text-gray-500 dark:text-gray-400'}`}>
      {formatElapsed(elapsed)}
    </span>
  )
}

function OrderItemRow({ item }: { item: KDSOrderItem }) {
  const modifiers = item.modifiers ? Object.entries(item.modifiers) : []

  return (
    <div className="flex items-start gap-2 py-1.5 border-b border-gray-50 dark:border-gray-700/50 last:border-0">
      <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${ITEM_STATUS_DOT[item.status] ?? 'bg-gray-400'}`} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
            {item.item_name}
          </span>
          <span className="text-sm font-bold text-gray-700 dark:text-gray-300 shrink-0">
            x{item.quantity}
          </span>
        </div>
        {modifiers.length > 0 && (
          <p className="text-xs text-gray-400 mt-0.5 truncate">
            {modifiers.map(([k, v]) => `${k}: ${v}`).join(', ')}
          </p>
        )}
        {item.notes && (
          <p className="text-xs text-[#ffa21d] mt-0.5 italic">
            {item.notes}
          </p>
        )}
      </div>
    </div>
  )
}

export default function KDSOrderCard({ order, onStart, onReady, onServed, onCancel }: KDSOrderCardProps) {
  const displayId = order.transaction_number ?? `#${order.id.slice(0, 8).toUpperCase()}`

  return (
    <Card
      className={`${STATUS_BORDER[order.status] ?? ''} flex flex-col`}
      padding={false}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-gray-900 dark:text-gray-100">{displayId}</span>
          <Badge variant={STATUS_BADGE_VARIANT[order.status] ?? 'default'}>
            {STATUS_LABEL[order.status] ?? order.status}
          </Badge>
        </div>
        <ElapsedTimer createdAt={order.created_at} />
      </div>

      {order.priority > 0 && (
        <div className="px-4 pb-1">
          <Badge variant="danger" className="text-[10px]">PRIORITY {order.priority}</Badge>
        </div>
      )}

      {/* Items */}
      <div className="flex-1 px-4 py-2 space-y-0">
        {order.items.map((item) => (
          <OrderItemRow key={item.id} item={item} />
        ))}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 px-4 pb-4 pt-2 border-t border-gray-100 dark:border-gray-700">
        {order.status === 'new' && (
          <Button
            size="sm"
            className="flex-1 bg-[#6fd943] hover:bg-[#5ec835] text-white"
            onClick={() => onStart(order.id)}
          >
            Start
          </Button>
        )}

        {order.status === 'in_progress' && (
          <Button
            size="sm"
            variant="primary"
            className="flex-1"
            onClick={() => onReady(order.id)}
          >
            Ready
          </Button>
        )}

        {order.status === 'ready' && (
          <Button
            size="sm"
            className="flex-1 bg-[#6fd943] hover:bg-[#5ec835] text-white"
            onClick={() => onServed(order.id)}
          >
            Served
          </Button>
        )}

        {order.status !== 'served' && order.status !== 'cancelled' && (
          <Button
            size="sm"
            variant="danger"
            onClick={() => onCancel(order.id)}
          >
            Cancel
          </Button>
        )}
      </div>
    </Card>
  )
}
