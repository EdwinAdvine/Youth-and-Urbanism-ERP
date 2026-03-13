import { useState, useCallback, useEffect } from 'react'
import {
  useNotes, useCreateNote, useUpdateNote, useDeleteNote,
  useAttachFile, useCreateEventFromNote, useEmailNote, useLinkNoteToTask,
  type Note,
} from '../../api/notes'
import {
  useNotebooks, useRecentPages, useFavoritePages,
  usePageBreadcrumb, useEntityLinks,
} from '../../api/notebooks'
import { useNoteVersions, useNoteComments } from '../../api/noteCollab'
import NoteBlockEditor from './NoteBlockEditor'
import NotebookNav from './NotebookNav'
import LinkedItemsSidebar from './LinkedItemsSidebar'
import ExportMenu from './ExportMenu'
import QuickNoteFAB from './QuickNoteFAB'
import NotesAIPanel from './NotesAIPanel'
import { ERPWidgetPicker } from './ERPWidgetCard'
import DatabasesPage from './database/DatabasesPage'
import PresenceAvatars from './collab/PresenceAvatars'
import CommentsSidebar from './collab/CommentsSidebar'
import VersionHistory from './collab/VersionHistory'
import VoiceRecorder from './ai/VoiceRecorder'
import MindMapView from './ai/MindMapView'
import AgenticNotesCopilot from './ai/AgenticNotesCopilot'
import NotesAnalyticsDashboard from './NotesAnalyticsDashboard'
import SecuritySettingsDialog from './SecuritySettingsDialog'
import AuditLogViewer from './AuditLogViewer'
import KnowledgeGraph from './KnowledgeGraph'

// ── Breadcrumb ──────────────────────────────────────────────────────────────

function Breadcrumb({ noteId }: { noteId: string }) {
  const { data } = usePageBreadcrumb(noteId)
  const crumbs: { id: string; title: string; type: string }[] = data ?? []
  if (!crumbs.length) return null

  return (
    <div className="flex items-center gap-1 text-[11px] text-gray-400 overflow-x-auto whitespace-nowrap">
      {crumbs.map((c, i) => (
        <span key={c.id} className="flex items-center gap-1">
          {i > 0 && <span className="text-gray-300 dark:text-gray-600">/</span>}
          <span className={c.type === 'notebook' ? 'font-medium text-gray-500' : ''}>
            {c.title}
          </span>
        </span>
      ))}
    </div>
  )
}

// ── Version & Comment counts ────────────────────────────────────────────────

function NoteMetaBar({ noteId }: { noteId: string }) {
  const { data: versions } = useNoteVersions(noteId)
  const { data: comments } = useNoteComments(noteId)
  const { data: entityLinks } = useEntityLinks(noteId)
  const vCount = Array.isArray(versions) ? versions.length : 0
  const cCount = Array.isArray(comments) ? comments.length : 0
  const lCount = Array.isArray(entityLinks) ? entityLinks.length : 0

  if (!vCount && !cCount && !lCount) return null

  return (
    <div className="flex items-center gap-3 text-[10px] text-gray-400">
      {vCount > 0 && <span>{vCount} version{vCount !== 1 ? 's' : ''}</span>}
      {cCount > 0 && <span>{cCount} comment{cCount !== 1 ? 's' : ''}</span>}
      {lCount > 0 && <span>{lCount} link{lCount !== 1 ? 's' : ''}</span>}
    </div>
  )
}

// ── Cross-module action dialogs ─────────────────────────────────────────────

