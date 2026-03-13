import { useState } from 'react'
import apiClient from '@/api/client'

interface Suggestion {
  issue: string
  severity: 'high' | 'medium' | 'low'
  recommendation: string
}

interface AuditResult {
  overall_score: number
  clarity_score: number
  completion_likelihood: number
  accessibility_score: number
  bias_score: number
  estimated_completion_minutes: number
  suggestions: Suggestion[]
}

interface FormAccessibilityCheckerProps {
  formId: string
}

function ScoreRing({ score, label }: { score: number; label: string }) {
  const radius = 36
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (score / 100) * circumference

  const color =
    score >= 80 ? '#6fd943' : score >= 60 ? '#ffa21d' : '#ff3a6e'

  return (
    <div className="flex flex-col items-center gap-2">
      <svg width="96" height="96" viewBox="0 0 96 96">
        <circle
          cx="48"
          cy="48"
          r={radius}
          fill="none"
          stroke="#e5e7eb"
          strokeWidth="8"
        />
        <circle
          cx="48"
          cy="48"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform="rotate(-90 48 48)"
          style={{ transition: 'stroke-dashoffset 0.6s ease' }}
        />
        <text
          x="48"
          y="48"
          textAnchor="middle"
          dominantBaseline="central"
          fontSize="16"
          fontWeight="700"
          fill={color}
        >
          {score}%
        </text>
      </svg>
      <span className="text-xs text-gray-500 dark:text-gray-400 text-center font-medium">
        {label}
      </span>
    </div>
  )
}

const SEVERITY_CONFIG = {
  high: { label: 'High', bg: '#ff3a6e', text: '#fff' },
  medium: { label: 'Medium', bg: '#ffa21d', text: '#fff' },
  low: { label: 'Low', bg: '#6fd943', text: '#fff' },
}

const SEVERITY_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2 }

export default function FormAccessibilityChecker({ formId }: FormAccessibilityCheckerProps) {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<AuditResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const runAudit = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await apiClient.post(`/forms/${formId}/ai-suggest-improvements`)
      setResult(res.data)
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Failed to run audit. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const sortedSuggestions = result
    ? [...result.suggestions].sort(
        (a, b) => (SEVERITY_ORDER[a.severity] ?? 3) - (SEVERITY_ORDER[b.severity] ?? 3)
      )
    : []

  return (
    <div
      className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6"
      style={{ fontFamily: 'Open Sans, sans-serif', borderRadius: 10 }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">
            Accessibility &amp; Quality Audit
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            AI-powered analysis of your form's accessibility, clarity, and completion rate.
          </p>
        </div>
        <button
          onClick={runAudit}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-white text-sm font-medium transition-opacity disabled:opacity-60"
          style={{ backgroundColor: '#51459d', borderRadius: 10 }}
        >
          {loading ? (
            <>
              <svg
                className="animate-spin h-4 w-4 text-white"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8v8H4z"
                />
              </svg>
              Analysing…
            </>
          ) : (
            <>
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
                  d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                />
              </svg>
              Run Accessibility Audit
            </>
          )}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div
          className="mb-4 p-3 rounded-lg text-sm text-white"
          style={{ backgroundColor: '#ff3a6e', borderRadius: 10 }}
        >
          {error}
        </div>
      )}

      {/* Placeholder */}
      {!result && !loading && !error && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-14 w-14 mb-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="#51459d"
            strokeWidth={1.2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          <p className="text-gray-500 dark:text-gray-400 font-medium">No audit run yet</p>
          <p className="text-gray-400 dark:text-gray-500 text-sm mt-1">
            Click "Run Accessibility Audit" to analyse your form.
          </p>
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <svg
            className="animate-spin h-10 w-10"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="#51459d" strokeWidth="4" />
            <path className="opacity-75" fill="#51459d" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
          <p className="text-gray-500 dark:text-gray-400 text-sm">Running AI analysis…</p>
        </div>
      )}

      {/* Results */}
      {result && !loading && (
        <div className="space-y-6">
          {/* Score cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 p-4 bg-gray-50 dark:bg-gray-900/50 rounded-xl">
            <ScoreRing score={result.overall_score} label="Overall Score" />
            <ScoreRing score={result.clarity_score} label="Clarity" />
            <ScoreRing score={result.completion_likelihood} label="Completion Likelihood" />
            <ScoreRing score={result.accessibility_score} label="Accessibility" />
            <ScoreRing score={result.bias_score} label="Bias-Free Language" />
          </div>

          {/* Estimated completion time */}
          <div
            className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-700"
            style={{ borderRadius: 10 }}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5 flex-shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              stroke="#3ec9d6"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <span className="text-sm text-gray-700 dark:text-gray-300">
              Estimated completion time:{' '}
              <strong className="text-gray-900 dark:text-gray-100">
                {result.estimated_completion_minutes} minute
                {result.estimated_completion_minutes !== 1 ? 's' : ''}
              </strong>
            </span>
          </div>

          {/* Suggestions */}
          {sortedSuggestions.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                Suggestions ({sortedSuggestions.length})
              </h3>
              <div className="space-y-3">
                {sortedSuggestions.map((s, i) => {
                  const cfg = SEVERITY_CONFIG[s.severity]
                  return (
                    <div
                      key={i}
                      className="flex gap-3 p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40"
                      style={{ borderRadius: 10 }}
                    >
                      <span
                        className="flex-shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full h-fit mt-0.5"
                        style={{
                          backgroundColor: cfg.bg,
                          color: cfg.text,
                          borderRadius: 20,
                        }}
                      >
                        {cfg.label}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 dark:text-gray-100">
                          {s.issue}
                        </p>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                          {s.recommendation}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {sortedSuggestions.length === 0 && (
            <div
              className="flex items-center gap-2 p-3 rounded-lg text-sm font-medium"
              style={{ backgroundColor: '#6fd943' + '22', color: '#4aaa2e', borderRadius: 10 }}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              No suggestions — your form looks great!
            </div>
          )}
        </div>
      )}
    </div>
  )
}
