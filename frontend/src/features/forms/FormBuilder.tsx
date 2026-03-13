import { useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  useForm,
  useUpdateForm,
  useBulkUpdateFields,
  useSaveLogicRules,
  useSaveTheme,
  type FormField,
  type FieldType,
} from '../../api/forms'
import { Button, Card, Badge, Input, Spinner, toast } from '../../components/ui'
import ConditionalLogicBuilder, { type ConditionalRule } from './ConditionalLogicBuilder'
import FormSharingDialog from './FormSharingDialog'
import ThankYouPageEditor, { type ThankYouConfig } from './ThankYouPageEditor'
import ResponseNotificationSettings, { type NotificationConfig } from './ResponseNotificationSettings'
import FormThemeEditor from './FormThemeEditor'
import FormVersionHistory from './FormVersionHistory'
import QuizSettingsPanel from './QuizSettingsPanel'
import FormScheduleDialog from './FormScheduleDialog'
import ResponseApprovalQueue from './ResponseApprovalQueue'
import FormTranslationEditor from './FormTranslationEditor'
import FormConsentManager from './FormConsentManager'
import FormAutomationBuilder from './FormAutomationBuilder'
import FormApprovalWorkflowBuilder from './FormApprovalWorkflowBuilder'
import FormAccessibilityChecker from './FormAccessibilityChecker'
import FormComplianceDashboard from './FormComplianceDashboard'
import AIFormGeneratorDialog from './AIFormGeneratorDialog'
import { useFormWebhooks, useCreateWebhook, useDeleteWebhook } from '../../api/forms'

// ── Field type categories ────────────────────────────────────────────────────

interface FieldTypeOption {
  value: FieldType
  label: string
  icon: string
  category: string
}

const FIELD_TYPE_CATEGORIES: { name: string; types: FieldTypeOption[] }[] = [
  {
    name: 'Basic',
    types: [
      { value: 'text', label: 'Short Text', icon: 'Aa', category: 'Basic' },
      { value: 'textarea', label: 'Long Text', icon: 'Tx', category: 'Basic' },
      { value: 'number', label: 'Number', icon: '#', category: 'Basic' },
      { value: 'email', label: 'Email', icon: '@', category: 'Basic' },
      { value: 'phone', label: 'Phone', icon: 'Ph', category: 'Basic' },
      { value: 'url', label: 'URL', icon: 'Ln', category: 'Basic' },
      { value: 'date', label: 'Date', icon: 'Dt', category: 'Basic' },
      { value: 'time', label: 'Time', icon: 'Tm', category: 'Basic' },
      { value: 'datetime', label: 'Date & Time', icon: 'DT', category: 'Basic' },
    ],
  },
  {
    name: 'Choice',
    types: [
      { value: 'select', label: 'Dropdown', icon: 'Sl', category: 'Choice' },
      { value: 'radio', label: 'Radio', icon: 'Rd', category: 'Choice' },
      { value: 'checkbox', label: 'Checkbox', icon: 'Ck', category: 'Choice' },
      { value: 'dropdown', label: 'Multi-Select', icon: 'Ms', category: 'Choice' },
      { value: 'ranking', label: 'Ranking', icon: 'Rk', category: 'Choice' },
      { value: 'cascading_select', label: 'Cascading', icon: 'Cs', category: 'Choice' },
    ],
  },
  {
    name: 'Scale & Rating',
    types: [
      { value: 'rating', label: 'Star Rating', icon: 'St', category: 'Scale' },
      { value: 'likert', label: 'Likert Scale', icon: 'Lk', category: 'Scale' },
      { value: 'nps', label: 'NPS (0-10)', icon: 'Np', category: 'Scale' },
      { value: 'slider', label: 'Slider', icon: 'Sd', category: 'Scale' },
    ],
  },
  {
    name: 'Matrix',
    types: [
      { value: 'matrix', label: 'Matrix Grid', icon: 'Mx', category: 'Matrix' },
    ],
  },
  {
    name: 'Media & Files',
    types: [
      { value: 'file', label: 'File Upload', icon: 'Fi', category: 'Media' },
      { value: 'photo', label: 'Photo Capture', icon: 'Ph', category: 'Media' },
      { value: 'video', label: 'Video Capture', icon: 'Vd', category: 'Media' },
      { value: 'audio', label: 'Audio Record', icon: 'Au', category: 'Media' },
      { value: 'signature', label: 'Signature', icon: 'Sg', category: 'Media' },
    ],
  },
  {
    name: 'Location & Scanning',
    types: [
      { value: 'gps', label: 'GPS Location', icon: 'Gp', category: 'Location' },
      { value: 'barcode', label: 'Barcode/QR', icon: 'Bc', category: 'Location' },
    ],
  },
  {
    name: 'Layout',
    types: [
      { value: 'section_header', label: 'Section Header', icon: 'Hd', category: 'Layout' },
      { value: 'description', label: 'Description', icon: 'Ds', category: 'Layout' },
      { value: 'page_break', label: 'Page Break', icon: 'Pb', category: 'Layout' },
    ],
  },
  {
    name: 'Computed',
    types: [
      { value: 'calculated', label: 'Calculated', icon: 'Fx', category: 'Computed' },
    ],
  },
  {
    name: 'ERP Data',
    types: [
      { value: 'employee_picker', label: 'Employee', icon: 'Ep', category: 'ERP' },
      { value: 'product_picker', label: 'Product', icon: 'Pp', category: 'ERP' },
      { value: 'customer_picker', label: 'Customer', icon: 'Cp', category: 'ERP' },
      { value: 'gl_account_picker', label: 'GL Account', icon: 'Gl', category: 'ERP' },
      { value: 'warehouse_picker', label: 'Warehouse', icon: 'Wh', category: 'ERP' },
    ],
  },
]

