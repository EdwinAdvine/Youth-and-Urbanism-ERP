import { useState } from 'react'
import { Card, Input, Badge, Spinner } from '../../components/ui'
import { useKBArticles, useKBArticle, useMarkKBHelpful } from '../../api/support'

export default function KBPublicPage() {
  const [search, setSearch] = useState('')
  const [selectedSlug, setSelectedSlug] = useState('')
  const [page, setPage] = useState(1)
  const limit = 12

  const { data: articlesData, isLoading } = useKBArticles({ search: search || undefined, page, limit })
  const { data: article, isLoading: articleLoading } = useKBArticle(selectedSlug)
  const markHelpful = useMarkKBHelpful()

  const articles = articlesData?.articles ?? []

  if (selectedSlug) {
    return (
      <div className="p-6 max-w-4xl mx-auto space-y-6">
        <button
          className="text-sm text-primary hover:underline"
          onClick={() => setSelectedSlug('')}
        >
          Back to Knowledge Base
        </button>

        {articleLoading ? (
          <div className="flex justify-center py-20"><Spinner size="lg" /></div>
        ) : article ? (
          <Card>
            <div className="mb-4">
              <h1 className="text-2xl font-bold text-gray-900">{article.title}</h1>
              <div className="flex items-center gap-3 mt-2 text-sm text-gray-500">
                <span>By {article.author_name || 'Unknown'}</span>
                <span>{new Date(article.updated_at).toLocaleDateString()}</span>
                <span>{article.view_count} views</span>
              </div>
              {article.tags && article.tags.length > 0 && (
                <div className="flex gap-1 mt-2">
                  {article.tags.map((tag) => (
                    <Badge key={tag} variant="primary">{tag}</Badge>
                  ))}
                </div>
              )}
            </div>
            <div className="prose prose-sm max-w-none text-gray-700 whitespace-pre-wrap">
              {article.content || 'No content.'}
            </div>
            <div className="mt-8 pt-4 border-t border-gray-100 dark:border-gray-800 flex items-center gap-4">
              <span className="text-sm text-gray-500">Was this helpful?</span>
              <button
                className="text-sm text-primary hover:underline font-medium"
                onClick={() => markHelpful.mutate(article.id)}
              >
                Yes ({article.helpful_count})
              </button>
            </div>
          </Card>
        ) : (
          <Card className="text-center py-12">
            <p className="text-gray-400">Article not found</p>
          </Card>
        )}
      </div>
    )
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Knowledge Base</h1>
        <p className="text-gray-500 mt-2">Find answers to common questions</p>
        <div className="max-w-lg mx-auto mt-4">
          <Input
            placeholder="Search articles..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            leftIcon={
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            }
          />
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20"><Spinner size="lg" /></div>
      ) : articles.length === 0 ? (
        <Card className="text-center py-12">
          <p className="text-gray-400">{search ? `No articles matching "${search}"` : 'No articles published yet'}</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {articles.map((a) => (
            <Card
              key={a.id}
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => setSelectedSlug(a.slug)}
            >
              <h3 className="font-semibold text-gray-900 mb-1">{a.title}</h3>
              {a.content && (
                <p className="text-sm text-gray-500 line-clamp-3">{a.content.slice(0, 150)}</p>
              )}
              <div className="flex items-center gap-3 mt-3 text-xs text-gray-400">
                <span>{a.view_count} views</span>
                <span>{a.helpful_count} helpful</span>
                <span>{new Date(a.updated_at).toLocaleDateString()}</span>
              </div>
              {a.tags && a.tags.length > 0 && (
                <div className="flex gap-1 mt-2">
                  {a.tags.slice(0, 3).map((tag) => (
                    <Badge key={tag} variant="primary">{tag}</Badge>
                  ))}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {articlesData && articlesData.total > limit && (
        <div className="flex justify-center gap-2">
          <button className="px-3 py-1.5 text-sm rounded-md hover:bg-gray-100 disabled:opacity-40" disabled={page === 1} onClick={() => setPage(page - 1)}>Previous</button>
          <span className="text-sm text-gray-500 self-center">Page {page} of {Math.ceil(articlesData.total / limit)}</span>
          <button className="px-3 py-1.5 text-sm rounded-md hover:bg-gray-100 disabled:opacity-40" disabled={page * limit >= articlesData.total} onClick={() => setPage(page + 1)}>Next</button>
        </div>
      )}
    </div>
  )
}
