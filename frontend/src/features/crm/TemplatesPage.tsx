import { useState } from 'react'
import {
  useTemplates,
  useCreateTemplate,
  useUpdateTemplate,
  useDeleteTemplate,
  usePreviewTemplate,
  type EmailTemplate,
  type TemplateCreatePayload,
} from '@/api/crm_v2'
import { Button, Badge, Card, Modal, Input, Select, Table, toast } from '@/components/ui'

const CATEGORIES = ['outreach', 'follow_up', 'nurture', 'announcement', 'transactional', 'other']

const EMPTY_FORM: TemplateCreatePayload = {
  name: '',
  subject: '',
  body_html: '',
  body_text: '',
  category: 'outreach',
  is_active: true,
}

export default function TemplatesPage() {
  const [categoryFilter, setCategoryFilter] = useState<string | undefined>(undefined)
  const [page, setPage] = useState(1)
  const { data, isLoading } = useTemplates(categoryFilter, false, page)
  const createTemplate = useCreateTemplate()
  const updateTemplate = useUpdateTemplate()
  const deleteTemplate = useDeleteTemplate()
  const previewTemplate = usePreviewTemplate()

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<EmailTemplate | null>(null)
  const [form, setForm] = useState<TemplateCreatePayload>(EMPTY_FORM)

  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewHtml, setPreviewHtml] = useState('')
  const [previewSubject, setPreviewSubject] = useState('')

  const templates: EmailTemplate[] = data?.items ?? data ?? []

  const openCreate = () => {
    setEditing(null)
    setForm(EMPTY_FORM)
    setModalOpen(true)
  }

  const openEdit = (tpl: EmailTemplate) => {
    setEditing(tpl)
    setForm({
      name: tpl.name,
      subject: tpl.subject,
      body_html: tpl.body_html,
      body_text: tpl.body_text ?? '',
      category: tpl.category,
      is_active: tpl.is_active,
    })
    setModalOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      if (editing) {
        await updateTemplate.mutateAsync({ id: editing.id, ...form })
        toast('success', 'Template updated')
      } else {
        await createTemplate.mutateAsync(form)
        toast('success', 'Template created')
      }
      setModalOpen(false)
    } catch {
      toast('error', 'Failed to save template')
    }
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this template?')) return
    try {
      await deleteTemplate.mutateAsync(id)
      toast('success', 'Template deleted')
    } catch {
      toast('error', 'Failed to delete template')
    }
  }

  const handlePreview = async (tpl: EmailTemplate) => {
    try {
      const result = await previewTemplate.mutateAsync({
        id: tpl.id,
        mergeData: { first_name: 'John', last_name: 'Doe', company: 'Acme Inc' },
      })
      setPreviewSubject(result?.subject ?? tpl.subject)
      setPreviewHtml(result?.body_html ?? tpl.body_html)
      setPreviewOpen(true)
    } catch {
      // Fallback: show raw template
      setPreviewSubject(tpl.subject)
      setPreviewHtml(tpl.body_html)
      setPreviewOpen(true)
    }
  }

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100">
            Email Templates
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Create and manage reusable email templates with merge fields
          </p>
        </div>
        <Button onClick={openCreate}>+ New Template</Button>
      </div>

      {/* Filter */}
      <div className="flex gap-3">
        <Select
          label="Category"
          value={categoryFilter ?? ''}
          onChange={(e) => { setCategoryFilter(e.target.value || undefined); setPage(1) }}
          options={[
            { value: '', label: 'All Categories' },
            ...CATEGORIES.map((c) => ({
              value: c,
              label: c.replace(/_/g, ' ').replace(/\b\w/g, (ch) => ch.toUpperCase()),
            })),
          ]}
        />
      </div>

      {/* Templates Table */}
      <Card padding={false}>
        <Table<EmailTemplate>
          loading={isLoading}
          data={templates}
          keyExtractor={(t) => t.id}
          emptyText="No templates yet."
          columns={[
            { key: 'name', label: 'Name', render: (t) => (
              <span className="font-medium text-gray-900 dark:text-gray-100">{t.name}</span>
            )},
            { key: 'subject', label: 'Subject', render: (t) => (
              <span className="text-sm text-gray-600 dark:text-gray-400 truncate max-w-[200px] block">{t.subject}</span>
            )},
            { key: 'category', label: 'Category', render: (t) => (
              <Badge variant="info">{t.category.replace(/_/g, ' ')}</Badge>
            )},
            { key: 'is_active', label: 'Status', render: (t) => (
              <Badge variant={t.is_active ? 'success' : 'default'}>
                {t.is_active ? 'Active' : 'Inactive'}
              </Badge>
            )},
            { key: 'updated_at', label: 'Updated', render: (t) => (
              <span className="text-xs text-gray-500">{new Date(t.updated_at).toLocaleDateString()}</span>
            )},
            { key: 'actions', label: '', render: (t) => (
              <div className="flex gap-2 justify-end">
                <Button size="sm" variant="ghost" onClick={() => handlePreview(t)} loading={previewTemplate.isPending}>
                  Preview
                </Button>
                <Button size="sm" variant="ghost" onClick={() => openEdit(t)}>Edit</Button>
                <Button size="sm" variant="danger" onClick={() => handleDelete(t.id)}>Delete</Button>
              </div>
            )},
          ]}
        />
      </Card>

      {/* Create / Edit Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit Template' : 'New Template'}
        size="xl"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Template Name"
              required
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Welcome Email"
            />
            <Select
              label="Category"
              value={form.category ?? 'outreach'}
              onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
              options={CATEGORIES.map((c) => ({
                value: c,
                label: c.replace(/_/g, ' ').replace(/\b\w/g, (ch) => ch.toUpperCase()),
              }))}
            />
          </div>
          <Input
            label="Subject Line"
            required
            value={form.subject}
            onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
            placeholder="e.g. Welcome to {{company}}, {{first_name}}!"
          />
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Body HTML
            </label>
            <p className="text-xs text-gray-400 mb-1">
              Use {'{{field_name}}'} for merge fields. Available: first_name, last_name, company, email
            </p>
            <textarea
              className="w-full rounded-[10px] border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              rows={8}
              value={form.body_html}
              onChange={(e) => setForm((f) => ({ ...f, body_html: e.target.value }))}
              required
            />
          </div>
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Plain Text (optional)
            </label>
            <textarea
              className="w-full rounded-[10px] border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              rows={4}
              value={form.body_text ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, body_text: e.target.value }))}
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
            <input
              type="checkbox"
              checked={form.is_active ?? true}
              onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
              className="rounded"
            />
            Active
          </label>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" type="button" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={createTemplate.isPending || updateTemplate.isPending}>
              {editing ? 'Save Changes' : 'Create Template'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Preview Modal */}
      <Modal open={previewOpen} onClose={() => setPreviewOpen(false)} title="Template Preview" size="xl">
        <div className="space-y-3">
          <div>
            <p className="text-xs text-gray-500">Subject</p>
            <p className="font-medium text-gray-900 dark:text-gray-100">{previewSubject}</p>
          </div>
          <div className="border border-gray-200 dark:border-gray-700 rounded-[10px] p-4 bg-white dark:bg-gray-900">
            <div
              className="prose prose-sm dark:prose-invert max-w-none"
              dangerouslySetInnerHTML={{ __html: previewHtml }}
            />
          </div>
          <div className="flex justify-end">
            <Button variant="secondary" onClick={() => setPreviewOpen(false)}>Close</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
