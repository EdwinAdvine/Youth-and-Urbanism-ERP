import { useState } from 'react'
import { Card, Button, Spinner, Modal, Input, Badge, toast } from '../../components/ui'
import { useNoteTemplates, useCreateNoteTemplate, type NoteTemplate } from '../../api/notes_ext'
import { useCreateNote } from '../../api/notes'

export default function NoteTemplatesPage() {
  const { data: templates, isLoading } = useNoteTemplates()
  const createTemplate = useCreateNoteTemplate()
  const createNote = useCreateNote()

  const [showCreate, setShowCreate] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [content, setContent] = useState('')
  const [category, setCategory] = useState('')

  const handleCreate = () => {
    if (!name.trim()) return toast('error', 'Name is required')
    if (!content.trim()) return toast('error', 'Content is required')
    createTemplate.mutate(
      { name, description: description || undefined, content, category: category || undefined },
      {
        onSuccess: () => {
          toast('success', 'Template created')
          setShowCreate(false)
          setName('')
          setDescription('')
          setContent('')
          setCategory('')
        },
        onError: () => toast('error', 'Failed to create template'),
      }
    )
  }

  const handleUseTemplate = (tmpl: NoteTemplate) => {
    createNote.mutate(
      { title: `${tmpl.name} - ${new Date().toLocaleDateString()}`, content: tmpl.content },
      {
        onSuccess: () => toast('success', 'Note created from template'),
        onError: () => toast('error', 'Failed to create note'),
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
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Note Templates</h1>
          <p className="text-sm text-gray-500 mt-1">Start from a template for common note types</p>
        </div>
        <Button onClick={() => setShowCreate(true)}>New Template</Button>
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
          <div className="text-center py-16 text-gray-400">No note templates. Create one to get started.</div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((tmpl) => (
            <Card key={tmpl.id} className="hover:shadow-md transition-shadow group">
              <div className="mb-3">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{tmpl.name}</h3>
                {tmpl.description && <p className="text-xs text-gray-500 mt-0.5">{tmpl.description}</p>}
              </div>
              <div className="bg-gray-50 dark:bg-gray-950 rounded-lg p-3 text-xs text-gray-600 dark:text-gray-400 line-clamp-4 font-mono whitespace-pre-wrap mb-3">
                {tmpl.content}
              </div>
              <div className="flex items-center justify-between">
                <div className="flex gap-2">
                  {tmpl.category && <Badge variant="info">{tmpl.category}</Badge>}
                </div>
                <Button
                  size="sm"
                  onClick={() => handleUseTemplate(tmpl)}
                  loading={createNote.isPending}
                >
                  Use Template
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="New Note Template" size="lg">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Template name" />
            <Input label="Category" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="e.g., Meeting Notes" />
          </div>
          <Input label="Description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What this template is for" />
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Content</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Template content..."
              className="w-full rounded-[10px] border border-gray-200 dark:border-gray-700 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary font-mono"
              rows={10}
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button onClick={handleCreate} loading={createTemplate.isPending}>Create</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
