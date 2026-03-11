import { useState } from 'react'
import {
  Button, Badge, Card, Table, Modal, Input, Select, Spinner, toast,
} from '../../components/ui'
import {
  useAITemplates,
  useCreateAITemplate,
  useUpdateAITemplate,
  useDeleteAITemplate,
  type AIPromptTemplate,
} from '../../api/ai_ext'

const CATEGORY_OPTIONS = [
  { value: '', label: 'All Categories' },
  { value: 'general', label: 'General' },
  { value: 'finance', label: 'Finance' },
  { value: 'hr', label: 'HR' },
  { value: 'crm', label: 'CRM' },
  { value: 'support', label: 'Support' },
  { value: 'inventory', label: 'Inventory' },
  { value: 'projects', label: 'Projects' },
]

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}

interface FormState {
  name: string
  category: string
  description: string
  prompt: string
  variables: string
  is_public: boolean
}

const emptyForm: FormState = { name: '', category: 'general', description: '', prompt: '', variables: '', is_public: false }

export default function PromptTemplatesPage() {
  const { data: templates, isLoading } = useAITemplates()
  const createTemplate = useCreateAITemplate()
  const updateTemplate = useUpdateAITemplate()
  const deleteTemplate = useDeleteAITemplate()

  const [filter, setFilter] = useState('')
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm)

  const filtered = (templates ?? []).filter((t) => {
    if (filter && t.category !== filter) return false
    if (search && !t.name.toLowerCase().includes(search.toLowerCase()) && !t.description?.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const openCreate = () => {
    setEditId(null)
    setForm(emptyForm)
    setShowModal(true)
  }

  const openEdit = (tpl: AIPromptTemplate) => {
    setEditId(tpl.id)
    setForm({
      name: tpl.name,
      category: tpl.category ?? 'general',
      description: tpl.description ?? '',
      prompt: tpl.prompt,
      variables: tpl.variables.join(', '),
      is_public: tpl.is_public,
    })
    setShowModal(true)
  }

  const handleSave = () => {
    if (!form.name.trim()) return toast('error', 'Template name is required')
    if (!form.prompt.trim()) return toast('error', 'Template content is required')
    const vars = form.variables.split(',').map((v) => v.trim()).filter(Boolean)

    if (editId) {
      updateTemplate.mutate(
        { id: editId, name: form.name, category: form.category, description: form.description, prompt: form.prompt, variables: vars, is_public: form.is_public },
        {
          onSuccess: () => { toast('success', 'Template updated'); setShowModal(false) },
          onError: () => toast('error', 'Failed to update template'),
        }
      )
    } else {
      createTemplate.mutate(
        { name: form.name, category: form.category, description: form.description, prompt: form.prompt, variables: vars, is_public: form.is_public },
        {
          onSuccess: () => { toast('success', 'Template created'); setShowModal(false) },
          onError: () => toast('error', 'Failed to create template'),
        }
      )
    }
  }

  const handleDelete = (id: string) => {
    if (!confirm('Delete this template?')) return
    deleteTemplate.mutate(id, {
      onSuccess: () => toast('success', 'Template deleted'),
      onError: () => toast('error', 'Failed to delete template'),
    })
  }

  const columns = [
    {
      key: 'name',
      label: 'Name',
      render: (row: AIPromptTemplate) => (
        <button className="text-primary font-medium hover:underline" onClick={() => openEdit(row)}>
          {row.name}
        </button>
      ),
    },
    {
      key: 'category',
      label: 'Category',
      render: (row: AIPromptTemplate) => (
        <Badge variant="primary">{row.category ?? 'general'}</Badge>
      ),
    },
    {
      key: 'description',
      label: 'Description',
      render: (row: AIPromptTemplate) => (
        <span className="text-gray-500 text-xs truncate max-w-[250px] block">{row.description}</span>
      ),
    },
    {
      key: 'variables',
      label: 'Variables',
      render: (row: AIPromptTemplate) => (
        <div className="flex gap-1 flex-wrap">
          {row.variables.slice(0, 3).map((v) => (
            <Badge key={v} variant="default" className="text-[10px]">{`{{${v}}}`}</Badge>
          ))}
          {row.variables.length > 3 && (
            <Badge variant="default" className="text-[10px]">+{row.variables.length - 3}</Badge>
          )}
        </div>
      ),
    },
    {
      key: 'updated_at',
      label: 'Updated',
      render: (row: AIPromptTemplate) => <span className="text-gray-400 text-xs">{formatDate(row.updated_at)}</span>,
    },
    {
      key: 'actions',
      label: '',
      render: (row: AIPromptTemplate) => (
        <div className="flex gap-2 justify-end">
          <Button size="sm" variant="ghost" onClick={() => openEdit(row)}>Edit</Button>
          <Button size="sm" variant="ghost" className="text-red-500" onClick={() => handleDelete(row.id)}>Delete</Button>
        </div>
      ),
    },
  ]

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Prompt Templates</h1>
          <p className="text-sm text-gray-500 mt-1">Manage reusable AI prompt templates</p>
        </div>
        <Button onClick={openCreate}>New Template</Button>
      </div>

      <Card className="mb-6">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[200px]">
            <Input label="Search" placeholder="Search templates..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="w-48">
            <Select label="Category" options={CATEGORY_OPTIONS} value={filter} onChange={(e) => setFilter(e.target.value)} />
          </div>
        </div>
      </Card>

      <Card padding={false}>
        <Table<AIPromptTemplate>
          columns={columns}
          data={filtered}
          loading={isLoading}
          emptyText="No templates found"
          keyExtractor={(row) => row.id}
        />
      </Card>

      <Modal open={showModal} onClose={() => setShowModal(false)} title={editId ? 'Edit Template' : 'Create Template'} size="xl">
        <div className="space-y-4">
          <Input label="Template Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g., Revenue Report Generator" />
          <div className="grid grid-cols-2 gap-4">
            <Select label="Category" options={CATEGORY_OPTIONS.filter((o) => o.value !== '')} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
            <Input label="Variables (comma-separated)" value={form.variables} onChange={(e) => setForm({ ...form, variables: e.target.value })} placeholder="period, recipient, subject" />
          </div>
          <Input label="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Brief description" />
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Template Content</label>
            <textarea
              className="w-full rounded-[10px] border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary min-h-[160px] font-mono"
              value={form.prompt}
              onChange={(e) => setForm({ ...form, prompt: e.target.value })}
              placeholder="Write your prompt template here. Use {{variable_name}} for dynamic values..."
            />
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.is_public} onChange={(e) => setForm({ ...form, is_public: e.target.checked })} className="rounded border-gray-300 text-primary" />
            <span className="text-sm text-gray-700 dark:text-gray-300">Make public (visible to all users)</span>
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button onClick={handleSave} loading={createTemplate.isPending || updateTemplate.isPending}>
              {editId ? 'Update' : 'Create'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
