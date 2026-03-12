import { useState } from 'react'
import { useERPTemplates, useGenerateFromERP, type ERPTemplate } from '../../api/docs'

const MODULE_COLORS: Record<string, { bg: string; text: string; icon: string }> = {
  finance:      { bg: 'bg-green-50 border-green-200', text: 'text-green-700', icon: '$' },
  hr:           { bg: 'bg-blue-50 border-blue-200',   text: 'text-blue-700',  icon: 'HR' },
  supply_chain: { bg: 'bg-amber-50 border-amber-200', text: 'text-amber-700', icon: 'SC' },
  projects:     { bg: 'bg-purple-50 border-purple-200', text: 'text-purple-700', icon: 'P' },
  crm:          { bg: 'bg-pink-50 border-pink-200',   text: 'text-pink-700',  icon: 'CRM' },
}

// Dynamic form fields per template type
const TEMPLATE_FIELDS: Record<string, { key: string; label: string; type: string; placeholder: string }[]> = {
  invoice: [
    { key: 'invoice_id', label: 'Invoice ID', type: 'text', placeholder: 'UUID of the invoice' },
  ],
  payslip: [
    { key: 'employee_id', label: 'Employee ID', type: 'text', placeholder: 'UUID of the employee' },
    { key: 'period_start', label: 'Period Start', type: 'date', placeholder: '' },
    { key: 'period_end', label: 'Period End', type: 'date', placeholder: '' },
  ],
  purchase_order: [
    { key: 'requisition_id', label: 'Requisition ID', type: 'text', placeholder: 'UUID of the procurement requisition' },
  ],
  project_report: [
    { key: 'project_id', label: 'Project ID', type: 'text', placeholder: 'UUID of the project' },
  ],
  financial_report: [
    { key: 'report_type', label: 'Report Type', type: 'select', placeholder: 'revenue,expenses,overview' },
    { key: 'start_date', label: 'Start Date', type: 'date', placeholder: '' },
    { key: 'end_date', label: 'End Date', type: 'date', placeholder: '' },
  ],
  crm_pipeline: [
    { key: 'pipeline_id', label: 'Pipeline ID (optional)', type: 'text', placeholder: 'Leave empty for all pipelines' },
  ],
}

interface ERPTemplateDialogProps {
  open: boolean
  onClose: () => void
  onGenerated?: (result: { file_id: string; filename: string }) => void
}

export default function ERPTemplateDialog({ open, onClose, onGenerated }: ERPTemplateDialogProps) {
  const { data } = useERPTemplates()
  const generateMut = useGenerateFromERP()
  const [selected, setSelected] = useState<ERPTemplate | null>(null)
  const [params, setParams] = useState<Record<string, string>>({})
  const [error, setError] = useState('')

  if (!open) return null

  const templates = data?.templates ?? []
  const fields = selected ? TEMPLATE_FIELDS[selected.id] ?? [] : []

  const handleGenerate = async () => {
    if (!selected) return
    setError('')

    // Validate required fields
    for (const f of fields) {
      if (f.key !== 'pipeline_id' && !params[f.key]?.trim()) {
        setError(`${f.label} is required`)
        return
      }
    }

    try {
      const result = await generateMut.mutateAsync({
        template_type: selected.id,
        params,
      })
      onGenerated?.({ file_id: result.file_id, filename: result.filename })
      setSelected(null)
      setParams({})
      onClose()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Generation failed'
      setError(msg)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-gray-800 rounded-[10px] shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-[6px] bg-[#51459d]/10 flex items-center justify-center">
              <svg className="h-4 w-4 text-[#51459d]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              {selected ? 'Configure Template' : 'Generate from ERP'}
            </h3>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-[6px] text-gray-500">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5">
          {!selected ? (
            <div className="space-y-2">
              <p className="text-xs text-gray-500 mb-3">
                Generate professional documents populated with live ERP data.
              </p>
              {templates.map((t) => {
                const colors = MODULE_COLORS[t.module] ?? MODULE_COLORS.finance
                return (
                  <button
                    key={t.id}
                    onClick={() => { setSelected(t); setParams({}); setError('') }}
                    className="w-full flex items-center gap-3 p-3 rounded-[8px] border border-gray-100 dark:border-gray-700 hover:border-[#51459d]/30 hover:bg-[#51459d]/5 transition-all text-left"
                  >
                    <div className={`w-10 h-10 rounded-[8px] border flex items-center justify-center text-xs font-bold shrink-0 ${colors.bg} ${colors.text}`}>
                      {colors.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{t.name}</p>
                      <p className="text-[10px] text-gray-400 mt-0.5">{t.description}</p>
                    </div>
                    <span className="text-[9px] font-medium uppercase tracking-wider text-gray-400 bg-gray-50 dark:bg-gray-900 px-2 py-0.5 rounded-full shrink-0">
                      {t.doc_type}
                    </span>
                  </button>
                )
              })}
            </div>
          ) : (
            <div className="space-y-4">
              {/* Back button */}
              <button
                onClick={() => { setSelected(null); setError('') }}
                className="flex items-center gap-1 text-xs text-[#51459d] hover:underline"
              >
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Back to templates
              </button>

              {/* Template info */}
              <div className="bg-gray-50 dark:bg-gray-950 rounded-[8px] p-3">
                <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">{selected.name}</p>
                <p className="text-[10px] text-gray-400 mt-1">{selected.description}</p>
              </div>

              {/* Dynamic fields */}
              {fields.map((f) => (
                <div key={f.key}>
                  <label className="text-xs font-medium text-gray-700 dark:text-gray-300 block mb-1.5">
                    {f.label}
                  </label>
                  {f.type === 'select' ? (
                    <select
                      value={params[f.key] ?? ''}
                      onChange={(e) => setParams({ ...params, [f.key]: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-[8px] focus:outline-none focus:ring-1 focus:ring-[#51459d]/40 bg-white dark:bg-gray-800"
                    >
                      <option value="">Select...</option>
                      {f.placeholder.split(',').map((opt) => (
                        <option key={opt} value={opt}>{opt.charAt(0).toUpperCase() + opt.slice(1)}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type={f.type}
                      value={params[f.key] ?? ''}
                      onChange={(e) => setParams({ ...params, [f.key]: e.target.value })}
                      placeholder={f.placeholder}
                      className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-[8px] focus:outline-none focus:ring-1 focus:ring-[#51459d]/40"
                    />
                  )}
                </div>
              ))}

              {/* Error */}
              {error && (
                <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-[8px] p-3">
                  <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        {selected && (
          <div className="px-5 py-3 border-t border-gray-100 dark:border-gray-800 flex justify-end gap-2 shrink-0">
            <button
              onClick={() => { setSelected(null); setError('') }}
              className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-[8px] transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleGenerate}
              disabled={generateMut.isPending}
              className="flex items-center gap-2 px-4 py-2 text-sm bg-[#51459d] text-white rounded-[8px] hover:bg-[#3d3480] transition-colors disabled:opacity-50"
            >
              {generateMut.isPending ? (
                <>
                  <svg className="animate-spin h-3.5 w-3.5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                  </svg>
                  Generating...
                </>
              ) : (
                <>
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Generate & Open
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
