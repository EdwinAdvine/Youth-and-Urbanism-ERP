import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Button, Input, Spinner } from '@/components/ui'
import {
  useHandbookArticle,
  useHandbookCategories,
  useCreateArticle,
  useUpdateArticle,
  useUploadMedia,
} from '@/api/handbook'
import BreadcrumbNav from './components/BreadcrumbNav'

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

export default function ArticleEditor() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const isEdit = !!id

  const { data: existingArticle, isLoading: articleLoading } = useHandbookArticle(id || '')
  const { data: categories } = useHandbookCategories()
  const createArticle = useCreateArticle()
  const updateArticle = useUpdateArticle()
  const uploadMedia = useUploadMedia()

  const [form, setForm] = useState({
    title: '',
    slug: '',
    content_markdown: '',
    excerpt: '',
    category_id: '',
    article_type: 'guide',
    module: '',
    tags: '',
    video_url: '',
    ai_shortcut_prompt: '',
    is_pinned: false,
  })
  const [autoSlug, setAutoSlug] = useState(true)
  const [preview, setPreview] = useState(false)

  // Populate form for editing
  useEffect(() => {
    if (existingArticle && isEdit) {
      setForm({
        title: existingArticle.title,
        slug: existingArticle.slug,
        content_markdown: existingArticle.content_markdown,
        excerpt: existingArticle.excerpt || '',
        category_id: existingArticle.category_id || '',
        article_type: existingArticle.article_type,
        module: existingArticle.module || '',
        tags: existingArticle.tags?.join(', ') || '',
        video_url: existingArticle.video_url || '',
        ai_shortcut_prompt: existingArticle.ai_shortcut_prompt || '',
        is_pinned: existingArticle.is_pinned,
      })
      setAutoSlug(false)
    }
  }, [existingArticle, isEdit])

  const handleTitleChange = (val: string) => {
    setForm((f) => ({ ...f, title: val, ...(autoSlug ? { slug: slugify(val) } : {}) }))
  }

  const handleSave = async (publishAfter = false) => {
    const payload = {
      title: form.title,
      slug: form.slug,
      content_markdown: form.content_markdown,
      excerpt: form.excerpt || undefined,
      category_id: form.category_id || undefined,
      article_type: form.article_type,
      module: form.module || undefined,
      tags: form.tags ? form.tags.split(',').map((t) => t.trim()).filter(Boolean) : undefined,
      video_url: form.video_url || undefined,
      ai_shortcut_prompt: form.ai_shortcut_prompt || undefined,
      is_pinned: form.is_pinned,
      status: publishAfter ? 'published' : 'draft',
    }

    if (isEdit && id) {
      await updateArticle.mutateAsync({ id, ...payload })
    } else {
      await createArticle.mutateAsync(payload)
    }
    navigate('/handbook/admin')
  }

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !id) return
    const result = await uploadMedia.mutateAsync({ articleId: id, file })
    // Insert markdown image at cursor
    setForm((f) => ({
      ...f,
      content_markdown: f.content_markdown + `\n![${file.name}](${result.url})\n`,
    }))
  }

  if (isEdit && articleLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Spinner size="lg" />
      </div>
    )
  }

  const isSaving = createArticle.isPending || updateArticle.isPending

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      <BreadcrumbNav articleTitle={isEdit ? 'Edit Article' : 'New Article'} />

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          {isEdit ? 'Edit Article' : 'New Article'}
        </h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setPreview(!preview)}>
            {preview ? 'Edit' : 'Preview'}
          </Button>
          <Button variant="outline" size="sm" onClick={() => handleSave(false)} loading={isSaving}>
            Save Draft
          </Button>
          <Button size="sm" onClick={() => handleSave(true)} loading={isSaving}>
            Publish
          </Button>
        </div>
      </div>

      {preview ? (
        <div className="rounded-[10px] border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-800 p-6">
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">{form.title || 'Untitled'}</h2>
          <div className="prose prose-sm max-w-none text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
            {form.content_markdown || 'No content yet.'}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Title */}
          <Input
            label="Title"
            value={form.title}
            onChange={(e) => handleTitleChange(e.target.value)}
            placeholder="How to create an invoice"
          />

          {/* Slug */}
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <Input
                label="Slug"
                value={form.slug}
                onChange={(e) => {
                  setAutoSlug(false)
                  setForm((f) => ({ ...f, slug: e.target.value }))
                }}
                placeholder="how-to-create-an-invoice"
              />
            </div>
            {!autoSlug && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setAutoSlug(true)
                  setForm((f) => ({ ...f, slug: slugify(f.title) }))
                }}
              >
                Auto
              </Button>
            )}
          </div>

          {/* Category + Type + Module */}
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Category</label>
              <select
                value={form.category_id}
                onChange={(e) => setForm((f) => ({ ...f, category_id: e.target.value }))}
                className="w-full rounded-[10px] border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 py-2 px-3 text-sm"
              >
                <option value="">None</option>
                {categories?.map((cat) => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Type</label>
              <select
                value={form.article_type}
                onChange={(e) => setForm((f) => ({ ...f, article_type: e.target.value }))}
                className="w-full rounded-[10px] border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 py-2 px-3 text-sm"
              >
                <option value="guide">Guide</option>
                <option value="quickstart">Quick Start</option>
                <option value="faq">FAQ</option>
                <option value="release_note">Release Note</option>
                <option value="pro_tip">Pro Tip</option>
              </select>
            </div>
            <Input
              label="Module"
              value={form.module}
              onChange={(e) => setForm((f) => ({ ...f, module: e.target.value }))}
              placeholder="finance, hr, crm..."
            />
          </div>

          {/* Excerpt */}
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Excerpt</label>
            <textarea
              value={form.excerpt}
              onChange={(e) => setForm((f) => ({ ...f, excerpt: e.target.value }))}
              placeholder="Brief summary for search results..."
              className="w-full rounded-[10px] border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3 text-sm resize-none"
              rows={2}
            />
          </div>

          {/* Content */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Content (Markdown)</label>
              {isEdit && (
                <label className="text-xs text-primary cursor-pointer hover:underline">
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleImageUpload}
                  />
                  Upload Image
                </label>
              )}
            </div>
            <textarea
              value={form.content_markdown}
              onChange={(e) => setForm((f) => ({ ...f, content_markdown: e.target.value }))}
              placeholder="Write your article content in Markdown..."
              className="w-full rounded-[10px] border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 text-sm font-mono resize-y"
              rows={20}
            />
          </div>

          {/* Tags + Video + AI prompt */}
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Tags (comma-separated)"
              value={form.tags}
              onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))}
              placeholder="invoicing, finance, billing"
            />
            <Input
              label="Video URL"
              value={form.video_url}
              onChange={(e) => setForm((f) => ({ ...f, video_url: e.target.value }))}
              placeholder="https://..."
            />
          </div>

          <Input
            label="AI Shortcut Prompt (for 'Try it now' button)"
            value={form.ai_shortcut_prompt}
            onChange={(e) => setForm((f) => ({ ...f, ai_shortcut_prompt: e.target.value }))}
            placeholder="Create a new invoice for..."
          />

          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
            <input
              type="checkbox"
              checked={form.is_pinned}
              onChange={(e) => setForm((f) => ({ ...f, is_pinned: e.target.checked }))}
              className="rounded border-gray-300"
            />
            Pin this article to the top
          </label>
        </div>
      )}
    </div>
  )
}
