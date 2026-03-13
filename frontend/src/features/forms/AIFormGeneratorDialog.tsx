import { useState } from 'react'
import { useAIGenerateForm } from '@/api/forms'

const PROMPT_EXAMPLES = [
  'Customer satisfaction survey with NPS and rating questions',
  'Employee onboarding checklist with file uploads',
  'Purchase order request with product selection and approval',
  'Event registration form with dietary preferences and accessibility needs',
  'IT support ticket with priority, category, and screenshot upload',
  'Expense report with receipt photo, GL account, and manager approval',
  'Job application with resume upload and work history',
  'Facility inspection with GPS location, photo evidence, and checklists',
]

interface AIFormGeneratorDialogProps {
  onClose: () => void
  onFormGenerated: (form: { title: string; description: string; fields: unknown[] }) => void
}

export default function AIFormGeneratorDialog({ onClose, onFormGenerated }: AIFormGeneratorDialogProps) {
  const [prompt, setPrompt] = useState('')
  const [options, setOptions] = useState({
    include_erp_fields: true,
    multi_page: false,
    include_logic: true,
    field_count: 'auto' as 'auto' | 'minimal' | 'comprehensive',
  })
  const generateForm = useAIGenerateForm()

  const handleGenerate = () => {
    if (!prompt.trim()) return
    generateForm.mutate(
      {
        prompt: prompt.trim(),
        include_erp_fields: options.include_erp_fields,
        multi_page: options.multi_page,
        include_logic: options.include_logic,
        field_count: options.field_count,
      },
      {
        onSuccess: (data) => {
          onFormGenerated(data)
          onClose()
        },
      }
    )
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-50" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          className="bg-white dark:bg-gray-800 rounded-[10px] shadow-2xl w-full max-w-xl max-h-[85vh] flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-[8px] bg-gradient-to-br from-[#51459d] to-[#7c3aed] flex items-center justify-center">
                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <div>
                <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">AI Form Generator</h2>
                <p className="text-[10px] text-gray-400">Describe your form and AI will build it</p>
              </div>
            </div>
            <button onClick={onClose} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-[6px] text-gray-400">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            {/* Prompt */}
            <div>
              <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5 block">
                Describe your form
              </label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="E.g., Create a customer feedback form with satisfaction rating, NPS score, and open-ended comments..."
                rows={4}
                className="w-full px-3 py-2 text-xs bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-700 rounded-[8px] resize-none focus:ring-2 focus:ring-[#51459d]/30 focus:border-[#51459d] transition-colors"
                autoFocus
              />
            </div>

            {/* Examples */}
            <div>
              <h4 className="text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-2">Try an example</h4>
              <div className="flex flex-wrap gap-1.5">
                {PROMPT_EXAMPLES.map((ex) => (
                  <button
                    key={ex}
                    onClick={() => setPrompt(ex)}
                    className="px-2.5 py-1 text-[10px] bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-full text-gray-500 dark:text-gray-400 hover:border-[#51459d] hover:text-[#51459d] transition-colors"
                  >
                    {ex}
                  </button>
                ))}
              </div>
            </div>

            {/* Options */}
            <div>
              <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-3">Options</h4>
              <div className="space-y-3">
                <label className="flex items-center justify-between">
                  <div>
                    <span className="text-xs text-gray-600 dark:text-gray-400">Include ERP fields</span>
                    <p className="text-[10px] text-gray-400">Auto-add employee, customer, product pickers when relevant</p>
                  </div>
                  <button
                    onClick={() => setOptions((o) => ({ ...o, include_erp_fields: !o.include_erp_fields }))}
                    className={`w-9 h-5 rounded-full transition-colors shrink-0 ${options.include_erp_fields ? 'bg-[#51459d]' : 'bg-gray-300 dark:bg-gray-600'}`}
                  >
                    <div className={`w-4 h-4 bg-white rounded-full shadow transform transition-transform ${options.include_erp_fields ? 'translate-x-4' : 'translate-x-0.5'}`} />
                  </button>
                </label>

                <label className="flex items-center justify-between">
                  <div>
                    <span className="text-xs text-gray-600 dark:text-gray-400">Multi-page form</span>
                    <p className="text-[10px] text-gray-400">Split into logical sections with page breaks</p>
                  </div>
                  <button
                    onClick={() => setOptions((o) => ({ ...o, multi_page: !o.multi_page }))}
                    className={`w-9 h-5 rounded-full transition-colors shrink-0 ${options.multi_page ? 'bg-[#51459d]' : 'bg-gray-300 dark:bg-gray-600'}`}
                  >
                    <div className={`w-4 h-4 bg-white rounded-full shadow transform transition-transform ${options.multi_page ? 'translate-x-4' : 'translate-x-0.5'}`} />
                  </button>
                </label>

                <label className="flex items-center justify-between">
                  <div>
                    <span className="text-xs text-gray-600 dark:text-gray-400">Include conditional logic</span>
                    <p className="text-[10px] text-gray-400">Auto-add show/hide rules between related fields</p>
                  </div>
                  <button
                    onClick={() => setOptions((o) => ({ ...o, include_logic: !o.include_logic }))}
                    className={`w-9 h-5 rounded-full transition-colors shrink-0 ${options.include_logic ? 'bg-[#51459d]' : 'bg-gray-300 dark:bg-gray-600'}`}
                  >
                    <div className={`w-4 h-4 bg-white rounded-full shadow transform transition-transform ${options.include_logic ? 'translate-x-4' : 'translate-x-0.5'}`} />
                  </button>
                </label>

                <div>
                  <span className="text-xs text-gray-600 dark:text-gray-400 block mb-1">Field count</span>
                  <div className="flex border border-gray-200 dark:border-gray-700 rounded-[8px] overflow-hidden">
                    {(['auto', 'minimal', 'comprehensive'] as const).map((opt) => (
                      <button
                        key={opt}
                        onClick={() => setOptions((o) => ({ ...o, field_count: opt }))}
                        className={`flex-1 px-3 py-1.5 text-[11px] font-medium capitalize transition-colors ${
                          options.field_count === opt
                            ? 'bg-[#51459d] text-white'
                            : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-900'
                        }`}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Error */}
            {generateForm.isError && (
              <div className="bg-red-50 border border-red-200 rounded-[8px] p-3">
                <p className="text-xs text-red-700">
                  Failed to generate form. Please try again with a different description.
                </p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-5 py-4 border-t border-gray-100 dark:border-gray-700 flex items-center justify-end gap-2 shrink-0">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              Cancel
            </button>
            <button
              onClick={handleGenerate}
              disabled={!prompt.trim() || generateForm.isPending}
              className="px-5 py-2 text-xs font-semibold text-white bg-gradient-to-r from-[#51459d] to-[#7c3aed] hover:from-[#3d3480] hover:to-[#6d28d9] rounded-[8px] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {generateForm.isPending ? (
                <>
                  <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Generating...
                </>
              ) : (
                <>
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  Generate Form
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
