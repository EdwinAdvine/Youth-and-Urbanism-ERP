import { Link } from 'react-router-dom'
import { Spinner } from '@/components/ui'
import { useGettingStarted, useHandbookProgress } from '@/api/handbook'
import BreadcrumbNav from './components/BreadcrumbNav'
import ProgressTracker from './components/ProgressTracker'

export default function GettingStartedPage() {
  const { data: articles, isLoading } = useGettingStarted()
  const { data: progress } = useHandbookProgress()
  const readIds = progress?.read_article_ids || []

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Spinner size="lg" />
      </div>
    )
  }

  const total = articles?.length || 0
  const read = articles?.filter((a) => readIds.includes(a.id)).length || 0

  return (
    <div className="p-6 space-y-6 max-w-3xl mx-auto">
      <BreadcrumbNav articleTitle="Getting Started" />

      <div className="text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
          <svg className="h-8 w-8 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Getting Started with Urban ERP</h1>
        <p className="text-sm text-gray-500 mt-2">
          Follow these guides to get up and running quickly. Complete them in order for the best experience.
        </p>
      </div>

      {total > 0 && (
        <ProgressTracker
          totalRead={read}
          totalPublished={total}
          completionPct={Math.round((read / total) * 100)}
          label="Onboarding Progress"
        />
      )}

      {articles && articles.length > 0 ? (
        <div className="space-y-3">
          {articles.map((article, idx) => {
            const isRead = readIds.includes(article.id)
            return (
              <Link
                key={article.id}
                to={`/handbook/articles/${article.slug}`}
                className="flex items-center gap-4 p-4 rounded-[10px] border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-800 hover:border-primary/30 hover:shadow-sm transition-all"
              >
                {/* Step number / checkmark */}
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-sm font-bold ${ isRead ? 'bg-success text-white' : 'bg-gray-100 text-gray-500' }`}
                >
                  {isRead ? (
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    idx + 1
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{article.title}</h3>
                  {article.excerpt && (
                    <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{article.excerpt}</p>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0 text-xs text-gray-400">
                  {article.estimated_read_time && <span>{article.estimated_read_time} min</span>}
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </Link>
            )
          })}
        </div>
      ) : (
        <div className="text-center py-16 text-gray-400">
          <p className="text-sm">Quick-start guides are coming soon!</p>
        </div>
      )}
    </div>
  )
}
