import { Link } from 'react-router-dom'
import type { HandbookArticle } from '@/api/handbook'

interface ArticleCardProps {
  article: HandbookArticle
  isRead?: boolean
}

const TYPE_COLORS: Record<string, string> = {
  guide: 'bg-primary/10 text-primary',
  quickstart: 'bg-success/10 text-green-700',
  faq: 'bg-info/10 text-cyan-700',
  release_note: 'bg-warning/10 text-amber-700',
  pro_tip: 'bg-danger/10 text-red-600',
}

const TYPE_LABELS: Record<string, string> = {
  guide: 'Guide',
  quickstart: 'Quick Start',
  faq: 'FAQ',
  release_note: 'Release Note',
  pro_tip: 'Pro Tip',
}

export default function ArticleCard({ article, isRead }: ArticleCardProps) {
  return (
    <Link
      to={`/handbook/articles/${article.slug}`}
      className="group block rounded-[10px] border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-800 p-5 transition-all hover:border-primary/30 hover:shadow-sm"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-2">
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${ TYPE_COLORS[article.article_type] || 'bg-gray-100 text-gray-600' }`}
            >
              {TYPE_LABELS[article.article_type] || article.article_type}
            </span>
            {article.module && (
              <span className="text-[10px] text-gray-400 uppercase tracking-wide">
                {article.module}
              </span>
            )}
            {article.is_pinned && (
              <svg className="h-3.5 w-3.5 text-warning" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
            )}
          </div>

          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 group-hover:text-primary transition-colors line-clamp-2">
            {article.title}
          </h3>

          {article.excerpt && (
            <p className="mt-1.5 text-xs text-gray-500 line-clamp-2">{article.excerpt}</p>
          )}

          <div className="flex items-center gap-3 mt-3 text-[10px] text-gray-400">
            {article.estimated_read_time && (
              <span>{article.estimated_read_time} min read</span>
            )}
            <span>{article.view_count} views</span>
            {article.helpful_count > 0 && (
              <span>{article.helpful_count} found helpful</span>
            )}
          </div>
        </div>

        {isRead && (
          <div className="shrink-0 mt-1">
            <svg className="h-5 w-5 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        )}
      </div>

      {article.tags && article.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-3">
          {article.tags.slice(0, 4).map((tag) => (
            <span key={tag} className="px-1.5 py-0.5 bg-gray-50 dark:bg-gray-950 text-[10px] text-gray-500 rounded">
              {tag}
            </span>
          ))}
        </div>
      )}
    </Link>
  )
}
