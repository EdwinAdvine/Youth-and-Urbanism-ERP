import { useState } from 'react'
import { Mail, Check, X, Clock, Calendar, User, Video } from 'lucide-react'
import { Card, Button, Badge, Spinner } from '../../components/ui'
import { useMeetings } from '../../api/meetings'
import { useMeetingRSVP } from '../../api/meetings_ext'

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleDateString('en-KE', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatDuration(start: string, end: string) {
  const ms = new Date(end).getTime() - new Date(start).getTime()
  const mins = Math.round(ms / 60000)
  if (mins < 60) return `${mins} min`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m ? `${h}h ${m}m` : `${h}h`
}

type RSVPStatus = 'accepted' | 'declined' | 'tentative' | null

interface InviteCardProps {
  id: string
  title: string
  startTime: string
  endTime: string
  organizer?: string
  jitsiRoom?: string
}

function InviteCard({ id, title, startTime, endTime, jitsiRoom }: InviteCardProps) {
  const rsvp = useMeetingRSVP()
  const [status, setStatus] = useState<RSVPStatus>(null)

  const respond = (response: 'accepted' | 'declined' | 'tentative') => {
    rsvp.mutate(
      { meeting_id: id, response },
      { onSuccess: () => setStatus(response) },
    )
  }

  const isPast = new Date(endTime) < new Date()

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-[10px] bg-[#51459d]/10 flex items-center justify-center shrink-0">
            <Video className="w-5 h-5 text-[#51459d]" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">{title}</p>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1">
              <span className="flex items-center gap-1 text-xs text-gray-500">
                <Calendar className="w-3 h-3" /> {formatDateTime(startTime)}
              </span>
              <span className="flex items-center gap-1 text-xs text-gray-500">
                <Clock className="w-3 h-3" /> {formatDuration(startTime, endTime)}
              </span>
            </div>
            {jitsiRoom && (
              <a
                href={jitsiRoom}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-[#51459d] hover:underline mt-1 inline-block"
              >
                Join link →
              </a>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {status ? (
            <Badge
              variant={status === 'accepted' ? 'success' : status === 'declined' ? 'danger' : 'warning'}
            >
              {status === 'accepted' ? 'Accepted' : status === 'declined' ? 'Declined' : 'Tentative'}
            </Badge>
          ) : isPast ? (
            <Badge variant="default">Expired</Badge>
          ) : (
            <>
              <button
                onClick={() => respond('accepted')}
                disabled={rsvp.isPending}
                className="flex items-center gap-1 px-3 py-1.5 text-xs bg-[#6fd943]/10 text-[#3a7d1e] border border-[#6fd943]/30 rounded-[8px] hover:bg-[#6fd943]/20 disabled:opacity-50 transition-colors"
              >
                <Check className="w-3 h-3" /> Accept
              </button>
              <button
                onClick={() => respond('tentative')}
                disabled={rsvp.isPending}
                className="flex items-center gap-1 px-3 py-1.5 text-xs bg-[#ffa21d]/10 text-[#7d5200] border border-[#ffa21d]/30 rounded-[8px] hover:bg-[#ffa21d]/20 disabled:opacity-50 transition-colors"
              >
                <Clock className="w-3 h-3" /> Maybe
              </button>
              <button
                onClick={() => respond('declined')}
                disabled={rsvp.isPending}
                className="flex items-center gap-1 px-3 py-1.5 text-xs bg-[#ff3a6e]/10 text-[#7d001c] border border-[#ff3a6e]/30 rounded-[8px] hover:bg-[#ff3a6e]/20 disabled:opacity-50 transition-colors"
              >
                <X className="w-3 h-3" /> Decline
              </button>
            </>
          )}
        </div>
      </div>
    </Card>
  )
}

export default function PendingInvitesPage() {
  const { data, isLoading } = useMeetings()

  const meetings = data?.meetings ?? []
  const now = new Date()
  const upcoming = meetings.filter((m) => new Date(m.start_time) > now)
  const past = meetings.filter((m) => new Date(m.end_time) <= now).slice(0, 10)

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-gray-900">Pending Invites</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Meetings you've been invited to — accept, decline, or mark as tentative
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-24">
          <Spinner size="lg" />
        </div>
      ) : (
        <>
          {/* Upcoming invites */}
          <div>
            <h2 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <span>Upcoming</span>
              <span className="px-2 py-0.5 text-xs bg-[#51459d] text-white rounded-full">{upcoming.length}</span>
            </h2>
            {upcoming.length === 0 ? (
              <Card>
                <div className="py-16 flex flex-col items-center gap-3 text-center">
                  <div className="w-14 h-14 rounded-2xl bg-[#51459d]/10 flex items-center justify-center">
                    <Mail className="w-7 h-7 text-[#51459d]" />
                  </div>
                  <p className="text-sm font-medium text-gray-900">No pending invites</p>
                  <p className="text-xs text-gray-500 max-w-xs">
                    Meeting invites will appear here. When someone schedules a meeting with you, you can respond from this page.
                  </p>
                </div>
              </Card>
            ) : (
              <div className="space-y-3">
                {upcoming.map((m) => (
                  <InviteCard
                    key={m.id}
                    id={m.id}
                    title={m.title}
                    startTime={m.start_time}
                    endTime={m.end_time}
                    jitsiRoom={m.jitsi_room ?? undefined}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Past invites */}
          {past.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-gray-700 mb-3">Past Meetings</h2>
              <div className="space-y-3">
                {past.map((m) => (
                  <InviteCard
                    key={m.id}
                    id={m.id}
                    title={m.title}
                    startTime={m.start_time}
                    endTime={m.end_time}
                    jitsiRoom={m.jitsi_room ?? undefined}
                  />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
