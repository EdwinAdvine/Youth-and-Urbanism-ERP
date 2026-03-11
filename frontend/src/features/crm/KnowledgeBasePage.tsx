import { useState } from 'react'
import {
  useKBArticles,
  useCreateKBArticle,
  useUpdateKBArticle,
  useDeleteKBArticle,
  useKBSearch,
  type KBArticle,
  type KBArticleCreatePayload,
} from '@/api/crm_service'
import { Button, Spinner, Modal, Input, Select, toast } from '@/components/ui'

type ArticleStatus = 'draft' | 'published' | 'archived'

const STATUSES: ArticleStatus[] = ['draft', 'published', 'archived']

const STATUS_LABELS: Record<ArticleStatus, string> = {
  draft: 'Draft',
  published: 'Published',
  archived: 'Archived',
}

const STATUS_COLORS: Record<ArticleStatus, string> = {
  draft: 'bg-[#ffa21d]/10 text-[#ffa21d]',
  published: 'bg-[#6fd943]/10 text-[#6fd943]',
  archived: 'bg-gray-100 text-gray-500',
}

const EMPTY_FORM: KBArticleCreatePayload = {
  title: '',
  slug: '',
  content_html: '',
  content_text: '',
  category: '',
  tags: [],
  status: 'draft',
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
}

