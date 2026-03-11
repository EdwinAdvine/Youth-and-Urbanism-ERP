/**
 * MeetingIntegrations — Cross-module integration panels for the meeting detail page.
 *
 * Sections:
 *   1. Linked Tasks (Meetings → Projects)
 *   2. Meeting Notes (Meetings → Notes)
 *   3. CRM Links (Meetings → CRM contacts & deals)
 */
import { useState } from 'react'
import { Card, Button, Spinner, toast } from '../../components/ui'
import {
  useLinkedTasks,
  useLinkTask,
  useUnlinkTask,
  useMeetingNotes,
  useCreateMeetingNote,
  useLinkedCRM,
  useLinkContact,
  useLinkDeal,
  useUnlinkCRM,
  type LinkedTask,
  type LinkedNote,
  type LinkedContact,
  type LinkedDeal,
} from '../../api/meetings'

// ─── Task Picker Dialog ──────────────────────────────────────────────────────

function TaskPickerDialog({
  meetingId,
  onClose,
}: {
  meetingId: string
  onClose: () => void
}) {
  const [taskId, setTaskId] = useState('')
  const linkTask = useLinkTask()

  const handleLink = () => {
    if (!taskId.trim()) return
    linkTask.mutate(
      { meetingId, taskId: taskId.trim() },
      {
        onSuccess: () => {
          toast('success', 'Task linked to meeting')
          onClose()
        },
        onError: (err: any) => {
          const msg = err?.response?.data?.detail || 'Failed to link task'
          toast('error', msg)
        },
      },
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-[10px] shadow-2xl w-full max-w-sm">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900">Link Task</h3>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-[6px] text-gray-500">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="text-xs font-medium text-gray-700 block mb-1.5">Task ID</label>
            <input
              value={taskId}
              onChange={(e) => setTaskId(e.target.value)}
              placeholder="Paste the task UUID"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-[8px] focus:outline-none focus:ring-1 focus:ring-[#51459d]/40"
            />
            <p className="text-[10px] text-gray-400 mt-1">Find the task ID from the Projects module</p>
          </div>
        </div>
        <div className="px-5 py-3 border-t border-gray-100 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-[8px]">
            Cancel
          </button>
          <button
            onClick={handleLink}
            disabled={!taskId.trim() || linkTask.isPending}
            className="px-4 py-2 text-sm bg-[#51459d] text-white rounded-[8px] hover:bg-[#3d3480] disabled:opacity-50"
          >
            {linkTask.isPending ? 'Linking...' : 'Link Task'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── CRM Picker Dialog ──────────────────────────────────────────────────────

function CRMPickerDialog({
  meetingId,
  onClose,
}: {
  meetingId: string
  onClose: () => void
}) {
  const [entityId, setEntityId] = useState('')
  const [linkType, setLinkType] = useState<'contact' | 'deal'>('contact')
  const linkContact = useLinkContact()
  const linkDeal = useLinkDeal()

  const handleLink = () => {
    if (!entityId.trim()) return
    const mutation = linkType === 'contact' ? linkContact : linkDeal
    const payload =
      linkType === 'contact'
        ? { meetingId, contactId: entityId.trim() }
        : { meetingId, dealId: entityId.trim() }

    mutation.mutate(payload as any, {
      onSuccess: () => {
        toast('success', `${linkType === 'contact' ? 'Contact' : 'Deal'} linked to meeting`)
        onClose()
      },
      onError: (err: any) => {
        const msg = err?.response?.data?.detail || 'Failed to link'
        toast('error', msg)
      },
    })
  }

  const isPending = linkContact.isPending || linkDeal.isPending

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-[10px] shadow-2xl w-full max-w-sm">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900">Link CRM Entity</h3>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-[6px] text-gray-500">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="text-xs font-medium text-gray-700 block mb-2">Type</label>
            <div className="flex gap-2">
              {(['contact', 'deal'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setLinkType(t)}
                  className={`flex-1 py-2 text-xs rounded-[8px] border transition-colors capitalize ${
                    linkType === t
                      ? 'bg-[#51459d] text-white border-[#51459d]'
                      : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-700 block mb-1.5">
              {linkType === 'contact' ? 'Contact' : 'Deal'} ID
            </label>
            <input
              value={entityId}
              onChange={(e) => setEntityId(e.target.value)}
              placeholder={`Paste the ${linkType} UUID`}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-[8px] focus:outline-none focus:ring-1 focus:ring-[#51459d]/40"
            />
            <p className="text-[10px] text-gray-400 mt-1">Find the ID from the CRM module</p>
          </div>
        </div>
        <div className="px-5 py-3 border-t border-gray-100 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-[8px]">
            Cancel
          </button>
          <button
            onClick={handleLink}
            disabled={!entityId.trim() || isPending}
            className="px-4 py-2 text-sm bg-[#51459d] text-white rounded-[8px] hover:bg-[#3d3480] disabled:opacity-50"
          >
            {isPending ? 'Linking...' : 'Link'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Status Badge Helper ─────────────────────────────────────────────────────

function StatusDot({ status }: { status: string | null }) {
  const colors: Record<string, string> = {
    todo: 'bg-gray-400',
    in_progress: 'bg-blue-500',
    in_review: 'bg-yellow-500',
    done: 'bg-green-500',
    active: 'bg-green-500',
    completed: 'bg-green-500',
    cancelled: 'bg-red-500',
  }
  return (
    <span
      className={`inline-block w-2 h-2 rounded-full ${colors[status || ''] || 'bg-gray-300'}`}
      title={status || 'unknown'}
    />
  )
}

// ─── Linked Tasks Section ────────────────────────────────────────────────────

function LinkedTasksSection({ meetingId }: { meetingId: string }) {
  const { data, isLoading } = useLinkedTasks(meetingId)
  const unlinkTask = useUnlinkTask()
  const [showPicker, setShowPicker] = useState(false)

  const tasks: LinkedTask[] = data?.tasks ?? []

  const handleUnlink = (taskId: string) => {
    unlinkTask.mutate(
      { meetingId, taskId },
      {
        onSuccess: () => toast('success', 'Task unlinked'),
        onError: () => toast('error', 'Failed to unlink task'),
      },
    )
  }

  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
          <svg className="w-4 h-4 text-[#51459d]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          Linked Tasks
        </h2>
        <Button size="sm" variant="outline" onClick={() => setShowPicker(true)}>
          + Link Task
        </Button>
      </div>

      {isLoading ? (
        <Spinner />
      ) : tasks.length === 0 ? (
        <p className="text-sm text-gray-400">No tasks linked to this meeting yet.</p>
      ) : (
        <div className="space-y-2">
          {tasks.map((task) => (
            <div key={task.link_id} className="flex items-center justify-between p-3 rounded-lg bg-gray-50 group">
              <div className="flex items-center gap-3 min-w-0">
                <StatusDot status={task.status} />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-700 truncate">{task.title}</p>
                  <p className="text-[10px] text-gray-400">
                    {task.status && <span className="capitalize">{task.status.replace('_', ' ')}</span>}
                    {task.priority && <span> / {task.priority}</span>}
                  </p>
                </div>
              </div>
              <button
                onClick={() => handleUnlink(task.task_id)}
                className="opacity-0 group-hover:opacity-100 p-1.5 text-gray-400 hover:text-red-500 rounded transition-all"
                title="Unlink task"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}

      {showPicker && <TaskPickerDialog meetingId={meetingId} onClose={() => setShowPicker(false)} />}
    </Card>
  )
}

// ─── Meeting Notes Section ───────────────────────────────────────────────────

function MeetingNotesSection({ meetingId }: { meetingId: string }) {
  const { data, isLoading } = useMeetingNotes(meetingId)
  const createNote = useCreateMeetingNote()

  const notes: LinkedNote[] = data?.notes ?? []

  const handleCreateNote = () => {
    createNote.mutate(
      { meetingId },
      {
        onSuccess: () => toast('success', 'Meeting note created'),
        onError: () => toast('error', 'Failed to create note'),
      },
    )
  }

  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
          <svg className="w-4 h-4 text-[#ffa21d]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
          Meeting Notes
        </h2>
        <Button size="sm" variant="outline" onClick={handleCreateNote} loading={createNote.isPending}>
          + Create Note
        </Button>
      </div>

      {isLoading ? (
        <Spinner />
      ) : notes.length === 0 ? (
        <div className="text-center py-4">
          <p className="text-sm text-gray-400 mb-2">No meeting notes yet.</p>
          <p className="text-[10px] text-gray-400">
            Notes are auto-created when a meeting ends, or click "Create Note" to start one now.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {notes.map((note) => (
            <a
              key={note.link_id}
              href="/notes"
              className="block p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors"
            >
              <p className="text-sm font-medium text-gray-700 truncate">{note.title}</p>
              <p className="text-xs text-gray-400 mt-1 line-clamp-2">{note.content_preview}</p>
              {note.created_at && (
                <p className="text-[10px] text-gray-400 mt-1">
                  {new Date(note.created_at).toLocaleDateString('en-KE', {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              )}
            </a>
          ))}
        </div>
      )}
    </Card>
  )
}

// ─── CRM Links Section ──────────────────────────────────────────────────────

function CRMLinksSection({ meetingId }: { meetingId: string }) {
  const { data, isLoading } = useLinkedCRM(meetingId)
  const unlinkCRM = useUnlinkCRM()
  const [showPicker, setShowPicker] = useState(false)

  const contacts: LinkedContact[] = data?.contacts ?? []
  const deals: LinkedDeal[] = data?.deals ?? []

  const handleUnlink = (linkType: 'contact' | 'deal', entityId: string) => {
    unlinkCRM.mutate(
      { meetingId, linkType, entityId },
      {
        onSuccess: () => toast('success', `${linkType === 'contact' ? 'Contact' : 'Deal'} unlinked`),
        onError: () => toast('error', 'Failed to unlink'),
      },
    )
  }

  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
          <svg className="w-4 h-4 text-[#3ec9d6]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          CRM Links
        </h2>
        <Button size="sm" variant="outline" onClick={() => setShowPicker(true)}>
          + Link CRM
        </Button>
      </div>

      {isLoading ? (
        <Spinner />
      ) : contacts.length === 0 && deals.length === 0 ? (
        <p className="text-sm text-gray-400">No CRM contacts or deals linked to this meeting.</p>
      ) : (
        <div className="space-y-4">
          {contacts.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2">Contacts</h3>
              <div className="space-y-2">
                {contacts.map((c) => (
                  <div key={c.link_id} className="flex items-center justify-between p-3 rounded-lg bg-gray-50 group">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-7 h-7 rounded-full bg-[#3ec9d6]/10 text-[#3ec9d6] flex items-center justify-center text-xs font-bold shrink-0">
                        {(c.name || '?').charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-700 truncate">{c.name}</p>
                        <p className="text-[10px] text-gray-400 truncate">
                          {[c.email, c.company].filter(Boolean).join(' / ') || 'No details'}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleUnlink('contact', c.contact_id)}
                      className="opacity-0 group-hover:opacity-100 p-1.5 text-gray-400 hover:text-red-500 rounded transition-all"
                      title="Unlink contact"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {deals.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2">Deals</h3>
              <div className="space-y-2">
                {deals.map((d) => (
                  <div key={d.link_id} className="flex items-center justify-between p-3 rounded-lg bg-gray-50 group">
                    <div className="flex items-center gap-3 min-w-0">
                      <StatusDot status={d.status} />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-700 truncate">{d.title}</p>
                        <p className="text-[10px] text-gray-400">
                          {d.value && d.currency ? `${d.currency} ${d.value}` : 'No value'}
                          {d.status && <span className="capitalize"> / {d.status}</span>}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleUnlink('deal', d.deal_id)}
                      className="opacity-0 group-hover:opacity-100 p-1.5 text-gray-400 hover:text-red-500 rounded transition-all"
                      title="Unlink deal"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {showPicker && <CRMPickerDialog meetingId={meetingId} onClose={() => setShowPicker(false)} />}
    </Card>
  )
}

// ─── Main Export ──────────────────────────────────────────────────────────────

export default function MeetingIntegrations({ meetingId }: { meetingId: string }) {
  return (
    <div className="space-y-6">
      <LinkedTasksSection meetingId={meetingId} />
      <MeetingNotesSection meetingId={meetingId} />
      <CRMLinksSection meetingId={meetingId} />
    </div>
  )
}
