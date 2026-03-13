import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button, Input, Spinner, cn } from '@/components/ui'
import { useHandbookCategories, useHandbookArticles, useHandbookProgress } from '@/api/handbook'
import ArticleCard from './components/ArticleCard'
import ProgressTracker from './components/ProgressTracker'
import type { HandbookCategory } from '@/api/handbook'

function CategorySidebar({
  categories,
  selected,
  onSelect,
}: {
  categories: HandbookCategory[]
  selected: string | null
  onSelect: (slug: string | null) => void
}) {
  return (
    <div className="space-y-0.5">
      <button
        onClick={() => onSelect(null)}
        className={cn(
          'w-full text-left px-3 py-2 rounded-[8px] text-sm transition-colors',
          !selected ? 'bg-primary/10 text-primary font-medium' : 'text-gray-600 hover:bg-gray-100'
        )}
      >
        All Articles
      </button>
      {categories.map((cat) => (
        <button
          key={cat.id}
          onClick={() => onSelect(cat.slug)}
          className={cn(
            'w-full text-left px-3 py-2 rounded-[8px] text-sm transition-colors flex items-center justify-between',
            selected === cat.slug
              ? 'bg-primary/10 text-primary font-medium'
              : 'text-gray-600 hover:bg-gray-100'
          )}
        >
          <span className="flex items-center gap-2">
            {cat.icon && <span>{cat.icon}</span>}
            {cat.name}
          </span>
          {(cat.article_count ?? 0) > 0 && (
            <span className="text-[10px] text-gray-400">{cat.article_count}</span>
          )}
        </button>
      ))}
    </div>
  )
}

export default function HandbookPage() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)

  const { data: categories, isLoading: catLoading } = useHandbookCategories()
  const { data: articlesData, isLoading: articlesLoading } = useHandbookArticles({
    category: selectedCategory || undefined,
    limit: 50,
  })
  const { data: progress } = useHandbookProgress()

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (search.trim()) navigate(`/handbook/search?q=${encodeURIComponent(search.trim())}`)
  }

  const loading = catLoading || articlesLoading

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Handbook</h1>
          <p className="text-sm text-gray-500 mt-1">
            Your guide to everything in Urban Vibes Dynamics. Search, browse, or follow the quick-start guides.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/handbook/getting-started">
            <Button variant="outline" size="sm">
              <svg className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Getting Started
            </Button>
          </Link>
        </div>
      </div>

      {/* Search */}
      <form onSubmit={handleSearch} className="max-w-xl">
        <Input
          placeholder="Search articles... (e.g. 'how do I approve a purchase order?')"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          leftIcon={
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          }
        />
      </form>

      {/* Progress */}
      {progress && progress.total_published > 0 && (
        <ProgressTracker
          totalRead={progress.total_read}
          totalPublished={progress.total_published}
          completionPct={progress.completion_pct}
        />
      )}

      {/* Main content: sidebar + articles */}
      {loading ? (
        <div className="flex items-center justify-center min-h-[40vh]">
          <Spinner size="lg" />
        </div>
      ) : (
        <div className="flex gap-6">
          {/* Category sidebar */}
          <div className="w-52 shrink-0 hidden lg:block">
            <p className="px-3 pb-2 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
              Categories
            </p>
            <CategorySidebar
              categories={categories || []}
              selected={selectedCategory}
              onSelect={setSelectedCategory}
            />
          </div>

          {/* Articles grid */}
          <div className="flex-1 min-w-0">
            {articlesData?.articles && articlesData.articles.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {articlesData.articles.map((article) => (
                  <ArticleCard
                    key={article.id}
                    article={article}
                    isRead={progress?.read_article_ids.includes(article.id)}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-16 text-gray-400">
                <svg className="h-12 w-12 mx-auto mb-3 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
                <p className="text-sm">No articles yet. Check back soon!</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
