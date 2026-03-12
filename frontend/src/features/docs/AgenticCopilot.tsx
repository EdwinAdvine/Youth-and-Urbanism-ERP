import { useState } from 'react'
import { useAgentActions, useRunAgentAction } from '../../api/docs'

const ACTION_ICONS: Record<string, string> = {
  board_deck: 'BD',
  monthly_report: 'MR',
  proposal: 'SP',
}

interface AgenticCopilotProps {
  onGenerated?: (result: { file_id: string; filename: string }) => void
  onClose: () => void
}

export default function AgenticCopilot({ onGenerated, onClose }: AgenticCopilotProps) {
  const { data: actionsData } = useAgentActions()
  const runAction = useRunAgentAction()
  const [selected, setSelected] = useState<string | null>(null)
  const [params, setParams] = useState<Record<string, string>>({})
  const [error, setError] = useState('')
  const [steps, setSteps] = useState<string[]>([])

  const actions = actionsData?.actions || []

  const PARAM_FIELDS: Record<string, { key: string; label: string; type: string; placeholder: string; required?: boolean }[]> = {
    board_deck: [
      { key: 'period', label: 'Period', type: 'text', placeholder: '2026-Q1 (optional)' },
    ],
    monthly_report: [
      { key: 'month', label: 'Month', type: 'text', placeholder: '2026-03 (optional)' },
      { key: 'department', label: 'Department', type: 'text', placeholder: 'Department name (optional)' },
    ],
    proposal: [
      { key: 'deal_id', label: 'Deal ID', type: 'text', placeholder: 'UUID of the CRM deal', required: true },
    ],
  }

  const handleRun = async () => {
    if (!selected) return
    setError('')
    setSteps([])

    const fields = PARAM_FIELDS[selected] || []
    for (const f of fields) {
      if (f.required && !params[f.key]?.trim()) {
        setError(`${f.label} is required`)
        return
      }
    }

    setSteps(['Gathering ERP data...'])

    try {
      setTimeout(() => setSteps((prev) => [...prev, 'Analyzing metrics...']), 800)
      setTimeout(() => setSteps((prev) => [...prev, 'Generating document...']), 1600)

      const result = await runAction.mutateAsync({ action: selected, params })
      setSteps((prev) => [...prev, 'Done!'])

      if (result.file_id) {
        onGenerated?.({ file_id: result.file_id, filename: result.filename })
      }

      setTimeout(() => {
        setSelected(null)
        setParams({})
        setSteps([])
      }, 1500)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Agent action failed'
      setError(msg)
      setSteps([])
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-[6px] bg-[#51459d]/10 flex items-center justify-center">
            <svg className="h-3.5 w-3.5 text-[#51459d]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">AI Agent</h3>
        </div>
        <button onClick={onClose} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-[6px]">
          <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {!selected ? (
          <>
            <p className="text-xs text-gray-500 mb-2">
              AI agents create complex documents by gathering data from multiple ERP modules.
            </p>
            {actions.map((action) => (
              <button
                key={action.id}
                onClick={() => { setSelected(action.id); setParams({}); setError('') }}
                className="w-full flex items-center gap-3 p-3 rounded-[8px] border border-gray-100 dark:border-gray-700 hover:border-[#51459d]/30 hover:bg-[#51459d]/5 transition-all text-left"
              >
                <div className="w-9 h-9 rounded-[8px] bg-[#51459d]/10 flex items-center justify-center text-[10px] font-bold text-[#51459d] shrink-0">
                  {ACTION_ICONS[action.id] || 'AI'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{action.name}</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">{action.description}</p>
                </div>
              </button>
            ))}
          </>
        ) : (
          <>
            <button
              onClick={() => { setSelected(null); setError(''); setSteps([]) }}
              className="flex items-center gap-1 text-xs text-[#51459d] hover:underline"
            >
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back
            </button>

            <div className="bg-gray-50 dark:bg-gray-950 rounded-[8px] p-3">
              <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                {actions.find((a) => a.id === selected)?.name || selected}
              </p>
              <p className="text-[10px] text-gray-400 mt-1">
                {actions.find((a) => a.id === selected)?.description}
              </p>
            </div>

            {/* Dynamic params */}
            {(PARAM_FIELDS[selected] || []).map((f) => (
              <div key={f.key}>
                <label className="text-xs font-medium text-gray-700 dark:text-gray-300 block mb-1">
                  {f.label} {f.required && <span className="text-red-400">*</span>}
                </label>
                <input
                  type={f.type}
                  value={params[f.key] || ''}
                  onChange={(e) => setParams({ ...params, [f.key]: e.target.value })}
                  placeholder={f.placeholder}
                  className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-[8px] focus:outline-none focus:ring-1 focus:ring-[#51459d]/40"
                />
              </div>
            ))}

            {/* Progress steps */}
            {steps.length > 0 && (
              <div className="space-y-1.5 p-3 bg-[#51459d]/5 rounded-[8px]">
                {steps.map((step, i) => (
                  <div key={i} className="flex items-center gap-2">
                    {i === steps.length - 1 && step !== 'Done!' ? (
                      <svg className="animate-spin h-3 w-3 text-[#51459d]" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                      </svg>
                    ) : (
                      <svg className="h-3 w-3 text-[#6fd943]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                    <span className="text-xs text-gray-600 dark:text-gray-400">{step}</span>
                  </div>
                ))}
              </div>
            )}

            {error && (
              <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-[8px] p-3">
                <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
              </div>
            )}

            <button
              onClick={handleRun}
              disabled={runAction.isPending}
              className="w-full flex items-center justify-center gap-2 py-2.5 text-sm bg-[#51459d] text-white rounded-[8px] hover:bg-[#3d3480] transition-colors disabled:opacity-50"
            >
              {runAction.isPending ? (
                <>
                  <svg className="animate-spin h-3.5 w-3.5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                  </svg>
                  Running Agent...
                </>
              ) : (
                <>
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  Run Agent
                </>
              )}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
