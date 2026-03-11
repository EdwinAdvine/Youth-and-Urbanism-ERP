import { useState } from 'react'
import { Card, Button, Spinner, Modal, Input, Badge, toast } from '../../components/ui'
import { useDocTemplates, useCreateFromTemplate, type DocumentTemplate } from '../../api/docs_ext'

const TYPE_ICONS: Record<string, string> = {
  docx: 'W',
  xlsx: 'X',
  pptx: 'P',
}

const TYPE_COLORS: Record<string, string> = {
  docx: 'bg-blue-500',
  xlsx: 'bg-green-500',
  pptx: 'bg-orange-500',
}

export default function TemplateGalleryPage() {
  const { data: templates, isLoading } = useDocTemplates()
  const createFromTemplate = useCreateFromTemplate()

  const [showModal, setShowModal] = useState(false)
  const [selected, setSelected] = useState<DocumentTemplate | null>(null)
  const [filename, setFilename] = useState('')
  const [filter, setFilter] = useState<string>('')

  const openUse = (tmpl: DocumentTemplate) => {
    setSelected(tmpl)
    setFilename('')
    setShowModal(true)
  }

  const handleCreate = () => {
    if (!selected || !filename.trim()) return toast('error', 'Filename is required')
    createFromTemplate.mutate(
      { template_id: selected.id, filename },
      {
        onSuccess: () => {
          toast('success', 'Document created from template')
          setShowModal(false)
        },
        onError: () => toast('error', 'Failed to create document'),
      }
    )
  }

  const filtered = (templates ?? []).filter((t) => {
    if (!filter) return true
    return t.doc_type === filter || t.category === filter
  })

  const categories = [...new Set((templates ?? []).map((t) => t.category).filter(Boolean))] as string[]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Document Templates</h1>
          <p className="text-sm text-gray-500 mt-1">Start from a template to save time</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <Button size="sm" variant={!filter ? 'primary' : 'outline'} onClick={() => setFilter('')}>All</Button>
        {['docx', 'xlsx', 'pptx'].map((t) => (
          <Button key={t} size="sm" variant={filter === t ? 'primary' : 'outline'} onClick={() => setFilter(t)}>
            {t.toUpperCase()}
          </Button>
        ))}
        {categories.map((c) => (
          <Button key={c} size="sm" variant={filter === c ? 'primary' : 'outline'} onClick={() => setFilter(c)}>
            {c}
          </Button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-24"><Spinner size="lg" /></div>
      ) : filtered.length === 0 ? (
        <Card>
          <div className="text-center py-16 text-gray-400">
            {templates?.length === 0 ? 'No document templates available.' : 'No templates match the selected filter.'}
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filtered.map((tmpl) => (
            <Card key={tmpl.id} className="hover:shadow-md transition-shadow cursor-pointer group" onClick={() => openUse(tmpl)}>
              <div className="flex flex-col items-center text-center">
                {tmpl.thumbnail_url ? (
                  <img src={tmpl.thumbnail_url} alt={tmpl.name} className="w-20 h-24 object-cover rounded mb-3 border border-gray-100 dark:border-gray-800" />
                ) : (
                  <div className={`w-20 h-24 ${TYPE_COLORS[tmpl.doc_type] ?? 'bg-gray-400'} rounded mb-3 flex items-center justify-center text-white text-2xl font-bold`}>
                    {TYPE_ICONS[tmpl.doc_type] ?? 'D'}
                  </div>
                )}
                <h3 className="text-sm font-semibold text-gray-700 truncate w-full">{tmpl.name}</h3>
                {tmpl.description && (
                  <p className="text-xs text-gray-400 mt-1 line-clamp-2">{tmpl.description}</p>
                )}
                <div className="flex items-center gap-2 mt-2">
                  <Badge variant="default">{tmpl.doc_type.toUpperCase()}</Badge>
                  {tmpl.category && <Badge variant="info">{tmpl.category}</Badge>}
                </div>
                <Button size="sm" variant="primary" className="mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
                  Use Template
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal open={showModal} onClose={() => setShowModal(false)} title={`Use "${selected?.name}"`}>
        <div className="space-y-4">
          <Input
            label="Document Name"
            value={filename}
            onChange={(e) => setFilename(e.target.value)}
            placeholder="My Document"
          />
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button onClick={handleCreate} loading={createFromTemplate.isPending}>Create</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
