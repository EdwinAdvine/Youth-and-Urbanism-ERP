import { useState, useEffect, useCallback, useRef } from 'react'
import { cn } from '../../components/ui'
import { toast } from '../../components/ui'
import { useInventoryItems, type InventoryItem } from '../../api/inventory'

// ─── BarcodeDetector Type Declaration ────────────────────────────────────────
// The BarcodeDetector API is not yet in TypeScript's lib.dom.d.ts.

interface DetectedBarcode {
  rawValue: string
  format: string
  boundingBox: DOMRectReadOnly
  cornerPoints: { x: number; y: number }[]
}

interface BarcodeDetectorOptions {
  formats?: string[]
}

declare class BarcodeDetector {
  constructor(options?: BarcodeDetectorOptions)
  detect(source: HTMLVideoElement | HTMLCanvasElement | ImageBitmap): Promise<DetectedBarcode[]>
  static getSupportedFormats(): Promise<string[]>
}

// Augment the global scope so we can check for BarcodeDetector on window
declare global {
  interface Window {
    BarcodeDetector?: typeof BarcodeDetector
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isTouchDevice(): boolean {
  return 'ontouchstart' in window || navigator.maxTouchPoints > 0
}

function isBarcodeDetectorSupported(): boolean {
  return typeof window.BarcodeDetector !== 'undefined'
}

// ─── Camera Barcode Scanner ──────────────────────────────────────────────────

interface CameraBarcodeScannerProps {
  onDetected: (barcode: string) => void
  onClose: () => void
}

function CameraBarcodeScanner({ onDetected, onClose }: CameraBarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const animFrameRef = useRef<number>(0)
  const [error, setError] = useState<string | null>(null)
  const [isStarting, setIsStarting] = useState(true)
  const detectedRef = useRef(false)

  const stopCamera = useCallback(() => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current)
      animFrameRef.current = 0
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!isBarcodeDetectorSupported()) {
      setError(
        'BarcodeDetector API is not supported in this browser. Please use Chrome, Edge, or Safari on a recent version.'
      )
      setIsStarting(false)
      return
    }

    let cancelled = false
    const detector = new window.BarcodeDetector!({
      formats: ['ean_13', 'ean_8', 'code_128', 'qr_code', 'upc_a', 'upc_e'],
    })

    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
        })
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play()
          setIsStarting(false)
          scanFrame()
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof DOMException && err.name === 'NotAllowedError'
              ? 'Camera permission denied. Please allow camera access and try again.'
              : 'Unable to access camera. Ensure your device has a camera and permissions are granted.'
          )
          setIsStarting(false)
        }
      }
    }

    function scanFrame() {
      if (cancelled || detectedRef.current) return
      if (!videoRef.current || videoRef.current.readyState < 2) {
        animFrameRef.current = requestAnimationFrame(scanFrame)
        return
      }

      detector
        .detect(videoRef.current)
        .then((barcodes) => {
          if (cancelled || detectedRef.current) return
          if (barcodes.length > 0) {
            detectedRef.current = true
            const value = barcodes[0].rawValue
            onDetected(value)
          } else {
            animFrameRef.current = requestAnimationFrame(scanFrame)
          }
        })
        .catch(() => {
          if (!cancelled) {
            animFrameRef.current = requestAnimationFrame(scanFrame)
          }
        })
    }

    startCamera()

    return () => {
      cancelled = true
      stopCamera()
    }
  }, [onDetected, stopCamera])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="relative w-full max-w-md rounded-[10px] overflow-hidden bg-white dark:bg-gray-800 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-primary text-white">
          <div className="flex items-center gap-2">
            {/* Camera icon */}
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
            <span className="font-medium text-sm">Scan Barcode</span>
          </div>
          <button
            onClick={() => {
              stopCamera()
              onClose()
            }}
            className="p-1 rounded hover:bg-white/20 transition-colors"
            title="Close camera"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Video area */}
        <div className="relative aspect-[4/3] bg-black">
          {error ? (
            <div className="absolute inset-0 flex items-center justify-center p-6">
              <div className="text-center">
                <svg className="mx-auto h-12 w-12 text-red-400 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <p className="text-white text-sm">{error}</p>
              </div>
            </div>
          ) : (
            <>
              <video
                ref={videoRef}
                className="absolute inset-0 w-full h-full object-cover"
                playsInline
                muted
                autoPlay
              />

              {/* Scanning overlay */}
              {isStarting ? (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    <div className="mx-auto h-8 w-8 border-2 border-white border-t-transparent rounded-full animate-spin mb-2" />
                    <p className="text-white text-xs">Starting camera...</p>
                  </div>
                </div>
              ) : (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  {/* Scan guide rectangle */}
                  <div className="relative w-3/4 h-1/3">
                    {/* Corner markers */}
                    <div className="absolute top-0 left-0 w-6 h-6 border-t-2 border-l-2 border-green-400 rounded-tl" />
                    <div className="absolute top-0 right-0 w-6 h-6 border-t-2 border-r-2 border-green-400 rounded-tr" />
                    <div className="absolute bottom-0 left-0 w-6 h-6 border-b-2 border-l-2 border-green-400 rounded-bl" />
                    <div className="absolute bottom-0 right-0 w-6 h-6 border-b-2 border-r-2 border-green-400 rounded-br" />

                    {/* Animated scan line */}
                    <div className="absolute left-2 right-2 h-0.5 bg-green-400/80 animate-[scan_2s_ease-in-out_infinite]" />
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer hint */}
        <div className="px-4 py-3 bg-gray-50 dark:bg-gray-950 text-center">
          <p className="text-xs text-gray-500">
            Point your camera at a barcode. Detection is automatic.
          </p>
        </div>
      </div>

      {/* Scan-line animation keyframes injected via style tag */}
      <style>{`
        @keyframes scan {
          0%, 100% { top: 10%; }
          50% { top: 85%; }
        }
      `}</style>
    </div>
  )
}

// ─── Barcode Scanner Component for Inventory ────────────────────────────────
// Listens for rapid keystrokes (typical of barcode scanners) that end with Enter.
// Matches scanned barcodes against inventory item SKUs.
// Also supports camera-based scanning on mobile and desktop (BarcodeDetector API).

interface BarcodeScannerProps {
  /** Called when a barcode is scanned and an inventory item is found */
  onItemScanned: (item: InventoryItem) => void
  /** Optional: called when scan happens but item not found */
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
  onItemScanned,
  onNotFound,
  showIndicator = true,
  keystrokeThreshold = 80,
  minLength = 3,
  enabled = true,
}: BarcodeScannerProps) {
  const { data: itemsData } = useInventoryItems({ limit: 1000 })
  const [isListening, setIsListening] = useState(true)
  const [lastScan, setLastScan] = useState<string | null>(null)
  const [scanStatus, setScanStatus] = useState<'idle' | 'scanning' | 'found' | 'not_found'>('idle')

  // Camera mode: auto-default to camera on touch devices
  const [mode, setMode] = useState<'keyboard' | 'camera'>(isTouchDevice() ? 'camera' : 'keyboard')
  const [showCamera, setShowCamera] = useState(false)

  const bufferRef = useRef('')
  const lastKeystrokeRef = useRef(0)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const lookupItem = useCallback(
    (barcode: string): InventoryItem | null => {
      if (!itemsData?.items) return null
      return itemsData.items.find(
        (item) => item.sku.toLowerCase() === barcode.toLowerCase()
      ) ?? null
    },
    [itemsData]
  )

  const handleBarcodeScan = useCallback(
    (barcode: string) => {
      setLastScan(barcode)
      const item = lookupItem(barcode)

      if (item) {
        setScanStatus('found')
        onItemScanned(item)
        toast('success', `Found: ${item.name} (${item.sku})`)
      } else {
        setScanStatus('not_found')
        onNotFound?.(barcode)
        toast('error', `Item not found for barcode: ${barcode}`)
      }

      // Reset status after 2 seconds
      setTimeout(() => setScanStatus('idle'), 2000)
    },
    [lookupItem, onItemScanned, onNotFound]
  )

  // ─── Keyboard scanner (existing logic, only active in keyboard mode) ──────

  useEffect(() => {
    if (!enabled || !isListening || mode !== 'keyboard') return

    function handleKeyDown(e: KeyboardEvent) {
      const now = Date.now()
      const target = e.target as HTMLElement
      const tagName = target.tagName.toLowerCase()

      const isInputFocused = tagName === 'input' || tagName === 'textarea' || tagName === 'select'
      const timeSinceLast = now - lastKeystrokeRef.current
      const isRapidKeystroke = timeSinceLast < keystrokeThreshold

      // If we're not in rapid mode and user is in an input, ignore
      if (isInputFocused && !isRapidKeystroke && bufferRef.current.length === 0) {
        return
      }

      if (e.key === 'Enter') {
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
          bufferRef.current = ''
        }

        bufferRef.current += e.key
        lastKeystrokeRef.current = now

        if (bufferRef.current.length >= 2) {
          setScanStatus('scanning')
        }

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
  }, [enabled, isListening, mode, keystrokeThreshold, minLength, handleBarcodeScan])

  // ─── Camera detection callback ────────────────────────────────────────────

  const handleCameraDetected = useCallback(
    (barcode: string) => {
      setShowCamera(false)
      handleBarcodeScan(barcode)
    },
    [handleBarcodeScan]
  )

  if (!showIndicator) return null

  return (
    <>
      <div className="flex items-center gap-2">
        {/* Keyboard scanner status pill */}
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

        {/* Mode toggle: keyboard <-> camera */}
        <button
          onClick={() => setMode(mode === 'keyboard' ? 'camera' : 'keyboard')}
          className={cn(
            'flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium transition-all',
            mode === 'camera' ? 'bg-info/10 text-info' : 'bg-gray-100 text-gray-500'
          )}
          title={mode === 'keyboard' ? 'Switch to camera scan mode' : 'Switch to keyboard scan mode'}
        >
          {mode === 'camera' ? (
            <>
              {/* Camera icon */}
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
                />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span>Camera</span>
            </>
          ) : (
            <>
              {/* Keyboard icon */}
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 10h16M4 14h16M4 18h16"
                />
              </svg>
              <span>Keyboard</span>
            </>
          )}
        </button>

        {/* Scan with Camera button (shown in camera mode) */}
        {mode === 'camera' && (
          <button
            onClick={() => setShowCamera(true)}
            className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-primary text-white hover:bg-primary/90 transition-colors"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            Scan with Camera
          </button>
        )}

        {lastScan && (
          <span className="text-[10px] text-gray-400 font-mono">
            Last: {lastScan}
          </span>
        )}
      </div>

      {/* Camera overlay (portal-style, rendered at component level) */}
      {showCamera && (
        <CameraBarcodeScanner
          onDetected={handleCameraDetected}
          onClose={() => setShowCamera(false)}
        />
      )}
    </>
  )
}

// ─── Manual Barcode Input (fallback for keyboards / testing) ─────────────────

interface ManualBarcodeInputProps {
  onSubmit: (barcode: string) => void
  placeholder?: string
}

export function ManualBarcodeInput({ onSubmit, placeholder = 'Scan or enter barcode/SKU...' }: ManualBarcodeInputProps) {
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
        className="flex-1 rounded-[10px] border border-gray-200 dark:border-gray-700 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
      />
      <button
        type="submit"
        className="px-3 py-1.5 rounded-[10px] bg-primary text-white text-sm font-medium hover:bg-primary/90 transition-colors"
      >
        Lookup
      </button>
    </form>
  )
}