export default function KnowledgeBasePage() {
  const [categoryFilter, setCategoryFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState<ArticleStatus | ''>('')
  const [searchQuery, setSearchQuery] = useState('')
  const [page, setPage] = useState(1)

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<KBArticle | null>(null)
  const [form, setForm] = useState<KBArticleCreatePayload>(EMPTY_FORM)
  const [tagsInput, setTagsInput] = useState('')

  const { data: articlesData, isLoading } = useKBArticles({
    category: categoryFilter || undefined,
    status: statusFilter || undefined,
    page,
  })
  const articles: KBArticle[] = articlesData?.articles ?? articlesData ?? []
  const total = articlesData?.total ?? articles.length

  const { data: searchResults } = useKBSearch(searchQuery)
  const searchArticles: KBArticle[] = searchResults?.articles ?? searchResults ?? []

  const createMutation = useCreateKBArticle()
  const updateMutation = useUpdateKBArticle()
  const deleteMutation = useDeleteKBArticle()

  const displayArticles = searchQuery ? searchArticles : articles

  // Extract unique categories from articles for the filter dropdown
  const categories = Array.from(new Set(articles.map((a) => a.category).filter(Boolean)))

  const openCreate = () => {
    setEditing(null)
    setForm(EMPTY_FORM)
    setTagsInput('')
    setModalOpen(true)
  }

  const openEdit = (article: KBArticle) => {
    setEditing(article)
    setForm({
      title: article.title,
      slug: article.slug,
      content_html: article.content_html,
      content_text: article.content_text,
      category: article.category,
      tags: article.tags,
      status: article.status,
    })
    setTagsInput((article.tags ?? []).join(', '))
    setModalOpen(true)
  }

  const handleTitleChange = (title: string) => {
    setForm({
      ...form,
      title,
      slug: editing ? form.slug : slugify(title),
    })
  }

  const handleSubmit = async () => {
    const payload: KBArticleCreatePayload = {
      ...form,
      tags: tagsInput.split(',').map((t) => t.trim()).filter(Boolean),
    }
    try {
      if (editing) {
        await updateMutation.mutateAsync({ id: editing.id, ...payload })
        toast('success', 'Article updated')
      } else {
        await createMutation.mutateAsync(payload)
        toast('success', 'Article created')
      }
      setModalOpen(false)
    } catch {
      toast('error', 'Operation failed')
    }
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this article? This cannot be undone.')) return
    try {
      await deleteMutation.mutateAsync(id)
      toast('success', 'Article deleted')
    } catch {
      toast('error', 'Delete failed')
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Knowledge Base</h1>
          <p className="text-sm text-gray-500 mt-1">
            {total} article{total !== 1 ? 's' : ''}
          </p>
        </div>
        <Button onClick={openCreate}>+ New Article</Button>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-wrap gap-3">
        <Input
          placeholder="Search articles (semantic)..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-72"
        />
        <Select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value as ArticleStatus | ''); setPage(1) }}
        >
          <option value="">All Statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>{STATUS_LABELS[s]}</option>
          ))}
        </Select>
        <Select
          value={categoryFilter}
          onChange={(e) => { setCategoryFilter(e.target.value); setPage(1) }}
        >
          <option value="">All Categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </Select>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex justify-center py-16"><Spinner size="lg" /></div>
      ) : displayArticles.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          {searchQuery ? 'No articles match your search.' : 'No articles found. Create your first article to get started.'}
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-[10px] border border-gray-200 dark:border-gray-700 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-800 bg-gray-50/50">
                <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Title</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Category</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Status</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Views</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Helpful</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Actions</th>
              </tr>
            </thead>
            <tbody>
              {displayArticles.map((article) => (
                <tr key={article.id} className="border-b border-gray-50 dark:border-gray-800 hover:bg-gray-50/50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900 dark:text-gray-100">{article.title}</div>
                    {article.tags && article.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {article.tags.map((tag) => (
                          <span key={tag} className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] bg-[#51459d]/10 text-[#51459d]">
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{article.category}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[article.status as ArticleStatus] ?? STATUS_COLORS.draft}`}>
                      {STATUS_LABELS[article.status as ArticleStatus] ?? article.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{article.view_count}</td>
                  <td className="px-4 py-3 text-gray-500">
                    <span className="text-[#6fd943]">{article.helpful_count}</span>
                    {article.not_helpful_count > 0 && (
                      <span className="text-[#ff3a6e] ml-1">/ {article.not_helpful_count}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="ghost" onClick={() => openEdit(article)}>Edit</Button>
                      <Button size="sm" variant="ghost" className="text-[#ff3a6e]" onClick={() => handleDelete(article.id)}>Delete</Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {!searchQuery && total > 20 && (
        <div className="flex justify-center gap-2">
          <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
          <span className="flex items-center px-3 text-sm text-gray-500">
            Page {page} of {Math.ceil(total / 20)}
          </span>
          <Button size="sm" variant="outline" disabled={page >= Math.ceil(total / 20)} onClick={() => setPage((p) => p + 1)}>Next</Button>
        </div>
      )}

      {/* Create / Edit Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Article' : 'New Article'}>
        <div className="space-y-4">
          <Input
            label="Title"
            value={form.title}
            onChange={(e) => handleTitleChange(e.target.value)}
            placeholder="Article title"
            required
          />
          <Input
            label="Slug"
            value={form.slug ?? ''}
            onChange={(e) => setForm({ ...form, slug: e.target.value })}
            placeholder="auto-generated-from-title"
          />
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Content (HTML)</label>
            <textarea
              className="w-full rounded-[10px] border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#51459d]/40 min-h-[120px] font-mono"
              value={form.content_html}
              onChange={(e) => setForm({ ...form, content_html: e.target.value })}
              placeholder="<p>Article content...</p>"
            />
          </div>
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Content (Plain Text)</label>
            <textarea
              className="w-full rounded-[10px] border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#51459d]/40 min-h-[80px]"
              value={form.content_text ?? ''}
              onChange={(e) => setForm({ ...form, content_text: e.target.value })}
              placeholder="Plain text version of the article..."
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Category"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              placeholder="e.g. Getting Started"
              required
            />
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Status</label>
              <Select
                value={form.status ?? 'draft'}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                ))}
              </Select>
            </div>
          </div>
          <Input
            label="Tags (comma-separated)"
            value={tagsInput}
            onChange={(e) => setTagsInput(e.target.value)}
            placeholder="e.g. onboarding, setup, faq"
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button
              onClick={handleSubmit}
              loading={createMutation.isPending || updateMutation.isPending}
            >
              {editing ? 'Save Changes' : 'Create Article'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
