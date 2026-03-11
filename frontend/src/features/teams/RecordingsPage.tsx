import { useState } from 'react'
import { Card, Button, Spinner, Badge } from '../../components/ui'
import { useMeetings } from '../../api/meetings'
import { useMeetingRecording } from '../../api/meetings_ext'

export default function RecordingsPage() {
  const { data: meetingsData, isLoading } = useMeetings()
  const meetings = meetingsData?.meetings ?? []

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Meeting Recordings</h1>
        <p className="text-sm text-gray-500 mt-1">Browse and download meeting recordings</p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-24"><Spinner size="lg" /></div>
      ) : meetings.length === 0 ? (
        <Card>
          <div className="text-center py-16 text-gray-400">No meetings found.</div>
        </Card>
      ) : (
        <div className="space-y-4">
          {meetings.map((meeting) => (
            <MeetingRecordingCard key={meeting.id} meetingId={meeting.id} meetingTitle={meeting.title} meetingDate={meeting.start_time} />
          ))}
        </div>
      )}
    </div>
  )
}

function MeetingRecordingCard({
  meetingId,
  meetingTitle,
  meetingDate,
}: {
  meetingId: string
  meetingTitle: string
  meetingDate: string
}) {
  const { data: recordings, isLoading } = useMeetingRecording(meetingId)
  const [expanded, setExpanded] = useState(false)

  if (isLoading) return null
  if (!recordings || recordings.length === 0) return null

  return (
    <Card>
      <div
        className="flex items-center justify-between cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
          <svg className="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          <div>
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">{meetingTitle}</h3>
            <p className="text-xs text-gray-400">{new Date(meetingDate).toLocaleString()}</p>
          </div>
          <Badge variant="info">{recordings.length} recording{recordings.length !== 1 ? 's' : ''}</Badge>
        </div>
        <svg
          className={`w-4 h-4 text-gray-400 transition-transform ${expanded ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>

      {expanded && (
        <div className="mt-4 space-y-2 border-t border-gray-100 dark:border-gray-800 pt-4">
          {recordings.map((rec) => (
            <div key={rec.id} className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-950">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-[10px] bg-primary/10 text-primary flex items-center justify-center">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{rec.file_name}</p>
                  <div className="flex items-center gap-3 text-xs text-gray-400">
                    <span>{Math.round(rec.duration_seconds / 60)} min</span>
                    <span>{(rec.file_size / 1024 / 1024).toFixed(1)} MB</span>
                    <span>{new Date(rec.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>
              {rec.download_url && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => window.open(rec.download_url!, '_blank')}
                >
                  <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Download
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}
