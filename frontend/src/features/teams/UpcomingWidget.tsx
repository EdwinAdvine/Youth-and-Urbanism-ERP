import { Card, Button, Spinner, Badge } from '../../components/ui'
import { useUpcomingMeetings } from '../../api/meetings_ext'
import { useJoinMeeting } from '../../api/meetings'

interface Props {
  limit?: number
  className?: string
}

function timeUntil(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now()
  if (diff < 0) return 'Now'
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `in ${mins}m`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `in ${hrs}h`
  const days = Math.floor(hrs / 24)
  return `in ${days}d`
}

export default function UpcomingWidget({ limit = 5, className }: Props) {
  const { data: meetings, isLoading } = useUpcomingMeetings(limit)
  const joinMeeting = useJoinMeeting()

  const handleJoin = (meetingId: string) => {
    joinMeeting.mutate(meetingId, {
      onSuccess: (data) => window.open(data.room_url, '_blank'),
    })
  }

  return (
    <Card className={className}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">Upcoming Meetings</h3>
        <Badge variant="info">{meetings?.length ?? 0}</Badge>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-8"><Spinner /></div>
      ) : !meetings || meetings.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-4">No upcoming meetings</p>
      ) : (
        <div className="space-y-3">
          {meetings.map((meeting) => {
            const isNow = new Date(meeting.start_time) <= new Date() && new Date(meeting.end_time) >= new Date()
            return (
              <div key={meeting.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                <div className={`w-1 h-10 rounded-full shrink-0 ${isNow ? 'bg-green-500' : 'bg-primary'}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate">{meeting.title}</p>
                  <div className="flex items-center gap-2 text-xs text-gray-400">
                    <span>{new Date(meeting.start_time).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' })}</span>
                    <span className={isNow ? 'text-green-600 font-medium' : ''}>{timeUntil(meeting.start_time)}</span>
                  </div>
                </div>
                {meeting.jitsi_room && (
                  <Button
                    size="sm"
                    variant={isNow ? 'primary' : 'ghost'}
                    onClick={() => handleJoin(meeting.id)}
                  >
                    {isNow ? 'Join' : 'Open'}
                  </Button>
                )}
              </div>
            )
          })}
        </div>
      )}
    </Card>
  )
}
