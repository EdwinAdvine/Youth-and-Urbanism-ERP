import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useForm, useUpdateForm, useAddField, type FormField } from '../../api/forms'
import { Button, Card, Badge, Input, Spinner, toast } from '../../components/ui'
import ConditionalLogicBuilder, { type ConditionalRule } from './ConditionalLogicBuilder'
import FormSharingDialog from './FormSharingDialog'
import ThankYouPageEditor, { type ThankYouConfig } from './ThankYouPageEditor'
import ResponseNotificationSettings, { type NotificationConfig } from './ResponseNotificationSettings'

const FIELD_TYPES: { value: FormField['field_type']; label: string }[] = [
  { value: 'text', label: 'Text' },
  { value: 'textarea', label: 'Textarea' },
  { value: 'number', label: 'Number' },
  { value: 'email', label: 'Email' },
  { value: 'select', label: 'Select' },
  { value: 'checkbox', label: 'Checkbox' },
  { value: 'radio', label: 'Radio' },
  { value: 'date', label: 'Date' },
  { value: 'file', label: 'File' },
]

const TYPE_COLORS: Record<string, string> = {
  text: 'bg-blue-100 text-blue-700',
  textarea: 'bg-blue-100 text-blue-700',
  number: 'bg-purple-100 text-purple-700',
  email: 'bg-cyan-100 text-cyan-700',
  select: 'bg-orange-100 text-orange-700',
  checkbox: 'bg-green-100 text-green-700',
  radio: 'bg-green-100 text-green-700',
  date: 'bg-pink-100 text-pink-700',
  file: 'bg-gray-100 text-gray-700',
}

const HAS_OPTIONS = new Set(['select', 'checkbox', 'radio'])

