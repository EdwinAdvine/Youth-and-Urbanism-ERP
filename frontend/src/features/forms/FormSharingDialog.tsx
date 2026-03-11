import { useState } from 'react'

interface FormSharingDialogProps {
  formId: string
  formTitle: string
  isPublished: boolean
  onClose: () => void
}

export default function FormSharingDialog({
  formId,
  formTitle,
  isPublished,
  onClose,
}: FormSharingDialogProps) {
  const [copiedField, setCopiedField] = useState<string | null>(null)
  const [embedSize, setEmbedSize] = useState<'small' | 'medium' | 'large'>('medium')

  const formUrl = `${window.location.origin}/forms/${formId}/submit`
  const embedSizes = {
    small: { width: 400, height: 500 },
    medium: { width: 640, height: 700 },
    large: { width: 800, height: 900 },
  }
  const { width, height } = embedSizes[embedSize]
  const embedCode = `<iframe src="${formUrl}" width="${width}" height="${height}" frameborder="0" style="border:none;border-radius:10px;" title="${formTitle}"></iframe>`

  // Generate a simple QR code as an SVG data URL using a free API
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(formUrl)}`

  const handleCopy = (text: string, field: string) => {
    navigator.clipboard.writeText(text)
    setCopiedField(field)
    setTimeout(() => setCopiedField(null), 2000)
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-50" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          className="bg-white rounded-[10px] shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between shrink-0">
            <div>
              <h2 className="text-sm font-semibold text-gray-900">Share Form</h2>
              <p className="text-xs text-gray-400 mt-0.5">"{formTitle}"</p>
            </div>
            <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-[6px] text-gray-400">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            {/* Publication status */}
            {!isPublished && (
              <div className="bg-amber-50 border border-amber-200 rounded-[8px] p-3 flex items-start gap-2">
                <svg className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <div>
                  <p className="text-xs font-medium text-amber-800">Form is not published</p>
                  <p className="text-[10px] text-amber-600 mt-0.5">
                    The form must be published before it can accept responses via shared links.
                  </p>
                </div>
              </div>
            )}

            {/* Direct Link */}
            <div>
              <h3 className="text-xs font-semibold text-gray-700 mb-2">Direct Link</h3>
              <div className="flex items-center gap-2">
                <input
                  readOnly
                  value={formUrl}
                  className="flex-1 px-3 py-2 text-xs bg-gray-50 border border-gray-200 rounded-[8px] text-gray-700"
                />
                <button
                  onClick={() => handleCopy(formUrl, 'link')}
                  className="shrink-0 px-3 py-2 text-xs bg-[#51459d] text-white rounded-[8px] hover:bg-[#3d3480] transition-colors"
                >
                  {copiedField === 'link' ? 'Copied!' : 'Copy'}
                </button>
              </div>
            </div>

            {/* Embed Code */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-semibold text-gray-700">Embed Code</h3>
                <div className="flex border border-gray-200 rounded-[6px] overflow-hidden">
                  {(['small', 'medium', 'large'] as const).map((size) => (
                    <button
                      key={size}
                      onClick={() => setEmbedSize(size)}
                      className={`px-2 py-1 text-[10px] font-medium transition-colors capitalize ${
                        embedSize === size ? 'bg-[#51459d] text-white' : 'text-gray-500 hover:bg-gray-50'
                      }`}
                    >
                      {size}
                    </button>
                  ))}
                </div>
              </div>
              <div className="relative">
                <textarea
                  readOnly
                  value={embedCode}
                  rows={3}
                  className="w-full px-3 py-2 text-[11px] bg-gray-50 border border-gray-200 rounded-[8px] text-gray-600 font-mono resize-none"
                />
                <button
                  onClick={() => handleCopy(embedCode, 'embed')}
                  className="absolute top-2 right-2 px-2 py-1 text-[10px] bg-white border border-gray-200 rounded-[6px] text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  {copiedField === 'embed' ? 'Copied!' : 'Copy'}
                </button>
              </div>
              <p className="text-[10px] text-gray-400 mt-1">
                {width} x {height}px iframe
              </p>
            </div>

            {/* QR Code */}
            <div>
              <h3 className="text-xs font-semibold text-gray-700 mb-2">QR Code</h3>
              <div className="flex items-start gap-4">
                <div className="bg-white border border-gray-200 rounded-[10px] p-3">
                  <img
                    src={qrUrl}
                    alt="QR Code for form"
                    className="w-32 h-32"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none'
                    }}
                  />
                </div>
                <div className="flex-1 space-y-2">
                  <p className="text-xs text-gray-600">
                    Scan this QR code to open the form on a mobile device.
                  </p>
                  <button
                    onClick={() => {
                      const a = document.createElement('a')
                      a.href = qrUrl
                      a.download = `${formTitle}-qr.png`
                      a.click()
                    }}
                    className="flex items-center gap-1.5 text-xs text-[#51459d] hover:underline"
                  >
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Download QR code
                  </button>
                </div>
              </div>
            </div>

            {/* Social sharing */}
            <div>
              <h3 className="text-xs font-semibold text-gray-700 mb-2">Share via</h3>
              <div className="flex gap-2">
                <a
                  href={`mailto:?subject=${encodeURIComponent(formTitle)}&body=${encodeURIComponent(`Please fill out this form: ${formUrl}`)}`}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs border border-gray-200 rounded-[8px] text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  Email
                </a>
                <button
                  onClick={() => handleCopy(formUrl, 'clipboard')}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs border border-gray-200 rounded-[8px] text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                  </svg>
                  {copiedField === 'clipboard' ? 'Copied!' : 'Copy link'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
