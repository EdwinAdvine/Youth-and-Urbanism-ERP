import { useState } from 'react'
import type { FormField } from '../../api/forms'

interface MultiPageFormProps {
  fields: FormField[]
  fieldsPerPage?: number
  answers: Record<string, unknown>
  onAnswer: (fieldId: string, value: unknown) => void
  onCheckbox: (fieldId: string, option: string, checked: boolean) => void
  onSubmit: () => void
  isSubmitting?: boolean
  formTitle?: string
  formDescription?: string
}

export default function MultiPageForm({
  fields,
  fieldsPerPage = 3,
  answers,
  onAnswer,
  onCheckbox,
  onSubmit,
  isSubmitting,
  formTitle,
  formDescription,
}: MultiPageFormProps) {
  const [currentPage, setCurrentPage] = useState(0)
  const sorted = [...fields].sort((a, b) => a.order - b.order)
  const totalPages = Math.ceil(sorted.length / fieldsPerPage)
  const pageFields = sorted.slice(
    currentPage * fieldsPerPage,
    (currentPage + 1) * fieldsPerPage,
  )
  const isLastPage = currentPage === totalPages - 1
  const isFirstPage = currentPage === 0

  const validateCurrentPage = () => {
    for (const field of pageFields) {
      if (field.is_required) {
        const val = answers[field.id]
        if (val === undefined || val === null || val === '' || (Array.isArray(val) && val.length === 0)) {
          return false
        }
      }
    }
    return true
  }

  const handleNext = () => {
    if (!validateCurrentPage()) {
      alert('Please fill in all required fields before continuing.')
      return
    }
    if (!isLastPage) setCurrentPage((p) => p + 1)
  }

  const handleBack = () => {
    if (!isFirstPage) setCurrentPage((p) => p - 1)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!validateCurrentPage()) {
      alert('Please fill in all required fields.')
      return
    }
    onSubmit()
  }

  const inputClasses =
    'w-full rounded-[10px] border border-gray-200 bg-white px-3 py-2 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-[#51459d]/30 focus:border-[#51459d] placeholder:text-gray-400'

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header with title */}
      {formTitle && (
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{formTitle}</h1>
          {formDescription && (
            <p className="text-sm text-gray-500 mt-1">{formDescription}</p>
          )}
        </div>
      )}

      {/* Progress bar */}
      <div className="mb-6">
        <div className="flex items-center justify-between text-xs text-gray-500 mb-2">
          <span>Page {currentPage + 1} of {totalPages}</span>
          <span>{Math.round(((currentPage + 1) / totalPages) * 100)}% complete</span>
        </div>
        <div className="h-2 bg-gray-100 dark:bg-gray-900 rounded-full overflow-hidden">
          <div
            className="h-full bg-[#51459d] rounded-full transition-all duration-300"
            style={{ width: `${((currentPage + 1) / totalPages) * 100}%` }}
          />
        </div>
      </div>

      {/* Page dots */}
      <div className="flex items-center justify-center gap-1.5 mb-6">
        {Array.from({ length: totalPages }).map((_, i) => (
          <button
            key={i}
            onClick={() => {
              if (i < currentPage || validateCurrentPage()) setCurrentPage(i)
            }}
            className={`w-2.5 h-2.5 rounded-full transition-colors ${ i === currentPage ? 'bg-[#51459d]' : i < currentPage ? 'bg-[#51459d]/40' : 'bg-gray-200' }`}
          />
        ))}
      </div>

      {/* Fields */}
      <form onSubmit={handleSubmit}>
        <div className="bg-white dark:bg-gray-800 rounded-[10px] border border-gray-100 dark:border-gray-800 shadow-sm p-6 space-y-5">
          {pageFields.map((field) => (
            <div key={field.id} className="space-y-1.5">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                {field.label}
                {field.is_required && <span className="text-[#ff3a6e] ml-1">*</span>}
              </label>

              {(field.field_type === 'text' || field.field_type === 'email') && (
                <input
                  type={field.field_type}
                  className={inputClasses}
                  value={(answers[field.id] as string) ?? ''}
                  onChange={(e) => onAnswer(field.id, e.target.value)}
                  required={field.is_required}
                  placeholder={`Enter ${field.label.toLowerCase()}`}
                />
              )}

              {field.field_type === 'textarea' && (
                <textarea
                  className={`${inputClasses} resize-none`}
                  rows={4}
                  value={(answers[field.id] as string) ?? ''}
                  onChange={(e) => onAnswer(field.id, e.target.value)}
                  required={field.is_required}
                  placeholder={`Enter ${field.label.toLowerCase()}`}
                />
              )}

              {field.field_type === 'number' && (
                <input
                  type="number"
                  className={inputClasses}
                  value={(answers[field.id] as string) ?? ''}
                  onChange={(e) => onAnswer(field.id, e.target.value)}
                  required={field.is_required}
                />
              )}

              {field.field_type === 'date' && (
                <input
                  type="date"
                  className={inputClasses}
                  value={(answers[field.id] as string) ?? ''}
                  onChange={(e) => onAnswer(field.id, e.target.value)}
                  required={field.is_required}
                />
              )}

              {field.field_type === 'select' && (
                <select
                  className={inputClasses}
                  value={(answers[field.id] as string) ?? ''}
                  onChange={(e) => onAnswer(field.id, e.target.value)}
                  required={field.is_required}
                >
                  <option value="">Select an option</option>
                  {field.options?.map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              )}

              {field.field_type === 'radio' && (
                <div className="space-y-2 pt-1">
                  {field.options?.map((opt) => (
                    <label key={opt} className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
                      <input
                        type="radio"
                        name={`field-${field.id}`}
                        value={opt}
                        checked={(answers[field.id] as string) === opt}
                        onChange={() => onAnswer(field.id, opt)}
                        className="text-[#51459d] focus:ring-[#51459d]/30"
                      />
                      {opt}
                    </label>
                  ))}
                </div>
              )}

              {field.field_type === 'checkbox' && (
                <div className="space-y-2 pt-1">
                  {field.options?.map((opt) => (
                    <label key={opt} className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={((answers[field.id] as string[]) ?? []).includes(opt)}
                        onChange={(e) => onCheckbox(field.id, opt, e.target.checked)}
                        className="rounded border-gray-300 text-[#51459d] focus:ring-[#51459d]/30"
                      />
                      {opt}
                    </label>
                  ))}
                </div>
              )}

              {field.field_type === 'file' && (
                <input
                  type="file"
                  className={inputClasses}
                  onChange={(e) => onAnswer(field.id, e.target.files?.[0]?.name ?? '')}
                  required={field.is_required}
                />
              )}
            </div>
          ))}
        </div>

        {/* Navigation buttons */}
        <div className="flex items-center justify-between mt-6">
          <button
            type="button"
            onClick={handleBack}
            disabled={isFirstPage}
            className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </button>

          {isLastPage ? (
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-2 bg-[#51459d] text-white text-sm font-medium px-6 py-2.5 rounded-[10px] hover:bg-[#3d3480] disabled:opacity-50 transition-colors"
            >
              {isSubmitting ? (
                <>
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Submitting...
                </>
              ) : (
                'Submit'
              )}
            </button>
          ) : (
            <button
              type="button"
              onClick={handleNext}
              className="flex items-center gap-1.5 bg-[#51459d] text-white text-sm font-medium px-6 py-2.5 rounded-[10px] hover:bg-[#3d3480] transition-colors"
            >
              Next
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          )}
        </div>
      </form>
    </div>
  )
}
