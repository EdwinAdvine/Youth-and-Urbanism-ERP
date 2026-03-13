/**
 * SmartNarrative — AI-generated chart insight component.
 * Shows a small "✨ Explain" button. On click, calls the analytics copilot
 * to generate a 2-3 sentence business narrative about the chart data.
 */
import { useState } from 'react'
import apiClient from '../../../api/client'

interface SmartNarrativeProps {
  chartTitle: string
  data: Record<string, unknown>[]
  className?: string
}

export default function SmartNarrative({ chartTitle, data, className = '' }: SmartNarrativeProps) {
  const [loading, setLoading] = useState(false)
  const [narrative, setNarrative] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleExplain() {
    setLoading(true)
    setError(null)
    setNarrative(null)
    try {
      const response = await apiClient.post('/api/v1/analytics/copilot/query', {
        question: `Analyze this chart: "${chartTitle}". Data: ${JSON.stringify(data.slice(0, 8))}. Give a 2-3 sentence business insight.`,
      })
      const text =
        response.data.narrative ||
        response.data.result ||
        'No insight available'
      setNarrative(text)
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to generate insight'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  function handleDismiss() {
    setNarrative(null)
    setError(null)
  }

  return (
    <div className={className}>
      {!narrative && (
        <button
          type="button"
          onClick={handleExplain}
          disabled={loading}
          className="flex items-center gap-1 text-xs text-[#51459d] hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <svg className="animate-spin w-3 h-3" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          ) : (
            <span>✨</span>
          )}
          {loading ? 'Analyzing...' : 'Explain'}
        </button>
      )}

      {narrative && (
        <div className="bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-800 rounded-lg p-3 mt-2 text-xs text-gray-700 dark:text-gray-300 relative">
          <button
            type="button"
            onClick={handleDismiss}
            className="absolute top-2 right-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 leading-none"
            aria-label="Dismiss"
          >
            ✕
          </button>
          <p className="pr-4 leading-relaxed">{narrative}</p>
        </div>
      )}

      {error && (
        <p className="text-xs text-red-500 mt-1">{error}</p>
      )}
    </div>
  )
}
