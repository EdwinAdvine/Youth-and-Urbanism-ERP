import { useParams, Link } from 'react-router-dom'
import { Spinner } from '@/components/ui'
import { useHandbookCategory, useHandbookProgress } from '@/api/handbook'
import BreadcrumbNav from './components/BreadcrumbNav'
import ArticleCard from './components/ArticleCard'
import ProgressTracker from './components/ProgressTracker'

export default function CategoryPage() {
  const { slug } = useParams<{ slug: string }>()
  const { data, isLoading } = useHandbookCategory(slug || '')
  const { data: progress } = useHandbookProgress()

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Spinner size="lg" />
      </div>
    )
  }

  if (!data) {
    return (
      <div className="p-6 text-center py-20">
        <p className="text-gray-500">Category not found.</p>
        <Link to="/handbook" className="text-primary text-sm mt-2 inline-block">
          Back to Handbook
        </Link>
      </div>
    )
  }

  const { category, articles, total } = data
  const readIds = progress?.read_article_ids || []
  const catRead = articles.filter((a) => readIds.includes(a.id)).length

  return (
    <div className="p-6 space-y-6">
      <BreadcrumbNav category={category} />

      <div>
        <h1 className="text-2xl font-bold text-gray-900">{category.name}</h1>
        {category.description && (
          <p className="text-sm text-gray-500 mt-1">{category.description}</p>
        )}
        <p className="text-xs text-gray-400 mt-1">{total} articles</p>
      </div>

      {total > 0 && (
        <ProgressTracker
          totalRead={catRead}
          totalPublished={total}
          completionPct={Math.round((catRead / total) * 100)}
          label={`${category.name} Progress`}
        />
      )}

      {articles.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {articles.map((article) => (
            <ArticleCard
              key={article.id}
              article={article}
              isRead={readIds.includes(article.id)}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-16 text-gray-400">
          <p className="text-sm">No articles in this category yet.</p>
        </div>
      )}
    </div>
  )
}
