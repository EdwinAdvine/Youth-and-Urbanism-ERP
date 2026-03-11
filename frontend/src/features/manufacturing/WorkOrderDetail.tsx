import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { cn, Button, Spinner, Badge, Card, Modal, Input } from '../../components/ui'
import { toast } from '../../components/ui'
import {
  useWorkOrderDetail,
  useWorkOrderConsumption,
  useMaterialAvailability,
  useQualityChecks,
  useStartWorkOrder,
  useCompleteWorkOrder,
  useCancelWorkOrder,
  useCreateQualityCheck,
  type MaterialConsumption,
  type MaterialAvailability,
  type QualityCheck,
} from '../../api/manufacturing'
import {
  useWorkOrderCostBreakdown,
  useRequestMaterials,
  useAssignOperators,
  useWorkOrderOperators,
  type WorkOrderOperator,
} from '../../api/cross_module_links'

function formatCurrency(amount: string | number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(amount))
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return '--'
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

function formatDateTime(dateStr: string | null) {
  if (!dateStr) return '--'
  return new Date(dateStr).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const STATUS_BADGE: Record<string, 'default' | 'info' | 'success' | 'danger' | 'warning'> = {
  draft: 'default',
  planned: 'info',
  in_progress: 'warning',
  completed: 'success',
  cancelled: 'danger',
}

const PRIORITY_BADGE: Record<string, 'default' | 'info' | 'warning' | 'danger'> = {
  low: 'default',
  medium: 'info',
  high: 'warning',
  urgent: 'danger',
}

const QC_STATUS_BADGE: Record<string, 'default' | 'info' | 'success' | 'danger' | 'warning'> = {
  pending: 'default',
  passed: 'success',
  failed: 'danger',
  partial: 'warning',
}

export default function WorkOrderDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [confirmStart, setConfirmStart] = useState(false)
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [completeOpen, setCompleteOpen] = useState(false)
  const [completedQty, setCompletedQty] = useState('')
  const [rejectedQty, setRejectedQty] = useState('0')
  const [qcOpen, setQcOpen] = useState(false)
  const [qcForm, setQcForm] = useState({ quantity_inspected: '', quantity_passed: '', quantity_failed: '', notes: '' })

  const { data: wo, isLoading } = useWorkOrderDetail(id ?? '')
  const { data: consumption } = useWorkOrderConsumption(id ?? '')
  const { data: availability } = useMaterialAvailability(id ?? '')
  const { data: qualityChecks } = useQualityChecks({ work_order_id: id ?? '' })

  const startWO = useStartWorkOrder()
  const completeWO = useCompleteWorkOrder()
  const cancelWO = useCancelWorkOrder()
  const createQC = useCreateQualityCheck()

  // Cross-module hooks
  const { data: costBreakdown } = useWorkOrderCostBreakdown(id ?? '')
  const { data: operators } = useWorkOrderOperators(id ?? '')
  const requestMaterialsMut = useRequestMaterials()
  const assignOperatorsMut = useAssignOperators()
  const [assignOpen, setAssignOpen] = useState(false)
  const [employeeIdsInput, setEmployeeIdsInput] = useState('')

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Spinner size="lg" />
      </div>
    )
  }

  if (!wo) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] text-gray-400">
        Work order not found.
      </div>
    )
  }

  const isDraft = wo.status === 'draft'
  const isPlanned = wo.status === 'planned'
  const isInProgress = wo.status === 'in_progress'
  const canStart = isDraft || isPlanned
  const canComplete = isInProgress
  const canCancel = wo.status !== 'completed' && wo.status !== 'cancelled'

  async function handleStart() {
    if (!id) return
    try {
      await startWO.mutateAsync(id)
      toast('success', 'Work order started -- materials consumed from inventory')
      setConfirmStart(false)
    } catch (err: any) {
      toast('error', err?.response?.data?.detail ?? 'Failed to start work order')
      setConfirmStart(false)
    }
  }

  async function handleComplete() {
    if (!id) return
    const qty = Number(completedQty)
    if (!qty || qty < 0) {
      toast('warning', 'Enter a valid completed quantity')
      return
    }
    try {
      await completeWO.mutateAsync({
        id,
        completed_quantity: qty,
        rejected_quantity: Number(rejectedQty) || 0,
      })
      toast('success', 'Work order completed -- finished goods added to inventory')
      setCompleteOpen(false)
    } catch (err: any) {
      toast('error', err?.response?.data?.detail ?? 'Failed to complete work order')
    }
  }

  async function handleCancel() {
    if (!id) return
    try {
      await cancelWO.mutateAsync(id)
      toast('success', 'Work order cancelled')
      setConfirmCancel(false)
    } catch {
      toast('error', 'Failed to cancel work order')
    }
  }

  async function handleCreateQC() {
    if (!id) return
    const inspected = Number(qcForm.quantity_inspected)
    const passed = Number(qcForm.quantity_passed)
    const failed = Number(qcForm.quantity_failed)
    if (!inspected || inspected < 0) {
      toast('warning', 'Enter quantity inspected')
      return
    }
    try {
      await createQC.mutateAsync({
        work_order_id: id,
        quantity_inspected: inspected,
        quantity_passed: passed || 0,
        quantity_failed: failed || 0,
        status: failed > 0 && passed === 0 ? 'failed' : failed > 0 ? 'partial' : 'passed',
        notes: qcForm.notes.trim() || undefined,
      })
      toast('success', 'Quality check recorded')
      setQcOpen(false)
      setQcForm({ quantity_inspected: '', quantity_passed: '', quantity_failed: '', notes: '' })
    } catch {
      toast('error', 'Failed to create quality check')
    }
  }

  const allAvailable = availability?.every((m: MaterialAvailability) => m.sufficient) ?? false

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/manufacturing/work-orders')}
            className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <svg className="h-5 w-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{wo.wo_number}</h1>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant={STATUS_BADGE[wo.status] ?? 'default'} className="capitalize">
                {wo.status.replace('_', ' ')}
              </Badge>
              <Badge variant={PRIORITY_BADGE[wo.priority] ?? 'default'} className="capitalize">
                {wo.priority}
              </Badge>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          {canStart && (
            <Button
              size="sm"
              onClick={() => setConfirmStart(true)}
              className="bg-[#6fd943] hover:bg-[#5ec335] text-white"
            >
              Start Production
            </Button>
          )}
          {canComplete && (
            <Button size="sm" onClick={() => { setCompletedQty(String(wo.planned_quantity)); setCompleteOpen(true) }}>
              Complete
            </Button>
          )}
          {isInProgress && (
            <Button size="sm" variant="outline" onClick={() => setQcOpen(true)}>
              Add QC Check
            </Button>
          )}
          {(canStart || isInProgress) && (
            <Button
              size="sm"
              variant="outline"
              loading={requestMaterialsMut.isPending}
              onClick={async () => {
                try {
                  const res = await requestMaterialsMut.mutateAsync(id!)
                  toast('success', res.message || 'Material requisition created')
                } catch {
                  toast('error', 'Failed to request materials')
                }
              }}
            >
              Request Materials
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={() => setAssignOpen(true)}>
            Assign Operators
          </Button>
          {canCancel && (
            <Button variant="danger" size="sm" onClick={() => setConfirmCancel(true)}>
              Cancel
            </Button>
          )}
        </div>
      </div>

      {/* Work Order Info */}
      <Card className="mb-6">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Product</p>
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 mt-1">{wo.finished_item_name ?? wo.finished_item_id}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">BOM</p>
            <p className="text-sm text-gray-900 dark:text-gray-100 mt-1">
              {wo.bom_name ? (
                <button className="text-primary hover:underline" onClick={() => navigate(`/manufacturing/bom/${wo.bom_id}`)}>
                  {wo.bom_name}
                </button>
              ) : wo.bom_id}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Planned Qty</p>
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 mt-1">{wo.planned_quantity}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Completed / Rejected</p>
            <p className="text-sm mt-1">
              <span className="font-semibold text-green-600">{wo.completed_quantity}</span>
              {wo.rejected_quantity > 0 && (
                <span className="text-red-600 ml-1">/ {wo.rejected_quantity} rejected</span>
              )}
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 mt-4 pt-4 border-t border-gray-100 dark:border-gray-800">
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Planned Start</p>
            <p className="text-sm text-gray-900 dark:text-gray-100 mt-1">{formatDateTime(wo.planned_start)}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Planned End</p>
            <p className="text-sm text-gray-900 dark:text-gray-100 mt-1">{formatDateTime(wo.planned_end)}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Actual Start</p>
            <p className="text-sm text-gray-900 dark:text-gray-100 mt-1">{formatDateTime(wo.actual_start)}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Actual End</p>
            <p className="text-sm text-gray-900 dark:text-gray-100 mt-1">{formatDateTime(wo.actual_end)}</p>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-6 mt-4 pt-4 border-t border-gray-100 dark:border-gray-800">
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Material Cost</p>
            <p className="text-lg font-bold text-gray-900 dark:text-gray-100 mt-1">{formatCurrency(wo.total_material_cost)}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Labor Cost</p>
            <p className="text-lg font-bold text-gray-900 dark:text-gray-100 mt-1">{formatCurrency(wo.total_labor_cost)}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Created</p>
            <p className="text-sm text-gray-900 dark:text-gray-100 mt-1">{formatDate(wo.created_at)}</p>
          </div>
        </div>
        {wo.notes && (
          <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Notes</p>
            <p className="text-sm text-gray-700 dark:text-gray-300">{wo.notes}</p>
          </div>
        )}
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Material Availability */}
        {canStart && availability && (
          <Card padding={false}>
            <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-gray-800">
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Material Availability</h2>
                <Badge variant={allAvailable ? 'success' : 'danger'}>
                  {allAvailable ? 'All Available' : 'Shortages'}
                </Badge>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-gray-800">
                    <th className="text-left py-2 px-4 text-xs font-semibold text-gray-500 uppercase">Item</th>
                    <th className="text-right py-2 px-4 text-xs font-semibold text-gray-500 uppercase w-20">Required</th>
                    <th className="text-right py-2 px-4 text-xs font-semibold text-gray-500 uppercase w-20">Available</th>
                    <th className="text-center py-2 px-4 text-xs font-semibold text-gray-500 uppercase w-20">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {availability.map((m: MaterialAvailability) => (
                    <tr key={m.item_id} className="border-b border-gray-50 dark:border-gray-800">
                      <td className="py-2 px-4 text-gray-700 dark:text-gray-300">{m.item_name ?? m.item_id}</td>
                      <td className="py-2 px-4 text-right font-medium">{m.required}</td>
                      <td className="py-2 px-4 text-right font-medium">{m.available}</td>
                      <td className="py-2 px-4 text-center">
                        {m.sufficient ? (
                          <Badge variant="success">OK</Badge>
                        ) : (
                          <Badge variant="danger">-{m.shortfall}</Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {/* Material Consumption */}
        <Card padding={false}>
          <div className="p-5 border-b border-gray-100 dark:border-gray-800">
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Material Consumption</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-800">
                  <th className="text-left py-2 px-4 text-xs font-semibold text-gray-500 uppercase">Item</th>
                  <th className="text-right py-2 px-4 text-xs font-semibold text-gray-500 uppercase w-24">Planned</th>
                  <th className="text-right py-2 px-4 text-xs font-semibold text-gray-500 uppercase w-24">Actual</th>
                  <th className="text-left py-2 px-4 text-xs font-semibold text-gray-500 uppercase w-32">Consumed At</th>
                </tr>
              </thead>
              <tbody>
                {!consumption || consumption.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="text-center py-8 text-gray-400">No consumption records</td>
                  </tr>
                ) : (
                  consumption.map((mc: MaterialConsumption) => (
                    <tr key={mc.id} className="border-b border-gray-50 dark:border-gray-800">
                      <td className="py-2 px-4 text-gray-700 dark:text-gray-300">{mc.item_name ?? mc.item_id}</td>
                      <td className="py-2 px-4 text-right">{mc.planned_quantity}</td>
                      <td className="py-2 px-4 text-right font-medium">
                        {mc.actual_quantity > 0 ? (
                          <span className={cn(
                            Number(mc.actual_quantity) > Number(mc.planned_quantity) ? 'text-red-600' : 'text-green-600'
                          )}>
                            {mc.actual_quantity}
                          </span>
                        ) : (
                          <span className="text-gray-400">--</span>
                        )}
                      </td>
                      <td className="py-2 px-4 text-gray-500 text-xs">{formatDateTime(mc.consumed_at)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Quality Checks */}
        <Card padding={false} className={canStart && availability ? '' : 'lg:col-span-2'}>
          <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-gray-800">
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Quality Checks</h2>
            {isInProgress && (
              <Button size="sm" variant="outline" onClick={() => setQcOpen(true)}>
                Add Check
              </Button>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-800">
                  <th className="text-left py-2 px-4 text-xs font-semibold text-gray-500 uppercase">Check #</th>
                  <th className="text-right py-2 px-4 text-xs font-semibold text-gray-500 uppercase w-20">Inspected</th>
                  <th className="text-right py-2 px-4 text-xs font-semibold text-gray-500 uppercase w-20">Passed</th>
                  <th className="text-right py-2 px-4 text-xs font-semibold text-gray-500 uppercase w-20">Failed</th>
                  <th className="text-center py-2 px-4 text-xs font-semibold text-gray-500 uppercase w-20">Status</th>
                  <th className="text-left py-2 px-4 text-xs font-semibold text-gray-500 uppercase">Date</th>
                </tr>
              </thead>
              <tbody>
                {!qualityChecks?.quality_checks || qualityChecks.quality_checks.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-gray-400">No quality checks recorded</td>
                  </tr>
                ) : (
                  qualityChecks.quality_checks.map((qc: QualityCheck) => (
                    <tr key={qc.id} className="border-b border-gray-50 dark:border-gray-800">
                      <td className="py-2 px-4 font-mono text-xs text-primary">{qc.check_number}</td>
                      <td className="py-2 px-4 text-right">{qc.quantity_inspected}</td>
                      <td className="py-2 px-4 text-right text-green-600 font-medium">{qc.quantity_passed}</td>
                      <td className="py-2 px-4 text-right text-red-600 font-medium">{qc.quantity_failed}</td>
                      <td className="py-2 px-4 text-center">
                        <Badge variant={QC_STATUS_BADGE[qc.status] ?? 'default'} className="capitalize">{qc.status}</Badge>
                      </td>
                      <td className="py-2 px-4 text-gray-500 text-xs">{formatDateTime(qc.checked_at)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* Cost Breakdown (Finance Integration) */}
      {costBreakdown && (
        <Card className="mt-6">
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-4">Production Cost Breakdown</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Material Cost</p>
              <p className="text-lg font-bold text-gray-900 dark:text-gray-100">{formatCurrency(costBreakdown.total_material_cost)}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Labor Cost</p>
              <p className="text-lg font-bold text-gray-900 dark:text-gray-100">{formatCurrency(costBreakdown.total_labor_cost)}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Overhead ({costBreakdown.overhead_rate})</p>
              <p className="text-lg font-bold text-gray-900 dark:text-gray-100">{formatCurrency(costBreakdown.overhead_cost)}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Total / Unit Cost</p>
              <p className="text-lg font-bold text-primary">{formatCurrency(costBreakdown.total_production_cost)}</p>
              <p className="text-xs text-gray-500">{formatCurrency(costBreakdown.unit_cost)} per unit</p>
            </div>
          </div>
          {costBreakdown.material_costs.length > 0 && (
            <div className="overflow-x-auto border-t border-gray-100 dark:border-gray-800 pt-3">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Material Details</p>
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-gray-800">
                    <th className="text-left py-1 px-2 text-gray-500">Item</th>
                    <th className="text-right py-1 px-2 text-gray-500">Qty</th>
                    <th className="text-right py-1 px-2 text-gray-500">Unit Cost</th>
                    <th className="text-right py-1 px-2 text-gray-500">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {costBreakdown.material_costs.map((m) => (
                    <tr key={m.item_id} className="border-b border-gray-50 dark:border-gray-800">
                      <td className="py-1 px-2 text-gray-700 dark:text-gray-300">{m.item_name}</td>
                      <td className="py-1 px-2 text-right">{m.quantity}</td>
                      <td className="py-1 px-2 text-right">{formatCurrency(m.unit_cost)}</td>
                      <td className="py-1 px-2 text-right font-medium">{formatCurrency(m.total_cost)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* Assigned Operators (HR Integration) */}
      {operators?.operators && operators.operators.length > 0 && (
        <Card className="mt-6">
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-4">Assigned Operators</h2>
          <div className="space-y-2">
            {operators.operators.map((op: WorkOrderOperator) => (
              <div key={op.employee_id} className="flex items-center justify-between py-2 px-3 rounded-[10px] bg-gray-50 dark:bg-gray-950">
                <div>
                  <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{op.name}</span>
                  <span className="text-xs text-gray-500 ml-2">({op.employee_number})</span>
                </div>
                <div className="text-xs text-gray-500">{op.job_title || 'No title'}</div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Assign Operators Modal */}
      <Modal open={assignOpen} onClose={() => setAssignOpen(false)} title="Assign Operators" size="sm">
        <div className="space-y-4">
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Employee IDs</label>
            <textarea
              className="w-full rounded-[10px] border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary min-h-[80px]"
              placeholder="Paste employee UUIDs, one per line"
              value={employeeIdsInput}
              onChange={(e) => setEmployeeIdsInput(e.target.value)}
            />
            <p className="text-xs text-gray-400">Enter one employee ID per line</p>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => setAssignOpen(false)}>Cancel</Button>
            <Button
              size="sm"
              loading={assignOperatorsMut.isPending}
              onClick={async () => {
                const ids = employeeIdsInput.split('\n').map(s => s.trim()).filter(Boolean)
                if (ids.length === 0) { toast('warning', 'Enter at least one employee ID'); return }
                try {
                  await assignOperatorsMut.mutateAsync({ woId: id!, employeeIds: ids })
                  toast('success', 'Operators assigned')
                  setAssignOpen(false)
                  setEmployeeIdsInput('')
                } catch {
                  toast('error', 'Failed to assign operators')
                }
              }}
            >
              Assign
            </Button>
          </div>
        </div>
      </Modal>

      {/* Start Confirmation Modal */}
      <Modal open={confirmStart} onClose={() => setConfirmStart(false)} title="Start Work Order" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Starting <span className="font-semibold">{wo.wo_number}</span> will consume raw materials from the source warehouse. This cannot be undone.
          </p>
          {!allAvailable && availability && (
            <div className="rounded-[10px] bg-red-50 border border-red-200 p-3">
              <p className="text-sm text-red-700 font-medium">
                Warning: Some materials have insufficient stock. Starting may fail.
              </p>
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => setConfirmStart(false)}>Cancel</Button>
            <Button
              size="sm"
              onClick={handleStart}
              loading={startWO.isPending}
              className="bg-[#6fd943] hover:bg-[#5ec335] text-white"
            >
              Start Production
            </Button>
          </div>
        </div>
      </Modal>

      {/* Complete Modal */}
      <Modal open={completeOpen} onClose={() => setCompleteOpen(false)} title="Complete Work Order" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Enter the quantity of finished goods produced for <span className="font-semibold">{wo.wo_number}</span>.
          </p>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Completed Quantity *"
              type="number"
              min="0"
              value={completedQty}
              onChange={(e) => setCompletedQty(e.target.value)}
            />
            <Input
              label="Rejected Quantity"
              type="number"
              min="0"
              value={rejectedQty}
              onChange={(e) => setRejectedQty(e.target.value)}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => setCompleteOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={handleComplete} loading={completeWO.isPending}>
              Complete
            </Button>
          </div>
        </div>
      </Modal>

      {/* Cancel Confirmation Modal */}
      <Modal open={confirmCancel} onClose={() => setConfirmCancel(false)} title="Cancel Work Order" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Are you sure you want to cancel <span className="font-semibold">{wo.wo_number}</span>? This action cannot be undone.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => setConfirmCancel(false)}>Go Back</Button>
            <Button variant="danger" size="sm" onClick={handleCancel} loading={cancelWO.isPending}>
              Cancel Order
            </Button>
          </div>
        </div>
      </Modal>

      {/* QC Modal */}
      <Modal open={qcOpen} onClose={() => setQcOpen(false)} title="Add Quality Check" size="sm">
        <div className="space-y-4">
          <Input
            label="Quantity Inspected *"
            type="number"
            min="0"
            value={qcForm.quantity_inspected}
            onChange={(e) => setQcForm({ ...qcForm, quantity_inspected: e.target.value })}
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Quantity Passed"
              type="number"
              min="0"
              value={qcForm.quantity_passed}
              onChange={(e) => setQcForm({ ...qcForm, quantity_passed: e.target.value })}
            />
            <Input
              label="Quantity Failed"
              type="number"
              min="0"
              value={qcForm.quantity_failed}
              onChange={(e) => setQcForm({ ...qcForm, quantity_failed: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notes</label>
            <textarea
              value={qcForm.notes}
              onChange={(e) => setQcForm({ ...qcForm, notes: e.target.value })}
              rows={2}
              className="w-full rounded-[10px] border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary placeholder:text-gray-400"
              placeholder="Optional notes"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => setQcOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={handleCreateQC} loading={createQC.isPending}>
              Record Check
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
