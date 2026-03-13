import { useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { sanitizeHTML } from '@/shared/utils/sanitize'
import { Spinner } from '@/components/ui'
import { useHandbookArticle, useRelatedArticles, useMarkArticleRead } from '@/api/handbook'
import BreadcrumbNav from './components/BreadcrumbNav'
import TOCSidebar from './components/TOCSidebar'
import FeedbackWidget from './components/FeedbackWidget'
import ProTipBox from './components/ProTipBox'
import AIShortcutButton from './components/AIShortcutButton'
import ArticleCard from './components/ArticleCard'

function MarkdownRenderer({ html, markdown }: { html: string | null; markdown: string }) {
  // Use pre-rendered HTML if available, otherwise render markdown as-is with basic formatting
  if (html) {
    return (
      <div
        className="prose prose-sm max-w-none prose-headings:scroll-mt-20 prose-headings:font-semibold prose-a:text-primary prose-code:bg-gray-100 prose-code:px-1 prose-code:rounded"
        dangerouslySetInnerHTML={{ __html: sanitizeHTML(html) }}
      />
    )
  }

  // Basic markdown to HTML (headings get IDs for TOC linking)
  const rendered = markdown
    .replace(/^#### (.+)$/gm, (_, t) => `<h4 id="${t.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')}" class="text-base font-semibold text-gray-900 dark:text-gray-100 mt-6 mb-2 scroll-mt-20">${t}</h4>`)
    .replace(/^### (.+)$/gm, (_, t) => `<h3 id="${t.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')}" class="text-lg font-semibold text-gray-900 dark:text-gray-100 mt-8 mb-3 scroll-mt-20">${t}</h3>`)
    .replace(/^## (.+)$/gm, (_, t) => `<h2 id="${t.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')}" class="text-xl font-bold text-gray-900 dark:text-gray-100 mt-10 mb-4 scroll-mt-20">${t}</h2>`)
    .replace(/^# (.+)$/gm, (_, t) => `<h1 id="${t.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')}" class="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-10 mb-4 scroll-mt-20">${t}</h1>`)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code class="bg-gray-100 dark:bg-gray-900 px-1 rounded text-sm">$1</code>')
    .replace(/^- (.+)$/gm, '<li class="ml-4 text-sm text-gray-700 dark:text-gray-300">$1</li>')
    .replace(/^(\d+)\. (.+)$/gm, '<li class="ml-4 text-sm text-gray-700 dark:text-gray-300">$2</li>')
    .replace(/\n\n/g, '</p><p class="text-sm text-gray-700 dark:text-gray-300 leading-relaxed mb-3">')

  return (
    <div
      className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed"
      dangerouslySetInnerHTML={{ __html: sanitizeHTML(`<p class="text-sm text-gray-700 dark:text-gray-300 leading-relaxed mb-3">${rendered}</p>`) }}
    />
  )
}

export default function ArticlePage() {
  const { slug } = useParams<{ slug: string }>()
  const { data: article, isLoading } = useHandbookArticle(slug || '')
  const { data: related } = useRelatedArticles(article?.id || '')
  const markRead = useMarkArticleRead()

  // Auto-mark as read after 10 seconds
  useEffect(() => {
    if (!article) return
    const timer = setTimeout(() => {
      markRead.mutate(article.id)
    }, 10000)
    return () => clearTimeout(timer)
  }, [article?.id])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Spinner size="lg" />
      </div>
    )
  }

  if (!article) {
    return (
      <div className="p-6 text-center py-20">
        <p className="text-gray-500">Article not found.</p>
        <Link to="/handbook" className="text-primary text-sm mt-2 inline-block">
          Back to Handbook
        </Link>
      </div>
    )
  }

  return (
    <div className="p-6">
      <BreadcrumbNav category={article.category} articleTitle={article.title} />

      <div className="flex gap-8 mt-6">
        {/* Main content */}
        <div className="flex-1 min-w-0 max-w-3xl">
          {/* Title & meta */}
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{article.title}</h1>
          <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
            {article.estimated_read_time && <span>{article.estimated_read_time} min read</span>}
            <span>{article.view_count} views</span>
            <span>
              Updated{' '}
              {new Date(article.updated_at).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}
            </span>
          </div>

          {/* Featured image */}
          {article.featured_image_url && (
            <img
              src={article.featured_image_url}
              alt={article.title}
              className="w-full rounded-[10px] mt-6 border border-gray-100 dark:border-gray-800"
            />
          )}

          {/* Video embed */}
          {article.video_url && (
            <div className="mt-6 aspect-video rounded-[10px] overflow-hidden border border-gray-100 dark:border-gray-800">
              <iframe
                src={article.video_url}
                className="w-full h-full"
                allowFullScreen
                title={article.title}
              />
            </div>
          )}

          {/* Article content */}
          <div className="mt-8">
            <MarkdownRenderer html={article.content_html} markdown={article.content_markdown} />
          </div>

          {/* Quick Tips / AI shortcut */}
          {article.ai_shortcut_prompt && (
            <div className="mt-8">
              <ProTipBox title="Quick Tip">
                <p className="mb-2">
                  You can do this faster with the AI assistant!
                </p>
                <code className="block bg-white/60 px-3 py-2 rounded text-xs mb-3 border border-amber-200">
                  {article.ai_shortcut_prompt}
                </code>
                <AIShortcutButton prompt={article.ai_shortcut_prompt} />
              </ProTipBox>
            </div>
          )}

          {/* Tags */}
          {article.tags && article.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-6">
              {article.tags.map((tag) => (
                <Link
                  key={tag}
                  to={`/handbook/search?q=${encodeURIComponent(tag)}`}
                  className="px-2 py-0.5 bg-gray-50 dark:bg-gray-950 text-xs text-gray-500 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  {tag}
                </Link>
              ))}
            </div>
          )}

          {/* Feedback */}
          <div className="mt-8">
            <FeedbackWidget articleId={article.id} />
          </div>

          {/* Related articles */}
          {related && related.length > 0 && (
            <div className="mt-10">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Related Articles</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {related.map((a) => (
                  <ArticleCard key={a.id} article={a} />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* TOC sidebar */}
        <div className="w-56 shrink-0 hidden xl:block">
          <TOCSidebar markdown={article.content_markdown} />
        </div>
      </div>
    </div>
  )
}
