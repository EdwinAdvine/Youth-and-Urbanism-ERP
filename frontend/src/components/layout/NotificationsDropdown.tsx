/**
 * NotificationsDropdown — bell-icon notification panel in the AppShell header.
 *
 * Fetches notifications via `api/notifications` (TanStack Query, 30s stale
 * time) and displays an unread-count badge. Clicking the bell opens a dropdown
 * list of recent notifications with relative timestamps ("2 min ago").
 *
 * Mark-as-read:
 * - Clicking an individual notification → `useMarkRead` mutation
 * - "Mark all read" button → `useMarkAllRead` mutation
 *
 * Navigates to the notification's linked route on click.
 * Closes on outside-click via a `mousedown` listener on `document`.
 */
import { useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  useNotifications,
  useUnreadCount,
  useMarkRead,
  useMarkAllRead,
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

// ─── Dropdown Item ────────────────────────────────────────────────────────────

function DropdownItem({
  notification,
  onClose,
}: {
  notification: Notification
  onClose: () => void
}) {
  const navigate = useNavigate()
  const markRead = useMarkRead()

  const handleClick = () => {
    if (!notification.is_read) {
      markRead.mutate(notification.id)
    }
    onClose()
    if (notification.link_url) {
      navigate(notification.link_url)
    } else {
      navigate('/notifications')
    }
  }

  return (
    <button
      onClick={handleClick}
      className={`w-full text-left flex items-start gap-3 px-4 py-3 transition-colors hover:bg-gray-50 dark:hover:bg-gray-700 ${
        !notification.is_read ? 'bg-primary/5' : ''
      }`}
    >
      <span className="text-base shrink-0 mt-0.5">{notifTypeIcon(notification.type)}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-start gap-1">
          <p className={`text-sm leading-snug flex-1 truncate ${!notification.is_read ? 'font-semibold text-gray-900 dark:text-gray-100' : 'text-gray-700 dark:text-gray-300'}`}>
            {notification.title}
          </p>
          {!notification.is_read && (
            <span className="shrink-0 h-2 w-2 mt-1.5 rounded-full bg-primary" />
          )}
        </div>
        <p className="text-xs text-gray-400 mt-0.5">{timeAgo(notification.created_at)}</p>
      </div>
    </button>
  )
}

// ─── Notifications Dropdown ───────────────────────────────────────────────────

interface NotificationsDropdownProps {
  open: boolean
  onToggle: () => void
  onClose: () => void
}

export function NotificationsDropdown({ open, onToggle, onClose }: NotificationsDropdownProps) {
  const navigate = useNavigate()
  const containerRef = useRef<HTMLDivElement>(null)
  const markAllRead = useMarkAllRead()

  const { data: unreadData } = useUnreadCount()
  const { data: notifications, isLoading } = useNotifications({ limit: 5 })

  const unreadCount = unreadData?.count ?? 0

  // Click-outside detection
  useEffect(() => {
    if (!open) return
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open, onClose])

  const handleMarkAllRead = (e: React.MouseEvent) => {
    e.stopPropagation()
    markAllRead.mutate()
  }

  const handleViewAll = () => {
    onClose()
    navigate('/notifications')
  }

  return (
    <div ref={containerRef} className="relative">
      {/* Bell button */}
      <button
        onClick={onToggle}
        className="relative p-2 rounded-[8px] hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
        title="Notifications"
      >
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 h-4 w-4 rounded-full bg-danger flex items-center justify-center text-white text-[9px] font-bold leading-none">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="absolute right-0 mt-1 w-80 bg-white dark:bg-gray-800 rounded-[10px] shadow-xl border border-gray-100 dark:border-gray-700 z-50 overflow-hidden">
          {/* Header */}
          <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-sm">Notifications</h3>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                disabled={markAllRead.isPending}
                className="text-xs text-primary hover:text-primary/80 font-medium transition-colors disabled:opacity-50"
              >
                Mark all read
              </button>
            )}
          </div>

          {/* Notification list */}
          <div className="max-h-[340px] overflow-y-auto">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <svg className="animate-spin h-5 w-5 text-primary" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
              </div>
            ) : !notifications || notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center px-4">
                <span className="text-2xl mb-2">🔔</span>
                <p className="text-sm text-gray-500">No new notifications</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50 dark:divide-gray-700">
                {notifications.map((notif) => (
                  <DropdownItem
                    key={notif.id}
                    notification={notif}
                    onClose={onClose}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-gray-100 dark:border-gray-700">
            <button
              onClick={handleViewAll}
              className="w-full px-4 py-3 text-sm font-medium text-primary hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-center"
            >
              View all notifications
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default NotificationsDropdown
