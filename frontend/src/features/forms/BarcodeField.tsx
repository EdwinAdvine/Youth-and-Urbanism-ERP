import { useState, useRef, useEffect, useCallback } from 'react'

interface BarcodeFieldProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  label?: string
  required?: boolean
}

declare class BarcodeDetector {
  constructor(options?: { formats?: string[] })
  detect(image: HTMLVideoElement | HTMLCanvasElement | ImageBitmap): Promise<Array<{ rawValue: string; format: string }>>
  static getSupportedFormats(): Promise<string[]>
}

const isBarcodeDetectorSupported = typeof (window as any).BarcodeDetector !== 'undefined'

export default function BarcodeField({
  value,
  onChange,
  placeholder = 'Scan or type a barcode value…',
  label,
  required,
}: BarcodeFieldProps) {
  const [cameraOpen, setCameraOpen] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [scanning, setScanning] = useState(false)

  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const rafRef = useRef<number | null>(null)
  const detectorRef = useRef<BarcodeDetector | null>(null)

  const stopCamera = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
    setScanning(false)
  }, [])

  const closeOverlay = useCallback(() => {
    stopCamera()
    setCameraOpen(false)
    setCameraError(null)
  }, [stopCamera])

  const startScan = useCallback(async () => {
    setCameraError(null)
    setCameraOpen(true)
  }, [])

  // Start camera & detector once overlay is open
  useEffect(() => {
    if (!cameraOpen) return

    let cancelled = false

    ;(async () => {
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
        }

        // Init BarcodeDetector
        let formats: string[] = []
        try {
          formats = await (window as any).BarcodeDetector.getSupportedFormats()
        } catch {
          formats = ['qr_code', 'ean_13', 'ean_8', 'code_128', 'code_39', 'upc_a', 'upc_e']
        }
        detectorRef.current = new (window as any).BarcodeDetector({ formats })

        setScanning(true)

        const tick = async () => {
          if (!videoRef.current || !detectorRef.current || cancelled) return
          try {
            const barcodes = await detectorRef.current.detect(videoRef.current)
            if (barcodes.length > 0 && barcodes[0].rawValue) {
              onChange(barcodes[0].rawValue)
              closeOverlay()
              return
            }
          } catch {
            // detection frame error — continue
          }
          if (!cancelled) {
            rafRef.current = requestAnimationFrame(tick)
          }
        }
        rafRef.current = requestAnimationFrame(tick)
      } catch (err: any) {
        if (!cancelled) {
          if (err?.name === 'NotAllowedError') {
            setCameraError('Camera permission denied. Please allow camera access and try again.')
          } else if (err?.name === 'NotFoundError') {
            setCameraError('No camera found on this device.')
          } else {
            setCameraError('Failed to access camera: ' + (err?.message ?? 'Unknown error'))
          }
        }
      }
    })()

    return () => {
      cancelled = true
      stopCamera()
    }
  }, [cameraOpen, onChange, closeOverlay, stopCamera])

  return (
    <div style={{ fontFamily: 'Open Sans, sans-serif' }} className="w-full">
      {label && (
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}

      <div className="flex gap-2">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          required={required}
          className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-[#51459d] dark:focus:ring-[#51459d]"
          style={{ borderRadius: 10 }}
        />
        <button
          type="button"
          onClick={isBarcodeDetectorSupported ? startScan : undefined}
          title={
            isBarcodeDetectorSupported
              ? 'Scan barcode using camera'
              : 'Barcode scanning not supported in this browser'
          }
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-white text-sm font-medium transition-opacity hover:opacity-90 disabled:opacity-50"
          style={{
            backgroundColor: isBarcodeDetectorSupported ? '#51459d' : '#9ca3af',
            borderRadius: 10,
          }}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"
            />
          </svg>
          Scan Barcode
        </button>
      </div>

      {!isBarcodeDetectorSupported && (
        <p className="mt-1.5 text-xs text-amber-600 dark:text-amber-400">
          Barcode scanning not supported in this browser. Please type the value manually.
        </p>
      )}

      {/* Camera overlay */}
      {cameraOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ backgroundColor: 'rgba(0,0,0,0.85)' }}
        >
          <div
            className="relative flex flex-col items-center gap-4 p-6 bg-gray-900 rounded-2xl shadow-2xl"
            style={{ fontFamily: 'Open Sans, sans-serif', borderRadius: 16 }}
          >
            <div className="flex items-center justify-between w-full">
              <h3 className="text-white font-semibold text-base">Scan Barcode</h3>
              <button
                type="button"
                onClick={closeOverlay}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {cameraError ? (
              <div className="w-96 text-center p-4">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-10 w-10 mx-auto mb-3 text-red-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M15 10l4.553-2.069A1 1 0 0121 8.868v6.264a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z"
                  />
                </svg>
                <p className="text-red-400 text-sm">{cameraError}</p>
              </div>
            ) : (
              /* Video + scanning frame */
              <div className="relative" style={{ width: 400, height: 300 }}>
                <video
                  ref={videoRef}
                  className="w-full h-full object-cover rounded-lg"
                  style={{ borderRadius: 10 }}
                  muted
                  playsInline
                />
                {/* Scanning dashed rectangle overlay */}
                <div
                  className="absolute inset-0 flex items-center justify-center pointer-events-none"
                >
                  <div
                    style={{
                      width: 240,
                      height: 150,
                      border: '2.5px dashed #51459d',
                      borderRadius: 8,
                      animation: 'pulse 1.5s ease-in-out infinite',
                      boxShadow: '0 0 0 4000px rgba(0,0,0,0.35)',
                    }}
                  />
                </div>
                {/* Scanning label */}
                {scanning && (
                  <div className="absolute bottom-3 left-0 right-0 flex justify-center">
                    <span
                      className="text-xs text-white bg-black/60 px-3 py-1 rounded-full flex items-center gap-2"
                      style={{ borderRadius: 20 }}
                    >
                      <span
                        className="inline-block h-2 w-2 rounded-full bg-green-400"
                        style={{ animation: 'pulse 1s ease-in-out infinite' }}
                      />
                      Scanning…
                    </span>
                  </div>
                )}
              </div>
            )}

            <p className="text-gray-400 text-xs text-center">
              Point the camera at a barcode or QR code. It will be detected automatically.
            </p>

            <button
              type="button"
              onClick={closeOverlay}
              className="px-6 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-white text-sm font-medium transition-colors"
              style={{ borderRadius: 10 }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  )
}
