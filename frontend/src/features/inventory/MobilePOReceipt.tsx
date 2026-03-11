import { useState } from 'react'
import { Card, Badge, Button, Input, Spinner } from '../../components/ui'
import { toast } from '../../components/ui'
import {
  usePurchaseOrderDetail,
  useReceivePO,
  type PurchaseOrderLine,
} from '../../api/inventory'

interface MobilePOReceiptProps {
  poId: string
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)
}

export default function MobilePOReceipt({ poId }: MobilePOReceiptProps) {
  const { data: po, isLoading } = usePurchaseOrderDetail(poId)
  const receivePO = useReceivePO()
  const [receivedQtys, setReceivedQtys] = useState<Record<string, number>>({})
  const [showConfirm, setShowConfirm] = useState(false)

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Spinner size="lg" />
      </div>
    )
  }

  if (!po) {
    return (
      <div className="text-center py-8 text-gray-400">Purchase order not found</div>
    )
  }

  const isSent = po.status === 'sent'
  const isReceived = po.status === 'received'

  function handleQtyChange(lineId: string, value: string) {
    const qty = Math.max(0, parseInt(value) || 0)
    setReceivedQtys((prev) => ({ ...prev, [lineId]: qty }))
  }

  function incrementQty(lineId: string, max: number) {
    setReceivedQtys((prev) => {
      const current = prev[lineId] ?? 0
      return { ...prev, [lineId]: Math.min(current + 1, max) }
    })
  }

  function decrementQty(lineId: string) {
    setReceivedQtys((prev) => {
      const current = prev[lineId] ?? 0
      return { ...prev, [lineId]: Math.max(current - 1, 0) }
    })
  }

  function setAllToOrdered() {
    const newQtys: Record<string, number> = {}
    po.lines.forEach((line) => {
      newQtys[line.id] = line.quantity - line.received_quantity
    })
    setReceivedQtys(newQtys)
  }

  async function handleConfirmReceive() {
    try {
      await receivePO.mutateAsync(poId)
      toast('success', 'Purchase order received -- stock updated')
      setShowConfirm(false)
    } catch {
      toast('error', 'Failed to receive purchase order')
    }
  }

  const totalToReceive = Object.values(receivedQtys).reduce((sum, qty) => sum + qty, 0)

  return (
    <div className="space-y-4">
      {/* PO Header */}
      <Card>
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">{po.po_number}</h3>
            <p className="text-sm text-gray-500">{po.supplier_name}</p>
          </div>
          <Badge
            variant={po.status === 'received' ? 'success' : po.status === 'sent' ? 'info' : 'default'}
            className="capitalize"
          >
            {po.status}
          </Badge>
        </div>
        <div className="grid grid-cols-2 gap-3 mt-3 text-sm">
          <div>
            <span className="text-gray-500">Total: </span>
            <span className="font-semibold text-gray-900 dark:text-gray-100">{formatCurrency(po.total)}</span>
          </div>
          <div>
            <span className="text-gray-500">Items: </span>
            <span className="font-semibold text-gray-900 dark:text-gray-100">{po.lines.length}</span>
          </div>
        </div>
      </Card>

      {/* Quick Actions */}
      {isSent && (
        <Button
          variant="outline"
          onClick={setAllToOrdered}
          className="w-full min-h-[44px]"
        >
          Set All to Ordered Quantity
        </Button>
      )}

      {/* Line Items */}
      <div className="space-y-3">
        {po.lines.map((line: PurchaseOrderLine) => {
          const remaining = line.quantity - line.received_quantity
          const currentQty = receivedQtys[line.id] ?? 0
          const isFullyReceived = line.received_quantity >= line.quantity

          return (
            <Card key={line.id} className={isFullyReceived ? 'opacity-60' : ''}>
              <div className="flex items-start justify-between mb-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                    {line.item_name ?? line.item_id}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {formatCurrency(line.unit_price)} each
                  </p>
                </div>
                {isFullyReceived && (
                  <Badge variant="success">Received</Badge>
                )}
              </div>

              {/* Quantity info */}
              <div className="grid grid-cols-3 gap-2 text-center mb-3">
                <div className="bg-gray-50 dark:bg-gray-950 rounded-lg py-1.5">
                  <p className="text-lg font-bold text-gray-900 dark:text-gray-100">{line.quantity}</p>
                  <p className="text-[10px] text-gray-500 uppercase">Ordered</p>
                </div>
                <div className="bg-green-50 rounded-lg py-1.5">
                  <p className="text-lg font-bold text-green-700">{line.received_quantity}</p>
                  <p className="text-[10px] text-green-600 uppercase">Received</p>
                </div>
                <div className="bg-orange-50 rounded-lg py-1.5">
                  <p className="text-lg font-bold text-orange-700">{remaining}</p>
                  <p className="text-[10px] text-orange-600 uppercase">Remaining</p>
                </div>
              </div>

              {/* Receive input - only for non-received POs */}
              {isSent && !isFullyReceived && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500 shrink-0">Receive:</span>
                  <button
                    onClick={() => decrementQty(line.id)}
                    className="w-11 h-11 rounded-[10px] bg-gray-100 dark:bg-gray-900 text-gray-700 dark:text-gray-300 font-bold text-lg flex items-center justify-center active:bg-gray-200"
                    disabled={currentQty <= 0}
                  >
                    -
                  </button>
                  <Input
                    type="number"
                    min={0}
                    max={remaining}
                    value={currentQty}
                    onChange={(e) => handleQtyChange(line.id, e.target.value)}
                    className="text-center text-lg font-bold min-h-[44px] w-20"
                  />
                  <button
                    onClick={() => incrementQty(line.id, remaining)}
                    className="w-11 h-11 rounded-[10px] bg-primary/10 text-primary font-bold text-lg flex items-center justify-center active:bg-primary/20"
                    disabled={currentQty >= remaining}
                  >
                    +
                  </button>
                  <button
                    onClick={() => setReceivedQtys((prev) => ({ ...prev, [line.id]: remaining }))}
                    className="text-xs text-primary font-medium min-h-[44px] px-2 active:opacity-70"
                  >
                    All
                  </button>
                </div>
              )}
            </Card>
          )
        })}
      </div>

      {/* Confirm Button */}
      {isSent && (
        <>
          {!showConfirm ? (
            <Button
              onClick={() => setShowConfirm(true)}
              disabled={totalToReceive === 0}
              className="w-full min-h-[56px] text-base font-semibold"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Confirm Receipt
            </Button>
          ) : (
            <Card className="border-2 border-primary/30">
              <p className="text-sm text-gray-700 dark:text-gray-300 mb-3">
                Confirm receipt of <span className="font-bold">{po.po_number}</span>?
                This will update stock levels and cannot be undone.
              </p>
              <div className="flex gap-3">
                <Button
                  variant="secondary"
                  onClick={() => setShowConfirm(false)}
                  className="flex-1 min-h-[48px]"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleConfirmReceive}
                  loading={receivePO.isPending}
                  className="flex-1 min-h-[48px]"
                >
                  Confirm
                </Button>
              </div>
            </Card>
          )}
        </>
      )}

      {/* Already received notice */}
      {isReceived && (
        <div className="text-center py-4">
          <div className="inline-flex items-center gap-2 bg-green-50 rounded-[10px] px-6 py-4">
            <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span className="text-sm font-medium text-green-700">This PO has been fully received</span>
          </div>
        </div>
      )}
    </div>
  )
}