function CrossModuleDialog({
  type,
  noteId,
  noteTitle,
  onClose,
}: {
  type: 'attach-file' | 'create-event' | 'email-note' | 'link-task'
  noteId: string
  noteTitle: string
  onClose: () => void
}) {
  const [input1, setInput1] = useState('')
  const [input2, setInput2] = useState('')
  const attachFile = useAttachFile()
  const createEventFromNote = useCreateEventFromNote()
  const emailNote = useEmailNote()
  const linkNoteToTask = useLinkNoteToTask()

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-[10px] shadow-xl w-96 p-5" onClick={(e) => e.stopPropagation()}>
        {type === 'attach-file' && (
          <>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">Attach File from Drive</h3>
            <p className="text-xs text-gray-400 mb-3">Enter the Drive file ID to attach to this note.</p>
            <input value={input1} onChange={(e) => setInput1(e.target.value)} placeholder="File ID (UUID)" className="w-full px-3 py-2 text-xs border border-gray-200 dark:border-gray-700 rounded-[8px] focus:outline-none focus:border-[#51459d] mb-3 bg-transparent" />
            <div className="flex gap-2">
              <button
                onClick={async () => {
                  if (!input1.trim()) return
                  try { await attachFile.mutateAsync({ noteId, fileId: input1.trim() }); onClose() } catch { alert('Failed to attach file.') }
                }}
                disabled={attachFile.isPending}
                className="flex-1 text-xs bg-[#51459d] text-white py-2 rounded-[8px] hover:bg-[#3d3480] disabled:opacity-50"
              >{attachFile.isPending ? 'Attaching...' : 'Attach'}</button>
              <button onClick={onClose} className="text-xs text-gray-400 px-3">Cancel</button>
            </div>
          </>
        )}
        {type === 'create-event' && (
          <>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">Create Calendar Event</h3>
            <p className="text-xs text-gray-400 mb-3">Create an event from "{noteTitle}".</p>
            <div className="space-y-2 mb-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Start Time</label>
                <input type="datetime-local" value={input1} onChange={(e) => setInput1(e.target.value)} className="w-full px-3 py-2 text-xs border border-gray-200 dark:border-gray-700 rounded-[8px] focus:outline-none focus:border-[#51459d] bg-transparent" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">End Time (optional)</label>
                <input type="datetime-local" value={input2} onChange={(e) => setInput2(e.target.value)} className="w-full px-3 py-2 text-xs border border-gray-200 dark:border-gray-700 rounded-[8px] focus:outline-none focus:border-[#51459d] bg-transparent" />
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={async () => {
                  if (!input1) return
                  try {
                    await createEventFromNote.mutateAsync({ noteId, startTime: new Date(input1).toISOString(), endTime: input2 ? new Date(input2).toISOString() : undefined })
                    onClose()
                  } catch { alert('Failed to create event.') }
                }}
                disabled={createEventFromNote.isPending || !input1}
                className="flex-1 text-xs bg-[#51459d] text-white py-2 rounded-[8px] hover:bg-[#3d3480] disabled:opacity-50"
              >{createEventFromNote.isPending ? 'Creating...' : 'Create Event'}</button>
              <button onClick={onClose} className="text-xs text-gray-400 px-3">Cancel</button>
            </div>
          </>
        )}
        {type === 'email-note' && (
          <>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">Email This Note</h3>
            <p className="text-xs text-gray-400 mb-3">Send the note content as an email.</p>
            <div className="space-y-2 mb-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">To (comma-separated emails)</label>
                <input value={input1} onChange={(e) => setInput1(e.target.value)} placeholder="user@example.com" className="w-full px-3 py-2 text-xs border border-gray-200 dark:border-gray-700 rounded-[8px] focus:outline-none focus:border-[#51459d] bg-transparent" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Subject (optional)</label>
                <input value={input2} onChange={(e) => setInput2(e.target.value)} placeholder={`Note: ${noteTitle}`} className="w-full px-3 py-2 text-xs border border-gray-200 dark:border-gray-700 rounded-[8px] focus:outline-none focus:border-[#51459d] bg-transparent" />
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={async () => {
                  const recipients = input1.split(',').map((e) => e.trim()).filter(Boolean)
                  if (!recipients.length) return
                  try {
                    const result = await emailNote.mutateAsync({ noteId, to: recipients, subject: input2 || undefined })
                    alert(result.sent ? 'Email sent.' : 'Email queued.')
                    onClose()
                  } catch { alert('Failed to send email.') }
                }}
                disabled={emailNote.isPending || !input1.trim()}
                className="flex-1 text-xs bg-[#51459d] text-white py-2 rounded-[8px] hover:bg-[#3d3480] disabled:opacity-50"
              >{emailNote.isPending ? 'Sending...' : 'Send Email'}</button>
              <button onClick={onClose} className="text-xs text-gray-400 px-3">Cancel</button>
            </div>
          </>
        )}
        {type === 'link-task' && (
          <>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">Link to Task</h3>
            <p className="text-xs text-gray-400 mb-3">Link this note to a project task.</p>
            <div className="space-y-2 mb-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Project ID</label>
                <input value={input1} onChange={(e) => setInput1(e.target.value)} placeholder="Project UUID" className="w-full px-3 py-2 text-xs border border-gray-200 dark:border-gray-700 rounded-[8px] focus:outline-none focus:border-[#51459d] bg-transparent" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Task ID</label>
                <input value={input2} onChange={(e) => setInput2(e.target.value)} placeholder="Task UUID" className="w-full px-3 py-2 text-xs border border-gray-200 dark:border-gray-700 rounded-[8px] focus:outline-none focus:border-[#51459d] bg-transparent" />
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={async () => {
                  if (!input1.trim() || !input2.trim()) return
                  try {
                    await linkNoteToTask.mutateAsync({ noteId, projectId: input1.trim(), taskId: input2.trim() })
                    onClose()
                  } catch { alert('Failed to link note to task.') }
                }}
                disabled={linkNoteToTask.isPending || !input1.trim() || !input2.trim()}
                className="flex-1 text-xs bg-[#51459d] text-white py-2 rounded-[8px] hover:bg-[#3d3480] disabled:opacity-50"
              >{linkNoteToTask.isPending ? 'Linking...' : 'Link to Task'}</button>
              <button onClick={onClose} className="text-xs text-gray-400 px-3">Cancel</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ── Note Editor Panel ───────────────────────────────────────────────────────

function NoteEditorPanel({
  note,
  notebookId,
  onSave,
  onDelete,
}: {
  note: Note
  notebookId?: string
  onSave: (updated: { title?: string; content?: string; tags?: string[]; is_pinned?: boolean; content_format?: string }) => void
  onDelete: (id: string) => void
}) {
  const [title, setTitle] = useState(note.title)
  const [tags, setTags] = useState((note.tags || []).join(', '))
  const [tagInput, setTagInput] = useState('')
  const [showLinkedItems, setShowLinkedItems] = useState(false)
  const [showAIPanel, setShowAIPanel] = useState(false)
  const [showERPPicker, setShowERPPicker] = useState(false)
  const [showCrossModuleMenu, setShowCrossModuleMenu] = useState(false)
  const [showComments, setShowComments] = useState(false)
  const [showVersionHistory, setShowVersionHistory] = useState(false)
  const [dialogType, setDialogType] = useState<'attach-file' | 'create-event' | 'email-note' | 'link-task' | null>(null)
  const [showVoiceRecorder, setShowVoiceRecorder] = useState(false)
  const [showMindMap, setShowMindMap] = useState(false)
  const [showAgenticCopilot, setShowAgenticCopilot] = useState(false)
  const [showSecuritySettings, setShowSecuritySettings] = useState(false)
  const [showAuditLog, setShowAuditLog] = useState(false)
  const [showKnowledgeGraph, setShowKnowledgeGraph] = useState(false)

  const [pendingInsert, setPendingInsert] = useState<string | null>(null)

  useEffect(() => {
    setTitle(note.title)
    setTags((note.tags || []).join(', '))
  }, [note.id])

  const triggerTitleSave = useCallback((newTitle: string) => {
    onSave({ title: newTitle, tags: tags.split(',').map((t) => t.trim()).filter(Boolean) })
  }, [tags, onSave])

  const handleContentChange = useCallback((content: string, format: 'tiptap_json') => {
    onSave({ content, content_format: format })
  }, [onSave])

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })

  return (
    <div className="flex-1 flex flex-col bg-white dark:bg-gray-800 h-full overflow-hidden">
      {/* Top action bar */}
      <div className="border-b border-gray-100 dark:border-gray-800 px-4 py-1.5 flex items-center gap-1 shrink-0">
        <Breadcrumb noteId={note.id} />

        <div className="flex-1" />

        {/* Presence avatars */}
        <PresenceAvatars noteId={note.id} />

        <NoteMetaBar noteId={note.id} />

        <div className="h-4 w-px bg-gray-200 dark:bg-gray-700 mx-1" />

        {/* Save version */}
        <button
          onClick={() => setShowVersionHistory(!showVersionHistory)}
          className="p-1.5 text-gray-400 hover:text-[#51459d] hover:bg-[#51459d]/10 rounded-[6px] transition-colors"
          title="Save version"
        >
          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z" /><polyline points="17,21 17,13 7,13 7,21" /><polyline points="7,3 7,8 15,8" /></svg>
        </button>

        {/* ERP Widget */}
        <button
          onClick={() => setShowERPPicker(true)}
          className="p-1.5 text-gray-400 hover:text-[#3ec9d6] hover:bg-[#3ec9d6]/10 rounded-[6px] transition-colors"
          title="Add ERP widget"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zM14 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" /></svg>
        </button>

        {/* AI Assistant */}
        <button
          onClick={() => setShowAIPanel(!showAIPanel)}
          className={`p-1.5 rounded-[6px] transition-colors ${showAIPanel ? 'text-[#51459d] bg-[#51459d]/10' : 'text-gray-400 hover:text-[#51459d] hover:bg-[#51459d]/10'}`}
          title="AI Assistant"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" /></svg>
        </button>

        {/* Comments */}
        <button
          onClick={() => setShowComments(!showComments)}
          className={`p-1.5 rounded-[6px] transition-colors ${showComments ? 'text-[#3ec9d6] bg-[#3ec9d6]/10' : 'text-gray-400 hover:text-[#3ec9d6] hover:bg-[#3ec9d6]/10'}`}
          title="Comments"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
        </button>

        {/* Voice Recorder */}
        <button
          onClick={() => setShowVoiceRecorder(!showVoiceRecorder)}
          className={`p-1.5 rounded-[6px] transition-colors ${showVoiceRecorder ? 'text-[#ff3a6e] bg-[#ff3a6e]/10' : 'text-gray-400 hover:text-[#ff3a6e] hover:bg-[#ff3a6e]/10'}`}
          title="Voice Recorder"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
        </button>

        {/* Mind Map */}
        <button
          onClick={() => setShowMindMap(!showMindMap)}
          className={`p-1.5 rounded-[6px] transition-colors ${showMindMap ? 'text-[#6fd943] bg-[#6fd943]/10' : 'text-gray-400 hover:text-[#6fd943] hover:bg-[#6fd943]/10'}`}
          title="Mind Map"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><circle cx="12" cy="12" r="3" strokeWidth={2} /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9V3M12 21v-6M9 12H3M21 12h-6M6.34 6.34l1.42 1.42M16.24 16.24l1.42 1.42M6.34 17.66l1.42-1.42M16.24 7.76l1.42-1.42" /></svg>
        </button>

        {/* Agent Copilot */}
        <button
          onClick={() => setShowAgenticCopilot(!showAgenticCopilot)}
          className={`p-1.5 rounded-[6px] transition-colors ${showAgenticCopilot ? 'text-[#ffa21d] bg-[#ffa21d]/10' : 'text-gray-400 hover:text-[#ffa21d] hover:bg-[#ffa21d]/10'}`}
          title="Agent Copilot"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
        </button>

        {/* Security Settings */}
        <button
          onClick={() => setShowSecuritySettings(!showSecuritySettings)}
          className={`p-1.5 rounded-[6px] transition-colors ${showSecuritySettings ? 'text-[#51459d] bg-[#51459d]/10' : 'text-gray-400 hover:text-[#51459d] hover:bg-[#51459d]/10'}`}
          title="Security Settings"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
        </button>

        {/* Audit Log */}
        <button
          onClick={() => setShowAuditLog(!showAuditLog)}
          className={`p-1.5 rounded-[6px] transition-colors ${showAuditLog ? 'text-[#3ec9d6] bg-[#3ec9d6]/10' : 'text-gray-400 hover:text-[#3ec9d6] hover:bg-[#3ec9d6]/10'}`}
          title="Audit Log"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
        </button>

        {/* Knowledge Graph */}
        <button
          onClick={() => setShowKnowledgeGraph(!showKnowledgeGraph)}
          className={`p-1.5 rounded-[6px] transition-colors ${showKnowledgeGraph ? 'text-[#9333ea] bg-[#9333ea]/10' : 'text-gray-400 hover:text-[#9333ea] hover:bg-[#9333ea]/10'}`}
          title="Knowledge Graph"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><circle cx="18" cy="5" r="3" strokeWidth={2} /><circle cx="6" cy="12" r="3" strokeWidth={2} /><circle cx="18" cy="19" r="3" strokeWidth={2} /><line x1="8.59" y1="13.51" x2="15.42" y2="17.49" strokeWidth={2} strokeLinecap="round" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" strokeWidth={2} strokeLinecap="round" /></svg>
        </button>

        {/* Pin toggle */}
        <button
          onClick={() => onSave({ is_pinned: !note.is_pinned })}
          className={`p-1.5 rounded-[6px] transition-colors ${note.is_pinned ? 'text-[#51459d] bg-[#51459d]/10' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
          title={note.is_pinned ? 'Unpin' : 'Pin'}
        >
          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill={note.is_pinned ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={2}><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>
        </button>

        {/* Linked items */}
        <button
          onClick={() => setShowLinkedItems(!showLinkedItems)}
          className={`p-1.5 rounded-[6px] transition-colors ${showLinkedItems ? 'text-[#51459d] bg-[#51459d]/10' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
          title="Linked Items"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
        </button>

        <ExportMenu noteId={note.id} noteTitle={note.title} />

        {/* Cross-module actions */}
        <div className="relative">
          <button
            onClick={() => setShowCrossModuleMenu(!showCrossModuleMenu)}
            className={`p-1.5 rounded-[6px] transition-colors ${showCrossModuleMenu ? 'text-[#51459d] bg-[#51459d]/10' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
            title="Cross-module actions"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16m-7 6h7" /></svg>
          </button>
          {showCrossModuleMenu && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setShowCrossModuleMenu(false)} />
              <div className="absolute right-0 top-full mt-1 z-40 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-[8px] shadow-lg py-1 w-44">
                {[
                  { key: 'attach-file' as const, icon: '📎', label: 'Attach File' },
                  { key: 'create-event' as const, icon: '📅', label: 'Create Event' },
                  { key: 'email-note' as const, icon: '✉️', label: 'Email Note' },
                  { key: 'link-task' as const, icon: '☑️', label: 'Link to Task' },
                ].map((item) => (
                  <button
                    key={item.key}
                    onClick={() => { setDialogType(item.key); setShowCrossModuleMenu(false) }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                  >
                    <span className="w-4 text-center opacity-60">{item.icon}</span>{item.label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Delete */}
        <button
          onClick={() => onDelete(note.id)}
          className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-[6px] transition-colors"
          title="Delete note"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
        </button>
      </div>

      {/* Title & tags */}
      <div className="px-6 pt-4 pb-1 shrink-0">
        <input
          value={title}
          onChange={(e) => { setTitle(e.target.value) }}
          onBlur={() => triggerTitleSave(title)}
          onKeyDown={(e) => { if (e.key === 'Enter') triggerTitleSave(title) }}
          placeholder="Untitled"
          className="w-full text-2xl font-bold text-gray-900 dark:text-gray-100 focus:outline-none placeholder:text-gray-300 bg-transparent"
        />
        <p className="text-[11px] text-gray-400 mt-0.5">Last edited {formatDate(note.updated_at)}</p>
      </div>

      {/* Tags */}
      <div className="px-6 py-1.5 flex flex-wrap items-center gap-1.5 shrink-0">
        {tags.split(',').filter((t) => t.trim()).map((tag) => (
          <span key={tag} className="text-[10px] bg-[#51459d]/10 text-[#51459d] px-2 py-0.5 rounded-full">{tag.trim()}</span>
        ))}
        <input
          value={tagInput}
          onChange={(e) => setTagInput(e.target.value)}
          onKeyDown={(e) => {
            if ((e.key === 'Enter' || e.key === ',') && tagInput.trim()) {
              e.preventDefault()
              const newTags = [...tags.split(',').filter((t) => t.trim()), tagInput.trim()].join(', ')
              setTags(newTags)
              setTagInput('')
              onSave({ tags: newTags.split(',').map((t) => t.trim()).filter(Boolean) })
            }
          }}
          placeholder="+ Add tag"
          className="text-[10px] text-[#51459d] focus:outline-none placeholder:text-gray-300 w-16 bg-transparent"
        />
      </div>

      <div className="h-px bg-gray-100 dark:bg-gray-800 mx-6 shrink-0" />

      {/* Editor + sidebars */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        <div className="flex-1 flex flex-col overflow-hidden">
          <NoteBlockEditor
            key={note.id}
            content={pendingInsert ?? note.content ?? ''}
            contentFormat={(note as any).content_format || 'html'}
            onChange={(content, format) => {
              setPendingInsert(null)
              handleContentChange(content, format)
            }}
            placeholder="Start writing, or press / for commands..."
          />
        </div>

        {showLinkedItems && (
          <LinkedItemsSidebar noteId={note.id} onClose={() => setShowLinkedItems(false)} />
        )}

        {showAIPanel && (
          <NotesAIPanel
            noteContent={note.content || ''}
            notebookId={notebookId}
            onClose={() => setShowAIPanel(false)}
            onInsert={(text) => {
              const appended = (note.content || '') + '\n\n' + text
              setPendingInsert(appended)
              onSave({ content: appended, content_format: 'html' })
            }}
          />
        )}

        {showComments && (
          <CommentsSidebar noteId={note.id} onClose={() => setShowComments(false)} />
        )}

        {showVersionHistory && (
          <VersionHistory noteId={note.id} onClose={() => setShowVersionHistory(false)} />
        )}

        {showMindMap && (
          <MindMapView noteId={note.id} onClose={() => setShowMindMap(false)} />
        )}

        {showAgenticCopilot && (
          <AgenticNotesCopilot
            noteId={note.id}
            onClose={() => setShowAgenticCopilot(false)}
            onNoteCreated={() => {
              setShowAgenticCopilot(false)
            }}
          />
        )}

        {showKnowledgeGraph && (
          <KnowledgeGraph noteId={note.id} onClose={() => setShowKnowledgeGraph(false)} />
        )}
      </div>

      {/* Voice Recorder overlay */}
      {showVoiceRecorder && (
        <VoiceRecorder
          onTranscribed={(_text: string, newNoteId?: string) => {
            setShowVoiceRecorder(false)
            if (newNoteId) {
              // Signal parent to navigate to the new note
              onSave({})
            }
          }}
          onClose={() => setShowVoiceRecorder(false)}
        />
      )}

      {/* Security Settings dialog */}
      {showSecuritySettings && (
        <SecuritySettingsDialog noteId={note.id} onClose={() => setShowSecuritySettings(false)} />
      )}

      {/* Audit Log panel */}
      {showAuditLog && (
        <AuditLogViewer noteId={note.id} onClose={() => setShowAuditLog(false)} />
      )}

      {/* Cross-module dialog */}
      {dialogType && (
        <CrossModuleDialog
          type={dialogType}
          noteId={note.id}
          noteTitle={note.title}
          onClose={() => setDialogType(null)}
        />
      )}

      {/* ERP Widget Picker */}
      {showERPPicker && (
        <ERPWidgetPicker
          onAdd={(_type, _entityId) => {
            // Widget picker confirmation: for now just close (widgets render via ERPWidgetCard component)
            // Full TipTap node extension for embedded widgets is a Phase 2 feature.
          }}
          onClose={() => setShowERPPicker(false)}
        />
      )}
    </div>
  )
}

// ── Recent / Favorites list view ────────────────────────────────────────────

function PageListView({
  mode,
  onSelectPage,
}: {
  mode: 'recent' | 'favorites'
  onSelectPage: (id: string) => void
}) {
  const { data: recentData, isLoading: loadingRecent } = useRecentPages(30)
  const { data: favData, isLoading: loadingFav } = useFavoritePages()

  const pages = mode === 'recent' ? (recentData ?? []) : (favData ?? [])
  const isLoading = mode === 'recent' ? loadingRecent : loadingFav

  const formatDate = (iso: string) => {
    const d = new Date(iso)
    const now = new Date()
    if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' })
    return d.toLocaleDateString('en-KE', { day: 'numeric', month: 'short' })
  }

  return (
    <div className="flex-1 flex flex-col bg-white dark:bg-gray-800 h-full overflow-hidden">
      <div className="border-b border-gray-100 dark:border-gray-800 px-6 py-4">
        <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 capitalize">{mode} Pages</h2>
      </div>
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-48">
            <svg className="animate-spin h-5 w-5 text-[#51459d]" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
          </div>
        ) : pages.length === 0 ? (
          <div className="flex items-center justify-center h-48">
            <p className="text-sm text-gray-400">No {mode} pages</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50 dark:divide-gray-900">
            {pages.map((p: any) => (
              <button
                key={p.id}
                type="button"
                onClick={() => onSelectPage(p.id)}
                className="w-full text-left px-6 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-sm">{p.icon || '📄'}</span>
                    <span className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{p.title || 'Untitled'}</span>
                    {p.is_pinned && <span className="text-[10px]">📌</span>}
                  </div>
                  <span className="text-[11px] text-gray-400 shrink-0 ml-2">{formatDate(p.updated_at)}</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Main Page ───────────────────────────────────────────────────────────────

export default function NotesPage() {
  const [selectedNotebookId, setSelectedNotebookId] = useState<string | null>(null)
  const [selectedPageId, setSelectedPageId] = useState<string | null>(null)
  const [specialView, setSpecialView] = useState<'recent' | 'favorites' | 'databases' | 'analytics' | null>(null)

  const { data: notesData } = useNotes(
    selectedPageId && selectedPageId !== 'recent' && selectedPageId !== 'favorites'
      ? undefined
      : undefined
  )
  const notes = notesData?.notes ?? []

  const { data: notebooksData } = useNotebooks()
  const notebooks = notebooksData?.notebooks ?? []

  const createNote = useCreateNote()
  const updateNote = useUpdateNote()
  const deleteNote = useDeleteNote()

  // Auto-select first notebook if none selected
  useEffect(() => {
    if (!selectedNotebookId && notebooks.length > 0) {
      setSelectedNotebookId(notebooks[0].id)
    }
  }, [notebooks, selectedNotebookId])

  // Find the selected note from notes list
  const selectedNote = selectedPageId ? notes.find((n) => n.id === selectedPageId) ?? null : null

  const handleSelectPage = useCallback((id: string) => {
    if (id === 'recent') {
      setSpecialView('recent')
      setSelectedPageId(null)
    } else if (id === 'favorites') {
      setSpecialView('favorites')
      setSelectedPageId(null)
    } else if (id === 'databases') {
      setSpecialView('databases')
      setSelectedPageId(null)
    } else if (id === 'analytics') {
      setSpecialView('analytics')
      setSelectedPageId(null)
    } else {
      setSpecialView(null)
      setSelectedPageId(id)
    }
  }, [])

  const handleAddPage = useCallback((notebookId: string, sectionId: string) => {
    createNote.mutate(
      { title: 'Untitled', notebook_id: notebookId, section_id: sectionId },
      { onSuccess: (data) => { setSelectedPageId(data.id); setSpecialView(null) } }
    )
  }, [createNote])

  const handleSave = useCallback((updated: Record<string, any>) => {
    if (!selectedNote) return
    updateNote.mutate({ id: selectedNote.id, ...updated })
  }, [selectedNote, updateNote])

  const handleDelete = useCallback((id: string) => {
    deleteNote.mutate(id)
    setSelectedPageId(null)
  }, [deleteNote])

  return (
    <div className="h-full flex flex-col md:flex-row overflow-hidden">
      {/* Notebook navigation sidebar */}
      <aside className="w-full md:w-64 shrink-0 bg-white dark:bg-gray-900 border-b md:border-b-0 md:border-r border-gray-100 dark:border-gray-800 max-h-[35vh] md:max-h-none overflow-hidden">
        <NotebookNav
          selectedNotebookId={selectedNotebookId}
          selectedPageId={selectedPageId}
          onSelectNotebook={(id) => { setSelectedNotebookId(id); setSpecialView(null) }}
          onSelectPage={handleSelectPage}
          onAddPage={handleAddPage}
        />
      </aside>

      {/* Quick Note FAB (mobile) */}
      <QuickNoteFAB onNoteCreated={(id) => { setSelectedPageId(id); setSpecialView(null) }} />

      {/* Main content area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {specialView === 'databases' ? (
          <DatabasesPage />
        ) : specialView === 'analytics' ? (
          <NotesAnalyticsDashboard />
        ) : specialView ? (
          <PageListView
            mode={specialView as 'recent' | 'favorites'}
            onSelectPage={(id) => { setSelectedPageId(id); setSpecialView(null) }}
          />
        ) : selectedNote ? (
          <NoteEditorPanel
            key={selectedNote.id}
            note={selectedNote}
            notebookId={selectedNotebookId ?? undefined}
            onSave={handleSave}
            onDelete={handleDelete}
          />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-950 text-center">
            <div className="w-14 h-14 rounded-2xl bg-[#51459d]/10 flex items-center justify-center text-2xl mb-3">📝</div>
            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-1">Y&U Notes</h3>
            <p className="text-sm text-gray-400 mb-4 max-w-xs">Select a page from the sidebar, or create a new one to start writing.</p>
            {selectedNotebookId && (
              <button
                onClick={() => handleAddPage(selectedNotebookId, '')}
                className="px-4 py-2 bg-[#51459d] text-white text-sm rounded-[8px] hover:bg-[#3d3480] transition-colors"
              >
                New Page
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
