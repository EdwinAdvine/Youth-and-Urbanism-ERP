import { useState } from 'react'
import {
  useAIGenerate,
  useAISummarize,
  useAITranslate,
  useAIImprove,
  useAIExpand,
  useAISimplify,
} from '../../api/docs'

type AIAction = 'generate' | 'summarize' | 'translate' | 'improve' | 'expand' | 'simplify'

interface AIGenerationPanelProps {
  fileId: string
  onClose: () => void
  onInsert?: (text: string) => void
}

const AI_ACTIONS: { value: AIAction; label: string; icon: string; description: string }[] = [
  { value: 'generate',  label: 'Generate',  icon: 'M',  description: 'Create content from a prompt' },
  { value: 'summarize', label: 'Summarize', icon: 'S',  description: 'Shorten and condense text' },
  { value: 'translate', label: 'Translate', icon: 'T',  description: 'Convert to another language' },
  { value: 'improve',   label: 'Improve',   icon: 'I',  description: 'Fix grammar and tone' },
  { value: 'expand',    label: 'Expand',    icon: 'E',  description: 'Add more detail and depth' },
  { value: 'simplify',  label: 'Simplify',  icon: 'Si', description: 'Make text easier to read' },
]

const LANGUAGES = [
  'English', 'Spanish', 'French', 'German', 'Chinese', 'Japanese',
  'Korean', 'Portuguese', 'Arabic', 'Hindi', 'Swahili',
]

