import { useState, useRef } from 'react'
import { Button, Modal, Input } from '../../components/ui'
import { toast } from '../../components/ui'
import { useMutation } from '@tanstack/react-query'
import apiClient from '../../api/client'


interface ScanResult {
  type: 'work_order' | 'lot' | 'item'
  id: string
  label: string
  detail: Record<string, string | number>
}

interface Props {
  open: boolean
  onClose: () => void
  onResult?: (result: ScanResult) => void
}

export default function BarcodeScannerModal({ open, onClose, onResult }: Props) {
  const [manualCode, setManualCode] = useState('')
  const [result, setResult] = useState<ScanResult | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const scan = useMutation({
    mutationFn: (barcode: string) =>
      apiClient.post<ScanResult>('/manufacturing/barcode/scan', { barcode }).then(r => r.data),
    onSuccess: res => {
      setResult(res)
      if (onResult) onResult(res)
    },
    onError: () => toast('error', 'Barcode not recognised'),
  })

  const handleManual = () => {
    if (manualCode.trim()) scan.mutate(manualCode.trim())
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleManual()
  }

  const handleClose = () => {
    setManualCode('')
    setResult(null)
    onClose()
  }

  const typeColor: Record<string, string> = {
    work_order: 'bg-blue-50 border-blue-200 text-blue-800',
    lot: 'bg-green-50 border-green-200 text-green-800',
    item: 'bg-purple-50 border-purple-200 text-purple-800',
  }

  const typeLabel: Record<string, string> = {
    work_order: 'Work Order',
    lot: 'Lot / Serial',
    item: 'Inventory Item',
  }

  return (
    <Modal open={open} onClose={handleClose} title="Barcode Scanner">
      <div className="space-y-5">
        {/* Scan input */}
        <div className="space-y-2">
          <p className="text-sm text-gray-500">
            Scan a barcode with your scanner or enter the code manually.
          </p>
          <div className="flex gap-2">
            <Input
              ref={inputRef}
              placeholder="Scan or type barcode..."
              value={manualCode}
              onChange={e => setManualCode(e.target.value)}
              onKeyDown={handleKeyDown}
              autoFocus
              className="flex-1 font-mono"
            />
            <Button onClick={handleManual} loading={scan.isPending} disabled={!manualCode.trim()}>
              Look Up
            </Button>
          </div>
        </div>

        {/* Scan visual */}
        <div className="flex items-center justify-center border-2 border-dashed rounded-xl h-28 text-gray-300 select-none">
          <div className="text-center">
            <div className="text-4xl mb-1">▮▯▮▮▯▮▯▮▮▯</div>
            <div className="text-xs text-gray-400">Barcode scan area</div>
          </div>
        </div>

        {/* Result */}
        {result && (
          <div className={`rounded-xl border p-4 ${typeColor[result.type] || 'bg-gray-50 border-gray-200 text-gray-800'}`}>
            <div className="text-xs font-semibold uppercase tracking-wide mb-1">
              {typeLabel[result.type] || result.type}
            </div>
            <div className="font-bold text-lg">{result.label}</div>
            <div className="mt-2 space-y-0.5">
              {Object.entries(result.detail).map(([k, v]) => (
                <div key={k} className="flex justify-between text-sm">
                  <span className="opacity-70 capitalize">{k.replace(/_/g, ' ')}</span>
                  <span className="font-medium">{v}</span>
                </div>
              ))}
            </div>
            {onResult && (
              <Button
                size="sm"
                className="mt-3 w-full"
                onClick={() => { onResult(result); handleClose() }}
              >
                Use This {typeLabel[result.type]}
              </Button>
            )}
          </div>
        )}

        {/* Recent scans hint */}
        <div className="text-xs text-gray-400 text-center">
          Supports Work Order barcodes, Lot/Serial numbers, and Item barcodes
        </div>

        <div className="flex justify-end">
          <Button variant="ghost" onClick={handleClose}>Close</Button>
        </div>
      </div>
    </Modal>
  )
}
