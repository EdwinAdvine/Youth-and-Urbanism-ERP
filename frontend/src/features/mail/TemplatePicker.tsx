/**
 * Template Picker — dropdown in compose to select and insert email templates.
 * Supports ERP variable rendering with live CRM/Finance data.
 */
import { useState } from 'react'
import { useMailTemplates, useRenderTemplate, useRenderTemplateERP } from '../../api/mail'

interface TemplatePickerProps {
  onInsert: (subject: string, body: string) => void
  contactEmail?: string
  dealId?: string
  invoiceId?: string
}

export default function TemplatePicker({ onInsert, contactEmail, dealId, invoiceId }: TemplatePickerProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const { data: templates, isLoading } = useMailTemplates()
  const renderTemplate = useRenderTemplate()
  const renderERP = useRenderTemplateERP()

  const filtered = (templates ?? []).filter(
    (t) => t.name.toLowerCase().includes(search.toLowerCase())
      || (t.category ?? '').toLowerCase().includes(search.toLowerCase()),
  )

  const handleSelect = (templateId: string) => {
    const hasERPVars = templates?.find(
      (t) => t.id === templateId
        && (t.body_html_template.includes('{{crm.') || t.body_html_template.includes('{{finance.')),
    )

    if (hasERPVars && (contactEmail || dealId || invoiceId)) {
      renderERP.mutate(
        { templateId, contact_email: contactEmail, deal_id: dealId, invoice_id: invoiceId },
        {
          onSuccess: (data) => {
            onInsert(data.rendered_subject, data.rendered_body)
            setOpen(false)
          },
        },
      )
    } else {
      renderTemplate.mutate(
        { templateId, variables: {} },
        {
          onSuccess: (data) => {
            onInsert(data.rendered_subject, data.rendered_body)
            setOpen(false)
          },
        },
      )
    }
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 px-2 py-1 text-xs text-gray-500 hover:text-[#51459d] hover:bg-[#51459d]/5 rounded transition"
        title="Insert template"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        Templates
      </button>

      {open && (
        <div className="absolute bottom-full mb-1 left-0 w-72 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 z-50 max-h-80 flex flex-col">
          <div className="p-2 border-b border-gray-100 dark:border-gray-700">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search templates..."
              className="w-full px-2 py-1 text-xs border rounded focus:ring-1 focus:ring-[#51459d]"
              autoFocus
            />
          </div>
          <div className="flex-1 overflow-y-auto">
            {isLoading && <p className="p-3 text-xs text-gray-400">Loading...</p>}
            {filtered.length === 0 && !isLoading && (
              <p className="p-3 text-xs text-gray-400">No templates found</p>
            )}
            {filtered.map((t) => (
              <button
                key={t.id}
                onClick={() => handleSelect(t.id)}
                className="w-full px-3 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-700 transition"
              >
                <p className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate">
                  {t.name}
                </p>
                <p className="text-[10px] text-gray-400 truncate">
                  {t.subject_template}
                </p>
                <div className="flex items-center gap-1 mt-0.5">
                  {t.category && (
                    <span className="px-1.5 py-0.5 rounded text-[9px] bg-gray-100 dark:bg-gray-700 text-gray-500">
                      {t.category}
                    </span>
                  )}
                  {t.is_shared && (
                    <span className="px-1.5 py-0.5 rounded text-[9px] bg-[#3ec9d6]/10 text-[#3ec9d6]">
                      shared
                    </span>
                  )}
                  {t.variables.length > 0 && (
                    <span className="text-[9px] text-gray-400">
                      {t.variables.length} vars
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
