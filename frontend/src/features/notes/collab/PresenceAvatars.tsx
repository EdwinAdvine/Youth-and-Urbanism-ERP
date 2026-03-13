import { useNotePresence } from '../../../api/noteCollab'

const AVATAR_COLORS = [
  'bg-[#51459d]', 'bg-[#6fd943]', 'bg-[#3ec9d6]', 'bg-[#ffa21d]',
  'bg-[#ff3a6e]', 'bg-purple-500', 'bg-teal-500', 'bg-orange-500',
]

function getInitials(userId: string): string {
  // Use last 2 chars of UUID as visual identifier
  return userId.slice(-2).toUpperCase()
}

export default function PresenceAvatars({ noteId }: { noteId: string }) {
  const { data } = useNotePresence(noteId)
  const users = data?.active_users ?? []

  if (users.length === 0) return null

  const visible = users.slice(0, 4)
  const overflow = users.length - 4

  return (
    <div className="flex items-center gap-0.5" title={`${users.length} user${users.length !== 1 ? 's' : ''} editing`}>
      {visible.map((u, i) => (
        <div
          key={u.conn_id}
          className={`w-6 h-6 rounded-full ${AVATAR_COLORS[i % AVATAR_COLORS.length]} flex items-center justify-center text-[9px] font-bold text-white ring-2 ring-white dark:ring-gray-900 -ml-1 first:ml-0`}
          title={`User ${u.user_id.slice(-6)}`}
        >
          {getInitials(u.user_id)}
        </div>
      ))}
      {overflow > 0 && (
        <div className="w-6 h-6 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-[9px] font-medium text-gray-600 dark:text-gray-400 ring-2 ring-white dark:ring-gray-900 -ml-1">
          +{overflow}
        </div>
      )}
      <span className="ml-1.5 text-[10px] text-gray-400">{users.length} editing</span>
    </div>
  )
}