const ALL_FIELD_TYPES = FIELD_TYPE_CATEGORIES.flatMap((c) => c.types)

const HAS_OPTIONS = new Set<string>(['select', 'checkbox', 'radio', 'dropdown', 'ranking', 'cascading_select'])

const TYPE_COLORS: Record<string, string> = {
  Basic: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  Choice: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
  Scale: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  Matrix: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300',
  Media: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300',
  Location: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  Layout: 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-300',
  Computed: 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300',
  ERP: 'bg-[#51459d]/10 text-[#51459d] dark:bg-[#51459d]/20 dark:text-purple-300',
}

// ── Sortable Field Item ──────────────────────────────────────────────────────

function SortableFieldItem({
  field,
  index,
  onRemove,
  onEdit,
}: {
  field: FormField
  index: number
  onRemove: (id: string) => void
  onEdit: (field: FormField) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: field.id,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : 'auto' as string | number,
  }

  const typeInfo = ALL_FIELD_TYPES.find((t) => t.value === field.field_type)
  const categoryColor = typeInfo ? TYPE_COLORS[typeInfo.category] : TYPE_COLORS.Basic

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-3 p-3 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-800 rounded-[10px] hover:border-gray-200 dark:hover:border-gray-700 transition-colors ${
        isDragging ? 'shadow-lg ring-2 ring-[#51459d]/30' : ''
      }`}
    >
      {/* Drag handle */}
      <button
        {...attributes}
        {...listeners}
        className="text-gray-300 hover:text-gray-500 cursor-grab active:cursor-grabbing shrink-0 touch-none"
      >
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="9" cy="6" r="1.5" />
          <circle cx="15" cy="6" r="1.5" />
          <circle cx="9" cy="12" r="1.5" />
          <circle cx="15" cy="12" r="1.5" />
          <circle cx="9" cy="18" r="1.5" />
          <circle cx="15" cy="18" r="1.5" />
        </svg>
      </button>

      {/* Order number */}
      <span className="text-xs font-medium text-gray-400 w-5 text-center shrink-0">
        {index + 1}
      </span>

      {/* Label & description */}
      <div className="flex-1 min-w-0">
        <span className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate block">
          {field.label}
        </span>
        {field.description && (
          <span className="text-xs text-gray-400 truncate block">{field.description}</span>
        )}
      </div>

      {/* Page number */}
      {field.page_number > 1 && (
        <span className="text-[10px] text-gray-400 bg-gray-50 dark:bg-gray-900 px-1.5 py-0.5 rounded">
          P{field.page_number}
        </span>
      )}

      {/* Type badge */}
      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium shrink-0 ${categoryColor}`}>
        {typeInfo?.label ?? field.field_type}
      </span>

      {/* Required badge */}
      {field.is_required && <Badge variant="danger">Required</Badge>}

      {/* Options count */}
      {field.options && field.options.length > 0 && (
        <span className="text-[10px] text-gray-400">{field.options.length} opts</span>
      )}

      {/* Edit button */}
      <button
        onClick={() => onEdit(field)}
        className="text-gray-300 hover:text-gray-500 shrink-0"
        title="Edit field"
      >
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
      </button>

      {/* Remove button */}
      <button
        onClick={() => onRemove(field.id)}
        className="text-gray-300 hover:text-red-500 shrink-0"
        title="Remove field"
      >
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  )
}

