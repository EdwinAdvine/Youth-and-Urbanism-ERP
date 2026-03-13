import { useState } from 'react'
import { Button, Badge, Spinner, toast } from '../../components/ui'
import { useNavigate } from 'react-router-dom'
import {
  useNotifications,
  useMarkRead,
  useMarkAllRead,
  useDeleteNotification,
  useCreateTestNotification,
} from '../../api/notifications'
import type { Notification } from '../../api/notifications'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(dateStr: string): string {
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diffMs = now - then
  const diffSeconds = Math.floor(diffMs / 1000)
  const diffMinutes = Math.floor(diffSeconds / 60)
  const diffHours = Math.floor(diffMinutes / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffSeconds < 60) return 'just now'
  if (diffMinutes < 60) return `${diffMinutes}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return `${Math.floor(diffDays / 7)}w ago`
}

function notifTypeIcon(type: string): string {
  const icons: Record<string, string> = {
    success: '✅',
    warning: '⚠️',
    error: '❌',
    info: 'ℹ️',
  }
  return icons[type?.toLowerCase()] ?? 'ℹ️'
}

function notifTypeBadgeVariant(type: string): 'success' | 'warning' | 'danger' | 'info' | 'default' {
  const map: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'default'> = {
    success: 'success',
    warning: 'warning',
    error: 'danger',
    info: 'info',
  }
  return map[type?.toLowerCase()] ?? 'default'
}

// ─── Notification Row ─────────────────────────────────────────────────────────

function NotificationRow({ notification }: { notification: Notification }) {
  const navigate = useNavigate()
  const markRead = useMarkRead()
  const deleteNotif = useDeleteNotification()

  const handleClick = () => {
    if (!notification.is_read) {
      markRead.mutate(notification.id)
    }
    if (notification.link_url) {
      navigate(notification.link_url)
    }
  }

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation()
    deleteNotif.mutate(notification.id, {
      onError: () => toast('error', 'Failed to delete notification'),
    })
  }

  return (
    <div
      onClick={handleClick}
      className={`group flex items-start gap-4 p-4 rounded-[10px] transition-colors cursor-pointer ${ notification.is_read ? 'hover:bg-gray-50 dark:hover:bg-gray-800' : 'bg-primary/5 hover:bg-primary/10' }`}
    >
      {/* Type icon */}
      <span className="text-xl shrink-0 mt-0.5">{notifTypeIcon(notification.type)}</span>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className={`text-sm leading-snug ${notification.is_read ? 'text-gray-700' : 'font-semibold text-gray-900'}`}>
            {notification.title}
          </p>
          {!notification.is_read && (
            <span className="shrink-0 mt-1 h-2 w-2 rounded-full bg-primary" />
          )}
        </div>
        <p className="text-sm text-gray-500 mt-0.5 leading-snug">{notification.message}</p>
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          <span className="text-xs text-gray-400">{timeAgo(notification.created_at)}</span>
          {notification.module && (
            <Badge variant={notifTypeBadgeVariant(notification.type)} className="capitalize">
              {notification.module}
            </Badge>
          )}
        </div>
      </div>

      {/* Delete button */}
      <button
        onClick={handleDelete}
        disabled={deleteNotif.isPending}
        className="shrink-0 opacity-0 group-hover:opacity-100 text-gray-400 hover:text-danger transition-all p-1 rounded-[6px] hover:bg-red-50"
        title="Delete notification"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  )
}

// ─── Notifications Page ───────────────────────────────────────────────────────

type FilterTab = 'all' | 'unread'

export default function NotificationsPage() {
  const [filter, setFilter] = useState<FilterTab>('all')
  const markAllRead = useMarkAllRead()
  const createTest = useCreateTestNotification()

  const queryParams = filter === 'unread' ? { is_read: false } : {}
  const { data: notifications, isLoading } = useNotifications(queryParams)

  const handleMarkAllRead = () => {
    markAllRead.mutate(undefined, {
      onSuccess: () => toast('success', 'All notifications marked as read'),
      onError: () => toast('error', 'Failed to mark all as read'),
    })
  }

  const handleSendTest = () => {
    createTest.mutate(undefined, {
      onSuccess: () => toast('success', 'Test notification created'),
      onError: () => toast('error', 'Failed to create test notification'),
    })
  }

  return (
    <div className="p-3 sm:p-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 sm:mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Notifications</h1>
          <p className="text-sm text-gray-500 mt-1">Stay up to date with activity across your workspace</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSendTest}
            loading={createTest.isPending}
            disabled={createTest.isPending}
            title="Send a test notification to verify the system is working"
          >
            Send test
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleMarkAllRead}
            loading={markAllRead.isPending}
            disabled={markAllRead.isPending}
          >
            Mark all read
          </Button>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 mb-5 border-b border-gray-100 dark:border-gray-800">
        {(['all', 'unread'] as FilterTab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setFilter(tab)}
            className={`px-4 py-2.5 text-sm font-medium capitalize transition-colors border-b-2 -mb-px ${ filter === tab ? 'text-primary border-primary' : 'text-gray-500 border-transparent hover:text-gray-700 hover:border-gray-200' }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Spinner />
        </div>
      ) : !notifications || notifications.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center text-3xl mb-4">
            🔔
          </div>
          <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">You&apos;re all caught up!</h3>
          <p className="text-sm text-gray-500 mt-1">
            {filter === 'unread' ? 'No unread notifications.' : 'No notifications yet.'}
          </p>
        </div>
      ) : (
        <div className="space-y-1">
          {notifications.map((notif) => (
            <NotificationRow key={notif.id} notification={notif} />
          ))}
        </div>
      )}
    </div>
  )
}
