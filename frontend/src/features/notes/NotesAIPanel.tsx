/**
 * NotesAIPanel — Right-side AI assistant panel for Y&U Notes.
 *
 * Tabs: Generate | Summarize | Ask | Extract | Transform
 */
import { useState } from 'react'
import {
  useGenerateNoteContent,
  useSummarizeContent,
  useAskNotes,
  useExtractActions,
  useTransformText,
  type ActionItem,
} from '../../api/notebooks'

// ── Icons ────────────────────────────────────────────────────────────────────

function SparklesIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
        d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z" />
    </svg>
  )
}

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  )
}

function CopyIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
    </svg>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function Spinner() {
  return (
    <svg className="animate-spin h-4 w-4 text-[#51459d]" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  )
}

function ResultBox({ content, onInsert }: { content: string; onInsert?: (text: string) => void }) {
  const [copied, setCopied] = useState(false)

  function handleCopy() {
    navigator.clipboard.writeText(content)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="mt-3 bg-gray-50 dark:bg-gray-900/60 rounded-[8px] border border-gray-100 dark:border-gray-800 overflow-hidden">
      <div className="flex items-center justify-end gap-1 px-2 py-1 border-b border-gray-100 dark:border-gray-800">
        {onInsert && (
          <button
            onClick={() => onInsert(content)}
            className="text-[10px] text-[#51459d] hover:underline"
          >
            Insert into note
          </button>
        )}
        <button
          onClick={handleCopy}
          className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
          title="Copy"
        >
          {copied ? (
            <span className="text-[10px] text-green-500">Copied!</span>
          ) : (
            <CopyIcon className="h-3 w-3" />
          )}
        </button>
      </div>
      <div className="px-3 py-2 text-xs text-gray-700 dark:text-gray-300 whitespace-pre-wrap max-h-64 overflow-y-auto">
        {content}
      </div>
    </div>
  )
}

// ── Tab: Generate ─────────────────────────────────────────────────────────────

function GenerateTab({ onInsert }: { onInsert: (text: string) => void }) {
  const [prompt, setPrompt] = useState('')
  const [withErp, setWithErp] = useState(true)
  const { mutate, isPending, data, error } = useGenerateNoteContent()

  return (
    <div className="space-y-3">
      <p className="text-[11px] text-gray-500 dark:text-gray-400">
        Describe what you want to write. AI can pull live data from Finance, Projects, CRM, and more.
      </p>
      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder="e.g. Write a Q1 financial summary including revenue and outstanding invoices"
        rows={4}
        className="w-full text-xs px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-[8px] focus:outline-none focus:border-[#51459d] bg-transparent resize-none"
      />
      <label className="flex items-center gap-2 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={withErp}
          onChange={(e) => setWithErp(e.target.checked)}
          className="accent-[#51459d]"
        />
        <span className="text-[11px] text-gray-600 dark:text-gray-400">Include live ERP context</span>
      </label>
      <button
        onClick={() => prompt.trim() && mutate({ prompt, include_erp_context: withErp })}
        disabled={isPending || !prompt.trim()}
        className="w-full text-xs bg-[#51459d] text-white py-2 rounded-[8px] hover:bg-[#3d3480] disabled:opacity-50 flex items-center justify-center gap-1.5"
      >
        {isPending ? <><Spinner /> Generating...</> : <><SparklesIcon className="h-3.5 w-3.5" /> Generate</>}
      </button>
      {error && <p className="text-[11px] text-red-500">Generation failed. Try again.</p>}
      {data && <ResultBox content={data.content} onInsert={onInsert} />}
    </div>
  )
}

// ── Tab: Summarize ────────────────────────────────────────────────────────────

