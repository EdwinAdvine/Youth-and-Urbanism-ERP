import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Badge, Spinner, toast } from '../../components/ui'
import {
  useWorkOrders,
  useCompleteWorkOrder,
  useStartWorkOrder,
  type WorkOrder,
} from '../../api/manufacturing'

const STATUS_BADGE: Record<string, 'default' | 'success' | 'danger' | 'info' | 'warning'> = {
  draft: 'default',
  planned: 'info',
  in_progress: 'warning',
  completed: 'success',
  cancelled: 'danger',
}

// ---- Work Order Selection ----

function WorkOrderSelector({ onSelect }: { onSelect: (wo: WorkOrder) => void }) {
  const { data: inProgress, isLoading: l1 } = useWorkOrders({ status: 'in_progress', limit: 50 })
  const { data: planned, isLoading: l2 } = useWorkOrders({ status: 'planned', limit: 50 })
  const { data: draft, isLoading: l3 } = useWorkOrders({ status: 'draft', limit: 50 })

  const allOrders = useMemo(() => {
    return [
      ...(inProgress?.work_orders ?? []),
      ...(planned?.work_orders ?? []),
      ...(draft?.work_orders ?? []),
    ]
  }, [inProgress, planned, draft])

  const isLoading = l1 || l2 || l3

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner size="lg" />
      </div>
    )
  }

  if (allOrders.length === 0) {
    return (
      <div className="text-center py-12">
        <svg className="h-16 w-16 mx-auto text-gray-300 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
        </svg>
        <p className="text-gray-500 font-medium">No active work orders</p>
        <p className="text-gray-400 text-sm mt-1">Create a work order to start production</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-500 font-medium">{allOrders.length} work order(s)</p>
      {allOrders.map((wo) => {
        const progress = wo.planned_quantity > 0 ? (wo.completed_quantity / wo.planned_quantity) * 100 : 0
        return (
          <button
            key={wo.id}
            onClick={() => onSelect(wo)}
            className="w-full bg-white dark:bg-gray-800 rounded-[10px] border border-gray-200 dark:border-gray-700 p-4 text-left hover:border-primary active:bg-primary/5 active:scale-[0.98] transition-all"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-bold text-primary">{wo.wo_number}</span>
              <Badge variant={STATUS_BADGE[wo.status]}>{wo.status.replace('_', ' ')}</Badge>
            </div>
            <p className="text-sm text-gray-700 dark:text-gray-300 mb-1">{wo.finished_item_name ?? 'Unknown Product'}</p>
            <div className="flex items-center gap-3 text-xs text-gray-500">
              <span>{wo.completed_quantity}/{wo.planned_quantity} completed</span>
              {wo.rejected_quantity > 0 && (
                <span className="text-red-500">{wo.rejected_quantity} rejected</span>
              )}
            </div>
            <div className="w-full bg-gray-100 dark:bg-gray-900 rounded-full h-2 mt-2">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${Math.min(100, progress)}%` }}
              />
            </div>
          </button>
        )
      })}
    </div>
  )
}

// ---- Production Entry Form ----

function ProductionForm({
  workOrder,
  onDone,
}: {
  workOrder: WorkOrder
  onDone: () => void
}) {
  const startWO = useStartWorkOrder()
  const completeWO = useCompleteWorkOrder()

  const [completedQty, setCompletedQty] = useState(String(workOrder.planned_quantity - workOrder.completed_quantity))
  const [rejectedQty, setRejectedQty] = useState('0')
  const [notes, setNotes] = useState('')

  const remaining = workOrder.planned_quantity - workOrder.completed_quantity
  const progress = workOrder.planned_quantity > 0 ? (workOrder.completed_quantity / workOrder.planned_quantity) * 100 : 0

  const handleStart = async () => {
    try {
      await startWO.mutateAsync(workOrder.id)
      toast('success', 'Work order started')
    } catch (err: any) {
      toast('error', err?.response?.data?.detail || 'Failed to start work order')
    }
  }

  const handleComplete = async () => {
    const completed = parseInt(completedQty) || 0
    const rejected = parseInt(rejectedQty) || 0

    if (completed <= 0 && rejected <= 0) {
      toast('warning', 'Enter completed or rejected quantity')
      return
    }

    try {
      await completeWO.mutateAsync({
        id: workOrder.id,
        completed_quantity: completed,
        rejected_quantity: rejected,
      })
      toast('success', 'Production entry recorded')
      onDone()
    } catch (err: any) {
      toast('error', err?.response?.data?.detail || 'Failed to complete work order')
    }
  }

  const adjustQty = (field: 'completed' | 'rejected', delta: number) => {
    if (field === 'completed') {
      setCompletedQty(String(Math.max(0, (parseInt(completedQty) || 0) + delta)))
    } else {
      setRejectedQty(String(Math.max(0, (parseInt(rejectedQty) || 0) + delta)))
    }
  }

  return (
    <div className="space-y-4">
      {/* Work Order info */}
      <div className="bg-white dark:bg-gray-800 rounded-[10px] border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-bold text-primary">{workOrder.wo_number}</span>
          <Badge variant={STATUS_BADGE[workOrder.status]}>{workOrder.status.replace('_', ' ')}</Badge>
        </div>
        <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">{workOrder.finished_item_name ?? 'Product'}</p>
        {workOrder.bom_name && (
          <p className="text-xs text-gray-500 mt-1">BOM: {workOrder.bom_name}</p>
        )}
        <div className="mt-3">
          <div className="flex justify-between text-xs text-gray-500 mb-1">
            <span>{workOrder.completed_quantity} of {workOrder.planned_quantity} completed</span>
            <span>{progress.toFixed(0)}%</span>
          </div>
          <div className="w-full bg-gray-100 dark:bg-gray-900 rounded-full h-3">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${Math.min(100, progress)}%` }}
            />
          </div>
          <p className="text-xs text-gray-400 mt-1">{remaining} remaining</p>
        </div>
      </div>

      {/* Start button for draft/planned */}
      {(workOrder.status === 'draft' || workOrder.status === 'planned') && (
        <Button
          className="w-full min-h-[56px] text-base"
          size="lg"
          onClick={handleStart}
          loading={startWO.isPending}
        >
          Start Production
        </Button>
      )}

      {/* Quantity entry for in_progress */}
      {workOrder.status === 'in_progress' && (
        <>
          {/* Completed quantity */}
          <div className="bg-white dark:bg-gray-800 rounded-[10px] border border-green-200 p-4">
            <label className="block text-sm font-medium text-green-700 mb-3">Completed Quantity</label>
            <div className="flex items-center justify-center gap-4">
              <button
                onClick={() => adjustQty('completed', -10)}
                className="min-h-[56px] min-w-[56px] rounded-[10px] bg-green-50 text-green-700 text-lg font-bold flex items-center justify-center border border-green-200 active:bg-green-100 active:scale-95 transition-all"
              >
                -10
              </button>
              <button
                onClick={() => adjustQty('completed', -1)}
                className="min-h-[56px] min-w-[56px] rounded-[10px] bg-green-50 text-green-700 text-2xl font-bold flex items-center justify-center border border-green-200 active:bg-green-100 active:scale-95 transition-all"
              >
                -
              </button>
              <input
                type="number"
                value={completedQty}
                onChange={(e) => setCompletedQty(e.target.value)}
                className="w-24 min-h-[64px] rounded-[10px] border border-green-300 text-3xl font-bold text-center text-green-800 bg-green-50 focus:outline-none focus:ring-2 focus:ring-green-400"
              />
              <button
                onClick={() => adjustQty('completed', 1)}
                className="min-h-[56px] min-w-[56px] rounded-[10px] bg-green-50 text-green-700 text-2xl font-bold flex items-center justify-center border border-green-200 active:bg-green-100 active:scale-95 transition-all"
              >
                +
              </button>
              <button
                onClick={() => adjustQty('completed', 10)}
                className="min-h-[56px] min-w-[56px] rounded-[10px] bg-green-50 text-green-700 text-lg font-bold flex items-center justify-center border border-green-200 active:bg-green-100 active:scale-95 transition-all"
              >
                +10
              </button>
            </div>
          </div>

          {/* Rejected quantity */}
          <div className="bg-white dark:bg-gray-800 rounded-[10px] border border-red-200 p-4">
            <label className="block text-sm font-medium text-red-700 mb-3">Rejected Quantity</label>
            <div className="flex items-center justify-center gap-4">
              <button
                onClick={() => adjustQty('rejected', -1)}
                className="min-h-[56px] min-w-[56px] rounded-[10px] bg-red-50 text-red-700 text-2xl font-bold flex items-center justify-center border border-red-200 active:bg-red-100 active:scale-95 transition-all"
              >
                -
              </button>
              <input
                type="number"
                value={rejectedQty}
                onChange={(e) => setRejectedQty(e.target.value)}
                className="w-24 min-h-[64px] rounded-[10px] border border-red-300 text-3xl font-bold text-center text-red-800 bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-400"
              />
              <button
                onClick={() => adjustQty('rejected', 1)}
                className="min-h-[56px] min-w-[56px] rounded-[10px] bg-red-50 text-red-700 text-2xl font-bold flex items-center justify-center border border-red-200 active:bg-red-100 active:scale-95 transition-all"
              >
                +
              </button>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notes (optional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Production notes, issues, etc."
              rows={3}
              className="w-full rounded-[10px] border border-gray-200 dark:border-gray-700 px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-gray-400 min-h-[56px]"
            />
          </div>

          {/* Submit */}
          <Button
            className="w-full min-h-[56px] text-base font-semibold"
            size="lg"
            onClick={handleComplete}
            loading={completeWO.isPending}
          >
            Record Production Entry
          </Button>
        </>
      )}

      {workOrder.status === 'completed' && (
        <div className="text-center py-8 bg-green-50 rounded-[10px] border border-green-200">
          <svg className="h-16 w-16 mx-auto text-green-500 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-lg font-semibold text-green-800">Work Order Completed</p>
          <p className="text-sm text-green-600 mt-1">
            {workOrder.completed_quantity} completed, {workOrder.rejected_quantity} rejected
          </p>
        </div>
      )}
    </div>
  )
}

// ---- Main Component ----

export default function MobileProductionEntry() {
  const navigate = useNavigate()
  const [selectedWO, setSelectedWO] = useState<WorkOrder | null>(null)

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3 flex items-center gap-3">
        <button
          onClick={() => selectedWO ? setSelectedWO(null) : navigate('/manufacturing/work-orders')}
          className="min-h-[48px] min-w-[48px] flex items-center justify-center rounded-[10px] text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 active:bg-gray-200 transition-colors"
        >
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">
          {selectedWO ? 'Production Entry' : 'Select Work Order'}
        </h1>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        {!selectedWO ? (
          <WorkOrderSelector onSelect={setSelectedWO} />
        ) : (
          <ProductionForm
            workOrder={selectedWO}
            onDone={() => setSelectedWO(null)}
          />
        )}
      </div>
    </div>
  )
}
