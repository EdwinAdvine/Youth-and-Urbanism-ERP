import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Button, Card, Input, Select, Badge, Spinner, toast } from '../../components/ui'
import { useKBArticle, useCreateKBArticle, useUpdateKBArticle, type CreateKBPayload } from '../../api/support'

const emptyForm: CreateKBPayload = { title: '', slug: '', content: '', status: 'draft', tags: [] }

export default function KBEditorPage() {
  const { slug } = useParams<{ slug: string }>()
  const navigate = useNavigate()
  const isNew = !slug || slug === 'new'

  const { data: article, isLoading } = useKBArticle(slug || '')
  const createArticle = useCreateKBArticle()
  const updateArticle = useUpdateKBArticle()

  const [form, setForm] = useState<CreateKBPayload>(emptyForm)
  const [initialized, setInitialized] = useState(false)
  const [tagInput, setTagInput] = useState('')

  if (!isNew && article && !initialized) {
    setForm({
      title: article.title,
      slug: article.slug,
      content: article.content || '',
      status: article.status,
      tags: article.tags || [],
    })
    setInitialized(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.title || !form.slug) {
      toast('error', 'Title and slug are required')
      return
    }
    try {
      if (isNew) {
        await createArticle.mutateAsync(form)
        toast('success', 'Article created')
      } else {
        await updateArticle.mutateAsync({ id: article!.id, ...form })
        toast('success', 'Article updated')
      }
      navigate('/support/kb')
    } catch {
      toast('error', 'Failed to save article')
    }
  }

  const addTag = () => {
    const tag = tagInput.trim()
    if (tag && !(form.tags || []).includes(tag)) {
      setForm({ ...form, tags: [...(form.tags || []), tag] })
    }
    setTagInput('')
  }

  const removeTag = (tag: string) => {
    setForm({ ...form, tags: (form.tags || []).filter((t) => t !== tag) })
  }

  const generateSlug = (title: string) => {
    return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  }

  if (!isNew && isLoading) {
    return <div className="flex items-center justify-center min-h-[60vh]"><Spinner size="lg" /></div>
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{isNew ? 'New Article' : 'Edit Article'}</h1>
          <p className="text-sm text-gray-500 mt-1">Knowledge base article editor</p>
        </div>
        <Button variant="ghost" onClick={() => navigate('/support/kb')}>Back to KB</Button>
      </div>

      <form onSubmit={handleSubmit}>
        <Card className="space-y-4">
          <Input
            label="Title"
            value={form.title}
            onChange={(e) => {
              const title = e.target.value
              setForm({ ...form, title, slug: isNew ? generateSlug(title) : form.slug })
            }}
            required
          />
          <Input
            label="Slug"
            value={form.slug}
            onChange={(e) => setForm({ ...form, slug: e.target.value })}
            required
            placeholder="url-friendly-slug"
          />
          <Select
            label="Status"
            value={form.status || 'draft'}
            onChange={(e) => setForm({ ...form, status: e.target.value })}
            options={[
              { value: 'draft', label: 'Draft' },
              { value: 'published', label: 'Published' },
              { value: 'archived', label: 'Archived' },
            ]}
          />

          {/* Tags */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">Tags</label>
            <div className="flex gap-2 flex-wrap">
              {(form.tags || []).map((tag) => (
                <Badge key={tag} variant="primary" className="cursor-pointer" onClick={() => removeTag(tag)}>
                  {tag} x
                </Badge>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                placeholder="Add tag..."
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag() } }}
              />
              <Button type="button" variant="outline" onClick={addTag}>Add</Button>
            </div>
          </div>

          {/* Content */}
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">Content</label>
            <textarea
              className="w-full rounded-[10px] border border-gray-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 min-h-[400px] font-mono"
              value={form.content || ''}
              onChange={(e) => setForm({ ...form, content: e.target.value })}
              placeholder="Write article content here... (Markdown supported)"
            />
          </div>
        </Card>

        <div className="flex justify-end gap-3 mt-4">
          <Button variant="ghost" type="button" onClick={() => navigate('/support/kb')}>Cancel</Button>
          <Button type="submit" loading={createArticle.isPending || updateArticle.isPending}>
            {isNew ? 'Publish Article' : 'Save Changes'}
          </Button>
        </div>
      </form>
    </div>
  )
}
