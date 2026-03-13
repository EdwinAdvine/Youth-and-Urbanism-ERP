import { useState } from 'react'
import { sanitizeHTML } from '@/shared/utils/sanitize'
import { useQuery, useMutation } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router-dom'
import axios from 'axios'
import { Button, Card, Badge, Input, toast } from '../../components/ui'

// ─── Types ───────────────────────────────────────────────────────────────────

type PostStatus = 'draft' | 'published'

interface BlogPost {
  id: string
  title: string
  slug: string
  content: string
  feature_image: string
  meta_title: string
  meta_description: string
  tags: string[]
  status: PostStatus
  published_at: string | null
}

interface BlogPostPayload {
  title: string
  slug: string
  content: string
  feature_image: string
  meta_title: string
  meta_description: string
  tags: string[]
  status: PostStatus
  published_at: string | null
}

// ─── API ─────────────────────────────────────────────────────────────────────

const fetchPost = (id: string): Promise<BlogPost> =>
  axios.get(`/api/v1/ecommerce/blog/${id}`).then((r) => r.data)

const createPost = (data: BlogPostPayload): Promise<BlogPost> =>
  axios.post('/api/v1/ecommerce/blog', data).then((r) => r.data)

const updatePost = ({ id, data }: { id: string; data: BlogPostPayload }): Promise<BlogPost> =>
  axios.patch(`/api/v1/ecommerce/blog/${id}`, data).then((r) => r.data)

// ─── Markdown preview (simple, no external lib) ───────────────────────────────

