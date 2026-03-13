import { useState } from 'react'
import { sanitizeHTML } from '@/shared/utils/sanitize'
import { Card, Button, Spinner, Badge } from '../../components/ui'
import { useMailThreads, type MailThread, type MailThreadMessage } from '../../api/mail_ext'

export default function ThreadView() {
  const [folder, setFolder] = useState('inbox')
  const [page, setPage] = useState(1)
  const { data, isLoading } = useMailThreads({ folder, page, limit: 20 })
  const [expandedThread, setExpandedThread] = useState<string | null>(null)

  const threads = data?.threads ?? []
  const total = data?.total ?? 0

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Mail Threads</h1>
          <p className="text-sm text-gray-500 mt-1">Gmail-style threaded conversation view</p>
        </div>
        <div className="flex gap-2">
          {['inbox', 'sent', 'drafts', 'trash'].map((f) => (
            <Button
              key={f}
              size="sm"
              variant={folder === f ? 'primary' : 'outline'}
              onClick={() => { setFolder(f); setPage(1); setExpandedThread(null) }}
              className="capitalize"
            >
              {f}
            </Button>
          ))}
        </div>
      </div>

      <Card padding={false}>
        {isLoading ? (
          <div className="flex items-center justify-center py-24"><Spinner /></div>
        ) : threads.length === 0 ? (
          <div className="text-center py-16 text-gray-400">No threads in {folder}</div>
        ) : (
          <div className="divide-y divide-gray-50">
            {threads.map((thread) => (
              <ThreadItem
                key={thread.id}
                thread={thread}
                expanded={expandedThread === thread.id}
                onToggle={() => setExpandedThread(expandedThread === thread.id ? null : thread.id)}
              />
            ))}
          </div>
        )}
      </Card>

      {total > 20 && (
        <div className="flex items-center justify-center gap-2">
          <Button size="sm" variant="outline" disabled={page === 1} onClick={() => setPage(page - 1)}>Previous</Button>
          <span className="text-sm text-gray-500">Page {page} of {Math.ceil(total / 20)}</span>
          <Button size="sm" variant="outline" disabled={page * 20 >= total} onClick={() => setPage(page + 1)}>Next</Button>
        </div>
      )}
    </div>
  )
}

function ThreadItem({
  thread,
  expanded,
  onToggle,
}: {
  thread: MailThread
  expanded: boolean
  onToggle: () => void
}) {
  return (
    <div>
      {/* Thread header */}
      <div
        className={`flex items-center gap-4 px-4 py-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors ${ thread.has_unread ? 'bg-primary/5' : '' }`}
        onClick={onToggle}
      >
        <div className="flex items-center gap-2 w-40 shrink-0">
          {thread.participants.slice(0, 2).map((p, i) => (
            <div
              key={i}
              className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0"
              title={p.email}
            >
              {(p.name || p.email).charAt(0).toUpperCase()}
            </div>
          ))}
          {thread.participants.length > 2 && (
            <span className="text-xs text-gray-400">+{thread.participants.length - 2}</span>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={`text-sm truncate ${thread.has_unread ? 'font-semibold text-gray-900' : 'text-gray-700'}`}>
              {thread.subject || '(No subject)'}
            </span>
            <Badge variant="default" className="shrink-0">{thread.message_count}</Badge>
          </div>
          <p className="text-xs text-gray-400 truncate mt-0.5">{thread.snippet}</p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {thread.labels.map((l) => (
            <Badge key={l} variant="info" className="text-xs">{l}</Badge>
          ))}
          <span className="text-xs text-gray-400 w-20 text-right">
            {new Date(thread.last_message_date).toLocaleDateString('en', { month: 'short', day: 'numeric' })}
          </span>
          <svg
            className={`w-4 h-4 text-gray-400 transition-transform ${expanded ? 'rotate-180' : ''}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>

      {/* Expanded messages */}
      {expanded && thread.messages && (
        <div className="border-t border-gray-100 dark:border-gray-800 bg-gray-50/50">
          {thread.messages.map((msg, idx) => (
            <MessageItem key={msg.id} message={msg} isLast={idx === thread.messages.length - 1} />
          ))}
        </div>
      )}
    </div>
  )
}

function MessageItem({ message, isLast }: { message: MailThreadMessage; isLast: boolean }) {
  const [collapsed, setCollapsed] = useState(!isLast)

  return (
    <div className="px-6 py-3 border-b border-gray-100 dark:border-gray-800 last:border-0">
      <div
        className="flex items-center justify-between cursor-pointer"
        onClick={() => setCollapsed(!collapsed)}
      >
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0">
            {(message.from.name || message.from.email).charAt(0).toUpperCase()}
          </div>
          <div>
            <span className={`text-sm ${!message.read ? 'font-semibold' : ''} text-gray-700 dark:text-gray-300`}>
              {message.from.name || message.from.email}
            </span>
            {message.has_attachments && (
              <svg className="w-3.5 h-3.5 text-gray-400 inline ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
              </svg>
            )}
          </div>
        </div>
        <span className="text-xs text-gray-400">
          {new Date(message.date).toLocaleString()}
        </span>
      </div>

      {!collapsed && (
        <div className="mt-3 ml-9">
          <div className="text-xs text-gray-400 mb-2">
            To: {message.to.map((t) => t.name || t.email).join(', ')}
          </div>
          {message.html_body ? (
            <div
              className="text-sm text-gray-600 dark:text-gray-400 prose prose-sm max-w-none"
              dangerouslySetInnerHTML={{ __html: sanitizeHTML(message.html_body) }}
            />
          ) : (
            <p className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap">{message.text_body}</p>
          )}
        </div>
      )}
    </div>
  )
}
