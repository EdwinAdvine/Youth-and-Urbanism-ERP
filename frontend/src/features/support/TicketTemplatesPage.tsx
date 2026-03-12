import { useState } from 'react'
import { Button, Spinner, Badge, Card, Modal, Input, toast } from '../../components/ui'
import {
  useTicketTemplates,
  useCreateTemplate,
  useUpdateTemplate,
  useDeleteTemplate,
  type TicketTemplate,
  type CreateTemplatePayload,
} from '../../api/support_phase1'
import { useTicketCategories } from '../../api/support'

const PRIORITY_OPTIONS = ['low', 'medium', 'high', 'urgent']

const EMPTY_FORM: CreateTemplatePayload = {
  name: '',
  default_subject: '',
  default_priority: 'medium',
  default_category_id: '',
  is_active: true,
}

const priorityVariant = (p: string | null): 'default' | 'success' | 'warning' | 'danger' | 'primary' => {
  switch (p) {
    case 'urgent': return 'danger'
    case 'high': return 'warning'
    case 'medium': return 'primary'
    case 'low': return 'success'
    default: return 'default'
  }
}

export default function TicketTemplatesPage() {
  const { data: templates, isLoading, error } = useTicketTemplates()
  const { data: categories } = useTicketCategories()
  const createTemplate = useCreateTemplate()
  const updateTemplate = useUpdateTemplate()
  const deleteTemplate = useDeleteTemplate()

  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<TicketTemplate | null>(null)
  const [form, setForm] = useState<CreateTemplatePayload>(EMPTY_FORM)

  const resetForm = () => {
    setForm(EMPTY_FORM)
    setEditing(null)
    setShowModal(false)
  }

  const handleEdit = (t: TicketTemplate) => {
    setEditing(t)
    setForm({
      name: t.name,
      default_subject: t.default_subject || '',
      default_priority: t.default_priority || 'medium',
      default_category_id: t.default_category_id || '',
      is_active: t.is_active,
    })
    setShowModal(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) return
    try {
      const payload = { ...form }
      if (!payload.default_category_id) delete payload.default_category_id
      if (editing) {
        await updateTemplate.mutateAsync({ id: editing.id, ...payload })
        toast('success', 'Template updated')
      } else {
        await createTemplate.mutateAsync(payload)
        toast('success', 'Template created')
      }
      resetForm()
    } catch {
      toast('error', 'Failed to save template')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this template?')) return
    try {
      await deleteTemplate.mutateAsync(id)
      toast('success', 'Template deleted')
    } catch {
      toast('error', 'Failed to delete template')
    }
  }

  if (error) return <div className="p-6 text-[#ff3a6e]">Failed to load ticket templates</div>

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Spinner size="lg" />
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Ticket Templates</h1>
          <p className="text-sm text-gray-500 mt-1">Predefined templates for quick ticket creation</p>
        </div>
        <Button onClick={() => { resetForm(); setShowModal(true) }}>New Template</Button>
      </div>

      {(!templates || templates.length === 0) ? (
        <Card>
          <div className="text-center py-12 text-gray-400">
            <p className="text-lg font-medium">No templates yet</p>
            <p className="text-sm mt-1">Create your first ticket template to get started.</p>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map((t) => (
            <Card key={t.id}>
              <div className="flex items-start justify-between mb-3">
                <h3 className="font-semibold text-gray-900 text-base">{t.name}</h3>
                <Badge variant={t.is_active ? 'success' : 'default'}>
                  {t.is_active ? 'Active' : 'Inactive'}
                </Badge>
              </div>

              {t.default_priority && (
                <div className="mb-2">
                  <Badge variant={priorityVariant(t.default_priority)}>
                    {t.default_priority.charAt(0).toUpperCase() + t.default_priority.slice(1)}
                  </Badge>
                </div>
              )}

              {t.default_subject && (
                <p className="text-sm text-gray-600 truncate mb-4">
                  Subject: {t.default_subject}
                </p>
              )}

              {!t.default_subject && (
                <p className="text-sm text-gray-400 mb-4">No default subject</p>
              )}

              <div className="flex gap-2 pt-2 border-t border-gray-100">
                <Button size="sm" variant="ghost" onClick={() => handleEdit(t)}>
                  Edit
                </Button>
                <Button size="sm" variant="danger" onClick={() => handleDelete(t.id)}>
                  Delete
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal open={showModal} onClose={resetForm} title={editing ? 'Edit Template' : 'New Template'} size="lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Template Name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
            placeholder="e.g. Bug Report"
          />

          <Input
            label="Default Subject"
            value={form.default_subject || ''}
            onChange={(e) => setForm({ ...form, default_subject: e.target.value })}
            placeholder="e.g. [Bug] ..."
          />

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Default Priority</label>
              <select
                value={form.default_priority || 'medium'}
                onChange={(e) => setForm({ ...form, default_priority: e.target.value })}
                className="w-full rounded-[10px] border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#51459d]/30"
              >
                {PRIORITY_OPTIONS.map((p) => (
                  <option key={p} value={p}>
                    {p.charAt(0).toUpperCase() + p.slice(1)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
              <select
                value={form.default_category_id || ''}
                onChange={(e) => setForm({ ...form, default_category_id: e.target.value })}
                className="w-full rounded-[10px] border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#51459d]/30"
              >
                <option value="">No category</option>
                {(categories ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="template-active"
              checked={form.is_active ?? true}
              onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
              className="rounded border-gray-300 text-[#51459d] focus:ring-[#51459d]"
            />
            <label htmlFor="template-active" className="text-sm text-gray-700">
              Active
            </label>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button variant="ghost" type="button" onClick={resetForm}>
              Cancel
            </Button>
            <Button type="submit" loading={createTemplate.isPending || updateTemplate.isPending}>
              {editing ? 'Update' : 'Create'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
