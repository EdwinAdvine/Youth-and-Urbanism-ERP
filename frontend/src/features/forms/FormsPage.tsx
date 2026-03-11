import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForms, useCreateForm, useDeleteForm } from '../../api/forms'
import { Button, Card, Badge, Modal, Input, Spinner, toast } from '../../components/ui'

export default function FormsPage() {
  const navigate = useNavigate()
  const { data: forms, isLoading } = useForms()
  const createForm = useCreateForm()
  const deleteForm = useDeleteForm()

  const [showCreate, setShowCreate] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')

  function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    createForm.mutate(
      { title: title.trim(), description: description.trim() },
      {
        onSuccess: (form) => {
          setShowCreate(false)
          setTitle('')
          setDescription('')
          toast('success', 'Form created')
          navigate(`/forms/${form.id}/edit`)
        },
        onError: () => toast('error', 'Failed to create form'),
      }
    )
  }

  function handleDelete(e: React.MouseEvent, id: string) {
    e.stopPropagation()
    if (!confirm('Delete this form? This cannot be undone.')) return
    deleteForm.mutate(id, {
      onSuccess: () => toast('success', 'Form deleted'),
      onError: () => toast('error', 'Failed to delete form'),
    })
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Forms</h1>
          <p className="text-sm text-gray-500 mt-1">Create and manage forms, collect responses</p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Create Form
        </Button>
      </div>

      {/* Forms Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center min-h-[40vh]">
          <Spinner size="lg" />
        </div>
      ) : !forms || forms.length === 0 ? (
        <Card className="flex flex-col items-center justify-center min-h-[40vh] text-center">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
            <svg className="h-8 w-8 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-gray-900">No forms yet</h2>
          <p className="text-sm text-gray-500 mt-1 mb-4">Create your first form to start collecting responses</p>
          <Button onClick={() => setShowCreate(true)} size="sm">Create Form</Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {forms.map((form) => (
            <Card
              key={form.id}
              className="cursor-pointer hover:shadow-md transition-shadow group"
              padding={false}
            >
              <div
                className="p-5"
                onClick={() => navigate(`/forms/${form.id}/edit`)}
              >
                <div className="flex items-start justify-between mb-3">
                  <h3 className="text-sm font-semibold text-gray-900 line-clamp-1 group-hover:text-primary transition-colors">
                    {form.title}
                  </h3>
                  <Badge variant={form.is_published ? 'success' : 'default'}>
                    {form.is_published ? 'Published' : 'Draft'}
                  </Badge>
                </div>
                {form.description && (
                  <p className="text-xs text-gray-500 line-clamp-2 mb-3">{form.description}</p>
                )}
                <div className="flex items-center justify-between text-xs text-gray-400">
                  <span>{form.response_count ?? 0} response{(form.response_count ?? 0) !== 1 ? 's' : ''}</span>
                  <span>{new Date(form.created_at).toLocaleDateString()}</span>
                </div>
              </div>
              <div className="border-t border-gray-100 px-5 py-2.5 flex items-center justify-end gap-2">
                <button
                  className="text-xs text-gray-400 hover:text-primary transition-colors"
                  onClick={() => navigate(`/forms/${form.id}/responses`)}
                >
                  Responses
                </button>
                <button
                  className="text-xs text-gray-400 hover:text-primary transition-colors"
                  onClick={() => navigate(`/forms/${form.id}/submit`)}
                >
                  Preview
                </button>
                <button
                  className="text-xs text-gray-400 hover:text-danger transition-colors"
                  onClick={(e) => handleDelete(e, form.id)}
                >
                  Delete
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Create Modal */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Create Form">
        <form onSubmit={handleCreate} className="space-y-4">
          <Input
            label="Title"
            placeholder="e.g. Customer Feedback Survey"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            autoFocus
            required
          />
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">Description</label>
            <textarea
              className="w-full rounded-[10px] border border-gray-200 bg-white px-3 py-2 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary placeholder:text-gray-400 resize-none"
              rows={3}
              placeholder="Optional description..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" type="button" onClick={() => setShowCreate(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={createForm.isPending}>
              Create
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
