import { useState } from 'react'
import { Spinner } from '@/components/ui'
import { useHandbookAnalytics } from '@/api/handbook'
import BreadcrumbNav from './components/BreadcrumbNav'
import ArticleCard from './components/ArticleCard'

export default function HandbookAnalytics() {
  const [days, setDays] = useState(30)
  const { data, isLoading } = useHandbookAnalytics(days)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Spinner size="lg" />
      </div>
    )
  }

  if (!data) return null

  return (
    <div className="p-6 space-y-6">
      <BreadcrumbNav articleTitle="Analytics" />

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Handbook Analytics</h1>
        <select
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
          className="rounded-[10px] border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 py-1.5 px-3 text-sm"
        >
          <option value={7}>Last 7 days</option>
          <option value={30}>Last 30 days</option>
          <option value={90}>Last 90 days</option>
          <option value={365}>Last year</option>
        </select>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-[10px] border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-800 p-4">
          <div className="text-2xl font-bold text-primary">{data.total_views}</div>
          <div className="text-xs text-gray-500 mt-1">Total Views ({days}d)</div>
        </div>
        <div className="rounded-[10px] border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-800 p-4">
          <div className="text-2xl font-bold text-info">{data.total_feedback}</div>
          <div className="text-xs text-gray-500 mt-1">Total Feedback</div>
        </div>
        <div className="rounded-[10px] border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-800 p-4">
          <div className="text-2xl font-bold text-success">{data.status_counts.published || 0}</div>
          <div className="text-xs text-gray-500 mt-1">Published Articles</div>
        </div>
        <div className="rounded-[10px] border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-800 p-4">
          <div className="text-2xl font-bold text-warning">{data.status_counts.draft || 0}</div>
          <div className="text-xs text-gray-500 mt-1">Drafts</div>
        </div>
      </div>

      {/* Most viewed */}
      {data.most_viewed.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">Most Viewed</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {data.most_viewed.map((article) => (
              <ArticleCard key={article.id} article={article} />
            ))}
          </div>
        </div>
      )}

      {/* Most helpful */}
      {data.most_helpful.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">Most Helpful</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {data.most_helpful.map((article) => (
              <ArticleCard key={article.id} article={article} />
            ))}
          </div>
        </div>
      )}

      {/* Needs improvement */}
      {data.least_helpful.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">Needs Improvement</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {data.least_helpful.map((article) => (
              <ArticleCard key={article.id} article={article} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
