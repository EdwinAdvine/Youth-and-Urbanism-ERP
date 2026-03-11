import { useParams, useNavigate } from 'react-router-dom'
import { Button, Spinner, Badge, Card, toast } from '../../components/ui'
import {
  useRequisition, useSubmitRequisition, useApproveRequisition,
  useConvertRequisitionToPO,
} from '../../api/supplychain'

const STATUS_BADGE: Record<string, 'success' | 'danger' | 'info' | 'warning' | 'default' | 'primary'> = {
  draft: 'default',
  submitted: 'info',
  approved: 'success',
  rejected: 'danger',
  converted_to_po: 'primary',
}

function formatCurrency(value: string | number) {
  const num = typeof value === 'string' ? parseFloat(value) : value
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(num)
}

export default function RequisitionDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: req, isLoading } = useRequisition(id ?? '')
  const submit = useSubmitRequisition()
  const approve = useApproveRequisition()
  const convert = useConvertRequisitionToPO()

  if (isLoading) return <div className="flex items-center justify-center min-h-[60vh]"><Spinner size="lg" /></div>
  if (!req) return <div className="p-6 text-gray-500">Requisition not found</div>

  async function handleSubmit() {
    try { await submit.mutateAsync(req!.id); toast('success', 'Requisition submitted') } catch { toast('error', 'Failed to submit') }
  }
  async function handleApprove(action: 'approve' | 'reject') {
    try { await approve.mutateAsync({ id: req!.id, action }); toast('success', `Requisition ${action}d`) } catch { toast('error', `Failed to ${action}`) }
  }
  async function handleConvert() {
    try {
      const result = await convert.mutateAsync(req!.id)
      toast('success', `Converted to PO ${result.po_number}`)
      navigate(`/inventory/purchase-orders/${result.purchase_order_id}`)
    } catch { toast('error', 'Failed to convert') }
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/supply-chain/requisitions')} className="text-gray-400 hover:text-gray-600">
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        </button>
        <h1 className="text-xl font-bold text-gray-900">{req.requisition_number}</h1>
        <Badge variant={STATUS_BADGE[req.status] ?? 'default'}>{req.status.replace(/_/g, ' ')}</Badge>
        <div className="ml-auto flex gap-2">
          {req.status === 'draft' && <Button size="sm" onClick={handleSubmit} loading={submit.isPending}>Submit</Button>}
          {req.status === 'submitted' && (
            <>
              <Button size="sm" variant="outline" onClick={() => handleApprove('reject')} loading={approve.isPending}>Reject</Button>
              <Button size="sm" onClick={() => handleApprove('approve')} loading={approve.isPending}>Approve</Button>
            </>
          )}
          {req.status === 'approved' && <Button size="sm" onClick={handleConvert} loading={convert.isPending}>Convert to PO</Button>}
        </div>
      </div>

      <Card className="p-5">
        <h2 className="font-semibold text-gray-900 mb-3">{req.title}</h2>
        {req.description && <p className="text-sm text-gray-500 mb-4">{req.description}</p>}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div><span className="text-gray-400">Priority</span><p className="font-medium capitalize">{req.priority}</p></div>
          <div><span className="text-gray-400">Required By</span><p className="font-medium">{req.required_by_date ?? 'N/A'}</p></div>
          <div><span className="text-gray-400">Total Estimated</span><p className="font-medium">{formatCurrency(req.total_estimated)}</p></div>
          <div><span className="text-gray-400">Status</span><p className="font-medium capitalize">{req.status.replace(/_/g, ' ')}</p></div>
        </div>
      </Card>

      <Card className="p-5">
        <h3 className="font-semibold text-gray-900 mb-3">Line Items</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-gray-100 text-left text-gray-500">
              <th className="pb-2 pr-4">Item ID</th>
              <th className="pb-2 pr-4">Qty</th>
              <th className="pb-2 pr-4">Unit Price</th>
              <th className="pb-2 pr-4">Subtotal</th>
              <th className="pb-2">Notes</th>
            </tr></thead>
            <tbody>
              {(req.lines ?? []).map((line) => (
                <tr key={line.id} className="border-b border-gray-50">
                  <td className="py-2 pr-4 font-mono text-xs">{line.item_id.slice(0, 8)}...</td>
                  <td className="py-2 pr-4">{line.quantity}</td>
                  <td className="py-2 pr-4">{formatCurrency(line.estimated_unit_price)}</td>
                  <td className="py-2 pr-4">{formatCurrency(line.quantity * line.estimated_unit_price)}</td>
                  <td className="py-2 text-gray-400">{line.notes ?? '—'}</td>
                </tr>
              ))}
              {(!req.lines || req.lines.length === 0) && (
                <tr><td colSpan={5} className="py-8 text-center text-gray-400">No line items</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