export default function FormBuilder() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: form, isLoading } = useForm(id ?? '')
  const updateForm = useUpdateForm()
  const addField = useAddField()

  // Settings state
  const [editTitle, setEditTitle] = useState('')
  const [editDesc, setEditDesc] = useState('')
  const [settingsInit, setSettingsInit] = useState(false)

  // Sharing
  const [showSharing, setShowSharing] = useState(false)

  // Conditional logic
  const [conditionalRules, setConditionalRules] = useState<ConditionalRule[]>([])

  // Thank you page
  const [thankYouConfig, setThankYouConfig] = useState<ThankYouConfig | undefined>(undefined)

  // Notification settings
  const [notificationConfig, setNotificationConfig] = useState<NotificationConfig | undefined>(undefined)

  // New field state
  const [showAddField, setShowAddField] = useState(false)
  const [fieldLabel, setFieldLabel] = useState('')
  const [fieldType, setFieldType] = useState<FormField['field_type']>('text')
  const [fieldRequired, setFieldRequired] = useState(false)
  const [fieldOptions, setFieldOptions] = useState('')

  // Initialize settings from form data
  if (form && !settingsInit) {
    setEditTitle(form.title)
    setEditDesc(form.description ?? '')
    setSettingsInit(true)
  }

  function handleSaveSettings() {
    if (!id) return
    updateForm.mutate(
      { id, title: editTitle, description: editDesc },
      {
        onSuccess: () => toast('success', 'Form updated'),
        onError: () => toast('error', 'Failed to update form'),
      }
    )
  }

  function handleTogglePublish() {
    if (!id || !form) return
    updateForm.mutate(
      { id, is_published: !form.is_published },
      {
        onSuccess: () => toast('success', form.is_published ? 'Form unpublished' : 'Form published'),
        onError: () => toast('error', 'Failed to update form'),
      }
    )
  }

  function handleAddField(e: React.FormEvent) {
    e.preventDefault()
    if (!id || !fieldLabel.trim()) return
    const payload: Parameters<typeof addField.mutate>[0] = {
      form_id: id,
      label: fieldLabel.trim(),
      field_type: fieldType,
      is_required: fieldRequired,
      order: (form?.fields?.length ?? 0) + 1,
    }
    if (HAS_OPTIONS.has(fieldType) && fieldOptions.trim()) {
      payload.options = fieldOptions.split(',').map((o) => o.trim()).filter(Boolean)
    }
    addField.mutate(payload, {
      onSuccess: () => {
        toast('success', 'Field added')
        setFieldLabel('')
        setFieldType('text')
        setFieldRequired(false)
        setFieldOptions('')
        setShowAddField(false)
      },
      onError: () => toast('error', 'Failed to add field'),
    })
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Spinner size="lg" />
      </div>
    )
  }

  if (!form) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <h2 className="text-lg font-semibold text-gray-900">Form not found</h2>
        <Button variant="ghost" className="mt-4" onClick={() => navigate('/forms')}>Back to Forms</Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/forms')}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{form.title}</h1>
            <p className="text-sm text-gray-500 mt-0.5">Form Builder</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowSharing(true)}>
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
            Share
          </Button>
          <Button variant="outline" size="sm" onClick={() => navigate(`/forms/${id}/responses`)}>
            Responses
          </Button>
          <Button variant="outline" size="sm" onClick={() => navigate(`/forms/${id}/submit`)}>
            Preview
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Panel - Settings */}
        <div className="space-y-4">
          <Card>
            <h2 className="text-sm font-semibold text-gray-900 mb-4">Form Settings</h2>
            <div className="space-y-3">
              <Input
                label="Title"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
              />
              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-700">Description</label>
                <textarea
                  className="w-full rounded-[10px] border border-gray-200 bg-white px-3 py-2 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary placeholder:text-gray-400 resize-none"
                  rows={3}
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                />
              </div>
              <Button size="sm" onClick={handleSaveSettings} loading={updateForm.isPending}>
                Save Settings
              </Button>
            </div>
          </Card>

          <Card>
            <ResponseNotificationSettings
              config={notificationConfig}
              onChange={setNotificationConfig}
              emailFieldIds={
                (form.fields ?? [])
                  .filter((f) => f.field_type === 'email')
                  .map((f) => ({ id: f.id, label: f.label }))
              }
            />
          </Card>

          <Card>
            <ThankYouPageEditor config={thankYouConfig} onChange={setThankYouConfig} />
          </Card>

          <Card>
            <h2 className="text-sm font-semibold text-gray-900 mb-3">Publish</h2>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-700">
                  {form.is_published ? 'Form is live' : 'Form is in draft'}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {form.is_published ? 'Accepting responses' : 'Not accepting responses'}
                </p>
              </div>
              <button
                onClick={handleTogglePublish}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  form.is_published ? 'bg-[#6fd943]' : 'bg-gray-200'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    form.is_published ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </Card>
        </div>

        {/* Main Area - Fields */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-gray-900">
                Fields ({form.fields?.length ?? 0})
              </h2>
              <Button size="sm" variant="outline" onClick={() => setShowAddField(!showAddField)}>
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add Field
              </Button>
            </div>

            {/* Add Field Form */}
            {showAddField && (
              <form onSubmit={handleAddField} className="mb-5 p-4 bg-gray-50 rounded-[10px] space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Input
                    label="Label"
                    placeholder="e.g. Full Name"
                    value={fieldLabel}
                    onChange={(e) => setFieldLabel(e.target.value)}
                    autoFocus
                    required
                  />
                  <div className="space-y-1">
                    <label className="block text-sm font-medium text-gray-700">Type</label>
                    <select
                      className="w-full rounded-[10px] border border-gray-200 bg-white px-3 py-2 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                      value={fieldType}
                      onChange={(e) => setFieldType(e.target.value as FormField['field_type'])}
                    >
                      {FIELD_TYPES.map((ft) => (
                        <option key={ft.value} value={ft.value}>{ft.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {HAS_OPTIONS.has(fieldType) && (
                  <Input
                    label="Options (comma-separated)"
                    placeholder="e.g. Option A, Option B, Option C"
                    value={fieldOptions}
                    onChange={(e) => setFieldOptions(e.target.value)}
                  />
                )}

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="field-required"
                    checked={fieldRequired}
                    onChange={(e) => setFieldRequired(e.target.checked)}
                    className="rounded border-gray-300 text-primary focus:ring-primary/30"
                  />
                  <label htmlFor="field-required" className="text-sm text-gray-700">Required</label>
                </div>

                <div className="flex justify-end gap-2">
                  <Button variant="ghost" size="sm" type="button" onClick={() => setShowAddField(false)}>
                    Cancel
                  </Button>
                  <Button size="sm" type="submit" loading={addField.isPending}>
                    Add Field
                  </Button>
                </div>
              </form>
            )}

            {/* Fields List */}
            {(!form.fields || form.fields.length === 0) ? (
              <div className="text-center py-12 text-gray-400">
                <svg className="h-10 w-10 mx-auto mb-3 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                </svg>
                <p className="text-sm">No fields yet. Click "Add Field" to get started.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {[...form.fields]
                  .sort((a, b) => a.order - b.order)
                  .map((field, idx) => (
                    <div
                      key={field.id}
                      className="flex items-center gap-3 p-3 bg-white border border-gray-100 rounded-[10px] hover:border-gray-200 transition-colors"
                    >
                      {/* Drag handle */}
                      <div className="text-gray-300 cursor-grab shrink-0">
                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                          <circle cx="9" cy="6" r="1.5" />
                          <circle cx="15" cy="6" r="1.5" />
                          <circle cx="9" cy="12" r="1.5" />
                          <circle cx="15" cy="12" r="1.5" />
                          <circle cx="9" cy="18" r="1.5" />
                          <circle cx="15" cy="18" r="1.5" />
                        </svg>
                      </div>

                      {/* Order number */}
                      <span className="text-xs font-medium text-gray-400 w-5 text-center shrink-0">
                        {idx + 1}
                      </span>

                      {/* Label */}
                      <span className="text-sm font-medium text-gray-900 flex-1 min-w-0 truncate">
                        {field.label}
                      </span>

                      {/* Type badge */}
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${TYPE_COLORS[field.field_type] ?? 'bg-gray-100 text-gray-700'}`}>
                        {field.field_type}
                      </span>

                      {/* Required badge */}
                      {field.is_required && (
                        <Badge variant="danger">Required</Badge>
                      )}

                      {/* Options count */}
                      {field.options && field.options.length > 0 && (
                        <span className="text-[10px] text-gray-400">{field.options.length} options</span>
                      )}
                    </div>
                  ))}
              </div>
            )}
          </Card>

          {/* Conditional Logic */}
          {(form.fields?.length ?? 0) >= 2 && (
            <Card>
              <ConditionalLogicBuilder
                fields={form.fields ?? []}
                rules={conditionalRules}
                onChange={setConditionalRules}
              />
            </Card>
          )}
        </div>
      </div>

      {/* Sharing Dialog */}
      {showSharing && form && (
        <FormSharingDialog
          formId={form.id}
          formTitle={form.title}
          isPublished={form.is_published}
          onClose={() => setShowSharing(false)}
        />
      )}
    </div>
  )
}
