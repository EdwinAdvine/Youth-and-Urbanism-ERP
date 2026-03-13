import { useState } from 'react'
import { toast } from '../../components/ui'
import { useMutation } from '@tanstack/react-query'
import axios from 'axios'

const aiApi = axios.create({ baseURL: '/api/v1/ai' })
aiApi.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

interface CopilotAction {
  id: string
  label: string
  description: string
  tool: string
  icon: React.ReactNode
  colorClass: string
}

const ACTIONS: CopilotAction[] = [
  {
    id: 'auto_triage',
    label: 'Auto-Triage',
    description: 'Classify priority, category and suggested assignee',
    tool: 'support_auto_triage',
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
      </svg>
    ),
    colorClass: 'bg-[#51459d]/10 text-[#51459d] hover:bg-[#51459d]/20',
  },
  {
    id: 'customer_360',
    label: 'Customer 360',
    description: 'Full history, sentiment and risk profile',
    tool: 'support_customer_360',
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
    ),
    colorClass: 'bg-[#3ec9d6]/10 text-[#3ec9d6] hover:bg-[#3ec9d6]/20',
  },
  {
    id: 'escalation_predictor',
    label: 'Escalation Predictor',
    description: 'Predict if this ticket will escalate',
    tool: 'support_escalation_predictor',
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
      </svg>
    ),
    colorClass: 'bg-[#ffa21d]/10 text-[#ffa21d] hover:bg-[#ffa21d]/20',
  },
  {
    id: 'quality_scorer',
    label: 'Quality Scorer',
    description: 'Score agent response quality (0–100)',
    tool: 'support_quality_scorer',
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
      </svg>
    ),
    colorClass: 'bg-[#6fd943]/10 text-[#6fd943] hover:bg-[#6fd943]/20',
  },
  {
    id: 'generate_macro',
    label: 'Generate Macro',
    description: 'Suggest a canned response for this ticket',
    tool: 'support_generate_macro',
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
      </svg>
    ),
    colorClass: 'bg-[#51459d]/10 text-[#51459d] hover:bg-[#51459d]/20',
  },
  {
    id: 'translate',
    label: 'Translate',
    description: 'Translate ticket content to English',
    tool: 'support_translate',
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
      </svg>
    ),
    colorClass: 'bg-[#3ec9d6]/10 text-[#3ec9d6] hover:bg-[#3ec9d6]/20',
  },
]

interface OutputItem {
  actionId: string
  label: string
  result: string
  error?: boolean
  timestamp: string
}

export default function AICopilotPanel() {
  const ticketId = new URLSearchParams(window.location.search).get('ticketId') ?? ''
  const [outputs, setOutputs] = useState<OutputItem[]>([])
  const [activeAction, setActiveAction] = useState<string | null>(null)

  const runTool = useMutation({
    mutationFn: ({ tool, ticketId: tid }: { tool: string; ticketId: string }) =>
      aiApi
        .post('/tools/run', { tool_name: tool, params: { ticket_id: tid } })
        .then((r) => r.data),
  })

  const handleAction = async (action: CopilotAction) => {
    if (activeAction) return
    setActiveAction(action.id)
    try {
      const result = await runTool.mutateAsync({ tool: action.tool, ticketId })
      const text =
        typeof result?.result === 'string'
          ? result.result
          : JSON.stringify(result?.result ?? result, null, 2)
      setOutputs((prev) => [
        {
          actionId: action.id,
          label: action.label,
          result: text,
          timestamp: new Date().toLocaleTimeString(),
        },
        ...prev,
      ])
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
        'AI tool failed'
      setOutputs((prev) => [
        {
          actionId: action.id,
          label: action.label,
          result: msg,
          error: true,
          timestamp: new Date().toLocaleTimeString(),
        },
        ...prev,
      ])
      toast('error', msg)
    } finally {
      setActiveAction(null)
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-gray-100 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-full bg-[#51459d]/10 flex items-center justify-center">
            <svg className="h-4 w-4 text-[#51459d]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">AI Copilot</p>
            <p className="text-xs text-gray-400">Ticket #{ticketId.slice(0, 8)}</p>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="p-3 border-b border-gray-100 dark:border-gray-700">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Actions</p>
        <div className="grid grid-cols-2 gap-2">
          {ACTIONS.map((action) => (
            <button
              key={action.id}
              onClick={() => handleAction(action)}
              disabled={!!activeAction}
              title={action.description}
              className={`flex items-center gap-2 px-3 py-2 rounded-[10px] text-left text-xs font-medium transition-all ${action.colorClass} ${
                activeAction === action.id
                  ? 'opacity-60 cursor-not-allowed'
                  : activeAction
                  ? 'opacity-40 cursor-not-allowed'
                  : 'cursor-pointer'
              }`}
            >
              {activeAction === action.id ? (
                <svg className="h-4 w-4 animate-spin flex-shrink-0" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : (
                <span className="flex-shrink-0">{action.icon}</span>
              )}
              <span className="truncate">{action.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Output Area */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {outputs.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <svg className="mx-auto h-10 w-10 mb-2 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
            <p className="text-xs">Run an action to see AI insights</p>
          </div>
        ) : (
          outputs.map((out, i) => (
            <div
              key={i}
              className={`rounded-[10px] border p-3 ${
                out.error
                  ? 'border-[#ff3a6e]/30 bg-[#ff3a6e]/5'
                  : 'border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">{out.label}</span>
                <span className="text-[10px] text-gray-400">{out.timestamp}</span>
              </div>
              {out.error ? (
                <p className="text-xs text-[#ff3a6e]">{out.result}</p>
              ) : (
                <pre className="text-xs text-gray-600 dark:text-gray-400 whitespace-pre-wrap font-sans leading-relaxed">
                  {out.result}
                </pre>
              )}
            </div>
          ))
        )}
      </div>

      {/* Clear */}
      {outputs.length > 0 && (
        <div className="p-3 border-t border-gray-100 dark:border-gray-700">
          <button
            onClick={() => setOutputs([])}
            className="text-xs text-gray-400 hover:text-gray-600 transition-colors w-full text-center"
          >
            Clear output
          </button>
        </div>
      )}
    </div>
  )
}
