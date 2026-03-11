import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button, Badge, Spinner, cn } from '@/components/ui'
import { useHandbookArticles, useDeleteArticle, usePublishArticle, useArchiveArticle } from '@/api/handbook'

const STATUS_BADGES: Record<string, { variant: 'success' | 'warning' | 'default'; label: string }> = {
  published: { variant: 'success', label: 'Published' },
  draft: { variant: 'warning', label: 'Draft' },
  archived: { variant: 'default', label: 'Archived' },
}

export default function HandbookAdminPage() {
  const navigate = useNavigate()
  const [statusFilter, setStatusFilter] = useState<string>('')
  const { data, isLoading } = useHandbookArticles({
    limit: 100,
    // Show all statuses for admin by not filtering by status (backend returns published only for regular users)
    // Admin endpoint would need a separate hook — for now we use the regular one
  })
  const deleteArticle = useDeleteArticle()
  const publishArticle = usePublishArticle()
  const archiveArticle = useArchiveArticle()

  const articles = data?.articles || []
  const filtered = statusFilter
    ? articles.filter((a) => a.status === statusFilter)
    : articles

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Handbook Admin</h1>
          <p className="text-sm text-gray-500 mt-1">Manage articles, categories, and analytics.</p>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/handbook/admin/categories">
            <Button variant="outline" size="sm">Manage Categories</Button>
          </Link>
          <Link to="/handbook/admin/analytics">
            <Button variant="outline" size="sm">Analytics</Button>
          </Link>
          <Link to="/handbook/admin/articles/new">
            <Button size="sm">New Article</Button>
          </Link>
        </div>
      </div>

      {/* Status filter tabs */}
      <div className="flex items-center gap-1 border-b border-gray-100 dark:border-gray-800 pb-1">
        {[
          { value: '', label: 'All' },
          { value: 'published', label: 'Published' },
          { value: 'draft', label: 'Drafts' },
          { value: 'archived', label: 'Archived' },
        ].map((tab) => (
          <button
            key={tab.value}
            onClick={() => setStatusFilter(tab.value)}
            className={cn(
              'px-3 py-1.5 text-sm rounded-t-[8px] transition-colors',
              statusFilter === tab.value
                ? 'bg-primary/10 text-primary font-medium'
                : 'text-gray-500 hover:text-gray-700'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Spinner size="lg" />
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.length > 0 ? (
            filtered.map((article) => {
              const badge = STATUS_BADGES[article.status] || STATUS_BADGES.draft
              return (
                <div
                  key={article.id}
                  className="flex items-center justify-between p-4 rounded-[10px] border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-800 hover:border-gray-200 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
                        {article.title}
                      </h3>
                      <Badge variant={badge.variant}>{badge.label}</Badge>
                      {article.is_pinned && (
                        <span className="text-[10px] text-warning font-medium">Pinned</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-[10px] text-gray-400">
                      <span>{article.article_type}</span>
                      {article.module && <span>{article.module}</span>}
                      <span>{article.view_count} views</span>
                      <span>
                        Updated {new Date(article.updated_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {article.status === 'draft' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => publishArticle.mutate(article.id)}
                        loading={publishArticle.isPending}
                      >
                        Publish
                      </Button>
                    )}
                    {article.status === 'published' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => archiveArticle.mutate(article.id)}
                      >
                        Archive
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => navigate(`/handbook/admin/articles/${article.id}/edit`)}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-danger hover:text-danger"
                      onClick={() => {
                        if (confirm('Delete this article?')) {
                          deleteArticle.mutate(article.id)
                        }
                      }}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              )
            })
          ) : (
            <div className="text-center py-16 text-gray-400">
              <p className="text-sm">No articles found.</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
