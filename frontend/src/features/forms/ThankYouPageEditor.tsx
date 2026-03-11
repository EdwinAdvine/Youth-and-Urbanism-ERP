import { useState } from 'react'

export interface ThankYouConfig {
  heading: string
  message: string
  showSubmitAnother: boolean
  redirectUrl: string
  redirectDelay: number
}

const DEFAULT_CONFIG: ThankYouConfig = {
  heading: 'Response Submitted',
  message: 'Thank you for your submission.',
  showSubmitAnother: true,
  redirectUrl: '',
  redirectDelay: 3,
}

interface ThankYouPageEditorProps {
  config?: ThankYouConfig
  onChange: (config: ThankYouConfig) => void
}

export default function ThankYouPageEditor({ config, onChange }: ThankYouPageEditorProps) {
  const [cfg, setCfg] = useState<ThankYouConfig>(config ?? DEFAULT_CONFIG)
  const [showPreview, setShowPreview] = useState(false)

  const update = (partial: Partial<ThankYouConfig>) => {
    const updated = { ...cfg, ...partial }
    setCfg(updated)
    onChange(updated)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Thank You Page</h3>
          <p className="text-[11px] text-gray-400 mt-0.5">
            Customize what respondents see after submitting
          </p>
        </div>
        <button
          onClick={() => setShowPreview(!showPreview)}
          className={`text-xs px-3 py-1.5 rounded-[8px] border transition-colors ${ showPreview ? 'bg-[#51459d] text-white border-[#51459d]' : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800' }`}
        >
          {showPreview ? 'Edit' : 'Preview'}
        </button>
      </div>

      {showPreview ? (
        /* Preview mode */
        <div className="bg-gray-50 dark:bg-gray-950 rounded-[10px] border border-gray-200 dark:border-gray-700 p-8">
          <div className="flex flex-col items-center justify-center text-center max-w-md mx-auto">
            <div className="w-16 h-16 rounded-full bg-[#6fd943]/10 flex items-center justify-center mb-4">
              <svg className="h-8 w-8 text-[#6fd943]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">{cfg.heading || 'Response Submitted'}</h2>
            <p className="text-sm text-gray-500 mt-2 whitespace-pre-wrap">{cfg.message || 'Thank you for your submission.'}</p>
            {cfg.showSubmitAnother && (
              <button className="mt-4 text-sm text-[#51459d] hover:underline">
                Submit another response
              </button>
            )}
            {cfg.redirectUrl && (
              <p className="text-xs text-gray-400 mt-3">
                Redirecting in {cfg.redirectDelay}s...
              </p>
            )}
          </div>
        </div>
      ) : (
        /* Edit mode */
        <div className="space-y-3 bg-gray-50 dark:bg-gray-950 rounded-[10px] border border-gray-200 dark:border-gray-700 p-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Heading</label>
            <input
              value={cfg.heading}
              onChange={(e) => update({ heading: e.target.value })}
              placeholder="Response Submitted"
              className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-[8px] focus:outline-none focus:border-[#51459d]"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Message</label>
            <textarea
              value={cfg.message}
              onChange={(e) => update({ message: e.target.value })}
              placeholder="Thank you for your submission."
              rows={3}
              className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-[8px] focus:outline-none focus:border-[#51459d] resize-none"
            />
          </div>

          <label className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
            <input
              type="checkbox"
              checked={cfg.showSubmitAnother}
              onChange={(e) => update({ showSubmitAnother: e.target.checked })}
              className="rounded border-gray-300 text-[#51459d] focus:ring-[#51459d]/30"
            />
            Show "Submit another response" button
          </label>

          <div className="border-t border-gray-200 dark:border-gray-700 pt-3">
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              Redirect URL (optional)
            </label>
            <input
              value={cfg.redirectUrl}
              onChange={(e) => update({ redirectUrl: e.target.value })}
              placeholder="https://example.com/thank-you"
              className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-[8px] focus:outline-none focus:border-[#51459d]"
            />
            {cfg.redirectUrl && (
              <div className="mt-2">
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Redirect delay (seconds)
                </label>
                <input
                  type="number"
                  value={cfg.redirectDelay}
                  onChange={(e) => update({ redirectDelay: parseInt(e.target.value, 10) || 0 })}
                  min={0}
                  max={30}
                  className="w-24 px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-[8px] focus:outline-none focus:border-[#51459d]"
                />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
