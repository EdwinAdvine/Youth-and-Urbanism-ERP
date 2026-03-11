import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Button, Spinner, Badge, Card, Modal } from '../../components/ui'
import { toast } from '../../components/ui'
import {
  usePurchaseOrderDetail,
  useSendPO,
  useReceivePO,
  useCancelPO,
  type PurchaseOrderLine,
} from '../../api/inventory'
import MobilePOReceipt from './MobilePOReceipt'

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

const STATUS_BADGE: Record<string, 'default' | 'info' | 'success' | 'danger'> = {
  draft: 'default',
  sent: 'info',
  received: 'success',
  cancelled: 'danger',
}

export default function PODetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [confirmReceive, setConfirmReceive] = useState(false)
  const [confirmCancel, setConfirmCancel] = useState(false)

  const { data: po, isLoading } = usePurchaseOrderDetail(id ?? '')
  const sendPO = useSendPO()
  const receivePO = useReceivePO()
  const cancelPO = useCancelPO()

  async function handleSend() {
    if (!id) return
    try {
      await sendPO.mutateAsync(id)
      toast('success', 'Purchase order sent')
    } catch {
      toast('error', 'Failed to send purchase order')
    }
  }

  async function handleReceive() {
    if (!id) return
    try {
      await receivePO.mutateAsync(id)
      toast('success', 'Purchase order marked as received — stock updated')
      setConfirmReceive(false)
    } catch {
      toast('error', 'Failed to receive purchase order')
    }
  }

  async function handleCancel() {
    if (!id) return
    try {
      await cancelPO.mutateAsync(id)
      toast('success', 'Purchase order cancelled')
      setConfirmCancel(false)
      navigate('/inventory/purchase-orders')
    } catch {
      toast('error', 'Failed to cancel purchase order')
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Spinner size="lg" />
      </div>
    )
  }

  if (!po) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] text-gray-400">
        Purchase order not found.
      </div>
    )
  }

  const isDraft = po.status === 'draft'
  const isSent = po.status === 'sent'

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5 sm:mb-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/inventory/purchase-orders')}
            className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center sm:min-h-0 sm:min-w-0"
          >
            <svg className="h-5 w-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100">{po.po_number}</h1>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant={STATUS_BADGE[po.status] ?? 'default'} className="capitalize">{po.status}</Badge>
              <span className="text-sm text-gray-500">{po.supplier_name}</span>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          {isDraft && (
            <>
              <Button variant="outline" size="sm" onClick={handleSend} loading={sendPO.isPending} className="min-h-[44px] sm:min-h-0">
                Send PO
              </Button>
              <Button variant="danger" size="sm" onClick={() => setConfirmCancel(true)} className="min-h-[44px] sm:min-h-0">
                Cancel PO
              </Button>
            </>
          )}
          {isSent && (
            <Button size="sm" onClick={() => setConfirmReceive(true)} className="min-h-[44px] sm:min-h-0">
              Receive PO
            </Button>
          )}
        </div>
      </div>

      {/* Mobile PO Receipt view (visible on small screens for sent POs) */}
      <div className="block md:hidden mb-5">
        <MobilePOReceipt poId={id ?? ''} />
      </div>

      {/* PO Header Info (desktop) */}
      <Card className="mb-6 hidden md:block">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Supplier</p>
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 mt-1">{po.supplier_name}</p>
            {po.supplier_email && <p className="text-xs text-gray-500">{po.supplier_email}</p>}
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Order Date</p>
            <p className="text-sm text-gray-900 dark:text-gray-100 mt-1">{formatDate(po.order_date)}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Expected Date</p>
            <p className="text-sm text-gray-900 dark:text-gray-100 mt-1">
              {po.expected_date ? formatDate(po.expected_date) : <span className="text-gray-400">—</span>}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Total</p>
            <p className="text-lg font-bold text-gray-900 dark:text-gray-100 mt-1">{formatCurrency(po.total)}</p>
          </div>
        </div>
        {po.notes && (
          <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Notes</p>
            <p className="text-sm text-gray-700 dark:text-gray-300">{po.notes}</p>
          </div>
        )}
      </Card>

      {/* Line Items (desktop) */}
      <Card padding={false} className="hidden md:block">
        <div className="p-5 border-b border-gray-100 dark:border-gray-800">
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Line Items</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-800">
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">Item</th>
                <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide w-24">Qty Ordered</th>
                <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide w-28">Unit Price</th>
                <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide w-24">Received</th>
                <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide w-28">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {po.lines.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-12 text-gray-400">No line items</td>
                </tr>
              ) : (
                po.lines.map((line: PurchaseOrderLine) => (
                  <tr key={line.id} className="border-b border-gray-50 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                    <td className="py-3 px-4">
                      <span className="font-medium text-gray-900 dark:text-gray-100">
                        {line.item_name ?? line.item_id}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">{line.quantity}</td>
                    <td className="py-3 px-4 text-right">{formatCurrency(line.unit_price)}</td>
                    <td className="py-3 px-4 text-right">
                      <span className={line.received_quantity >= line.quantity ? 'text-green-600 font-medium' : 'text-gray-700 dark:text-gray-300'}>
                        {line.received_quantity}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-medium">
                      {formatCurrency(line.quantity * line.unit_price)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            <tfoot>
              <tr className="border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
                <td colSpan={4} className="py-3 px-4 text-right text-sm font-bold text-gray-900 dark:text-gray-100">Total</td>
                <td className="py-3 px-4 text-right text-sm font-bold text-gray-900 dark:text-gray-100">
                  {formatCurrency(po.total)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>

      {/* Receive PO Confirmation */}
      <Modal
        open={confirmReceive}
        onClose={() => setConfirmReceive(false)}
        title="Receive Purchase Order"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Confirm receipt of <span className="font-semibold">{po.po_number}</span>? This will update stock levels for all line items and cannot be undone.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => setConfirmReceive(false)}>Cancel</Button>
            <Button size="sm" onClick={handleReceive} loading={receivePO.isPending}>
              Confirm Receipt
            </Button>
          </div>
        </div>
      </Modal>

      {/* Cancel PO Confirmation */}
      <Modal
        open={confirmCancel}
        onClose={() => setConfirmCancel(false)}
        title="Cancel Purchase Order"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Are you sure you want to cancel <span className="font-semibold">{po.po_number}</span>? This action cannot be undone.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => setConfirmCancel(false)}>Go Back</Button>
            <Button variant="danger" size="sm" onClick={handleCancel} loading={cancelPO.isPending}>
              Cancel Order
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
