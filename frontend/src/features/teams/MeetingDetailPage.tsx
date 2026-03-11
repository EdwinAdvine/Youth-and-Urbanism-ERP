import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { Card, Button, Spinner, Badge, toast } from '../../components/ui'
import { useMeeting, useJoinMeeting, useDialIn, type DialInDetails } from '../../api/meetings'
import {
  useMeetingRecording,
  useMeetingAISummary,
  useStartMeeting,
  useEndMeeting,
  type AISummaryResponse,
} from '../../api/meetings_ext'
import MeetingIntegrations from './MeetingIntegrations'

export default function MeetingDetailPage() {
  const { id } = useParams<{ id: string }>()
  const meetingId = id ?? ''

  const { data: meeting, isLoading } = useMeeting(meetingId)
  const { data: recordings, isLoading: loadingRecs } = useMeetingRecording(meetingId)
  const joinMeeting = useJoinMeeting()
  const startMeeting = useStartMeeting()
  const endMeeting = useEndMeeting()
  const aiSummary = useMeetingAISummary()
  const dialIn = useDialIn()

  const [summary, setSummary] = useState<AISummaryResponse | null>(null)
  const [dialInInfo, setDialInInfo] = useState<DialInDetails | null>(null)

  const handleJoin = () => {
    joinMeeting.mutate(meetingId, {
      onSuccess: (data) => window.open(data.room_url, '_blank'),
      onError: () => toast('error', 'Failed to join meeting'),
    })
  }

  const handleStart = () => {
    startMeeting.mutate(meetingId, {
      onSuccess: (data) => window.open(data.room_url, '_blank'),
      onError: () => toast('error', 'Failed to start meeting'),
    })
  }

  const handleEnd = () => {
    if (!confirm('End this meeting?')) return
    endMeeting.mutate(meetingId, {
      onSuccess: () => toast('success', 'Meeting ended'),
      onError: () => toast('error', 'Failed to end meeting'),
    })
  }

  const handleDialIn = () => {
    dialIn.mutate(meetingId, {
      onSuccess: (data) => setDialInInfo(data),
      onError: () => {}, // SIP may not be configured — silently ignore
    })
  }

  const handleAISummary = () => {
    aiSummary.mutate(meetingId, {
      onSuccess: (data) => {
        setSummary(data)
        toast('success', 'AI summary generated')
      },
      onError: () => toast('error', 'Failed to generate summary'),
    })
  }

  if (isLoading) {
    return <div className="flex items-center justify-center py-24"><Spinner size="lg" /></div>
  }

  if (!meeting) {
    return <div className="text-center py-24 text-gray-400">Meeting not found</div>
  }

  const isPast = new Date(meeting.end_time) < new Date()
  const isNow = new Date(meeting.start_time) <= new Date() && new Date(meeting.end_time) >= new Date()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{meeting.title}</h1>
          <p className="text-sm text-gray-500 mt-1">
            {new Date(meeting.start_time).toLocaleString()} - {new Date(meeting.end_time).toLocaleTimeString()}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isNow && <Badge variant="success">In Progress</Badge>}
          {isPast && <Badge variant="default">Ended</Badge>}
          {!isPast && (
            <>
              <Button onClick={handleJoin} loading={joinMeeting.isPending}>Join Meeting</Button>
              {isNow && (
                <Button variant="danger" onClick={handleEnd} loading={endMeeting.isPending}>End</Button>
              )}
              {!isNow && (
                <Button variant="outline" onClick={handleStart} loading={startMeeting.isPending}>Start Early</Button>
              )}
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Info */}
        <Card className="md:col-span-2">
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-4">Details</h2>
          <dl className="space-y-3">
            {meeting.description && (
              <div>
                <dt className="text-xs font-semibold text-gray-500 uppercase">Description</dt>
                <dd className="text-sm text-gray-700 dark:text-gray-300 mt-1">{meeting.description}</dd>
              </div>
            )}
            {meeting.location && (
              <div>
                <dt className="text-xs font-semibold text-gray-500 uppercase">Location</dt>
                <dd className="text-sm text-gray-700 dark:text-gray-300 mt-1">{meeting.location}</dd>
              </div>
            )}
            {meeting.jitsi_room && (
              <div>
                <dt className="text-xs font-semibold text-gray-500 uppercase">Meeting Room</dt>
                <dd className="text-sm text-primary mt-1 truncate">
                  <a href={meeting.jitsi_room} target="_blank" rel="noopener noreferrer" className="hover:underline">
                    {meeting.jitsi_room}
                  </a>
                </dd>
              </div>
            )}
          </dl>
        </Card>

        {/* Attendees */}
        <Card>
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-4">Attendees</h2>
          {meeting.attendees && meeting.attendees.length > 0 ? (
            <div className="space-y-2">
              {meeting.attendees.map((a, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">
                    {a.charAt(0).toUpperCase()}
                  </div>
                  <span className="text-sm text-gray-700 dark:text-gray-300">{a}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400">No attendees listed</p>
          )}
        </Card>
      </div>

      {/* Recordings */}
      <Card>
        <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-4">Recordings</h2>
        {loadingRecs ? (
          <Spinner />
        ) : !recordings || recordings.length === 0 ? (
          <p className="text-sm text-gray-400">No recordings available</p>
        ) : (
          <div className="space-y-2">
            {recordings.map((rec) => (
              <div key={rec.id} className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-950">
                <div className="flex items-center gap-3">
                  <svg className="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  <div>
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{rec.file_name}</p>
                    <p className="text-xs text-gray-400">
                      {Math.round(rec.duration_seconds / 60)} min | {(rec.file_size / 1024 / 1024).toFixed(1)} MB
                    </p>
                  </div>
                </div>
                {rec.download_url && (
                  <Button size="sm" variant="outline" onClick={() => window.open(rec.download_url!, '_blank')}>
                    Download
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* SIP Dial-In */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Dial-In (Phone)</h2>
          {!dialInInfo && (
            <Button size="sm" variant="outline" onClick={handleDialIn} loading={dialIn.isPending}>
              Get Dial-In Info
            </Button>
          )}
        </div>
        {dialInInfo ? (
          <div className="space-y-3">
            {dialInInfo.dial_in_number && (
              <div>
                <dt className="text-xs font-semibold text-gray-500 uppercase">Dial-In Number</dt>
                <dd className="text-sm text-gray-700 dark:text-gray-300 mt-1 font-mono">{dialInInfo.dial_in_number}</dd>
              </div>
            )}
            <div>
              <dt className="text-xs font-semibold text-gray-500 uppercase">Meeting PIN</dt>
              <dd className="text-sm text-gray-700 dark:text-gray-300 mt-1 font-mono tracking-wider">{dialInInfo.meeting_pin}</dd>
            </div>
            {dialInInfo.sip_uri && (
              <div>
                <dt className="text-xs font-semibold text-gray-500 uppercase">SIP URI</dt>
                <dd className="text-sm text-gray-700 dark:text-gray-300 mt-1 font-mono text-xs break-all">{dialInInfo.sip_uri}</dd>
              </div>
            )}
            <p className="text-xs text-gray-400 mt-2">{dialInInfo.instructions}</p>
          </div>
        ) : dialIn.isError ? (
          <p className="text-sm text-gray-400">SIP dial-in is not configured for this instance.</p>
        ) : (
          <p className="text-sm text-gray-400">Click "Get Dial-In Info" to see phone dial-in details (requires SIP gateway configuration).</p>
        )}
      </Card>

      {/* AI Summary */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">AI Meeting Summary</h2>
          <Button size="sm" variant="outline" onClick={handleAISummary} loading={aiSummary.isPending}>
            Generate Summary
          </Button>
        </div>
        {summary ? (
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Summary</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">{summary.summary}</p>
            </div>
            {summary.action_items.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Action Items</h3>
                <ul className="space-y-1">
                  {summary.action_items.map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-400">
                      <span className="text-primary mt-0.5">-</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {summary.key_decisions.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Key Decisions</h3>
                <ul className="space-y-1">
                  {summary.key_decisions.map((dec, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-400">
                      <span className="text-green-600 mt-0.5">-</span>
                      {dec}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-gray-400">Click "Generate Summary" to create an AI-powered meeting summary.</p>
        )}
      </Card>

      {/* Cross-Module Integrations: Tasks, Notes, CRM */}
      <MeetingIntegrations meetingId={meetingId} />
    </div>
  )
}
