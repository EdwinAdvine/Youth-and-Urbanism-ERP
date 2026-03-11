import { useState } from 'react'
import { Card, Spinner, Select, Badge } from '../../components/ui'
import { useContacts, useContactTimeline, type ContactTimelineEvent } from '../../api/crm'

const eventIcons: Record<string, string> = {
  lead_created: 'L',
  email_sent: '@',
  call: 'C',
  meeting: 'M',
  note: 'N',
  deal_won: 'W',
  deal_lost: 'X',
  quote_sent: 'Q',
  status_change: 'S',
}

const eventColors: Record<string, string> = {
  lead_created: 'bg-blue-500',
  email_sent: 'bg-cyan-500',
  call: 'bg-yellow-500',
  meeting: 'bg-purple-500',
  note: 'bg-gray-500',
  deal_won: 'bg-green-500',
  deal_lost: 'bg-red-500',
  quote_sent: 'bg-primary',
  status_change: 'bg-orange-500',
}

export default function ContactTimelinePage() {
  const { data: contactsData, isLoading: contactsLoading } = useContacts({ limit: 500 })
  const [selectedContactId, setSelectedContactId] = useState('')
  const { data: events, isLoading: eventsLoading } = useContactTimeline(selectedContactId)

  if (contactsLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Spinner size="lg" />
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Contact Timeline</h1>
        <p className="text-sm text-gray-500 mt-1">Complete activity history for a contact</p>
      </div>

      <Select
        label="Select Contact"
        options={[
          { value: '', label: 'Choose a contact...' },
          ...(contactsData?.items?.map((c) => ({ value: c.id, label: `${c.name} (${c.email})` })) ?? []),
        ]}
        value={selectedContactId}
        onChange={(e) => setSelectedContactId(e.target.value)}
        className="w-80"
      />

      {!selectedContactId ? (
        <Card>
          <div className="text-center py-12 text-gray-400">
            <p className="text-lg font-medium">Select a contact to view their timeline</p>
          </div>
        </Card>
      ) : eventsLoading ? (
        <div className="flex items-center justify-center min-h-[40vh]">
          <Spinner size="lg" />
        </div>
      ) : events && events.length > 0 ? (
        <div className="relative pl-8">
          {/* Vertical line */}
          <div className="absolute left-3.5 top-2 bottom-2 w-0.5 bg-gray-200" />

          <div className="space-y-6">
            {events.map((event: ContactTimelineEvent) => (
              <div key={event.id} className="relative flex gap-4">
                {/* Dot */}
                <div className={`absolute -left-4.5 w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold ${eventColors[event.event_type] ?? 'bg-gray-400'}`}>
                  {eventIcons[event.event_type] ?? '?'}
                </div>

                {/* Content */}
                <Card className="flex-1 ml-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium text-gray-900 text-sm">{event.title}</h3>
                        <Badge variant="default">{event.event_type.replace(/_/g, ' ')}</Badge>
                      </div>
                      {event.description && (
                        <p className="text-sm text-gray-600 mt-1">{event.description}</p>
                      )}
                      {event.created_by_name && (
                        <p className="text-xs text-gray-400 mt-1">by {event.created_by_name}</p>
                      )}
                    </div>
                    <span className="text-xs text-gray-400 whitespace-nowrap ml-4">
                      {new Date(event.created_at).toLocaleString()}
                    </span>
                  </div>
                </Card>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <Card>
          <div className="text-center py-12 text-gray-400">No activity recorded for this contact</div>
        </Card>
      )}
    </div>
  )
}
