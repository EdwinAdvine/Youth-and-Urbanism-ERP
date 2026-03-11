import { useState, useCallback } from 'react'
import { Button, Spinner, toast } from '../../components/ui'
import apiClient from '../../api/client'

interface RFIDProduct {
  id: string
  sku: string
  name: string
  selling_price: string
  stock_on_hand: number
  rfid_tag: string
}

interface Props {
  onProductScanned: (product: RFIDProduct) => void
}

/**
 * RFID Scanner component for POS register.
 * Uses Web Serial API to read from USB/serial RFID readers,
 * with a manual input fallback.
 */
export default function RFIDScanner({ onProductScanned }: Props) {
  const [isConnected, setIsConnected] = useState(false)
  const [isScanning, setIsScanning] = useState(false)
  const [manualTag, setManualTag] = useState('')
  const [showManual, setShowManual] = useState(false)

  const lookupRFID = useCallback(async (tag: string) => {
    try {
      const { data } = await apiClient.get<RFIDProduct>(`/pos/products/rfid/${tag.trim()}`)
      onProductScanned(data)
      toast('success', `Scanned: ${data.name}`)
    } catch {
      toast('error', `No product found for RFID tag: ${tag}`)
    }
  }, [onProductScanned])

  const connectSerial = async () => {
    if (!('serial' in navigator)) {
      toast('error', 'Web Serial API not supported — use manual input or Chrome/Edge')
      setShowManual(true)
      return
    }

    try {
      // @ts-expect-error — Web Serial API types not always available
      const port = await navigator.serial.requestPort()
      await port.open({ baudRate: 9600 })
      setIsConnected(true)
      setIsScanning(true)

      const reader = port.readable.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      const readLoop = async () => {
        try {
          while (true) {
            const { value, done } = await reader.read()
            if (done) break
            buffer += decoder.decode(value, { stream: true })

            // RFID readers typically send tag followed by newline
            const lines = buffer.split('\n')
            buffer = lines.pop() || ''

            for (const line of lines) {
              const tag = line.trim()
              if (tag) {
                await lookupRFID(tag)
              }
            }
          }
        } catch (err) {
          console.error('[RFID] Read error:', err)
        } finally {
          reader.releaseLock()
          setIsConnected(false)
          setIsScanning(false)
        }
      }

      readLoop()
    } catch (err) {
      if ((err as Error).name !== 'NotFoundError') {
        toast('error', 'Failed to connect RFID reader')
      }
    }
  }

  const handleManualSubmit = () => {
    if (manualTag.trim()) {
      lookupRFID(manualTag)
      setManualTag('')
    }
  }

  return (
    <div className="inline-flex items-center gap-2">
      <button
        onClick={isConnected ? undefined : connectSerial}
        className={`px-3 py-2 min-h-[44px] rounded-[10px] border text-xs font-medium transition-colors flex items-center gap-1.5 ${
          isConnected
            ? 'border-green-500 bg-green-50 dark:bg-green-900/20 text-green-600'
            : 'border-gray-200 dark:border-gray-700 text-gray-500 hover:border-primary hover:text-primary'
        }`}
        title={isConnected ? 'RFID reader connected' : 'Connect RFID reader'}
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
        {isScanning && <Spinner size="sm" />}
        {isConnected ? 'RFID Active' : 'RFID'}
      </button>

      {/* Manual RFID input fallback */}
      <button
        onClick={() => setShowManual(!showManual)}
        className="px-2 py-2 min-h-[44px] rounded-[10px] border border-gray-200 dark:border-gray-700 text-gray-400 hover:text-primary text-xs"
        title="Manual RFID tag input"
      >
        #
      </button>

      {showManual && (
        <div className="flex items-center gap-1">
          <input
            value={manualTag}
            onChange={(e) => setManualTag(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleManualSubmit()}
            placeholder="RFID tag..."
            className="w-32 px-2 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-gray-600 bg-transparent focus:outline-none focus:border-primary"
          />
          <Button size="sm" onClick={handleManualSubmit} disabled={!manualTag.trim()}>
            Go
          </Button>
        </div>
      )}
    </div>
  )
}
