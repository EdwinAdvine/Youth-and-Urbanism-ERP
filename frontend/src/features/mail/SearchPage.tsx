import { useState } from 'react'
import { Card, Button, Input, Spinner, Badge } from '../../components/ui'
import { useMailSearch, type MailSearchParams, type MailThreadMessage } from '../../api/mail_ext'

export default function SearchPage() {
  const [query, setQuery] = useState('')
  const [fromFilter, setFromFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [hasAttachment, setHasAttachment] = useState(false)
  const [submitted, setSubmitted] = useState<MailSearchParams | null>(null)

  const { data, isLoading } = useMailSearch(
    submitted ?? { query: '' }
  )

  const handleSearch = () => {
    if (!query.trim()) return
    setSubmitted({
      query,
      from: fromFilter || undefined,
      date_from: dateFrom || undefined,
      date_to: dateTo || undefined,
      has_attachment: hasAttachment || undefined,
    })
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Mail Search</h1>
        <p className="text-sm text-gray-500 mt-1">Search emails with advanced filters</p>
      </div>

      <Card>
        <div className="space-y-4">
          <div className="flex gap-2">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search emails..."
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              leftIcon={
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              }
            />
            <Button onClick={handleSearch} className="shrink-0">Search</Button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Input label="From" value={fromFilter} onChange={(e) => setFromFilter(e.target.value)} placeholder="sender@..." />
            <Input label="Date From" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            <Input label="Date To" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            <div className="flex items-end pb-1">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={hasAttachment}
                  onChange={(e) => setHasAttachment(e.target.checked)}
                  className="rounded border-gray-300 text-primary focus:ring-primary"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">Has attachment</span>
              </label>
            </div>
          </div>
        </div>
      </Card>

      {/* Results */}
      {submitted && (
        <Card padding={false}>
          {isLoading ? (
            <div className="flex items-center justify-center py-16"><Spinner /></div>
          ) : !data || data.messages.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              No results found for "{submitted.query}"
            </div>
          ) : (
            <>
              <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800">
                <span className="text-sm text-gray-500">{data.total} result{data.total !== 1 ? 's' : ''}</span>
              </div>
              <div className="divide-y divide-gray-50">
                {data.messages.map((msg) => (
                  <SearchResultItem key={msg.id} message={msg} />
                ))}
              </div>
            </>
          )}
        </Card>
      )}
    </div>
  )
}

function SearchResultItem({ message }: { message: MailThreadMessage }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors cursor-pointer" onClick={() => setExpanded(!expanded)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0">
            {(message.from.name || message.from.email).charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <span className={`text-sm ${!message.read ? 'font-semibold text-gray-900' : 'text-gray-700'}`}>
              {message.from.name || message.from.email}
            </span>
            {message.has_attachments && (
              <Badge variant="default" className="ml-2">Attachment</Badge>
            )}
          </div>
        </div>
        <span className="text-xs text-gray-400 shrink-0">
          {new Date(message.date).toLocaleDateString()}
        </span>
      </div>

      {expanded && (
        <div className="mt-3 ml-11">
          <div className="text-xs text-gray-400 mb-1">
            To: {message.to.map((t) => t.name || t.email).join(', ')}
          </div>
          {message.html_body ? (
            <div className="text-sm text-gray-600 dark:text-gray-400 prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: message.html_body }} />
          ) : (
            <p className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap line-clamp-6">{message.text_body}</p>
          )}
        </div>
      )}
    </div>
  )
}
