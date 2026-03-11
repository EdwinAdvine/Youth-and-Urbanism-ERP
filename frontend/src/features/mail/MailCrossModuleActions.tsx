/**
 * Cross-module action dialogs for Mail integration:
 * - Save to Drive (all attachments)
 * - Link to CRM (contact/deal picker)
 * - Convert to Task (project picker)
 * - Save as Note
 */
import { useState } from 'react'
import {
  useSaveAllAttachmentsToDrive,
  useLinkMailToCRM,
  useConvertMailToTask,
  useSaveMailAsNote,
} from '../../api/mail'
import { useProjects } from '../../api/projects'
import { useContacts, useDeals } from '../../api/crm'

// ── Shared dialog shell ─────────────────────────────────────────────────────

function DialogShell({
  title,
  icon,
  onClose,
  children,
}: {
  title: string
  icon: React.ReactNode
  onClose: () => void
  children: React.ReactNode
}) {
  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-50" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          className="bg-white rounded-[10px] shadow-2xl w-full max-w-md"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <div className="flex items-center gap-2">
              {icon}
              <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
            </div>
            <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-[6px] text-gray-400">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="p-5">{children}</div>
        </div>
      </div>
    </>
  )
}

// ── Save to Drive ───────────────────────────────────────────────────────────

export function SaveToDriveDialog({
  messageId,
  hasAttachments,
  onClose,
}: {
  messageId: string
  hasAttachments: boolean
  onClose: () => void
}) {
  const saveToDrive = useSaveAllAttachmentsToDrive()

  const handleSave = () => {
    saveToDrive.mutate({ messageId }, { onSuccess: () => onClose() })
  }

  return (
    <DialogShell
      title="Save Attachments to Drive"
      icon={
        <svg className="h-4 w-4 text-[#51459d]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
        </svg>
      }
      onClose={onClose}
    >
      {!hasAttachments ? (
        <p className="text-sm text-gray-500">This email has no attachments to save.</p>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            All attachments will be saved to the <strong>mail-attachments</strong> folder in your Drive.
          </p>
          {saveToDrive.isError && (
            <p className="text-sm text-red-500">Failed to save attachments. Please try again.</p>
          )}
          {saveToDrive.isSuccess && (
            <p className="text-sm text-green-600">
              Saved {saveToDrive.data?.file_count} file(s) to Drive.
            </p>
          )}
          <div className="flex justify-end gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-[8px] transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saveToDrive.isPending}
              className="px-4 py-2 text-sm bg-[#51459d] text-white rounded-[8px] hover:bg-[#3d3480] transition-colors disabled:opacity-50"
            >
              {saveToDrive.isPending ? 'Saving...' : 'Save to Drive'}
            </button>
          </div>
        </div>
      )}
    </DialogShell>
  )
}

// ── Link to CRM ─────────────────────────────────────────────────────────────