function renderMarkdown(md: string): string {
  return md
    .replace(/^### (.+)$/gm, '<h3 class="text-lg font-bold mt-4 mb-1">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="text-xl font-bold mt-5 mb-2">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 class="text-2xl font-bold mt-6 mb-2">$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code class="bg-gray-100 px-1 rounded text-xs font-mono">$1</code>')
    .replace(/^\> (.+)$/gm, '<blockquote class="border-l-4 border-primary/30 pl-3 text-gray-600 italic my-2">$1</blockquote>')
    .replace(/^- (.+)$/gm, '<li class="ml-4 list-disc">$1</li>')
    .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" class="text-primary underline">$1</a>')
    .replace(/\n\n/g, '</p><p class="mb-3">')
    .replace(/^(?!<[hlbpoq])(.+)$/gm, (m) => m.trim() ? m : '')
    .replace(/^(.+)$/, '<p class="mb-3">$1</p>')
}

// ─── Component ───────────────────────────────────────────────────────────────

const EMPTY_FORM: BlogPostPayload = {
  title: '',
  slug: '',
  content: '',
  feature_image: '',
  meta_title: '',
  meta_description: '',
  tags: [],
  status: 'draft',
  published_at: null,
}

export default function BlogPostEditor() {
  const { id } = useParams<{ id?: string }>()
  const navigate = useNavigate()
  const isNew = !id || id === 'new'

  const [form, setForm] = useState<BlogPostPayload>(EMPTY_FORM)
  const [tagInput, setTagInput] = useState('')
  const [showPreview, setShowPreview] = useState(false)
  const [seoExpanded, setSeoExpanded] = useState(false)

  const { isLoading } = useQuery({
    queryKey: ['blog-post', id],
    queryFn: () => fetchPost(id!),
    enabled: !isNew,
    onSuccess: (data: BlogPost) => {
      setForm({
        title: data.title,
        slug: data.slug,
        content: data.content,
        feature_image: data.feature_image,
        meta_title: data.meta_title,
        meta_description: data.meta_description,
        tags: data.tags,
        status: data.status,
        published_at: data.published_at,
      })
    },
  } as Parameters<typeof useQuery>[0])

  const saveMutation = useMutation({
    mutationFn: isNew ? createPost : (data: BlogPostPayload) => updatePost({ id: id!, data }),
    onSuccess: (post: BlogPost) => {
      toast('success', isNew ? 'Post created.' : 'Post saved.')
      if (isNew) navigate(`/ecommerce/blog/${post.id}/edit`, { replace: true })
    },
    onError: () => toast('error', 'Failed to save post.'),
  })

  function slugify(val: string) {
    return val.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
  }

  function handleTitleChange(title: string) {
    setForm((f) => ({ ...f, title, slug: isNew ? slugify(title) : f.slug }))
  }

  function addTag(raw: string) {
    const tags = raw.split(',').map((t) => t.trim()).filter(Boolean)
    setForm((f) => ({ ...f, tags: Array.from(new Set([...f.tags, ...tags])) }))
    setTagInput('')
  }

  function removeTag(tag: string) {
    setForm((f) => ({ ...f, tags: f.tags.filter((t) => t !== tag) }))
  }

  function handlePublish() {
    saveMutation.mutate({
      ...form,
      status: 'published',
      published_at: form.published_at ?? new Date().toISOString(),
    })
  }

  function handleSaveDraft() {
    saveMutation.mutate({ ...form, status: 'draft' })
  }

  if (!isNew && isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <svg className="animate-spin h-8 w-8 text-primary" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
        </svg>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/ecommerce/blog')} className="text-gray-400 hover:text-gray-600 transition-colors">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{isNew ? 'New Post' : 'Edit Post'}</h1>
            <div className="flex items-center gap-2 mt-0.5">
              <Badge variant={form.status === 'published' ? 'success' : 'default'} className="capitalize">
                {form.status}
              </Badge>
              {form.published_at && (
                <span className="text-xs text-gray-400">Published {new Date(form.published_at).toLocaleDateString()}</span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setShowPreview(!showPreview)}>
            {showPreview ? 'Hide Preview' : 'Preview'}
          </Button>
          <Button variant="secondary" loading={saveMutation.isPending && form.status === 'draft'} onClick={handleSaveDraft}>
            Save Draft
          </Button>
          <Button loading={saveMutation.isPending && form.status === 'published'} onClick={handlePublish}>
            {form.status === 'published' ? 'Update' : 'Publish'}
          </Button>
        </div>
      </div>

      <div className={`grid gap-6 ${showPreview ? 'grid-cols-2' : 'grid-cols-1'}`}>
        {/* Editor Pane */}
        <div className="space-y-4">
          {/* Title */}
          <Input
            label="Title"
            placeholder="Post title..."
            value={form.title}
            onChange={(e) => handleTitleChange(e.target.value)}
          />

          {/* Slug */}
          <Input
            label="Slug"
            placeholder="post-url-slug"
            value={form.slug}
            onChange={(e) => setForm({ ...form, slug: e.target.value })}
          />

          {/* Content */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Content (Markdown)</label>
            <textarea
              className="w-full rounded-[10px] border border-gray-200 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary resize-none"
              rows={16}
              placeholder="Write your post in Markdown..."
              value={form.content}
              onChange={(e) => setForm({ ...form, content: e.target.value })}
            />
          </div>

          {/* Feature Image */}
          <Input
            label="Feature Image URL"
            placeholder="https://..."
            value={form.feature_image}
            onChange={(e) => setForm({ ...form, feature_image: e.target.value })}
          />

          {/* Tags */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tags</label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {form.tags.map((tag) => (
                <Badge key={tag} variant="primary" className="cursor-pointer" onClick={() => removeTag(tag)}>
                  {tag} <span className="ml-1 opacity-60">×</span>
                </Badge>
              ))}
            </div>
            <input
              className="w-full rounded-[10px] border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              placeholder="Enter tags, comma-separated, press Enter"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag(tagInput) } }}
              onBlur={() => { if (tagInput.trim()) addTag(tagInput) }}
            />
            <p className="text-xs text-gray-400 mt-1">Press Enter or comma to add</p>
          </div>

          {/* Publish Datetime */}
          {form.status === 'published' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Published At</label>
              <input
                type="datetime-local"
                className="rounded-[10px] border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                value={form.published_at ? form.published_at.slice(0, 16) : ''}
                onChange={(e) => setForm({ ...form, published_at: e.target.value ? new Date(e.target.value).toISOString() : null })}
              />
            </div>
          )}

          {/* SEO Section */}
          <Card>
            <button
              className="w-full flex items-center justify-between text-sm font-semibold text-gray-700"
              onClick={() => setSeoExpanded(!seoExpanded)}
            >
              <span>SEO Settings</span>
              <svg className={`h-4 w-4 text-gray-400 transition-transform ${seoExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {seoExpanded && (
              <div className="mt-4 space-y-3">
                <Input
                  label="Meta Title"
                  placeholder="SEO title (defaults to post title)"
                  value={form.meta_title}
                  onChange={(e) => setForm({ ...form, meta_title: e.target.value })}
                />
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Meta Description</label>
                  <textarea
                    className="w-full rounded-[10px] border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary resize-none"
                    rows={3}
                    placeholder="Brief description for search engines..."
                    value={form.meta_description}
                    onChange={(e) => setForm({ ...form, meta_description: e.target.value })}
                    maxLength={160}
                  />
                  <p className="text-xs text-gray-400 text-right">{form.meta_description.length}/160</p>
                </div>
              </div>
            )}
          </Card>
        </div>

        {/* Preview Pane */}
        {showPreview && (
          <div className="sticky top-6 self-start">
            <Card>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">Preview</p>
              {form.feature_image && (
                <img
                  src={form.feature_image}
                  alt="Feature"
                  className="w-full h-40 object-cover rounded-[10px] mb-4"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                />
              )}
              {form.title && (
                <h1 className="text-2xl font-bold text-gray-900 mb-2">{form.title}</h1>
              )}
              {form.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {form.tags.map((tag) => <Badge key={tag} variant="primary">{tag}</Badge>)}
                </div>
              )}
              <div
                className="prose prose-sm text-gray-700 text-sm leading-relaxed max-h-[500px] overflow-y-auto"
                dangerouslySetInnerHTML={{ __html: sanitizeHTML(renderMarkdown(form.content) || '<p class="text-gray-400">Start writing to see a preview...</p>') }}
              />
            </Card>
          </div>
        )}
      </div>
    </div>
  )
}
