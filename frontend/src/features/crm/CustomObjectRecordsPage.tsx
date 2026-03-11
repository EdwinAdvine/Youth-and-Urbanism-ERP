import { useState } from 'react'
import {
  useCustomObject,
  useCustomObjectRecords,
  useCreateRecord,
  useUpdateRecord,
  useDeleteRecord,
  type CustomObjectDefinition,
  type CustomObjectRecord,
  type CustomObjectField,
} from '@/api/crm_custom_objects'
import { Button, Card, Spinner, Modal, Input, Select, Table, toast } from '@/components/ui'

function getDefinitionId(): string {
  const parts = window.location.pathname.split('/')
  const idx = parts.indexOf('custom-objects')
  return idx !== -1 && parts[idx + 1] ? parts[idx + 1] : ''
}

function DynamicFieldInput({
  field,
  value,
  onChange,
}: {
  field: CustomObjectField
  value: unknown
  onChange: (val: unknown) => void
}) {
  switch (field.type) {
    case 'number':
      return (
        <Input
          label={field.label}
          type="number"
          value={value != null ? String(value) : ''}
          onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
        />
      )
    case 'date':
      return (
        <Input
          label={field.label}
          type="date"
          value={value != null ? String(value) : ''}
          onChange={(e) => onChange(e.target.value || null)}
        />
      )
    case 'boolean':
      return (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            {field.label}
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={!!value}
              onChange={(e) => onChange(e.target.checked)}
              className="rounded border-gray-300 text-[#51459d] focus:ring-[#51459d]"
            />
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {value ? 'Yes' : 'No'}
            </span>
          </label>
        </div>
      )
    case 'select':
      return (
        <Select
          label={field.label}
          value={value != null ? String(value) : ''}
          onChange={onChange}
          options={[
            { value: '', label: '-- Select --' },
            ...(field.options ?? []).map((o) => ({ value: o, label: o })),
          ]}
        />
      )
    case 'email':
      return (
        <Input
          label={field.label}
          type="email"
          value={value != null ? String(value) : ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder="email@example.com"
        />
      )
    case 'phone':
      return (
        <Input
          label={field.label}
          type="tel"
          value={value != null ? String(value) : ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder="+1 (555) 000-0000"
        />
      )
    case 'url':
      return (
        <Input
          label={field.label}
          type="url"
          value={value != null ? String(value) : ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder="https://"
        />
      )
    default:
      return (
        <Input
          label={field.label}
          value={value != null ? String(value) : ''}
          onChange={(e) => onChange(e.target.value)}
        />
      )
  }
}

export default function CustomObjectRecordsPage() {
  const definitionId = getDefinitionId()
  const { data: definition, isLoading: defLoading } = useCustomObject(definitionId)
  const { data: recordsData, isLoading: recsLoading } = useCustomObjectRecords(definitionId)
  const createRecord = useCreateRecord()
  const updateRecord = useUpdateRecord()
  const deleteRecord = useDeleteRecord()

  const [modalOpen, setModalOpen] = useState(false)
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null)
  const [formData, setFormData] = useState<Record<string, unknown>>({})

  const def: CustomObjectDefinition | null = definition ?? null
  const records: CustomObjectRecord[] = recordsData?.items ?? recordsData ?? []
  const fields: CustomObjectField[] = def?.fields ?? []

  const isLoading = defLoading || recsLoading

  function openCreate() {
    setEditingRecordId(null)
    const initial: Record<string, unknown> = {}
    for (const f of fields) {
      initial[f.name] = f.type === 'boolean' ? false : ''
    }
    setFormData(initial)
    setModalOpen(true)
  }

  function openEdit(record: CustomObjectRecord) {
    setEditingRecordId(record.id)
    setFormData(record.data ?? {})
    setModalOpen(true)
  }

  async function handleSave() {
    // Validate required fields
    for (const f of fields) {
      if (f.required && (formData[f.name] == null || formData[f.name] === '')) {
        toast.error(`"${f.label}" is required`)
        return
      }
    }

    try {
      if (editingRecordId) {
        await updateRecord.mutateAsync({
          objectId: definitionId,
          recordId: editingRecordId,
          data: formData,
        })
        toast.success('Record updated')
      } else {
        await createRecord.mutateAsync({
          objectId: definitionId,
          data: formData,
        })
        toast.success('Record created')
      }
      setModalOpen(false)
    } catch {
      toast.error('Failed to save record')
    }
  }

  async function handleDelete(recordId: string) {
    if (!confirm('Delete this record?')) return
    try {
      await deleteRecord.mutateAsync({ objectId: definitionId, recordId })
      toast.success('Record deleted')
    } catch {
      toast.error('Failed to delete record')
    }
  }

  // Build dynamic columns from fields
  const columns = [
    ...fields.slice(0, 6).map((f) => ({
      key: f.name,
      label: f.label,
      render: (row: CustomObjectRecord) => {
        const val = row.data?.[f.name]
        if (f.type === 'boolean') return val ? 'Yes' : 'No'
        if (val == null) return <span className="text-gray-400">---</span>
        return <span className="text-sm text-gray-800 dark:text-gray-200">{String(val)}</span>
      },
    })),
    {
      key: 'actions',
      label: 'Actions',
      render: (row: CustomObjectRecord) => (
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={(e: React.MouseEvent) => {
              e.stopPropagation()
              openEdit(row)
            }}
          >
            Edit
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="text-[#ff3a6e] hover:text-[#ff3a6e]"
            onClick={(e: React.MouseEvent) => {
              e.stopPropagation()
              handleDelete(row.id)
            }}
          >
            Delete
          </Button>
        </div>
      ),
    },
  ]

  if (!definitionId) {
    return (
      <div className="p-6">
        <p className="text-gray-500">No custom object definition ID provided.</p>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {def?.plural_label ?? def?.label ?? 'Records'}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {def?.description ?? `Browse and manage ${def?.label ?? 'custom object'} records`}
          </p>
        </div>
        <Button onClick={openCreate} disabled={!def}>
          + New Record
        </Button>
      </div>

      <Card padding={false}>
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Spinner />
          </div>
        ) : fields.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-500">
              No fields defined for this object. Add fields in the object definition first.
            </p>
          </div>
        ) : (
          <Table
            columns={columns}
            data={records}
            loading={isLoading}
            emptyText={`No ${def?.label ?? 'custom object'} records yet`}
            keyExtractor={(row) => row.id}
          />
        )}
      </Card>

      {/* Create / Edit Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingRecordId ? `Edit ${def?.label ?? 'Record'}` : `New ${def?.label ?? 'Record'}`}
      >
        <div className="space-y-4 max-h-[70vh] overflow-y-auto">
          {fields.map((field) => (
            <div key={field.name}>
              <DynamicFieldInput
                field={field}
                value={formData[field.name]}
                onChange={(val) =>
                  setFormData((prev) => ({ ...prev, [field.name]: val }))
                }
              />
              {field.required && (
                <p className="text-[10px] text-[#ff3a6e] mt-0.5">* Required</p>
              )}
            </div>
          ))}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              loading={createRecord.isPending || updateRecord.isPending}
            >
              {editingRecordId ? 'Update' : 'Create'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
