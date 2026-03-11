import { useState, useMemo } from 'react'
import { Button, Input, Modal } from '../../components/ui'
import type { TransactionPaymentPayload } from '../../api/pos'

const PAYMENT_METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'card', label: 'Card' },
  { value: 'mobile_money', label: 'Mobile Money' },
  { value: 'gift_card', label: 'Gift Card' },
  { value: 'store_credit', label: 'Store Credit' },
] as const

type PaymentMethod = (typeof PAYMENT_METHODS)[number]['value']

interface PaymentEntry {
  id: string
  method: PaymentMethod
  amount: string
  reference: string
}

interface SplitPaymentDialogProps {
  open: boolean
  onClose: () => void
  total: number
  onConfirm: (payments: TransactionPaymentPayload[]) => void
}

export function SplitPaymentDialog({ open, onClose, total, onConfirm }: SplitPaymentDialogProps) {
  const [entries, setEntries] = useState<PaymentEntry[]>([
    { id: crypto.randomUUID(), method: 'cash', amount: '', reference: '' },
  ])

  const totalPaid = useMemo(
    () => entries.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0),
    [entries]
  )
  const remaining = Math.max(0, total - totalPaid)
  const isFullyCovered = totalPaid >= total

  const addEntry = () => {
    const usedMethods = new Set(entries.map((e) => e.method))
    const nextMethod = PAYMENT_METHODS.find((m) => !usedMethods.has(m.value))?.value ?? 'cash'
    setEntries((prev) => [
      ...prev,
      { id: crypto.randomUUID(), method: nextMethod, amount: '', reference: '' },
    ])
  }

  const removeEntry = (id: string) => {
    if (entries.length <= 1) return
    setEntries((prev) => prev.filter((e) => e.id !== id))
  }

  const updateEntry = (id: string, field: keyof PaymentEntry, value: string) => {
    setEntries((prev) =>
      prev.map((e) => (e.id === id ? { ...e, [field]: value } : e))
    )
  }

  const handleConfirm = () => {
    const payments: TransactionPaymentPayload[] = entries
      .filter((e) => parseFloat(e.amount) > 0)
      .map((e) => ({
        payment_method: e.method,
        amount: parseFloat(e.amount),
        ...(e.reference ? { reference: e.reference } : {}),
      }))
    onConfirm(payments)
    // Reset state
    setEntries([{ id: crypto.randomUUID(), method: 'cash', amount: '', reference: '' }])
  }

  const handleClose = () => {
    setEntries([{ id: crypto.randomUUID(), method: 'cash', amount: '', reference: '' }])
    onClose()
  }

  return (
    <Modal open={open} onClose={handleClose} title="Split Payment" size="lg">
      <div className="space-y-4">
        {/* Total due header */}
        <div className="flex items-center justify-between p-4 rounded-lg bg-gray-50 dark:bg-gray-700/50">
          <span className="text-sm font-medium text-gray-600 dark:text-gray-300">Total Due</span>
          <span className="text-xl font-bold text-gray-900 dark:text-gray-100">
            ${total.toFixed(2)}
          </span>
        </div>

        {/* Payment entries */}
        <div className="space-y-3">
          {entries.map((entry, idx) => (
            <div
              key={entry.id}
              className="flex items-start gap-3 p-3 rounded-lg border border-gray-100 dark:border-gray-700"
            >
              <div className="flex-1 grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400">
                    Method
                  </label>
                  <select
                    className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-[#51459d]/30"
                    value={entry.method}
                    onChange={(e) => updateEntry(entry.id, 'method', e.target.value)}
                  >
                    {PAYMENT_METHODS.map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </div>

                <Input
                  label="Amount"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={entry.amount}
                  onChange={(e) => updateEntry(entry.id, 'amount', e.target.value)}
                />

                <Input
                  label="Reference"
                  placeholder="Optional"
                  value={entry.reference}
                  onChange={(e) => updateEntry(entry.id, 'reference', e.target.value)}
                />
              </div>

              {entries.length > 1 && (
                <button
                  className="mt-6 text-gray-400 hover:text-red-500 transition-colors"
                  onClick={() => removeEntry(entry.id)}
                  title={`Remove payment ${idx + 1}`}
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Add method button */}
        {entries.length < PAYMENT_METHODS.length && (
          <Button variant="ghost" size="sm" onClick={addEntry}>
            + Add Payment Method
          </Button>
        )}

        {/* Running balance */}
        <div className="flex items-center justify-between p-4 rounded-lg border-2 border-dashed border-gray-200 dark:border-gray-700">
          <div className="space-y-1">
            <p className="text-xs text-gray-500 dark:text-gray-400">Paid So Far</p>
            <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              ${totalPaid.toFixed(2)}
            </p>
          </div>
          <div className="text-right space-y-1">
            <p className="text-xs text-gray-500 dark:text-gray-400">Remaining</p>
            <p className={`text-lg font-semibold ${remaining > 0 ? 'text-[#ffa21d]' : 'text-[#6fd943]'}`}>
              {remaining > 0 ? `$${remaining.toFixed(2)}` : 'Covered'}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-2">
          <Button variant="secondary" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            disabled={!isFullyCovered}
            onClick={handleConfirm}
          >
            Pay ${totalPaid.toFixed(2)}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
