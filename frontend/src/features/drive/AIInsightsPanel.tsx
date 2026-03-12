import { useState } from 'react'
import { Button, Badge, Spinner } from '../../components/ui'
import {
  useFileAIMetadata,
  useReprocessAI,
  useApplyAITags,
  useSensitivityLabels,
  useSetFileSensitivity,
} from '../../api/drive_ext'

interface Props {
  fileId: string
}

const SENSITIVITY_COLORS: Record<string, string> = {
  public: 'bg-green-100 text-green-700',
  internal: 'bg-blue-100 text-blue-700',
  confidential: 'bg-amber-100 text-amber-700',
  highly_confidential: 'bg-red-100 text-red-700',
}

export default function AIInsightsPanel({ fileId }: Props) {
  const { data: ai, isLoading, isError } = useFileAIMetadata(fileId)
  const { data: labels } = useSensitivityLabels()
  const reprocess = useReprocessAI()
  const applyTags = useApplyAITags()
  const setSensitivity = useSetFileSensitivity()
  const [expanded, setExpanded] = useState<string | null>(null)

  if (isLoading) {
    return (
      <div className="p-4 flex items-center justify-center">
        <Spinner />
      </div>
    )
  }

  if (isError || !ai) {
    return (
      <div className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">AI Insights</p>
          <Button
            size="sm"
            variant="outline"
            onClick={() => reprocess.mutate(fileId)}
            loading={reprocess.isPending}
          >
            Analyze
          </Button>
        </div>
        <p className="text-xs text-gray-400">
          {isError ? 'AI analysis not available.' : 'No AI analysis yet. Click Analyze to process this file.'}
        </p>
      </div>
    )
  }

  const toggle = (key: string) => setExpanded(expanded === key ? null : key)

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">AI Insights</p>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => reprocess.mutate(fileId)}
          loading={reprocess.isPending}
          title="Re-analyze"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </Button>
      </div>

      {/* Summary */}
      {ai.summary && (
        <div>
          <button
            onClick={() => toggle('summary')}
            className="w-full flex items-center justify-between text-xs font-medium text-gray-700 dark:text-gray-300 mb-1"
          >
            Summary
            <svg className={`w-3 h-3 transition-transform ${expanded === 'summary' ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          <p className={`text-xs text-gray-500 leading-relaxed ${expanded === 'summary' ? '' : 'line-clamp-3'}`}>
            {ai.summary}
          </p>
        </div>
      )}

      {/* Sensitivity */}
      {ai.sensitivity_level && (
        <div>
          <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">Sensitivity</p>
          <div className="flex items-center gap-2">
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${SENSITIVITY_COLORS[ai.sensitivity_level] || 'bg-gray-100 text-gray-600'}`}>
              {ai.sensitivity_level.replace('_', ' ')}
            </span>
            {labels?.labels && (
              <select
                className="text-[10px] bg-transparent border border-gray-200 dark:border-gray-700 rounded px-1 py-0.5 text-gray-500"
                value={ai.sensitivity_level}
                onChange={(e) => setSensitivity.mutate({ fileId, sensitivity: e.target.value })}
              >
                {labels.labels.map((l) => (
                  <option key={l.name} value={l.name}>{l.display_name}</option>
                ))}
              </select>
            )}
          </div>
        </div>
      )}

      {/* Entities */}
      {ai.entities && (ai.entities.people?.length || ai.entities.organizations?.length || ai.entities.dates?.length || ai.entities.amounts?.length) ? (
        <div>
          <button
            onClick={() => toggle('entities')}
            className="w-full flex items-center justify-between text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5"
          >
            Entities
            <svg className={`w-3 h-3 transition-transform ${expanded === 'entities' ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {(expanded === 'entities' || true) && (
            <div className="space-y-1.5">
              {ai.entities.people?.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {ai.entities.people.map((p, i) => (
                    <Badge key={i} variant="default" className="text-[10px]">
                      <span className="mr-1 opacity-60">@</span>{p}
                    </Badge>
                  ))}
                </div>
              )}
              {ai.entities.organizations?.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {ai.entities.organizations.map((o, i) => (
                    <Badge key={i} variant="default" className="text-[10px]">
                      <span className="mr-1 opacity-60">#</span>{o}
                    </Badge>
                  ))}
                </div>
              )}
              {ai.entities.amounts?.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {ai.entities.amounts.map((a, i) => (
                    <Badge key={i} variant="default" className="text-[10px]">
                      <span className="mr-1 opacity-60">$</span>{a}
                    </Badge>
                  ))}
                </div>
              )}
              {ai.entities.dates?.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {ai.entities.dates.map((d, i) => (
                    <span key={i} className="text-[10px] text-gray-500 bg-gray-50 dark:bg-gray-900 px-1.5 py-0.5 rounded">{d}</span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      ) : null}

      {/* Suggested Tags */}
      {ai.suggested_tags?.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-xs font-medium text-gray-700 dark:text-gray-300">Suggested Tags</p>
            <button
              onClick={() => applyTags.mutate(fileId)}
              disabled={applyTags.isPending}
              className="text-[10px] text-[#51459d] hover:underline disabled:opacity-50"
            >
              {applyTags.isPending ? 'Applying...' : 'Apply All'}
            </button>
          </div>
          <div className="flex flex-wrap gap-1">
            {ai.suggested_tags.map((tag, i) => (
              <span key={i} className="text-[10px] bg-[#51459d]/10 text-[#51459d] px-2 py-0.5 rounded-full">{tag}</span>
            ))}
          </div>
        </div>
      )}

      {/* Module Suggestions */}
      {ai.module_suggestions && Object.keys(ai.module_suggestions).length > 0 && (
        <div>
          <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">ERP Links</p>
          <div className="space-y-1">
            {Object.entries(ai.module_suggestions).map(([module, suggestion]) => (
              <div key={module} className="flex items-center gap-2 text-[10px] text-gray-500 bg-gray-50 dark:bg-gray-900 px-2 py-1.5 rounded">
                <span className="font-medium text-gray-700 dark:text-gray-300 capitalize">{module}</span>
                <span className="truncate">{String(suggestion)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Metadata */}
      <div className="flex items-center justify-between text-[10px] text-gray-400 pt-2 border-t border-gray-100 dark:border-gray-800">
        {ai.language && <span>Language: {ai.language}</span>}
        {ai.word_count ? <span>{ai.word_count.toLocaleString()} words</span> : null}
        {ai.processed_at && <span>{new Date(ai.processed_at).toLocaleDateString()}</span>}
      </div>
    </div>
  )
}
