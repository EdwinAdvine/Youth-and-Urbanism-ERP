import { useState } from 'react'
import apiClient from '../api/client'

interface SummarizeButtonProps {
  type: 'email' | 'meeting' | 'note'
  id: string
}

const TOOL_MAP: Record<string, string> = {
  email: 'summarize_email',
  meeting: 'summarize_meeting',
  note: 'summarize_note',
}

const LABEL_MAP: Record<string, string> = {
  email: 'Email',
  meeting: 'Meeting',
  note: 'Note',
}

export default function SummarizeButton({ type, id }: SummarizeButtonProps) {
  const [summary, setSummary] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState(true)

  const handleSummarize = async () => {
    setLoading(true)
    setError(null)
    setSummary(null)

    try {
      // Send a message to the AI chat endpoint asking it to summarize
      const message = `Please summarize this ${type} with ID: ${id}`
      const response = await apiClient.post('/ai/chat', {
        message,
        session_id: `summarize-${type}-${id}`,
        context: { tool_hint: TOOL_MAP[type], item_id: id },
      })

      const data = response.data
      const replyText = data.reply || data.message || data.content || ''
      if (replyText) {
        setSummary(replyText)
        setExpanded(true)
      } else {
        setError('No summary was returned.')
      }
    } catch (err: any) {
      const msg =
        err?.response?.data?.detail ||
        err?.message ||
        'Failed to generate summary.'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="inline-flex flex-col">
      <button
        type="button"
        onClick={summary ? () => setExpanded(!expanded) : handleSummarize}
        disabled={loading}
        className={
          'inline-flex items-center gap-2 rounded-[10px] px-4 py-2 text-sm font-medium ' +
          'text-white transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 ' +
          'focus:ring-[#51459d] ' +
          (loading
            ? 'cursor-wait bg-[#51459d]/60'
            : 'bg-[#51459d] hover:bg-[#51459d]/90')
        }
      >
        {/* Sparkle icon */}
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
            d="M9.663 17h4.674M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
          />
        </svg>

        {loading
          ? 'Summarizing...'
          : summary
            ? expanded
              ? 'Hide Summary'
              : 'Show Summary'
            : `Summarize ${LABEL_MAP[type]}`}
      </button>

      {error && (
        <div className="mt-2 rounded-[10px] border border-[#ff3a6e]/30 bg-[#ff3a6e]/10 px-4 py-3 text-sm text-[#ff3a6e]">
          {error}
        </div>
      )}

      {summary && expanded && (
        <div className="mt-2 rounded-[10px] border border-[#3ec9d6]/30 bg-[#3ec9d6]/5 px-4 py-3 text-sm text-gray-700">
          <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-[#3ec9d6]">
            AI Summary
          </div>
          <p className="whitespace-pre-wrap leading-relaxed">{summary}</p>
        </div>
      )}
    </div>
  )
}
