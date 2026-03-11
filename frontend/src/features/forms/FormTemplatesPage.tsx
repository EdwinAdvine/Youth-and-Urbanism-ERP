import { useState } from 'react'
import { Card, Button, Spinner, Modal, Input, Badge, toast } from '../../components/ui'
import { useFormTemplates, useCreateFromTemplate, type FormTemplate } from '../../api/forms_ext'

export default function FormTemplatesPage() {
  const { data: templates, isLoading } = useFormTemplates()
  const createFromTemplate = useCreateFromTemplate()

  const [showModal, setShowModal] = useState(false)
  const [selected, setSelected] = useState<FormTemplate | null>(null)
  const [title, setTitle] = useState('')

  const openUse = (tmpl: FormTemplate) => {
    setSelected(tmpl)
    setTitle('')
    setShowModal(true)
  }

  const handleCreate = () => {
    if (!selected || !title.trim()) return toast('error', 'Title is required')
    createFromTemplate.mutate(
      { template_id: selected.id, title },
      {
        onSuccess: () => {
          toast('success', 'Form created from template')
          setShowModal(false)
        },
        onError: () => toast('error', 'Failed to create form'),
      }
    )
  }

  const categories = [...new Set((templates ?? []).map((t) => t.category).filter(Boolean))] as string[]
  const [filter, setFilter] = useState('')
  const filtered = (templates ?? []).filter((t) => !filter || t.category === filter)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Form Templates</h1>
          <p className="text-sm text-gray-500 mt-1">Start building forms from pre-made templates</p>
        </div>
      </div>

      {categories.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <Button size="sm" variant={!filter ? 'primary' : 'outline'} onClick={() => setFilter('')}>All</Button>
          {categories.map((c) => (
            <Button key={c} size="sm" variant={filter === c ? 'primary' : 'outline'} onClick={() => setFilter(c)}>
              {c}
            </Button>
          ))}
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-24"><Spinner size="lg" /></div>
      ) : filtered.length === 0 ? (
        <Card>
          <div className="text-center py-16 text-gray-400">No form templates available.</div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((tmpl) => (
            <Card key={tmpl.id} className="hover:shadow-md transition-shadow group">
              <div className="flex items-start gap-3 mb-3">
                <div className="w-10 h-10 rounded-[10px] bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-gray-900">{tmpl.name}</h3>
                  {tmpl.description && <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{tmpl.description}</p>}
                </div>
              </div>
              <div className="flex items-center gap-2 mb-3">
                {tmpl.category && <Badge variant="info">{tmpl.category}</Badge>}
                <Badge variant="default">{tmpl.fields_config.length} fields</Badge>
              </div>
              <div className="pt-3 border-t border-gray-100 dark:border-gray-800 flex justify-end">
                <Button size="sm" onClick={() => openUse(tmpl)}>Use Template</Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal open={showModal} onClose={() => setShowModal(false)} title={`Use "${selected?.name}"`}>
        <div className="space-y-4">
          <Input label="Form Title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="My new form" />
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button onClick={handleCreate} loading={createFromTemplate.isPending}>Create Form</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
