import { useState, useEffect } from 'react'
import apiClient from '@/api/client'

interface QuizResult {
  response_id: string
  score: number
  max_score: number
  percentage: number
  passed: boolean
  graded_at: string
}

interface QuizResultsData {
  results: QuizResult[]
  avg_score: number
  pass_rate: number
  total_graded: number
}

interface QuizResultsPageProps {
  formId: string
}

export default function QuizResultsPage({ formId }: QuizResultsPageProps) {
  const [data, setData] = useState<QuizResultsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [gradingId, setGradingId] = useState<string | null>(null)

  async function fetchResults() {
    setLoading(true)
    setError(null)
    try {
      const res = await apiClient.get<QuizResultsData>(`/forms/${formId}/quiz-results`)
      setData(res.data)
    } catch {
      setError('Failed to load quiz results.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (formId) fetchResults()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formId])

  async function handleGrade(responseId: string) {
    setGradingId(responseId)
    try {
      await apiClient.post(`/forms/${formId}/quiz-results/grade`, { response_id: responseId })
      await fetchResults()
    } catch {
      // ignore
    } finally {
      setGradingId(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16" style={{ fontFamily: 'Open Sans, sans-serif' }}>
        <div className="flex flex-col items-center gap-3">
          <div
            className="h-8 w-8 rounded-full border-4 border-t-transparent animate-spin"
            style={{ borderColor: '#51459d', borderTopColor: 'transparent' }}
          />
          <p className="text-sm text-gray-500">Loading quiz results…</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-16">
        <p className="text-sm text-red-500">{error}</p>
      </div>
    )
  }

  if (!data || data.total_graded === 0) {
    return (
      <div
        className="flex flex-col items-center justify-center py-16 text-center"
        style={{ fontFamily: 'Open Sans, sans-serif' }}
      >
        <div className="w-16 h-16 mb-4 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
          <span className="text-2xl">📊</span>
        </div>
        <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">No graded responses yet</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 max-w-xs">
          Quiz results will appear here once responses have been graded.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6" style={{ fontFamily: 'Open Sans, sans-serif' }}>
      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          label="Average Score"
          value={`${data.avg_score.toFixed(1)}%`}
          color="#51459d"
        />
        <StatCard
          label="Pass Rate"
          value={`${data.pass_rate.toFixed(1)}%`}
          color="#6fd943"
        />
        <StatCard
          label="Total Graded"
          value={String(data.total_graded)}
          color="#3ec9d6"
        />
      </div>

      {/* Results Table */}
      <div className="bg-white dark:bg-gray-800 rounded-[10px] border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Individual Results</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-700/50 text-left">
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                  Response ID
                </th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                  Score
                </th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                  Percentage
                </th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                  Result
                </th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                  Graded At
                </th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {data.results.map((result) => (
                <tr
                  key={result.response_id}
                  className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors"
                >
                  <td className="px-4 py-3 font-mono text-xs text-gray-600 dark:text-gray-300">
                    {result.response_id.slice(0, 8)}…
                  </td>
                  <td className="px-4 py-3 text-gray-900 dark:text-gray-100">
                    {result.score}/{result.max_score}
                  </td>
                  <td className="px-4 py-3 text-gray-900 dark:text-gray-100">
                    {result.percentage.toFixed(1)}%
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className="px-2.5 py-0.5 rounded-full text-xs font-semibold text-white"
                      style={{ backgroundColor: result.passed ? '#6fd943' : '#ff3a6e' }}
                    >
                      {result.passed ? 'Passed' : 'Failed'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400 text-xs">
                    {new Date(result.graded_at).toLocaleDateString(undefined, {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      disabled={gradingId === result.response_id}
                      onClick={() => handleGrade(result.response_id)}
                      className="px-3 py-1.5 text-xs font-semibold text-white rounded-[10px] transition-opacity hover:opacity-90 disabled:opacity-50"
                      style={{ backgroundColor: '#51459d' }}
                    >
                      {gradingId === result.response_id ? 'Grading…' : 'Re-Grade'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ─── Stat Card ───────────────────────────────────────────────────────────────

function StatCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-[10px] border border-gray-200 dark:border-gray-700 p-5">
      <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">{label}</p>
      <p className="text-3xl font-bold mt-1" style={{ color }}>
        {value}
      </p>
    </div>
  )
}