export function LinkCRMDialog({
  messageId,
  onClose,
}: {
  messageId: string
  onClose: () => void
}) {
  const [tab, setTab] = useState<'contact' | 'deal'>('contact')
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null)
  const [selectedDealId, setSelectedDealId] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const [searchTerm, setSearchTerm] = useState('')

  const { data: contactsData } = useContacts({ page: 1, limit: 50, search: searchTerm, contact_type: '', is_active: true })
  const { data: dealsData } = useDeals({ page: 1, limit: 50 })
  const linkCRM = useLinkMailToCRM()

  const contacts = contactsData?.items ?? []
  const deals = dealsData?.items ?? []

  const handleLink = () => {
    linkCRM.mutate(
      {
        messageId,
        contact_id: tab === 'contact' ? selectedContactId ?? undefined : undefined,
        deal_id: tab === 'deal' ? selectedDealId ?? undefined : undefined,
        note: note || undefined,
      },
      { onSuccess: () => onClose() },
    )
  }

  const isValid = tab === 'contact' ? !!selectedContactId : !!selectedDealId

  return (
    <DialogShell
      title="Link to CRM"
      icon={
        <svg className="h-4 w-4 text-[#51459d]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      }
      onClose={onClose}
    >
      <div className="space-y-4">
        {/* Tab switch */}
        <div className="flex bg-gray-100 rounded-[8px] p-0.5">
          <button
            onClick={() => setTab('contact')}
            className={`flex-1 text-xs font-medium py-2 rounded-[6px] transition-colors ${
              tab === 'contact' ? 'bg-white text-[#51459d] shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Contact
          </button>
          <button
            onClick={() => setTab('deal')}
            className={`flex-1 text-xs font-medium py-2 rounded-[6px] transition-colors ${
              tab === 'deal' ? 'bg-white text-[#51459d] shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Deal
          </button>
        </div>

        {/* Search */}
        {tab === 'contact' && (
          <input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search contacts..."
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-[8px] focus:outline-none focus:border-[#51459d]"
          />
        )}

        {/* List */}
        <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-[8px] divide-y divide-gray-100">
          {tab === 'contact' ? (
            contacts.length === 0 ? (
              <p className="px-3 py-4 text-xs text-gray-400 text-center">No contacts found</p>
            ) : (
              contacts.map((c: any) => (
                <button
                  key={c.id}
                  onClick={() => setSelectedContactId(c.id)}
                  className={`w-full text-left px-3 py-2.5 text-sm hover:bg-gray-50 transition-colors ${
                    selectedContactId === c.id ? 'bg-[#51459d]/10 text-[#51459d]' : 'text-gray-700'
                  }`}
                >
                  <span className="font-medium">
                    {c.first_name} {c.last_name}
                  </span>
                  {c.email && <span className="text-xs text-gray-400 ml-2">{c.email}</span>}
                </button>
              ))
            )
          ) : deals.length === 0 ? (
            <p className="px-3 py-4 text-xs text-gray-400 text-center">No deals found</p>
          ) : (
            deals.map((d: any) => (
              <button
                key={d.id}
                onClick={() => setSelectedDealId(d.id)}
                className={`w-full text-left px-3 py-2.5 text-sm hover:bg-gray-50 transition-colors ${
                  selectedDealId === d.id ? 'bg-[#51459d]/10 text-[#51459d]' : 'text-gray-700'
                }`}
              >
                <span className="font-medium">{d.title}</span>
                <span className="text-xs text-gray-400 ml-2">{d.status}</span>
              </button>
            ))
          )}
        </div>

        {/* Note */}
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Add a note (optional)..."
          rows={2}
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-[8px] focus:outline-none focus:border-[#51459d] resize-none"
        />

        {linkCRM.isError && (
          <p className="text-sm text-red-500">Failed to link. Please try again.</p>
        )}

        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-[8px] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleLink}
            disabled={!isValid || linkCRM.isPending}
            className="px-4 py-2 text-sm bg-[#51459d] text-white rounded-[8px] hover:bg-[#3d3480] transition-colors disabled:opacity-50"
          >
            {linkCRM.isPending ? 'Linking...' : 'Link to CRM'}
          </button>
        </div>
      </div>
    </DialogShell>
  )
}

// ── Convert to Task ─────────────────────────────────────────────────────────

export function ConvertToTaskDialog({
  messageId,
  onClose,
}: {
  messageId: string
  onClose: () => void
}) {
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
  const [priority, setPriority] = useState('medium')
  const { data: projects } = useProjects()
  const convertToTask = useConvertMailToTask()

  const handleConvert = () => {
    if (!selectedProjectId) return
    convertToTask.mutate(
      { messageId, project_id: selectedProjectId, priority },
      { onSuccess: () => onClose() },
    )
  }

  return (
    <DialogShell
      title="Convert to Task"
      icon={
        <svg className="h-4 w-4 text-[#51459d]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
        </svg>
      }
      onClose={onClose}
    >
      <div className="space-y-4">
        {/* Project picker */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1.5">Select Project</label>
          <div className="max-h-40 overflow-y-auto border border-gray-200 rounded-[8px] divide-y divide-gray-100">
            {!projects || projects.length === 0 ? (
              <p className="px-3 py-4 text-xs text-gray-400 text-center">No projects available</p>
            ) : (
              projects.map((p: any) => (
                <button
                  key={p.id}
                  onClick={() => setSelectedProjectId(p.id)}
                  className={`w-full text-left px-3 py-2.5 text-sm hover:bg-gray-50 transition-colors ${
                    selectedProjectId === p.id ? 'bg-[#51459d]/10 text-[#51459d]' : 'text-gray-700'
                  }`}
                >
                  <span className="font-medium">{p.name}</span>
                  <span className="text-xs text-gray-400 ml-2">{p.status}</span>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Priority */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1.5">Priority</label>
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-[8px] focus:outline-none focus:border-[#51459d] bg-white"
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </select>
        </div>

        {convertToTask.isSuccess && (
          <p className="text-sm text-green-600">
            Task created in project "{convertToTask.data?.project_name}"
          </p>
        )}
        {convertToTask.isError && (
          <p className="text-sm text-red-500">Failed to create task. Please try again.</p>
        )}

        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-[8px] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleConvert}
            disabled={!selectedProjectId || convertToTask.isPending}
            className="px-4 py-2 text-sm bg-[#51459d] text-white rounded-[8px] hover:bg-[#3d3480] transition-colors disabled:opacity-50"
          >
            {convertToTask.isPending ? 'Creating...' : 'Create Task'}
          </button>
        </div>
      </div>
    </DialogShell>
  )
}

// ── Save as Note ────────────────────────────────────────────────────────────

export function SaveAsNoteDialog({
  messageId,
  onClose,
}: {
  messageId: string
  onClose: () => void
}) {
  const [tags, setTags] = useState('')
  const [pinned, setPinned] = useState(false)
  const saveAsNote = useSaveMailAsNote()

  const handleSave = () => {
    const tagList = tags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)
    saveAsNote.mutate(
      { messageId, tags: tagList.length > 0 ? tagList : undefined, is_pinned: pinned },
      { onSuccess: () => onClose() },
    )
  }

  return (
    <DialogShell
      title="Save as Note"
      icon={
        <svg className="h-4 w-4 text-[#51459d]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
      }
      onClose={onClose}
    >
      <div className="space-y-4">
        <p className="text-sm text-gray-600">
          The email subject, sender, date, and body will be saved as a new note.
        </p>

        {/* Tags */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1.5">
            Tags <span className="text-gray-400">(comma-separated, optional)</span>
          </label>
          <input
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="e.g. meeting, follow-up"
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-[8px] focus:outline-none focus:border-[#51459d]"
          />
        </div>

        {/* Pin toggle */}
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={pinned}
            onChange={(e) => setPinned(e.target.checked)}
            className="rounded border-gray-300 text-[#51459d] focus:ring-[#51459d]"
          />
          <span className="text-sm text-gray-600">Pin this note</span>
        </label>

        {saveAsNote.isSuccess && (
          <p className="text-sm text-green-600">Note saved: "{saveAsNote.data?.title}"</p>
        )}
        {saveAsNote.isError && (
          <p className="text-sm text-red-500">Failed to save note. Please try again.</p>
        )}

        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-[8px] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saveAsNote.isPending}
            className="px-4 py-2 text-sm bg-[#51459d] text-white rounded-[8px] hover:bg-[#3d3480] transition-colors disabled:opacity-50"
          >
            {saveAsNote.isPending ? 'Saving...' : 'Save as Note'}
          </button>
        </div>
      </div>
    </DialogShell>
  )
}