function SummarizeTab({ noteContent, onInsert }: { noteContent: string; onInsert: (text: string) => void }) {
  const [style, setStyle] = useState<'concise' | 'executive' | 'detailed'>('concise')
  const [customContent, setCustomContent] = useState('')
  const [useCustom, setUseCustom] = useState(false)
  const { mutate, isPending, data, error } = useSummarizeContent()

  const content = useCustom ? customContent : noteContent

  return (
    <div className="space-y-3">
      <div className="flex gap-1">
        {(['concise', 'executive', 'detailed'] as const).map((s) => (
          <button
            key={s}
            onClick={() => setStyle(s)}
            className={`flex-1 text-[10px] py-1.5 rounded-[6px] border transition-colors capitalize ${
              style === s
                ? 'border-[#51459d] bg-[#51459d]/10 text-[#51459d]'
                : 'border-gray-200 dark:border-gray-700 text-gray-500 hover:border-gray-300'
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      <label className="flex items-center gap-2 cursor-pointer select-none">
        <input type="checkbox" checked={useCustom} onChange={(e) => setUseCustom(e.target.checked)} className="accent-[#51459d]" />
        <span className="text-[11px] text-gray-600 dark:text-gray-400">Paste custom content</span>
      </label>

      {useCustom && (
        <textarea
          value={customContent}
          onChange={(e) => setCustomContent(e.target.value)}
          placeholder="Paste text to summarize..."
          rows={4}
          className="w-full text-xs px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-[8px] focus:outline-none focus:border-[#51459d] bg-transparent resize-none"
        />
      )}

      <button
        onClick={() => content && mutate({ content, style })}
        disabled={isPending || !content}
        className="w-full text-xs bg-[#51459d] text-white py-2 rounded-[8px] hover:bg-[#3d3480] disabled:opacity-50 flex items-center justify-center gap-1.5"
      >
        {isPending ? <><Spinner /> Summarizing...</> : <><SparklesIcon className="h-3.5 w-3.5" /> Summarize</>}
      </button>

      {error && <p className="text-[11px] text-red-500">Summarize failed. Try again.</p>}
      {!content && !useCustom && (
        <p className="text-[11px] text-gray-400 text-center">Open a note to summarize it, or paste custom content.</p>
      )}
      {data && <ResultBox content={data.content} onInsert={onInsert} />}
    </div>
  )
}

// ── Tab: Ask ──────────────────────────────────────────────────────────────────

function AskTab({ notebookId }: { notebookId?: string }) {
  const [question, setQuestion] = useState('')
  const [scopeNotebook, setScopeNotebook] = useState(false)
  const { mutate, isPending, data, error } = useAskNotes()

  return (
    <div className="space-y-3">
      <p className="text-[11px] text-gray-500 dark:text-gray-400">
        Ask anything across all your notes. AI uses semantic search to find relevant context.
      </p>
      <textarea
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && question.trim()) {
            mutate({ question, notebook_id: scopeNotebook && notebookId ? notebookId : undefined })
          }
        }}
        placeholder="e.g. What were the action items from last week's meetings?"
        rows={3}
        className="w-full text-xs px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-[8px] focus:outline-none focus:border-[#51459d] bg-transparent resize-none"
      />

      {notebookId && (
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input type="checkbox" checked={scopeNotebook} onChange={(e) => setScopeNotebook(e.target.checked)} className="accent-[#51459d]" />
          <span className="text-[11px] text-gray-600 dark:text-gray-400">Search only this notebook</span>
        </label>
      )}

      <button
        onClick={() => question.trim() && mutate({ question, notebook_id: scopeNotebook && notebookId ? notebookId : undefined })}
        disabled={isPending || !question.trim()}
        className="w-full text-xs bg-[#51459d] text-white py-2 rounded-[8px] hover:bg-[#3d3480] disabled:opacity-50 flex items-center justify-center gap-1.5"
      >
        {isPending ? <><Spinner /> Searching...</> : <><SparklesIcon className="h-3.5 w-3.5" /> Ask Notes</>}
      </button>

      {error && <p className="text-[11px] text-red-500">Query failed. Try again.</p>}

      {data && (
        <div className="space-y-3">
          <div className="bg-gray-50 dark:bg-gray-900/60 rounded-[8px] border border-gray-100 dark:border-gray-800 p-3">
            <p className="text-xs text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{data.answer}</p>
          </div>
          {data.sources.length > 0 && (
            <div>
              <p className="text-[10px] font-medium text-gray-500 mb-1.5">Sources</p>
              <div className="space-y-1.5">
                {data.sources.map((s, i) => (
                  <div key={i} className="bg-white dark:bg-gray-800 rounded-[6px] border border-gray-100 dark:border-gray-800 px-2.5 py-2">
                    <p className="text-[11px] font-medium text-[#51459d]">{s.note_title}</p>
                    <p className="text-[10px] text-gray-500 mt-0.5 line-clamp-2">{s.excerpt}</p>
                    <p className="text-[9px] text-gray-400 mt-0.5">Score: {(s.score * 100).toFixed(0)}%</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Tab: Extract Actions ──────────────────────────────────────────────────────

const PRIORITY_COLORS: Record<string, string> = {
  high: 'text-red-600 bg-red-50',
  medium: 'text-yellow-600 bg-yellow-50',
  low: 'text-green-600 bg-green-50',
}

const ERP_ACTION_LABELS: Record<string, string> = {
  create_task: 'Create Task',
  create_invoice: 'Create Invoice',
  schedule_meeting: 'Schedule Meeting',
  create_deal: 'Create Deal',
  create_ticket: 'Create Ticket',
}

function ExtractTab({ noteContent }: { noteContent: string }) {
  const [customContent, setCustomContent] = useState('')
  const [useCustom, setUseCustom] = useState(false)
  const { mutate, isPending, data, error } = useExtractActions()

  const content = useCustom ? customContent : noteContent

  return (
    <div className="space-y-3">
      <p className="text-[11px] text-gray-500 dark:text-gray-400">
        Extract tasks, follow-ups, and decisions. One click to push items directly into ERP modules.
      </p>

      <label className="flex items-center gap-2 cursor-pointer select-none">
        <input type="checkbox" checked={useCustom} onChange={(e) => setUseCustom(e.target.checked)} className="accent-[#51459d]" />
        <span className="text-[11px] text-gray-600 dark:text-gray-400">Paste custom content</span>
      </label>

      {useCustom && (
        <textarea
          value={customContent}
          onChange={(e) => setCustomContent(e.target.value)}
          placeholder="Paste meeting notes or text to extract actions from..."
          rows={4}
          className="w-full text-xs px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-[8px] focus:outline-none focus:border-[#51459d] bg-transparent resize-none"
        />
      )}

      <button
        onClick={() => content && mutate({ content })}
        disabled={isPending || !content}
        className="w-full text-xs bg-[#51459d] text-white py-2 rounded-[8px] hover:bg-[#3d3480] disabled:opacity-50 flex items-center justify-center gap-1.5"
      >
        {isPending ? <><Spinner /> Extracting...</> : <><SparklesIcon className="h-3.5 w-3.5" /> Extract Actions</>}
      </button>

      {error && <p className="text-[11px] text-red-500">Extraction failed. Try again.</p>}
      {!content && !useCustom && (
        <p className="text-[11px] text-gray-400 text-center">Open a note to extract actions from it.</p>
      )}

      {data && data.length === 0 && (
        <p className="text-[11px] text-gray-400 text-center py-4">No action items found in this content.</p>
      )}

      {data && data.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] font-medium text-gray-500">{data.length} action item{data.length !== 1 ? 's' : ''} found</p>
          {data.map((item: ActionItem, i: number) => (
            <div key={i} className="bg-white dark:bg-gray-800 rounded-[8px] border border-gray-100 dark:border-gray-700 px-3 py-2.5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[10px] text-gray-400 uppercase tracking-wide">{item.type}</span>
                    <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded-full ${PRIORITY_COLORS[item.priority] ?? 'text-gray-500 bg-gray-50'}`}>
                      {item.priority}
                    </span>
                  </div>
                  <p className="text-xs font-medium text-gray-800 dark:text-gray-200 mt-0.5">{item.title}</p>
                  {item.assignee && <p className="text-[10px] text-gray-400 mt-0.5">Assignee: {item.assignee}</p>}
                  {item.due_date && <p className="text-[10px] text-gray-400">Due: {item.due_date}</p>}
                </div>
              </div>
              {item.erp_action && (
                <button className="mt-2 text-[10px] text-[#51459d] hover:underline flex items-center gap-1">
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
                  {ERP_ACTION_LABELS[item.erp_action] ?? item.erp_action}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Tab: Transform ────────────────────────────────────────────────────────────

const TRANSFORM_ACTIONS = [
  { key: 'improve', label: 'Improve Writing' },
  { key: 'expand', label: 'Expand' },
  { key: 'simplify', label: 'Simplify' },
  { key: 'fix_grammar', label: 'Fix Grammar' },
  { key: 'make_professional', label: 'Make Professional' },
  { key: 'make_casual', label: 'Make Casual' },
  { key: 'translate', label: 'Translate' },
  { key: 'change_tone', label: 'Change Tone' },
]

function TransformTab({ onInsert }: { onInsert: (text: string) => void }) {
  const [text, setText] = useState('')
  const [action, setAction] = useState('improve')
  const [tone, setTone] = useState('')
  const [lang, setLang] = useState('')
  const { mutate, isPending, data, error } = useTransformText()

  return (
    <div className="space-y-3">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Paste or type text to transform..."
        rows={4}
        className="w-full text-xs px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-[8px] focus:outline-none focus:border-[#51459d] bg-transparent resize-none"
      />

      <div className="grid grid-cols-2 gap-1">
        {TRANSFORM_ACTIONS.map((a) => (
          <button
            key={a.key}
            onClick={() => setAction(a.key)}
            className={`text-[10px] py-1.5 px-2 rounded-[6px] border text-left transition-colors ${
              action === a.key
                ? 'border-[#51459d] bg-[#51459d]/10 text-[#51459d]'
                : 'border-gray-200 dark:border-gray-700 text-gray-500 hover:border-gray-300'
            }`}
          >
            {a.label}
          </button>
        ))}
      </div>

      {action === 'change_tone' && (
        <input
          value={tone}
          onChange={(e) => setTone(e.target.value)}
          placeholder="Target tone (e.g. persuasive, empathetic)"
          className="w-full text-xs px-3 py-1.5 border border-gray-200 dark:border-gray-700 rounded-[8px] focus:outline-none focus:border-[#51459d] bg-transparent"
        />
      )}
      {action === 'translate' && (
        <input
          value={lang}
          onChange={(e) => setLang(e.target.value)}
          placeholder="Target language (e.g. French, Swahili)"
          className="w-full text-xs px-3 py-1.5 border border-gray-200 dark:border-gray-700 rounded-[8px] focus:outline-none focus:border-[#51459d] bg-transparent"
        />
      )}

      <button
        onClick={() => text.trim() && mutate({ text, action, tone: tone || undefined, target_language: lang || undefined })}
        disabled={isPending || !text.trim()}
        className="w-full text-xs bg-[#51459d] text-white py-2 rounded-[8px] hover:bg-[#3d3480] disabled:opacity-50 flex items-center justify-center gap-1.5"
      >
        {isPending ? <><Spinner /> Transforming...</> : <><SparklesIcon className="h-3.5 w-3.5" /> Transform</>}
      </button>

      {error && <p className="text-[11px] text-red-500">Transform failed. Try again.</p>}
      {data && <ResultBox content={data.content} onInsert={onInsert} />}
    </div>
  )
}

// ── Main Panel ────────────────────────────────────────────────────────────────

type Tab = 'generate' | 'summarize' | 'ask' | 'extract' | 'transform'

const TABS: { key: Tab; label: string }[] = [
  { key: 'generate', label: 'Generate' },
  { key: 'summarize', label: 'Summarize' },
  { key: 'ask', label: 'Ask' },
  { key: 'extract', label: 'Extract' },
  { key: 'transform', label: 'Transform' },
]

interface NotesAIPanelProps {
  noteContent?: string
  notebookId?: string
  onClose: () => void
  onInsert: (text: string) => void
}

export default function NotesAIPanel({ noteContent = '', notebookId, onClose, onInsert }: NotesAIPanelProps) {
  const [tab, setTab] = useState<Tab>('generate')

  return (
    <div className="w-80 shrink-0 flex flex-col bg-white dark:bg-gray-900 border-l border-gray-100 dark:border-gray-800 h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 dark:border-gray-800 shrink-0">
        <SparklesIcon className="h-4 w-4 text-[#51459d] shrink-0" />
        <span className="text-sm font-semibold text-gray-800 dark:text-gray-100 flex-1">AI Assistant</span>
        <button
          onClick={onClose}
          className="p-1 text-gray-400 hover:text-gray-600 rounded transition-colors"
          title="Close AI panel"
        >
          <CloseIcon className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-100 dark:border-gray-800 shrink-0 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 text-[10px] py-2 px-1 border-b-2 transition-colors whitespace-nowrap ${
              tab === t.key
                ? 'border-[#51459d] text-[#51459d] font-medium'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {tab === 'generate' && <GenerateTab onInsert={onInsert} />}
        {tab === 'summarize' && <SummarizeTab noteContent={noteContent} onInsert={onInsert} />}
        {tab === 'ask' && <AskTab notebookId={notebookId} />}
        {tab === 'extract' && <ExtractTab noteContent={noteContent} />}
        {tab === 'transform' && <TransformTab onInsert={onInsert} />}
      </div>

      {/* Footer hint */}
      <div className="px-4 py-2 border-t border-gray-100 dark:border-gray-800 shrink-0">
        <p className="text-[9px] text-gray-400 text-center">
          Powered by Ollama (local) · ERP-context aware
        </p>
      </div>
    </div>
  )
}
