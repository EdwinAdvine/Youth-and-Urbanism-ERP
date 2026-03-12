/**
 * AI Copilot Panel — context-aware drafting, tone checking, smart compose, thread summary.
 * Slides open from the right side of the mail detail view.
 */
import { useState } from 'react'
import {
  useContextAwareDraft,
  useEnhancedThreadSummary,
  useToneCheck,
  useMeetingPrep,
} from '../../api/mail'

interface AICopilotPanelProps {
  messageId: string
  threadMessageIds?: string[]
  senderEmail?: string
  onInsertDraft?: (html: string) => void
  onClose: () => void
}

type CopilotTab = 'draft' | 'summary' | 'tone' | 'meeting'

export default function AICopilotPanel({
  messageId,
  threadMessageIds,
  senderEmail,
  onInsertDraft,
  onClose,
}: AICopilotPanelProps) {
  const [activeTab, setActiveTab] = useState<CopilotTab>('draft')
  const [tone, setTone] = useState('professional')
  const [instructions, setInstructions] = useState('')
  const [draftCheckText, setDraftCheckText] = useState('')
  const [meetingEmails, setMeetingEmails] = useState(senderEmail || '')

  const contextDraft = useContextAwareDraft()
  const threadSummary = useEnhancedThreadSummary()
  const toneCheck = useToneCheck()
  const meetingPrep = useMeetingPrep()

  const tabs: { key: CopilotTab; label: string; icon: string }[] = [
    { key: 'draft', label: 'AI Draft', icon: 'edit-3' },
    { key: 'summary', label: 'Summary', icon: 'file-text' },
    { key: 'tone', label: 'Tone', icon: 'activity' },
    { key: 'meeting', label: 'Meeting', icon: 'calendar' },
  ]

  return (
    <div className="w-[380px] border-l border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-[#51459d] flex items-center justify-center">
            <span className="text-white text-xs font-bold">AI</span>
          </div>
          <h3 className="font-semibold text-sm">Era AI Copilot</h3>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Tab bar */}
      <div className="flex border-b border-gray-200 dark:border-gray-700">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 py-2 text-xs font-medium text-center border-b-2 transition ${
              activeTab === tab.key
                ? 'border-[#51459d] text-[#51459d]'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {/* ── AI Draft Tab ── */}
        {activeTab === 'draft' && (
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Tone</label>
              <div className="flex gap-1.5 mt-1">
                {['professional', 'casual', 'empathetic', 'direct'].map((t) => (
                  <button
                    key={t}
                    onClick={() => setTone(t)}
                    className={`px-2.5 py-1 text-xs rounded-full border transition ${
                      tone === t
                        ? 'bg-[#51459d] text-white border-[#51459d]'
                        : 'border-gray-300 text-gray-600 hover:border-[#51459d]'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 dark:text-gray-400">
                Additional instructions (optional)
              </label>
              <textarea
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                placeholder="e.g., mention the Q2 deadline, ask for revised quote..."
                className="w-full mt-1 px-3 py-2 text-sm border rounded-lg resize-none h-16 focus:ring-1 focus:ring-[#51459d] focus:border-[#51459d]"
              />
            </div>
            <button
              onClick={() =>
                contextDraft.mutate({ message_id: messageId, tone, instructions: instructions || undefined })
              }
              disabled={contextDraft.isPending}
              className="w-full py-2 px-4 bg-[#51459d] text-white text-sm font-medium rounded-lg hover:bg-[#413780] disabled:opacity-50 transition"
            >
              {contextDraft.isPending ? 'Generating...' : 'Generate Draft with Era Context'}
            </button>

            {contextDraft.data && (
              <div className="mt-3 space-y-2">
                {contextDraft.data.context_used.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {contextDraft.data.context_used.map((ctx, i) => (
                      <span
                        key={i}
                        className="px-2 py-0.5 text-[10px] rounded-full bg-[#51459d]/10 text-[#51459d] font-medium"
                      >
                        {ctx}
                      </span>
                    ))}
                  </div>
                )}
                <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg text-sm leading-relaxed whitespace-pre-wrap max-h-64 overflow-y-auto">
                  {contextDraft.data.draft_text}
                </div>
                <button
                  onClick={() => onInsertDraft?.(contextDraft.data!.draft_html)}
                  className="w-full py-1.5 text-sm border border-[#51459d] text-[#51459d] rounded-lg hover:bg-[#51459d]/5 transition"
                >
                  Insert into Compose
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── Thread Summary Tab ── */}
        {activeTab === 'summary' && (
          <div className="space-y-3">
            <button
              onClick={() => threadSummary.mutate(threadMessageIds ?? [messageId])}
              disabled={threadSummary.isPending}
              className="w-full py-2 px-4 bg-[#51459d] text-white text-sm font-medium rounded-lg hover:bg-[#413780] disabled:opacity-50 transition"
            >
              {threadSummary.isPending ? 'Summarizing...' : 'Summarize Thread'}
            </button>

            {threadSummary.data && (
              <div className="space-y-3">
                <div>
                  <h4 className="text-xs font-semibold text-gray-500 uppercase mb-1">Summary</h4>
                  <p className="text-sm text-gray-700 dark:text-gray-300">{threadSummary.data.summary}</p>
                </div>
                {threadSummary.data.key_decisions?.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold text-gray-500 uppercase mb-1">Key Decisions</h4>
                    <ul className="text-sm space-y-1">
                      {threadSummary.data.key_decisions.map((d, i) => (
                        <li key={i} className="flex items-start gap-1.5">
                          <span className="text-[#6fd943] mt-0.5">&#10003;</span>
                          <span>{d}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {threadSummary.data.action_items?.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold text-gray-500 uppercase mb-1">Action Items</h4>
                    <ul className="text-sm space-y-1">
                      {threadSummary.data.action_items.map((a, i) => (
                        <li key={i} className="flex items-start gap-1.5">
                          <span className="text-[#ffa21d] mt-0.5">&#9679;</span>
                          <span>
                            {a.action}
                            {a.due_date && <span className="text-gray-400 text-xs ml-1">by {a.due_date}</span>}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {threadSummary.data.unresolved_questions?.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold text-gray-500 uppercase mb-1">Unresolved</h4>
                    <ul className="text-sm space-y-1">
                      {threadSummary.data.unresolved_questions.map((q, i) => (
                        <li key={i} className="flex items-start gap-1.5">
                          <span className="text-[#ff3a6e] mt-0.5">?</span>
                          <span>{q}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                <div className="text-xs text-gray-400">
                  Sentiment: {threadSummary.data.sentiment_overview || 'neutral'}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Tone Check Tab ── */}
        {activeTab === 'tone' && (
          <div className="space-y-3">
            <textarea
              value={draftCheckText}
              onChange={(e) => setDraftCheckText(e.target.value)}
              placeholder="Paste your draft text here to analyze the tone..."
              className="w-full px-3 py-2 text-sm border rounded-lg resize-none h-32 focus:ring-1 focus:ring-[#51459d] focus:border-[#51459d]"
            />
            <button
              onClick={() => toneCheck.mutate(draftCheckText)}
              disabled={toneCheck.isPending || !draftCheckText.trim()}
              className="w-full py-2 px-4 bg-[#51459d] text-white text-sm font-medium rounded-lg hover:bg-[#413780] disabled:opacity-50 transition"
            >
              {toneCheck.isPending ? 'Analyzing...' : 'Check Tone'}
            </button>

            {toneCheck.data && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{toneCheck.data.emoji_summary}</span>
                  <div>
                    <p className="text-sm font-medium capitalize">{toneCheck.data.tone}</p>
                    <p className="text-xs text-gray-400">
                      {Math.round(toneCheck.data.confidence * 100)}% confidence
                    </p>
                  </div>
                </div>
                {toneCheck.data.suggestions?.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold text-gray-500 uppercase mb-1">Suggestions</h4>
                    <ul className="text-sm space-y-1">
                      {toneCheck.data.suggestions.map((s, i) => (
                        <li key={i} className="text-gray-600 dark:text-gray-400">
                          &bull; {s}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Meeting Prep Tab ── */}
        {activeTab === 'meeting' && (
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-gray-600 dark:text-gray-400">
                Attendee emails (comma-separated)
              </label>
              <textarea
                value={meetingEmails}
                onChange={(e) => setMeetingEmails(e.target.value)}
                placeholder="alice@company.com, bob@company.com"
                className="w-full mt-1 px-3 py-2 text-sm border rounded-lg resize-none h-16 focus:ring-1 focus:ring-[#51459d] focus:border-[#51459d]"
              />
            </div>
            <button
              onClick={() =>
                meetingPrep.mutate(
                  meetingEmails
                    .split(',')
                    .map((e) => e.trim())
                    .filter(Boolean),
                )
              }
              disabled={meetingPrep.isPending || !meetingEmails.trim()}
              className="w-full py-2 px-4 bg-[#51459d] text-white text-sm font-medium rounded-lg hover:bg-[#413780] disabled:opacity-50 transition"
            >
              {meetingPrep.isPending ? 'Preparing...' : 'Generate Meeting Prep'}
            </button>

            {meetingPrep.data && (
              <div className="space-y-2">
                <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg text-sm leading-relaxed whitespace-pre-wrap max-h-48 overflow-y-auto">
                  {meetingPrep.data.briefing_text}
                </div>
                {meetingPrep.data.attendees?.map((att, i) => (
                  <div key={i} className="p-2 border rounded-lg text-xs space-y-0.5">
                    <p className="font-medium">{att.name || att.email}</p>
                    <p className="text-gray-400">{att.email}</p>
                    <div className="flex gap-3 text-gray-500">
                      <span>{att.recent_emails} emails</span>
                      {att.crm_status && <span>CRM: {att.crm_status}</span>}
                      {att.open_tasks != null && <span>{att.open_tasks} tasks</span>}
                      {att.open_tickets != null && <span>{att.open_tickets} tickets</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
