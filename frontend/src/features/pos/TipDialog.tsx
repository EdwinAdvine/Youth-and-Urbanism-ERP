import { useState } from 'react'
import { Button, Input, Modal } from '../../components/ui'

const PRESETS = [
  { label: '10%', pct: 0.1 },
  { label: '15%', pct: 0.15 },
  { label: '20%', pct: 0.2 },
  { label: 'No Tip', pct: 0 },
] as const

interface TipDialogProps {
  open: boolean
  onClose: () => void
  subtotal: number
  onConfirm: (tipAmount: number) => void
}

export function TipDialog({ open, onClose, subtotal, onConfirm }: TipDialogProps) {
  const [selectedPct, setSelectedPct] = useState<number | null>(null)
  const [customAmount, setCustomAmount] = useState('')
  const [useCustom, setUseCustom] = useState(false)

  const tipAmount = useCustom
    ? parseFloat(customAmount) || 0
    : selectedPct !== null
      ? subtotal * selectedPct
      : 0

  const handlePreset = (pct: number) => {
    setSelectedPct(pct)
    setUseCustom(false)
    setCustomAmount('')
  }

  const handleCustom = (val: string) => {
    setCustomAmount(val)
    setUseCustom(true)
    setSelectedPct(null)
  }

  const handleConfirm = () => {
    onConfirm(Math.round(tipAmount * 100) / 100)
    reset()
  }

  const reset = () => {
    setSelectedPct(null)
    setCustomAmount('')
    setUseCustom(false)
  }

  const handleClose = () => {
    reset()
    onClose()
  }

  return (
    <Modal open={open} onClose={handleClose} title="Add a Tip" size="sm">
      <div className="space-y-5">
        {/* Subtotal context */}
        <div className="text-center">
          <p className="text-xs text-gray-500 dark:text-gray-400">Subtotal</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            ${subtotal.toFixed(2)}
          </p>
        </div>

        {/* Preset buttons */}
        <div className="grid grid-cols-4 gap-2">
          {PRESETS.map((p) => {
            const isActive = !useCustom && selectedPct === p.pct
            return (
              <button
                key={p.label}
                className={`py-3 rounded-lg text-sm font-medium transition-colors border ${
                  isActive
                    ? 'bg-[#51459d] text-white border-[#51459d]'
                    : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
                onClick={() => handlePreset(p.pct)}
              >
                <span className="block text-base font-semibold">{p.label}</span>
                {p.pct > 0 && (
                  <span className="block text-xs opacity-70">
                    ${(subtotal * p.pct).toFixed(2)}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* Custom input */}
        <Input
          label="Custom Tip Amount"
          type="number"
          min="0"
          step="0.01"
          placeholder="Enter custom amount"
          value={customAmount}
          onChange={(e) => handleCustom(e.target.value)}
        />

        {/* Calculated tip display */}
        <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50">
          <span className="text-sm text-gray-600 dark:text-gray-300">Tip Amount</span>
          <span className="text-lg font-bold text-[#51459d]">${tipAmount.toFixed(2)}</span>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={handleClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleConfirm}>
            Apply Tip
          </Button>
        </div>
      </div>
    </Modal>
  )
}
