import { useState } from 'react'
import { Card, Button, Input, Select, Spinner, toast } from '@/components/ui'
import {
  useRecognitions,
  useCreateRecognition,
  useDeleteRecognition,
  useRecognitionLeaderboard,
  type Recognition,
} from '@/api/hr_engagement'
import { useAuthStore } from '@/store/auth'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TYPE_CONFIG: Record<
  Recognition['recognition_type'],
  { label: string; color: string; bg: string; emoji: string }
> = {
  kudos:    { label: 'Kudos',    color: 'text-blue-700',   bg: 'bg-blue-100',   emoji: '👏' },
  badge:    { label: 'Badge',    color: 'text-purple-700', bg: 'bg-purple-100', emoji: '🏅' },
  shoutout: { label: 'Shoutout', color: 'text-green-700',  bg: 'bg-green-100',  emoji: '📣' },
  award:    { label: 'Award',    color: 'text-yellow-700', bg: 'bg-yellow-100', emoji: '🏆' },
}

function getInitials(name: string) {
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins  = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days  = Math.floor(diff / 86400000)
  if (mins < 1)   return 'just now'
  if (mins < 60)  return `${mins}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days < 7)   return `${days}d ago`
  return new Date(dateStr).toLocaleDateString()
}

// ─── Avatar ───────────────────────────────────────────────────────────────────

function Avatar({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' | 'lg' }) {
  const sizes = { sm: 'h-8 w-8 text-xs', md: 'h-10 w-10 text-sm', lg: 'h-12 w-12 text-base' }
  const colors = ['#51459d', '#3ec9d6', '#6fd943', '#ffa21d', '#ff3a6e', '#8b5cf6']
  const colorIndex = name.charCodeAt(0) % colors.length
  return (
    <div
      className={`${sizes[size]} flex flex-shrink-0 items-center justify-center rounded-full font-bold text-white`}
      style={{ backgroundColor: colors[colorIndex] }}
    >
      {getInitials(name)}
    </div>
  )
}

// ─── Recognition Card ─────────────────────────────────────────────────────────

interface RecognitionCardProps {
  recognition: Recognition
  currentEmployeeId?: string
  onDelete: (id: string) => void
  isDeleting: boolean
}

function RecognitionCard({ recognition, currentEmployeeId, onDelete, isDeleting }: RecognitionCardProps) {
  const fromName = recognition.from_employee?.user?.full_name ?? 'A colleague'
  const toName   = recognition.to_employee?.user?.full_name   ?? 'a team member'
  const cfg      = TYPE_CONFIG[recognition.recognition_type]
  const isOwn    = recognition.from_employee_id === currentEmployeeId

  return (
    <Card className="hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          {/* From avatar */}
          <Avatar name={fromName} />

          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
              <span className="font-semibold text-sm text-gray-900 dark:text-gray-100">{fromName}</span>
              <span className="text-xs text-gray-400">recognized</span>
              <span className="font-semibold text-sm text-gray-900 dark:text-gray-100">{toName}</span>
            </div>

            {/* Type badge */}
            <div className="mb-2">
              <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${cfg.bg} ${cfg.color}`}>
                {cfg.emoji} {cfg.label}
                {recognition.recognition_type === 'badge' && recognition.badge_name && (
                  <span className="font-bold">· {recognition.badge_name}</span>
                )}
              </span>
            </div>

            {/* Message */}
            <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed mb-3">
              {recognition.message}
            </p>

            {/* Footer */}
            <div className="flex items-center gap-3 flex-wrap">
              {recognition.points > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 text-amber-700 px-2.5 py-0.5 text-xs font-semibold">
                  ✨ {recognition.points} pts
                </span>
              )}
              <span className="text-xs text-gray-400">{timeAgo(recognition.created_at)}</span>
              {!recognition.is_public && (
                <span className="text-xs text-gray-400 italic">Private</span>
              )}
            </div>
          </div>
        </div>

        {isOwn && (
          <button
            onClick={() => onDelete(recognition.id)}
            disabled={isDeleting}
            className="flex-shrink-0 rounded-full p-1.5 text-gray-300 hover:text-danger hover:bg-red-50 transition-colors disabled:opacity-50"
            title="Delete"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        )}
      </div>
    </Card>
  )
}

// ─── Give Recognition Form ────────────────────────────────────────────────────

