import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Input, Spinner } from '@/components/ui'
import { useHandbookSearch } from '@/api/handbook'
import BreadcrumbNav from './components/BreadcrumbNav'
import ArticleCard from './components/ArticleCard'

export default function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const initialQ = searchParams.get('q') || ''
  const [query, setQuery] = useState(initialQ)
  const [debouncedQ, setDebouncedQ] = useState(initialQ)

  const { data, isLoading } = useHandbookSearch(debouncedQ)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setQuery(val)
    // Simple debounce
    clearTimeout((window as any).__handbookSearchTimer)
    ;(window as any).__handbookSearchTimer = setTimeout(() => {
      setDebouncedQ(val)
      if (val.trim()) {
        setSearchParams({ q: val.trim() })
      }
    }, 300)
  }

  return (
    <div className="p-6 space-y-6">
      <BreadcrumbNav articleTitle="Search" />

      <div>
        <h1 className="text-2xl font-bold text-gray-900">Search the Handbook</h1>
        <p className="text-sm text-gray-500 mt-1">
          Find guides, tutorials, and answers using natural language.
        </p>
      </div>

      <div className="max-w-xl">
        <Input
          placeholder="How do I approve a purchase order?"
          value={query}
          onChange={handleChange}
          autoFocus
          leftIcon={
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          }
        />
      </div>

      {isLoading && debouncedQ && (
        <div className="flex items-center justify-center py-12">
          <Spinner size="lg" />
        </div>
      )}

      {data && !isLoading && (
        <>
          <p className="text-sm text-gray-500">
            {data.total} result{data.total !== 1 ? 's' : ''} for "{data.query}"
          </p>
          {data.articles.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {data.articles.map((article) => (
                <ArticleCard key={article.id} article={article} />
              ))}
            </div>
          ) : (
            <div className="text-center py-16 text-gray-400">
              <p className="text-sm">No articles match your search. Try different keywords.</p>
            </div>
          )}
        </>
      )}

      {!debouncedQ && (
        <div className="text-center py-16 text-gray-400">
          <svg className="h-10 w-10 mx-auto mb-2 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <p className="text-sm">Start typing to search articles...</p>
        </div>
      )}
    </div>
  )
}