// ── Field Type Gallery ───────────────────────────────────────────────────────

function FieldTypeGallery({
  onSelect,
  onClose,
}: {
  onSelect: (type: FieldType) => void
  onClose: () => void
}) {
  const [search, setSearch] = useState('')

  const filtered = search
    ? FIELD_TYPE_CATEGORIES.map((cat) => ({
        ...cat,
        types: cat.types.filter((t) =>
          t.label.toLowerCase().includes(search.toLowerCase()) ||
          t.value.toLowerCase().includes(search.toLowerCase())
        ),
      })).filter((cat) => cat.types.length > 0)
    : FIELD_TYPE_CATEGORIES

  return (
    <div className="p-4 bg-gray-50 dark:bg-gray-950 rounded-[10px] mb-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Add Field</h3>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <input
        type="text"
        placeholder="Search field types..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-[#51459d]/30"
        autoFocus
      />

      <div className="space-y-3 max-h-[400px] overflow-y-auto">
        {filtered.map((category) => (
          <div key={category.name}>
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
              {category.name}
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
              {category.types.map((ft) => (
                <button
                  key={ft.value}
                  onClick={() => onSelect(ft.value)}
                  className={`flex items-center gap-2 px-2.5 py-2 rounded-lg text-left text-xs font-medium transition-all hover:scale-[1.02] hover:shadow-sm ${TYPE_COLORS[ft.category]}`}
                >
                  <span className="font-mono text-[10px] w-5 text-center opacity-70">{ft.icon}</span>
                  {ft.label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Add/Edit Field Dialog ────────────────────────────────────────────────────

function FieldEditor({
  fieldType,
  initialData,
  onSave,
  onCancel,
}: {
  fieldType: FieldType
  initialData?: FormField | null
  onSave: (data: {
    label: string
    field_type: FieldType
    options?: string[]
    is_required: boolean
    description?: string
    placeholder?: string
    page_number: number
    metadata?: Record<string, unknown>
  }) => void
  onCancel: () => void
}) {
  const [label, setLabel] = useState(initialData?.label ?? '')
  const [description, setDescription] = useState(initialData?.description ?? '')
  const [placeholder, setPlaceholder] = useState(initialData?.placeholder ?? '')
  const [required, setRequired] = useState(initialData?.is_required ?? false)
  const [options, setOptions] = useState(initialData?.options?.join(', ') ?? '')
  const [pageNumber, setPageNumber] = useState(initialData?.page_number ?? 1)
  const [sliderMin, setSliderMin] = useState(initialData?.metadata?.min as number ?? 0)
  const [sliderMax, setSliderMax] = useState(initialData?.metadata?.max as number ?? (fieldType === 'nps' ? 10 : 5))

  const typeInfo = ALL_FIELD_TYPES.find((t) => t.value === fieldType)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!label.trim()) return

    const data: Parameters<typeof onSave>[0] = {
      label: label.trim(),
      field_type: fieldType,
      is_required: required,
      page_number: pageNumber,
    }

    if (description.trim()) data.description = description.trim()
    if (placeholder.trim()) data.placeholder = placeholder.trim()

    if (HAS_OPTIONS.has(fieldType) && options.trim()) {
      data.options = options.split(',').map((o) => o.trim()).filter(Boolean)
    }

    if (['rating', 'nps', 'slider', 'likert'].includes(fieldType)) {
      data.metadata = { min: sliderMin, max: sliderMax }
    }

    onSave(data)
  }

  return (
    <form onSubmit={handleSubmit} className="p-4 bg-gray-50 dark:bg-gray-950 rounded-[10px] mb-4 space-y-3">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${TYPE_COLORS[typeInfo?.category ?? 'Basic']}`}>
            {typeInfo?.label ?? fieldType}
          </span>
          <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            {initialData ? 'Edit Field' : 'New Field'}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Input
          label="Label *"
          placeholder="e.g. Full Name"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          autoFocus
          required
        />
        <Input
          label="Placeholder"
          placeholder="e.g. Enter your name"
          value={placeholder}
          onChange={(e) => setPlaceholder(e.target.value)}
        />
      </div>

      <Input
        label="Help text / description"
        placeholder="Optional help text shown below the field"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />

      {HAS_OPTIONS.has(fieldType) && (
        <Input
          label="Options (comma-separated)"
          placeholder="e.g. Option A, Option B, Option C"
          value={options}
          onChange={(e) => setOptions(e.target.value)}
        />
      )}

      {['rating', 'nps', 'slider', 'likert'].includes(fieldType) && (
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Min value"
            type="number"
            value={String(sliderMin)}
            onChange={(e) => setSliderMin(Number(e.target.value))}
          />
          <Input
            label="Max value"
            type="number"
            value={String(sliderMax)}
            onChange={(e) => setSliderMax(Number(e.target.value))}
          />
        </div>
      )}

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="field-required"
            checked={required}
            onChange={(e) => setRequired(e.target.checked)}
            className="rounded border-gray-300 dark:border-gray-600 text-[#51459d] focus:ring-[#51459d]/30"
          />
          <label htmlFor="field-required" className="text-sm text-gray-700 dark:text-gray-300">Required</label>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-700 dark:text-gray-300">Page</label>
          <input
            type="number"
            min={1}
            value={pageNumber}
            onChange={(e) => setPageNumber(Number(e.target.value))}
            className="w-16 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-1 text-sm"
          />
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-1">
        <Button variant="ghost" size="sm" type="button" onClick={onCancel}>Cancel</Button>
        <Button size="sm" type="submit">{initialData ? 'Update' : 'Add'} Field</Button>
      </div>
    </form>
  )
}

// ── Main FormBuilder ─────────────────────────────────────────────────────────

export default function FormBuilder() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: form, isLoading } = useForm(id ?? '')
  const updateForm = useUpdateForm()
  const bulkUpdate = useBulkUpdateFields()
  const saveLogicRules = useSaveLogicRules()
  const saveTheme = useSaveTheme()

  // Settings state
  const [editTitle, setEditTitle] = useState('')
  const [editDesc, setEditDesc] = useState('')
  const [settingsInit, setSettingsInit] = useState(false)

  // UI state
  const [showSharing, setShowSharing] = useState(false)
  const [showGallery, setShowGallery] = useState(false)
  const [editingField, setEditingField] = useState<FormField | null>(null)
  const [addingFieldType, setAddingFieldType] = useState<FieldType | null>(null)
  const [activeTab, setActiveTab] = useState<'fields' | 'logic' | 'settings' | 'theme' | 'versions' | 'approvals' | 'translate' | 'consent' | 'automations' | 'accessibility' | 'compliance'>('fields')
  const [showAIGenerator, setShowAIGenerator] = useState(false)
  const [showScheduleDialog, setShowScheduleDialog] = useState(false)

  // Conditional logic
  const [conditionalRules, setConditionalRules] = useState<ConditionalRule[]>([])

  // Thank you page
  const [thankYouConfig, setThankYouConfig] = useState<ThankYouConfig | undefined>(undefined)
  // Notification settings
  const [notificationConfig, setNotificationConfig] = useState<NotificationConfig | undefined>(undefined)

  // Local fields state for drag-and-drop
  const [localFields, setLocalFields] = useState<FormField[]>([])
  const [fieldsInit, setFieldsInit] = useState(false)

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  // Initialize state from form data
  if (form && !settingsInit) {
    setEditTitle(form.title)
    setEditDesc(form.description ?? '')
    setSettingsInit(true)
  }
  if (form?.fields && !fieldsInit) {
    setLocalFields([...form.fields].sort((a, b) => a.order - b.order))
    setFieldsInit(true)
  }

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    setLocalFields((prev) => {
      const oldIndex = prev.findIndex((f) => f.id === active.id)
      const newIndex = prev.findIndex((f) => f.id === over.id)
      const reordered = arrayMove(prev, oldIndex, newIndex)
      // Persist reorder via bulk update
      if (id) {
        bulkUpdate.mutate({
          form_id: id,
          fields: reordered.map((f, idx) => ({
            label: f.label,
            field_type: f.field_type,
            options: f.options ?? undefined,
            is_required: f.is_required,
            order: idx,
            page_number: f.page_number,
            description: f.description ?? undefined,
            placeholder: f.placeholder ?? undefined,
            metadata: f.metadata ?? undefined,
            validation_rules: f.validation_rules ?? undefined,
          })),
        })
      }
      return reordered
    })
  }, [id, bulkUpdate])

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

  function handleAddField(data: {
    label: string
    field_type: FieldType
    options?: string[]
    is_required: boolean
    description?: string
    placeholder?: string
    page_number: number
    metadata?: Record<string, unknown>
  }) {
    if (!id) return
    const newFields = [
      ...localFields.map((f, idx) => ({
        label: f.label,
        field_type: f.field_type,
        options: f.options ?? undefined,
        is_required: f.is_required,
        order: idx,
        page_number: f.page_number,
        description: f.description ?? undefined,
        placeholder: f.placeholder ?? undefined,
        metadata: f.metadata ?? undefined,
        validation_rules: f.validation_rules ?? undefined,
      })),
      {
        ...data,
        order: localFields.length,
      },
    ]

    bulkUpdate.mutate(
      { form_id: id, fields: newFields },
      {
        onSuccess: () => {
          toast('success', 'Field added')
          setShowGallery(false)
          setAddingFieldType(null)
          setFieldsInit(false) // Re-sync from server
        },
        onError: () => toast('error', 'Failed to add field'),
      }
    )
  }

  function handleRemoveField(fieldId: string) {
    if (!id) return
    const remaining = localFields.filter((f) => f.id !== fieldId)
    setLocalFields(remaining)
    bulkUpdate.mutate(
      {
        form_id: id,
        fields: remaining.map((f, idx) => ({
          label: f.label,
          field_type: f.field_type,
          options: f.options ?? undefined,
          is_required: f.is_required,
          order: idx,
          page_number: f.page_number,
          description: f.description ?? undefined,
          placeholder: f.placeholder ?? undefined,
          metadata: f.metadata ?? undefined,
          validation_rules: f.validation_rules ?? undefined,
        })),
      },
      {
        onSuccess: () => toast('success', 'Field removed'),
        onError: () => toast('error', 'Failed to remove field'),
      }
    )
  }

  function handleSaveLogicRules(rules: ConditionalRule[]) {
    if (!id) return
    setConditionalRules(rules)
    saveLogicRules.mutate(
      { formId: id, rules: rules as unknown as Record<string, unknown>[] },
      {
        onSuccess: () => toast('success', 'Logic rules saved'),
        onError: () => toast('error', 'Failed to save logic rules'),
      }
    )
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
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Form not found</h2>
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
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{form.title}</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Form Builder
              <span className="mx-1.5 text-gray-300">|</span>
              <span className={form.is_published ? 'text-[#6fd943]' : 'text-gray-400'}>
                {form.is_published ? 'Published' : 'Draft'}
              </span>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowAIGenerator(true)}
            style={{ borderColor: '#3ec9d6', color: '#3ec9d6' }}
          >
            ✨ AI Generate
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowSharing(true)}>
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
            Share
          </Button>
          <Button variant="outline" size="sm" onClick={() => navigate(`/forms/${id}/responses`)}>
            Responses
          </Button>
          <Button variant="outline" size="sm" onClick={() => navigate(`/forms/${id}/analytics`)}>
            Analytics
          </Button>
          <Button variant="outline" size="sm" onClick={() => navigate(`/forms/${id}/submit?sandbox=true`)}>
            Preview
          </Button>
        </div>
      </div>

      {/* Tab Bar */}
      <div className="flex flex-wrap gap-1 bg-gray-100 dark:bg-gray-900 rounded-[10px] p-1">
        {(
          [
            { key: 'fields', label: `Fields (${localFields.length})` },
            { key: 'logic', label: 'Logic' },
            { key: 'settings', label: 'Settings' },
            { key: 'theme', label: 'Theme' },
            { key: 'versions', label: 'Versions' },
            { key: 'approvals', label: 'Approvals' },
            { key: 'translate', label: 'Translate' },
            { key: 'consent', label: 'Consent' },
            { key: 'automations', label: 'Automations' },
            { key: 'accessibility', label: 'Accessibility' },
            { key: 'compliance', label: 'Compliance' },
          ] as const
        ).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
              activeTab === key
                ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 shadow-sm'
                : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── Fields Tab ──────────────────────────────────────────────────── */}
      {activeTab === 'fields' && (
        <div className="space-y-4">
          <Card>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                Form Fields
              </h2>
              <Button size="sm" variant="outline" onClick={() => setShowGallery(!showGallery)}>
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add Field
              </Button>
            </div>

            {/* Field Type Gallery */}
            {showGallery && !addingFieldType && (
              <FieldTypeGallery
                onSelect={(type) => setAddingFieldType(type)}
                onClose={() => setShowGallery(false)}
              />
            )}

            {/* Field Editor (for new field) */}
            {addingFieldType && (
              <FieldEditor
                fieldType={addingFieldType}
                onSave={handleAddField}
                onCancel={() => { setAddingFieldType(null); setShowGallery(false) }}
              />
            )}

            {/* Field Editor (for editing existing field) */}
            {editingField && (
              <FieldEditor
                fieldType={editingField.field_type}
                initialData={editingField}
                onSave={(data) => {
                  // Update field in place
                  if (!id) return
                  const updated = localFields.map((f) =>
                    f.id === editingField.id ? { ...f, ...data } : f
                  )
                  setLocalFields(updated)
                  bulkUpdate.mutate(
                    {
                      form_id: id,
                      fields: updated.map((f, idx) => ({
                        label: f.label,
                        field_type: f.field_type,
                        options: f.options ?? undefined,
                        is_required: f.is_required,
                        order: idx,
                        page_number: f.page_number,
                        description: f.description ?? undefined,
                        placeholder: f.placeholder ?? undefined,
                        metadata: f.metadata ?? undefined,
                        validation_rules: f.validation_rules ?? undefined,
                      })),
                    },
                    {
                      onSuccess: () => {
                        toast('success', 'Field updated')
                        setEditingField(null)
                        setFieldsInit(false)
                      },
                    }
                  )
                }}
                onCancel={() => setEditingField(null)}
              />
            )}

            {/* Sortable Fields List */}
            {localFields.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <svg className="h-10 w-10 mx-auto mb-3 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                </svg>
                <p className="text-sm">No fields yet. Click "Add Field" to get started.</p>
                <p className="text-xs text-gray-300 mt-1">Choose from 30+ field types including ERP data pickers</p>
              </div>
            ) : (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={localFields.map((f) => f.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-2">
                    {localFields.map((field, idx) => (
                      <SortableFieldItem
                        key={field.id}
                        field={field}
                        index={idx}
                        onRemove={handleRemoveField}
                        onEdit={setEditingField}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            )}
          </Card>
        </div>
      )}

      {/* ── Logic Tab ───────────────────────────────────────────────────── */}
      {activeTab === 'logic' && (
        <Card>
          {localFields.length >= 2 ? (
            <div>
              <ConditionalLogicBuilder
                fields={localFields}
                rules={conditionalRules}
                onChange={(rules) => handleSaveLogicRules(rules)}
              />
              <p className="text-xs text-gray-400 mt-3">
                Logic rules are now persisted to the server and enforced during submission.
              </p>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-400">
              <p className="text-sm">Add at least 2 fields to configure conditional logic.</p>
            </div>
          )}
        </Card>
      )}

      {/* ── Settings Tab ────────────────────────────────────────────────── */}
      {activeTab === 'settings' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-4">Form Settings</h2>
            <div className="space-y-3">
              <Input
                label="Title"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
              />
              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Description</label>
                <textarea
                  className="w-full rounded-[10px] border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-[#51459d]/30 focus:border-[#51459d] placeholder:text-gray-400 resize-none"
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
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">Publish</h2>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  {form.is_published ? 'Form is live' : 'Form is in draft'}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {form.is_published ? 'Accepting responses' : 'Not accepting responses'}
                </p>
              </div>
              <button
                onClick={handleTogglePublish}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  form.is_published ? 'bg-[#6fd943]' : 'bg-gray-200 dark:bg-gray-700'
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

          <Card>
            <ResponseNotificationSettings
              config={notificationConfig}
              onChange={setNotificationConfig}
              emailFieldIds={
                localFields
                  .filter((f) => f.field_type === 'email')
                  .map((f) => ({ id: f.id, label: f.label }))
              }
            />
          </Card>

          <Card>
            <ThankYouPageEditor config={thankYouConfig} onChange={setThankYouConfig} />
          </Card>
        </div>
      )}

      {/* ── Theme Tab ───────────────────────────────────────────────────── */}
      {activeTab === 'theme' && id && (
        <Card>
          <FormThemeEditor
            formId={id}
            currentTheme={(form?.settings?.theme as Record<string, unknown> | undefined)}
            onSaved={() => toast('success', 'Theme saved')}
          />
        </Card>
      )}

      {/* ── Versions Tab ─────────────────────────────────────────────────── */}
      {activeTab === 'versions' && id && (
        <Card>
          <FormVersionHistory formId={id} onRestored={() => { window.location.reload() }} />
        </Card>
      )}

      {/* ── Approvals Tab ────────────────────────────────────────────────── */}
      {activeTab === 'approvals' && id && (
        <div className="space-y-4">
          <Card>
            <FormApprovalWorkflowBuilder formId={id} />
          </Card>
          <Card>
            <div className="mb-3">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Response Queue</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Review and approve submitted responses</p>
            </div>
            <ResponseApprovalQueue formId={id} />
          </Card>
        </div>
      )}

      {/* ── Translate Tab ────────────────────────────────────────────────── */}
      {activeTab === 'translate' && id && (
        <Card>
          <FormTranslationEditor formId={id} />
        </Card>
      )}

      {/* ── Consent Tab ──────────────────────────────────────────────────── */}
      {activeTab === 'consent' && id && (
        <Card>
          <FormConsentManager formId={id} />
        </Card>
      )}

      {/* ── Automations Tab ──────────────────────────────────────────────── */}
      {activeTab === 'automations' && id && (
        <Card>
          <FormAutomationBuilder formId={id} />
        </Card>
      )}

      {/* ── Accessibility Tab ────────────────────────────────────────────── */}
      {activeTab === 'accessibility' && id && (
        <Card>
          <FormAccessibilityChecker formId={id} />
        </Card>
      )}

      {/* ── Compliance Tab ───────────────────────────────────────────────── */}
      {activeTab === 'compliance' && id && (
        <Card>
          <FormComplianceDashboard
            formId={id}
            onNavigateToConsent={() => setActiveTab('consent')}
          />
        </Card>
      )}

      {/* Schedule Dialog */}
      {showScheduleDialog && id && (
        <FormScheduleDialog formId={id} onClose={() => setShowScheduleDialog(false)} />
      )}

      {/* AI Generator Dialog */}
      {showAIGenerator && (
        <AIFormGeneratorDialog
          onClose={() => setShowAIGenerator(false)}
          onFormGenerated={() => { setShowAIGenerator(false); window.location.reload() }}
        />
      )}

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