export default function AIGenerationPanel({ fileId, onClose, onInsert }: AIGenerationPanelProps) {
  const [action, setAction] = useState<AIAction>('generate')
  const [prompt, setPrompt] = useState('')
  const [inputText, setInputText] = useState('')
  const [targetLang, setTargetLang] = useState('Spanish')
  const [result, setResult] = useState('')
  const [error, setError] = useState('')

  const generateMut = useAIGenerate(fileId)
  const summarizeMut = useAISummarize(fileId)
  const translateMut = useAITranslate(fileId)
  const improveMut = useAIImprove(fileId)
  const expandMut = useAIExpand(fileId)
  const simplifyMut = useAISimplify(fileId)

  const loading = generateMut.isPending || summarizeMut.isPending || translateMut.isPending
    || improveMut.isPending || expandMut.isPending || simplifyMut.isPending

  const handleGenerate = async () => {
    setResult('')
    setError('')

    try {
      switch (action) {
        case 'generate': {
          const res = await generateMut.mutateAsync({ prompt, doc_type: 'doc' })
          setResult(res.generated_content)
          break
        }
        case 'summarize': {
          const res = await summarizeMut.mutateAsync({ max_length: 500 })
          setResult(res.summary)
          break
        }
        case 'translate': {
          const res = await translateMut.mutateAsync({ target_language: targetLang })
          setResult(res.translated_content)
          break
        }
        case 'improve': {
          const res = await improveMut.mutateAsync({ text: inputText })
          setResult(res.improved_content)
          break
        }
        case 'expand': {
          const res = await expandMut.mutateAsync({ text: inputText })
          setResult(res.expanded_content)
          break
        }
        case 'simplify': {
          const res = await simplifyMut.mutateAsync({ text: inputText })
          setResult(res.simplified_content)
          break
        }
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'AI service unavailable. Please try again.'
      setError(message)
    }
  }

  const canSubmit = action === 'generate'
    ? prompt.trim().length > 0
    : action === 'summarize'
      ? true
      : inputText.trim().length > 0

  return (
    <div className="absolute right-0 top-0 bottom-0 w-96 bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 shadow-lg z-20 flex flex-col">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-[6px] bg-[#51459d]/10 flex items-center justify-center">
            <svg className="h-3.5 w-3.5 text-[#51459d]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">AI Assistant</h3>
        </div>
        <button onClick={onClose} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-[6px] text-gray-400">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Actions */}
      <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 shrink-0">
        <div className="grid grid-cols-3 gap-1.5">
          {AI_ACTIONS.map((a) => (
            <button
              key={a.value}
              onClick={() => { setAction(a.value); setResult(''); setError('') }}
              className={`flex flex-col items-center p-2 rounded-[8px] transition-colors text-center ${ action === a.value ? 'bg-[#51459d]/10 text-[#51459d]' : 'text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800' }`}
            >
              <span className="text-[10px] font-bold mb-0.5">{a.icon}</span>
              <span className="text-[10px] font-medium">{a.label}</span>
            </button>
          ))}
        </div>
        <p className="text-[10px] text-gray-400 mt-2 text-center">
          {AI_ACTIONS.find((a) => a.value === action)?.description}
        </p>
      </div>

      {/* Input area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {action === 'generate' ? (
          <div>
            <label className="text-xs font-medium text-gray-700 dark:text-gray-300 block mb-1.5">Prompt</label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Describe what you want to generate..."
              className="w-full px-3 py-2 text-xs border border-gray-200 dark:border-gray-700 rounded-[8px] focus:outline-none focus:ring-1 focus:ring-[#51459d]/40 resize-none"
              rows={4}
            />
          </div>
        ) : action === 'summarize' ? (
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              The AI will read and summarize the current document content.
            </p>
          </div>
        ) : (
          <div>
            <label className="text-xs font-medium text-gray-700 dark:text-gray-300 block mb-1.5">
              {action === 'translate' ? 'Text to translate' : 'Input text'}
            </label>
            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Paste or type your text here..."
              className="w-full px-3 py-2 text-xs border border-gray-200 dark:border-gray-700 rounded-[8px] focus:outline-none focus:ring-1 focus:ring-[#51459d]/40 resize-none"
              rows={4}
            />
          </div>
        )}

        {action === 'translate' && (
          <div>
            <label className="text-xs font-medium text-gray-700 dark:text-gray-300 block mb-1.5">Target language</label>
            <select
              value={targetLang}
              onChange={(e) => setTargetLang(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-gray-200 dark:border-gray-700 rounded-[8px] focus:outline-none bg-white dark:bg-gray-800"
            >
              {LANGUAGES.map((lang) => (
                <option key={lang} value={lang}>{lang}</option>
              ))}
            </select>
          </div>
        )}

        <button
          onClick={handleGenerate}
          disabled={loading || !canSubmit}
          className="w-full flex items-center justify-center gap-2 py-2 text-xs bg-[#51459d] text-white rounded-[8px] hover:bg-[#3d3480] transition-colors disabled:opacity-50"
        >
          {loading ? (
            <>
              <svg className="animate-spin h-3.5 w-3.5" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
              </svg>
              Processing...
            </>
          ) : (
            <>
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              {action === 'generate' ? 'Generate' : action.charAt(0).toUpperCase() + action.slice(1)}
            </>
          )}
        </button>

        {/* Error */}
        {error && (
          <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-[8px] p-3">
            <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
          </div>
        )}

        {/* Result */}
        {result && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                Result
              </p>
              <button
                onClick={() => {
                  onInsert?.(result)
                  setResult('')
                }}
                className="text-[10px] text-[#51459d] hover:underline font-medium"
              >
                Insert into document
              </button>
            </div>
            <div className="bg-gray-50 dark:bg-gray-950 rounded-[8px] p-3">
              <p className="text-xs text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">
                {result}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(result)
                }}
                className="flex-1 py-1.5 text-[10px] border border-gray-200 dark:border-gray-700 rounded-[6px] text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                Copy
              </button>
              <button
                onClick={handleGenerate}
                className="flex-1 py-1.5 text-[10px] border border-gray-200 dark:border-gray-700 rounded-[6px] text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                Regenerate
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-2 border-t border-gray-100 dark:border-gray-800 shrink-0">
        <p className="text-[9px] text-gray-400 text-center">
          Powered by Urban Vibes Dynamics AI (Ollama / OpenAI / Anthropic)
        </p>
      </div>
    </div>
  )
}