function GiveRecognitionForm({ onSuccess }: { onSuccess: () => void }) {
  const createRecognition = useCreateRecognition()
  const { user } = useAuthStore()

  const [toEmployee, setToEmployee]       = useState('')
  const [type, setType]                   = useState<Recognition['recognition_type']>('kudos')
  const [badgeName, setBadgeName]         = useState('')
  const [message, setMessage]             = useState('')
  const [points, setPoints]               = useState(10)
  const [isPublic, setIsPublic]           = useState(true)
  const [expanded, setExpanded]           = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!toEmployee.trim()) { toast('error', 'Recipient is required'); return }
    if (!message.trim())    { toast('error', 'Message is required');   return }

    try {
      await createRecognition.mutateAsync({
        from_employee_id:  user?.id ?? '',
        to_employee_id:    toEmployee.trim(),
        recognition_type:  type,
        badge_name:        type === 'badge' ? badgeName.trim() || null : null,
        message:           message.trim(),
        points,
        is_public:         isPublic,
        from_employee_id_: undefined,
      } as any)
      toast('success', 'Recognition sent!')
      setToEmployee('')
      setMessage('')
      setBadgeName('')
      setPoints(10)
      setExpanded(false)
      onSuccess()
    } catch {
      toast('error', 'Failed to send recognition')
    }
  }

  return (
    <Card className="border-2" style={{ borderColor: '#51459d20' }}>
      {!expanded ? (
        <button
          onClick={() => setExpanded(true)}
          className="flex w-full items-center gap-3 text-left"
        >
          <div
            className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-white"
            style={{ backgroundColor: '#51459d' }}
          >
            🏅
          </div>
          <p className="text-sm text-gray-400">Give someone a recognition…</p>
        </button>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">Give Recognition</h3>
            <button
              type="button"
              onClick={() => setExpanded(false)}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input
              label="To (Employee ID or name)"
              placeholder="e.g., emp-001"
              value={toEmployee}
              onChange={(e) => setToEmployee(e.target.value)}
            />
            <Select
              label="Recognition Type"
              value={type}
              onChange={(e) => setType(e.target.value as Recognition['recognition_type'])}
              options={[
                { value: 'kudos',    label: '👏 Kudos' },
                { value: 'badge',    label: '🏅 Badge' },
                { value: 'shoutout', label: '📣 Shoutout' },
                { value: 'award',    label: '🏆 Award' },
              ]}
            />
          </div>

          {type === 'badge' && (
            <Input
              label="Badge Name"
              placeholder="e.g., Team Player, Innovation Star"
              value={badgeName}
              onChange={(e) => setBadgeName(e.target.value)}
            />
          )}

          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Message</label>
            <textarea
              className="w-full rounded-[10px] border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary resize-none"
              rows={3}
              placeholder="Why are you recognizing this person?"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-700 dark:text-gray-300">Points:</label>
              <input
                type="number"
                min={0}
                max={1000}
                step={5}
                value={points}
                onChange={(e) => setPoints(Number(e.target.value))}
                className="w-20 rounded-[10px] border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="relative inline-flex cursor-pointer items-center">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={isPublic}
                  onChange={(e) => setIsPublic(e.target.checked)}
                />
                <div className="h-5 w-9 rounded-full bg-gray-200 peer-checked:bg-primary transition-colors after:absolute after:left-0.5 after:top-0.5 after:h-4 after:w-4 after:rounded-full after:bg-white after:transition-transform peer-checked:after:translate-x-4" />
              </label>
              <span className="text-sm text-gray-700 dark:text-gray-300">Public</span>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={() => setExpanded(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" loading={createRecognition.isPending}>
              Send Recognition
            </Button>
          </div>
        </form>
      )}
    </Card>
  )
}

// ─── Leaderboard Sidebar ──────────────────────────────────────────────────────

function LeaderboardSidebar() {
  const { data: leaders, isLoading } = useRecognitionLeaderboard()

  const MEDAL = ['🥇', '🥈', '🥉']

  return (
    <Card>
      <h3 className="mb-4 font-semibold text-gray-900 dark:text-gray-100">Top Recognized This Month</h3>
      {isLoading ? (
        <div className="flex justify-center py-4">
          <Spinner size="sm" />
        </div>
      ) : !leaders || leaders.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-4">No data yet</p>
      ) : (
        <ol className="space-y-3">
          {leaders.slice(0, 10).map((leader, i) => (
            <li key={leader.employee_id} className="flex items-center gap-2.5">
              <span className="text-base flex-shrink-0 w-6 text-center">
                {i < 3 ? MEDAL[i] : <span className="text-xs font-bold text-gray-400">{i + 1}</span>}
              </span>
              <Avatar name={leader.employee_name} size="sm" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                  {leader.employee_name}
                </p>
                <p className="text-xs text-gray-400">{leader.recognition_count} recognitions</p>
              </div>
              <span className="text-sm font-bold text-amber-500 flex-shrink-0">
                {leader.points} pts
              </span>
            </li>
          ))}
        </ol>
      )}
    </Card>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function RecognitionFeedPage() {
  const [page, setPage]         = useState(1)
  const deleteRecognition       = useDeleteRecognition()
  const { user }                = useAuthStore()

  const { data, isLoading, refetch } = useRecognitions({ page, limit: 10 })

  const recognitions = data?.items ?? []
  const hasMore      = data ? page * 10 < data.total : false

  function handleDelete(id: string) {
    deleteRecognition.mutate(id, {
      onSuccess: () => toast('success', 'Recognition deleted'),
      onError:   () => toast('error', 'Failed to delete'),
    })
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Recognition Feed</h1>
        <p className="text-sm text-gray-500">Celebrate your colleagues' contributions</p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Feed (left 2/3) */}
        <div className="space-y-4 lg:col-span-2">
          <GiveRecognitionForm onSuccess={() => refetch()} />

          {isLoading ? (
            <div className="flex justify-center py-12">
              <Spinner size="lg" />
            </div>
          ) : recognitions.length === 0 ? (
            <Card>
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <span className="text-5xl mb-3">🏅</span>
                <p className="text-gray-500">No recognitions yet. Be the first to celebrate a colleague!</p>
              </div>
            </Card>
          ) : (
            <>
              {recognitions.map((r) => (
                <RecognitionCard
                  key={r.id}
                  recognition={r}
                  currentEmployeeId={user?.id}
                  onDelete={handleDelete}
                  isDeleting={deleteRecognition.isPending}
                />
              ))}

              {hasMore && (
                <div className="flex justify-center">
                  <Button
                    variant="outline"
                    onClick={() => setPage((p) => p + 1)}
                    loading={isLoading}
                  >
                    Load More
                  </Button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <LeaderboardSidebar />

          {/* Type Legend */}
          <Card>
            <h3 className="mb-3 text-sm font-semibold text-gray-700 dark:text-gray-300">Recognition Types</h3>
            <div className="space-y-2">
              {Object.entries(TYPE_CONFIG).map(([key, cfg]) => (
                <div key={key} className="flex items-center gap-2">
                  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${cfg.bg} ${cfg.color}`}>
                    {cfg.emoji} {cfg.label}
                  </span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
