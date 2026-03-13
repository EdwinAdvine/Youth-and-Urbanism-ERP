import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import apiClient from '../../api/client'
import { Button, Spinner, Modal, Input, toast } from '../../components/ui'
import { useEmailPosReceipt } from '../../api/cross_module_links'

interface ReceiptLine {
  id: string
  product_name: string
  quantity: number
  unit_price: number
  discount: number
  line_total: number
}

interface Receipt {
  receipt_number: string
  created_at: string
  cashier_name: string
  payment_method: string
  lines: ReceiptLine[]
  subtotal: number
  tax_amount: number
  discount_total: number
  total_amount: number
  change_given: number
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value)
}

export default function POSReceiptView() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const emailReceiptMut = useEmailPosReceipt()
  const [emailOpen, setEmailOpen] = useState(false)
  const [emailInput, setEmailInput] = useState('')

  const { data: receipt, isLoading } = useQuery({
    queryKey: ['pos', 'receipt', id],
    queryFn: async () => {
      const { data } = await apiClient.get<Receipt>(`/pos/transactions/${id}/receipt`)
      return data
    },
    enabled: !!id,
  })

  if (isLoading) return <div className="flex items-center justify-center min-h-[60vh]"><Spinner size="lg" /></div>
  if (!receipt) return <div className="p-6 text-gray-500">Receipt not found</div>

  return (
    <div className="p-6 max-w-md mx-auto">
      <div className="flex gap-2 mb-4 print:hidden">
        <Button size="sm" variant="outline" onClick={() => navigate(-1)}>Back</Button>
        <Button size="sm" onClick={() => window.print()}>Print Receipt</Button>
        <Button size="sm" variant="outline" onClick={() => setEmailOpen(true)}>Email Receipt</Button>
      </div>

      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 font-mono text-sm">
        <div className="text-center mb-4">
          <h2 className="text-lg font-bold">Urban Vibes Dynamics</h2>
          <p className="text-gray-500 text-xs">Point of Sale Receipt</p>
        </div>

        <div className="border-t border-dashed border-gray-300 py-2 text-xs text-gray-500">
          <div className="flex justify-between">
            <span>Receipt #</span>
            <span>{receipt.receipt_number}</span>
          </div>
          <div className="flex justify-between">
            <span>Date</span>
            <span>{new Date(receipt.created_at).toLocaleString()}</span>
          </div>
          <div className="flex justify-between">
            <span>Cashier</span>
            <span>{receipt.cashier_name}</span>
          </div>
        </div>

        <div className="border-t border-dashed border-gray-300 py-2">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-gray-500">
                <th className="text-left pb-1">Item</th>
                <th className="text-right pb-1">Qty</th>
                <th className="text-right pb-1">Price</th>
                <th className="text-right pb-1">Total</th>
              </tr>
            </thead>
            <tbody>
              {(receipt.lines ?? []).map((line) => (
                <tr key={line.id}>
                  <td className="py-0.5">{line.product_name}</td>
                  <td className="text-right">{line.quantity}</td>
                  <td className="text-right">{formatCurrency(line.unit_price)}</td>
                  <td className="text-right">{formatCurrency(line.line_total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="border-t border-dashed border-gray-300 py-2 text-xs space-y-1">
          <div className="flex justify-between">
            <span>Subtotal</span>
            <span>{formatCurrency(receipt.subtotal)}</span>
          </div>
          {receipt.discount_total > 0 && (
            <div className="flex justify-between text-green-600">
              <span>Discount</span>
              <span>-{formatCurrency(receipt.discount_total)}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span>Tax</span>
            <span>{formatCurrency(receipt.tax_amount)}</span>
          </div>
          <div className="flex justify-between font-bold text-sm pt-1 border-t border-gray-200 dark:border-gray-700">
            <span>TOTAL</span>
            <span>{formatCurrency(receipt.total_amount)}</span>
          </div>
          <div className="flex justify-between text-gray-500">
            <span>Payment ({receipt.payment_method})</span>
            <span>{formatCurrency(receipt.total_amount + receipt.change_given)}</span>
          </div>
          {receipt.change_given > 0 && (
            <div className="flex justify-between text-gray-500">
              <span>Change</span>
              <span>{formatCurrency(receipt.change_given)}</span>
            </div>
          )}
        </div>

        <div className="border-t border-dashed border-gray-300 pt-3 text-center text-xs text-gray-400">
          <p>Thank you for your purchase!</p>
        </div>
      </div>

      {/* Email Receipt Modal */}
      <Modal open={emailOpen} onClose={() => setEmailOpen(false)} title="Email Receipt" size="sm">
        <div className="space-y-4">
          <Input
            label="Recipient Email"
            type="email"
            placeholder="customer@example.com"
            value={emailInput}
            onChange={(e) => setEmailInput(e.target.value)}
          />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => setEmailOpen(false)}>Cancel</Button>
            <Button
              size="sm"
              loading={emailReceiptMut.isPending}
              onClick={async () => {
                if (!emailInput.trim()) { toast('warning', 'Enter an email address'); return }
                try {
                  await emailReceiptMut.mutateAsync({ txnId: id!, email: emailInput.trim() })
                  toast('success', 'Receipt emailed successfully')
                  setEmailOpen(false)
                  setEmailInput('')
                } catch {
                  toast('error', 'Failed to email receipt')
                }
              }}
            >
              Send Email
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
