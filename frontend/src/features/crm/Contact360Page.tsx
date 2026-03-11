import { useState } from 'react'
import { useParams } from 'react-router-dom'
import {
  useContact360,
  useCreateNote,
  type ContactNote,
  type NoteCreatePayload,
} from '@/api/crm_v2'
import { Button, Badge, Card, Spinner, cn, toast } from '@/components/ui'
import ActivityTimeline from './components/ActivityTimeline'
import CommentsThread from './components/CommentsThread'

type TabKey = 'overview' | 'activities' | 'notes' | 'deals' | 'campaigns' | 'comments'

const TABS: { key: TabKey; label: string }[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'activities', label: 'Activities' },
  { key: 'notes', label: 'Notes' },
  { key: 'deals', label: 'Deals' },
  { key: 'campaigns', label: 'Campaigns' },
  { key: 'comments', label: 'Comments' },
]

export default function Contact360Page() {
  const { contactId } = useParams<{ contactId: string }>()
  const { data, isLoading, error } = useContact360(contactId ?? '')
  const createNote = useCreateNote(contactId ?? '')
  const [activeTab, setActiveTab] = useState<TabKey>('overview')
  const [noteForm, setNoteForm] = useState<NoteCreatePayload>({ content: '', note_type: 'general' })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Spinner size="lg" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="p-6 text-center text-gray-500">
        Failed to load contact details.
      </div>
    )
  }

  const { contact, leads, opportunities, deals, activities, notes, campaigns, sequence_enrollments } = data

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!noteForm.content.trim()) return
    try {
      await createNote.mutateAsync(noteForm)
      setNoteForm({ content: '', note_type: 'general' })
      toast('success', 'Note added')
    } catch {
      toast('error', 'Failed to add note')
    }
  }

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Contact Info Card */}
      <Card className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex-shrink-0 h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xl font-bold">
          {(contact.name ?? contact.email ?? '?')[0]?.toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 truncate">
            {contact.name ?? 'Unnamed Contact'}
          </h1>
          {contact.email && (
            <p className="text-sm text-gray-500 truncate">{contact.email}</p>
          )}
          {contact.phone && (
            <p className="text-sm text-gray-500">{contact.phone}</p>
          )}
          {contact.company && (
            <p className="text-sm text-gray-500">{contact.company}</p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {contact.status && <Badge variant="primary">{contact.status}</Badge>}
          {contact.source && <Badge variant="info">{contact.source}</Badge>}
          {contact.lead_score != null && (
            <Badge variant={contact.lead_score >= 80 ? 'success' : contact.lead_score >= 60 ? 'warning' : 'default'}>
              Score: {contact.lead_score}
            </Badge>
          )}
        </div>
      </Card>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: 'Leads', count: leads.length },
          { label: 'Opportunities', count: opportunities.length },
          { label: 'Deals', count: deals.length },
          { label: 'Activities', count: activities.length },
          { label: 'Campaigns', count: campaigns.length },
        ].map((stat) => (
          <Card key={stat.label} className="text-center py-3 px-2">
            <p className="text-2xl font-bold text-primary">{stat.count}</p>
            <p className="text-xs text-gray-500">{stat.label}</p>
          </Card>
        ))}
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="flex gap-1 overflow-x-auto">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                'px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors border-b-2',
                activeTab === tab.key
                  ? 'border-primary text-primary'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
              )}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div>
        {activeTab === 'overview' && (
          <div className="space-y-4">
            <Card>
              <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-3">Contact Details</h3>
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                {Object.entries(contact).filter(([k]) => !['id', 'created_at', 'updated_at', 'owner_id'].includes(k)).map(([key, val]) => (
                  <div key={key}>
                    <dt className="text-gray-500 capitalize">{key.replace(/_/g, ' ')}</dt>
                    <dd className="text-gray-900 dark:text-gray-100 font-medium">{val != null ? String(val) : '-'}</dd>
                  </div>
                ))}
              </dl>
            </Card>
            {sequence_enrollments.length > 0 && (
              <Card>
                <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-3">Active Sequences</h3>
                <ul className="space-y-2">
                  {sequence_enrollments.map((e: Record<string, any>) => (
                    <li key={e.id} className="flex items-center justify-between text-sm">
                      <span className="text-gray-700 dark:text-gray-300">Sequence {e.sequence_id}</span>
                      <Badge variant={e.status === 'active' ? 'success' : 'default'}>{e.status}</Badge>
                    </li>
                  ))}
                </ul>
              </Card>
            )}
          </div>
        )}

        {activeTab === 'activities' && (
          <ActivityTimeline activities={activities} />
        )}

        {activeTab === 'notes' && (
          <div className="space-y-4">
            {/* Add note form */}
            <Card>
              <form onSubmit={handleAddNote} className="space-y-3">
                <h3 className="font-semibold text-gray-900 dark:text-gray-100">Add Note</h3>
                <div className="flex gap-3">
                  <select
                    className="rounded-[10px] border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
                    value={noteForm.note_type}
                    onChange={(e) => setNoteForm((f) => ({ ...f, note_type: e.target.value }))}
                  >
                    <option value="general">General</option>
                    <option value="call">Call</option>
                    <option value="meeting">Meeting</option>
                    <option value="email">Email</option>
                  </select>
                  <label className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-400">
                    <input
                      type="checkbox"
                      checked={noteForm.pinned ?? false}
                      onChange={(e) => setNoteForm((f) => ({ ...f, pinned: e.target.checked }))}
                      className="rounded"
                    />
                    Pin
                  </label>
                </div>
                <textarea
                  className="w-full rounded-[10px] border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                  rows={3}
                  placeholder="Write a note..."
                  value={noteForm.content}
                  onChange={(e) => setNoteForm((f) => ({ ...f, content: e.target.value }))}
                  required
                />
                <div className="flex justify-end">
                  <Button type="submit" loading={createNote.isPending} size="sm">
                    Add Note
                  </Button>
                </div>
              </form>
            </Card>

            {/* Notes list */}
            {notes.length === 0 ? (
              <p className="text-center text-gray-400 py-8">No notes yet.</p>
            ) : (
              <div className="space-y-3">
                {notes.map((note: ContactNote) => (
                  <Card key={note.id} className="relative">
                    {note.pinned && (
                      <span className="absolute top-3 right-3 text-xs text-warning font-medium">Pinned</span>
                    )}
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="info">{note.note_type}</Badge>
                      <span className="text-xs text-gray-400">
                        {new Date(note.created_at).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                      {note.content}
                    </p>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'deals' && (
          <div className="space-y-3">
            {deals.length === 0 && opportunities.length === 0 ? (
              <p className="text-center text-gray-400 py-8">No deals or opportunities.</p>
            ) : (
              <>
                {opportunities.length > 0 && (
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-3">Opportunities</h3>
                    <div className="space-y-2">
                      {opportunities.map((opp: Record<string, any>) => (
                        <Card key={opp.id} className="flex items-center justify-between">
                          <div>
                            <p className="font-medium text-sm text-gray-900 dark:text-gray-100">{opp.title}</p>
                            <p className="text-xs text-gray-500">{opp.stage}</p>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold text-primary text-sm">
                              ${Number(opp.value ?? 0).toLocaleString()}
                            </p>
                            <Badge variant="default">{opp.probability ?? 0}%</Badge>
                          </div>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}
                {deals.length > 0 && (
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-3">Deals</h3>
                    <div className="space-y-2">
                      {deals.map((deal: Record<string, any>) => (
                        <Card key={deal.id} className="flex items-center justify-between">
                          <div>
                            <p className="font-medium text-sm text-gray-900 dark:text-gray-100">{deal.title}</p>
                            <p className="text-xs text-gray-500">{deal.stage}</p>
                          </div>
                          <p className="font-semibold text-primary text-sm">
                            ${Number(deal.value ?? 0).toLocaleString()}
                          </p>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {activeTab === 'campaigns' && (
          <div className="space-y-3">
            {campaigns.length === 0 ? (
              <p className="text-center text-gray-400 py-8">Not enrolled in any campaigns.</p>
            ) : (
              campaigns.map((c) => (
                <Card key={c.campaign_id} className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm text-gray-900 dark:text-gray-100">
                      {c.campaign_name ?? 'Unnamed Campaign'}
                    </p>
                    {c.sent_at && (
                      <p className="text-xs text-gray-500">
                        Sent: {new Date(c.sent_at).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={c.status === 'sent' ? 'success' : c.status === 'opened' ? 'info' : 'default'}>
                      {c.status}
                    </Badge>
                    {c.opened_at && (
                      <span className="text-xs text-gray-400">
                        Opened {new Date(c.opened_at).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </Card>
              ))
            )}
          </div>
        )}

        {activeTab === 'comments' && (
          <CommentsThread entityType="contact" entityId={contactId ?? ''} />
        )}
      </div>
    </div>
  )
}
