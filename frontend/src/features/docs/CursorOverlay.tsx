/**
 * CursorOverlay — shows colored name labels for co-editors over the ONLYOFFICE iframe.
 *
 * Subscribes to useDocPresence and renders floating avatar badges.
 * Since ONLYOFFICE handles real-time cursor rendering inside its iframe,
 * this component shows an ambient "who is here" overlay in the editor chrome.
 */
import { useDocPresence, PresenceUser } from '../../hooks/useDocPresence'

// Deterministic color from user_id string
const CURSOR_COLORS = [
  '#6366f1', // indigo
  '#ec4899', // pink
  '#f59e0b', // amber
  '#10b981', // emerald
  '#3b82f6', // blue
  '#8b5cf6', // violet
  '#ef4444', // red
  '#14b8a6', // teal
]

function colorForUser(userId: string): string {
  let hash = 0
  for (let i = 0; i < userId.length; i++) {
    hash = (hash * 31 + userId.charCodeAt(i)) | 0
  }
  return CURSOR_COLORS[Math.abs(hash) % CURSOR_COLORS.length]
}

function initials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('')
}

interface UserBadgeProps {
  user: PresenceUser
  index: number
}

function UserBadge({ user, index }: UserBadgeProps) {
  const color = colorForUser(user.user_id)
  return (
    <div
      title={`${user.user_name} is editing`}
      style={{
        position: 'absolute',
        top: 12,
        right: 12 + index * 32,
        width: 28,
        height: 28,
        borderRadius: '50%',
        backgroundColor: color,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#fff',
        fontSize: 11,
        fontWeight: 700,
        border: '2px solid #fff',
        boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
        cursor: 'default',
        zIndex: 10,
        transition: 'right 0.2s ease',
        userSelect: 'none',
      }}
    >
      {initials(user.user_name)}
    </div>
  )
}

interface CursorOverlayProps {
  fileId: string | null
  /** Whether to show the "Live" dot indicator */
  showConnectedDot?: boolean
}

export default function CursorOverlay({ fileId, showConnectedDot = true }: CursorOverlayProps) {
  const { users, connected } = useDocPresence(fileId)

  if (!fileId) return null

  const others = users.filter(Boolean)

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        right: 0,
        left: 0,
        height: 0,
        pointerEvents: 'none',
        overflow: 'visible',
        zIndex: 10,
      }}
    >
      {/* Presence avatars */}
      {others.map((user, i) => (
        <UserBadge key={user.user_id} user={user} index={i} />
      ))}

      {/* Live dot */}
      {showConnectedDot && (
        <div
          title={connected ? 'Live collaboration active' : 'Connecting…'}
          style={{
            position: 'absolute',
            top: 14,
            left: 12,
            width: 8,
            height: 8,
            borderRadius: '50%',
            backgroundColor: connected ? '#6fd943' : '#ffa21d',
            boxShadow: connected ? '0 0 0 2px rgba(111,217,67,0.3)' : 'none',
            animation: connected ? 'pulse 2s infinite' : 'none',
            pointerEvents: 'none',
          }}
        />
      )}
    </div>
  )
}
