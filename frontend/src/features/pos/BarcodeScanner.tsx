import { useState, useEffect, useCallback, useRef } from 'react'
import { cn } from '../../components/ui'
import { toast } from '../../components/ui'
import { usePOSProducts, type POSProduct } from '../../api/pos'

// ─── Barcode Scanner Component ───────────────────────────────────────────────
// Listens for rapid keystrokes (typical of barcode scanners) that end with Enter.
// A real barcode scanner types characters very fast (< 50ms between keystrokes)
// and presses Enter at the end.

interface BarcodeScannerProps {
  /** Called when a barcode is scanned and a product is found */
  onProductScanned: (product: POSProduct) => void
  /** Optional: called when scan happens but product not found */
  onNotFound?: (barcode: string) => void
  /** Whether to show the status indicator */
  showIndicator?: boolean
  /** Max time between keystrokes to consider them barcode input (ms) */
  keystrokeThreshold?: number
  /** Min barcode length to consider valid */
  minLength?: number
  /** Whether scanner is active */
  enabled?: boolean
}

export default function BarcodeScanner({
  onProductScanned,
  onNotFound,
  showIndicator = true,
  keystrokeThreshold = 80,
  minLength = 3,
  enabled = true,
}: BarcodeScannerProps) {
  const { data: productsData } = usePOSProducts({ limit: 1000 })
  const [isListening, setIsListening] = useState(true)
  const [lastScan, setLastScan] = useState<string | null>(null)
  const [scanStatus, setScanStatus] = useState<'idle' | 'scanning' | 'found' | 'not_found'>('idle')

  const bufferRef = useRef('')
  const lastKeystrokeRef = useRef(0)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const lookupProduct = useCallback(
    (barcode: string): POSProduct | null => {
      if (!productsData?.products) return null
      // Match by SKU (primary barcode field)
      return productsData.products.find(
        (p) => p.sku.toLowerCase() === barcode.toLowerCase()
      ) ?? null
    },
    [productsData]
  )

  const handleBarcodeScan = useCallback(
    (barcode: string) => {
      setLastScan(barcode)
      const product = lookupProduct(barcode)

      if (product) {
        setScanStatus('found')
        onProductScanned(product)
        toast('success', `Scanned: ${product.name}`)
      } else {
        setScanStatus('not_found')
        onNotFound?.(barcode)
        toast('error', `Product not found: ${barcode}`)
      }

      // Reset status after 2 seconds
      setTimeout(() => setScanStatus('idle'), 2000)
    },
    [lookupProduct, onProductScanned, onNotFound]
  )

  useEffect(() => {
    if (!enabled || !isListening) return

    function handleKeyDown(e: KeyboardEvent) {
      const now = Date.now()
      const target = e.target as HTMLElement
      const tagName = target.tagName.toLowerCase()

      // If user is typing in an input/textarea, only intercept if keystrokes are fast
      // (indicating barcode scanner, not manual typing)
      const isInputFocused = tagName === 'input' || tagName === 'textarea' || tagName === 'select'
      const timeSinceLast = now - lastKeystrokeRef.current
      const isRapidKeystroke = timeSinceLast < keystrokeThreshold

      // If we're not in rapid mode and user is in an input, ignore
      if (isInputFocused && !isRapidKeystroke && bufferRef.current.length === 0) {
        return
      }

      if (e.key === 'Enter') {
        // Check if buffer has enough characters and was entered quickly
        const barcode = bufferRef.current.trim()
        if (barcode.length >= minLength) {
          e.preventDefault()
          e.stopPropagation()
          handleBarcodeScan(barcode)
        }
        bufferRef.current = ''
        lastKeystrokeRef.current = 0
        return
      }

      // Only accept printable characters
      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        if (!isRapidKeystroke && bufferRef.current.length > 0) {
          // Too slow - clear buffer (user is typing manually)
          bufferRef.current = ''
        }

        bufferRef.current += e.key
        lastKeystrokeRef.current = now

        // Set scanning indicator
        if (bufferRef.current.length >= 2) {
          setScanStatus('scanning')
        }

        // Auto-clear buffer after timeout
        if (timeoutRef.current) clearTimeout(timeoutRef.current)
        timeoutRef.current = setTimeout(() => {
          bufferRef.current = ''
          lastKeystrokeRef.current = 0
          setScanStatus('idle')
        }, keystrokeThreshold * 3)
      }
    }

    document.addEventListener('keydown', handleKeyDown, true)
    return () => {
      document.removeEventListener('keydown', handleKeyDown, true)
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [enabled, isListening, keystrokeThreshold, minLength, handleBarcodeScan])

  if (!showIndicator) return null

  return (
    <div className="flex items-center gap-2">
      {/* Scanner Status Indicator */}
      <button
        onClick={() => setIsListening(!isListening)}
        className={cn(
          'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all',
          isListening
            ? scanStatus === 'scanning'
              ? 'bg-yellow-100 text-yellow-700'
              : scanStatus === 'found'
              ? 'bg-green-100 text-green-700'
              : scanStatus === 'not_found'
              ? 'bg-red-100 text-red-700'
              : 'bg-primary/10 text-primary'
            : 'bg-gray-100 text-gray-400'
        )}
        title={isListening ? 'Barcode scanner active (click to pause)' : 'Barcode scanner paused (click to enable)'}
      >
        {/* Barcode icon */}
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7h1v10H4V7zm3 0h2v10H7V7zm4 0h1v10h-1V7zm3 0h2v10h-2V7zm4 0h2v10h-2V7z" />
        </svg>

        {/* Pulsing dot for active scanning */}
        {isListening && scanStatus === 'idle' && (
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
          </span>
        )}

        {scanStatus === 'scanning' && <span>Scanning...</span>}
        {scanStatus === 'found' && <span>Found</span>}
        {scanStatus === 'not_found' && <span>Not found</span>}
        {scanStatus === 'idle' && isListening && <span>Ready</span>}
        {!isListening && <span>Paused</span>}
      </button>

      {/* Last scanned barcode */}
      {lastScan && (
        <span className="text-[10px] text-gray-400 font-mono">
          Last: {lastScan}
        </span>
      )}
    </div>
  )
}

// ─── Manual Barcode Input (fallback for keyboards / testing) ─────────────────

interface ManualBarcodeInputProps {
  onSubmit: (barcode: string) => void
  placeholder?: string
}

export function ManualBarcodeInput({ onSubmit, placeholder = 'Enter barcode...' }: ManualBarcodeInputProps) {
  const [value, setValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const barcode = value.trim()
    if (barcode) {
      onSubmit(barcode)
      setValue('')
      inputRef.current?.focus()
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        className="flex-1 rounded-[10px] border border-gray-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
      />
      <button
        type="submit"
        className="px-3 py-1.5 rounded-[10px] bg-primary text-white text-sm font-medium hover:bg-primary/90 transition-colors"
      >
        Scan
      </button>
    </form>
  )
}
