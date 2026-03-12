import { useState, useEffect, useRef, useCallback } from 'react'
import DOMPurify from 'dompurify'
import {
  useMailFolders,
  useMailMessages,
  useMailMessage,
  useSendMail,
  useMarkAsRead,
  useDeleteMessage,
  useMoveMessage,
  useUploadMailAttachment,
  useFocusedInbox,
  useOtherInbox,
  useTriageInbox,
  usePinMessage,
  useFlagMessage,
  useSmartFolders,
} from '../../api/mail'
import type { MailFolder, MailMessageSummary, MailMessageFull, MailAttachment } from '../../api/mail'
import SnoozeDialog from './SnoozeDialog'
import ContactPicker from './ContactPicker'
import { useMailKeyboardShortcuts, KeyboardShortcutsHelp } from './KeyboardShortcuts'
import { SaveToDriveDialog, LinkCRMDialog, ConvertToTaskDialog, SaveAsNoteDialog } from './MailCrossModuleActions'
import RichTextEditor, { AttachmentChip } from './RichTextEditor'
import type { UploadedAttachment } from './RichTextEditor'
import AICopilotPanel from './AICopilotPanel'
import FinancialRibbon from './FinancialRibbon'
import ContactCard from './ContactCard'
import AnnotationsPanel from './AnnotationsPanel'
import QuickStepsBar from './QuickStepsBar'
import MailAnalytics from './MailAnalytics'
import TemplatePicker from './TemplatePicker'
import ScheduleSendDialog from './ScheduleSendDialog'

// ─── Compose Modal ────────────────────────────────────────────────────────────

interface PendingAttachment {
  id: string
  file: File
  uploading: boolean
  uploaded?: UploadedAttachment
  error?: string
}

function ComposeModal({ onClose, replyTo, forwardFrom }: {
  onClose: () => void
  replyTo?: { messageId: string; subject: string; from: string; body: string; replyAll?: boolean }
  forwardFrom?: { messageId: string; subject: string; body: string }
}) {
  const [to, setTo] = useState(replyTo?.from ?? '')
  const [cc, setCc] = useState('')
  const [subject, setSubject] = useState(
    replyTo ? `Re: ${replyTo.subject.replace(/^Re:\s*/i, '')}` :
    forwardFrom ? `Fwd: ${forwardFrom.subject.replace(/^Fwd:\s*/i, '')}` : ''
  )
  const [htmlBody, setHtmlBody] = useState(
    replyTo ? `<br/><br/><blockquote style="border-left:3px solid #51459d;padding-left:1em;color:#6b7280">${replyTo.body}</blockquote>` :
    forwardFrom ? `<br/><br/><p>---------- Forwarded message ----------</p>${forwardFrom.body}` : ''
  )
  const [showCc, setShowCc] = useState(false)
  const [attachments, setAttachments] = useState<PendingAttachment[]>([])

  const send = useSendMail()
  const uploadAttachment = useUploadMailAttachment()

  const handleAttachFiles = useCallback((files: File[]) => {
    const newAttachments: PendingAttachment[] = files.map((file) => ({
      id: crypto.randomUUID(),
      file,
      uploading: true,
    }))
    setAttachments((prev) => [...prev, ...newAttachments])

    // Upload each file
    newAttachments.forEach((att) => {
      uploadAttachment.mutate(att.file, {
        onSuccess: (result) => {
          setAttachments((prev) =>
            prev.map((a) => a.id === att.id ? { ...a, uploading: false, uploaded: result } : a)
          )
        },
        onError: () => {
          setAttachments((prev) =>
            prev.map((a) => a.id === att.id ? { ...a, uploading: false, error: 'Upload failed' } : a)
          )
        },
      })
    })
  }, [uploadAttachment])

  const removeAttachment = useCallback((id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id))
  }, [])

  const handleSend = () => {
    const uploadedAtts = attachments
      .filter((a) => a.uploaded)
      .map((a) => ({
        storage_key: a.uploaded!.storage_key,
        filename: a.uploaded!.filename,
        size: a.uploaded!.size,
        content_type: a.uploaded!.content_type,
      }))

    // Extract plain text from HTML for body field
    const tempDiv = document.createElement('div')
    tempDiv.innerHTML = htmlBody
    const plainText = tempDiv.textContent ?? tempDiv.innerText ?? ''

    send.mutate(
      {
        to: to.split(',').map((e) => e.trim()).filter(Boolean),
        cc: cc ? cc.split(',').map((e) => e.trim()).filter(Boolean) : undefined,
        subject,
        body: plainText,
        html_body: htmlBody || undefined,
        attachments: uploadedAtts.length > 0 ? uploadedAtts : undefined,
        in_reply_to: replyTo?.messageId,
      },
      { onSuccess: () => onClose() },
    )
  }

  const allUploaded = attachments.every((a) => !a.uploading)

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-gray-800 rounded-[10px] shadow-2xl w-full max-w-3xl flex flex-col" style={{ maxHeight: '85vh' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800 shrink-0">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            {replyTo ? 'Reply' : forwardFrom ? 'Forward' : 'New Message'}
          </h3>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-[6px] text-gray-500">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Fields */}
        <div className="flex-1 overflow-y-auto flex flex-col min-h-0">
          <div className="border-b border-gray-100 dark:border-gray-800 px-4 py-2 shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400 w-12 shrink-0">To</span>
              <div className="flex-1"><ContactPicker value={to} onChange={setTo} placeholder="Recipients" /></div>
              <button onClick={() => setShowCc(!showCc)} className="text-xs text-[#51459d] hover:underline shrink-0">Cc</button>
            </div>
          </div>
          {showCc && (
            <div className="border-b border-gray-100 dark:border-gray-800 px-4 py-2 shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400 w-12 shrink-0">Cc</span>
                <div className="flex-1"><ContactPicker value={cc} onChange={setCc} placeholder="Cc recipients" /></div>
              </div>
            </div>
          )}
          <div className="border-b border-gray-100 dark:border-gray-800 shrink-0">
            <div className="flex items-center px-4 py-2 gap-2">
              <span className="text-xs text-gray-400 w-12 shrink-0">Subject</span>
              <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Message subject" className="flex-1 text-sm text-gray-900 dark:text-gray-100 focus:outline-none placeholder:text-gray-400 bg-transparent" />
            </div>
          </div>

          {/* Rich Text Editor */}
          <div className="flex-1 min-h-0 overflow-y-auto">
            <RichTextEditor
              content={htmlBody}
              onChange={setHtmlBody}
              placeholder="Compose your message..."
              minHeight="180px"
              onAttachFiles={handleAttachFiles}
            />
          </div>

          {/* Attachments bar */}
          {attachments.length > 0 && (
            <div className="px-4 py-2 border-t border-gray-100 dark:border-gray-800 shrink-0">
              <div className="flex flex-wrap gap-2">
                {attachments.map((att) => (
                  <AttachmentChip
                    key={att.id}
                    filename={att.file.name}
                    size={att.file.size}
                    uploading={att.uploading}
                    onRemove={() => removeAttachment(att.id)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 dark:border-gray-800 shrink-0">
          <div className="flex items-center gap-3 text-xs text-gray-400">
            {attachments.length > 0 && (
              <span>{attachments.length} attachment{attachments.length > 1 ? 's' : ''}</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-[8px] transition-colors">Discard</button>
            <button
              onClick={handleSend}
              disabled={!to || !subject || send.isPending || !allUploaded}
              className="px-4 py-2 text-sm bg-[#51459d] text-white rounded-[8px] hover:bg-[#3d3480] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {send.isPending ? (
                <span className="flex items-center gap-1.5"><svg className="animate-spin h-3.5 w-3.5" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>Sending...</span>
              ) : (
                <>
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                  Send
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Skeleton ────────────────────────────────────────────────────────────────

function MessageSkeleton() {
  return (
    <div className="px-3 py-3 border-b border-gray-50 dark:border-gray-950 animate-pulse">
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 shrink-0" />
        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="flex justify-between">
            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-24" />
            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-12" />
          </div>
          <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-48" />
          <div className="h-3 bg-gray-100 dark:bg-gray-900 rounded w-full" />
        </div>
      </div>
    </div>
  )
}

// ─── Avatar initials ──────────────────────────────────────────────────────────

const AVATAR_COLORS = ['bg-[#51459d]', 'bg-[#3ec9d6]', 'bg-[#6fd943]', 'bg-[#ffa21d]', 'bg-[#ff3a6e]']
function getAvatarColor(name: string) {
  const idx = name.charCodeAt(0) % AVATAR_COLORS.length
  return AVATAR_COLORS[idx]
}
function getInitials(name: string) {
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
}

// ─── Swipeable mail list item ─────────────────────────────────────────────────

function SwipeableMailItem({ msg, isSelected, onSelect, onArchive, onDelete, onSnooze }: {
  msg: MailMessageSummary
  isSelected: boolean
  onSelect: (id: string) => void
  onArchive: (id: string) => void
  onDelete: (id: string) => void
  onSnooze: (id: string) => void
}) {
  const itemRef = useRef<HTMLDivElement>(null)
  const startX = useRef(0)
  const currentX = useRef(0)
  const swiping = useRef(false)
  const [offset, setOffset] = useState(0)
  const [revealed, setRevealed] = useState<'left' | 'right' | null>(null)

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX
    currentX.current = startX.current
    swiping.current = true
  }, [])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!swiping.current) return
    currentX.current = e.touches[0].clientX
    const delta = currentX.current - startX.current
    // Limit swipe range
    const clamped = Math.max(-120, Math.min(120, delta))
    setOffset(clamped)
  }, [])

  const handleTouchEnd = useCallback(() => {
    swiping.current = false
    const delta = currentX.current - startX.current
    if (delta > 80) {
      // Swipe right = archive
      setRevealed('right')
      setTimeout(() => {
        onArchive(msg.id)
        setOffset(0)
        setRevealed(null)
      }, 300)
    } else if (delta < -80) {
      // Swipe left = show delete/snooze
      setRevealed('left')
    } else {
      setOffset(0)
      setRevealed(null)
    }
  }, [msg.id, onArchive])

  const resetSwipe = useCallback(() => {
    setOffset(0)
    setRevealed(null)
  }, [])

  return (
    <div className="relative overflow-hidden">
      {/* Background actions revealed on swipe */}
      {/* Right swipe background (archive) */}
      <div className="absolute inset-y-0 left-0 w-full flex items-center px-4 bg-[#6fd943]">
        <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
        </svg>
        <span className="text-white text-xs font-medium ml-2">Archive</span>
      </div>
      {/* Left swipe background (delete/snooze) */}
      <div className="absolute inset-y-0 right-0 flex items-center gap-1 px-2 bg-white dark:bg-gray-800">
        <button
          onClick={() => { onSnooze(msg.id); resetSwipe() }}
          className="flex items-center gap-1 px-3 py-2 bg-[#ffa21d] text-white text-xs font-medium rounded-[6px] min-h-[36px]"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          Snooze
        </button>
        <button
          onClick={() => { onDelete(msg.id); resetSwipe() }}
          className="flex items-center gap-1 px-3 py-2 bg-[#ff3a6e] text-white text-xs font-medium rounded-[6px] min-h-[36px]"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
          Delete
        </button>
      </div>

      {/* Foreground content */}
      <div
        ref={itemRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{ transform: `translateX(${revealed === 'left' ? -120 : offset}px)`, transition: swiping.current ? 'none' : 'transform 0.2s ease-out' }}
        className="relative bg-white dark:bg-gray-800"
      >
        <button
          onClick={() => { if (!revealed) onSelect(msg.id); else resetSwipe() }}
          className={`w-full text-left px-3 py-3 border-b border-gray-50 dark:border-gray-950 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors ${
            isSelected ? 'bg-[#51459d]/5 border-l-2 border-l-[#51459d]' : ''
          }`}
        >
          <div className="flex items-start gap-2.5">
            <div className={`w-8 h-8 rounded-full ${getAvatarColor(msg.from.name ?? msg.from.email)} flex items-center justify-center text-white text-[10px] font-bold shrink-0`}>
              {getInitials(msg.from.name ?? msg.from.email)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-0.5">
                <span className={`text-xs truncate ${msg.read ? 'text-gray-600 dark:text-gray-400' : 'text-gray-900 dark:text-gray-100 font-semibold'}`}>{msg.from.name ?? msg.from.email}</span>
                <span className="text-[10px] text-gray-400 shrink-0 ml-1">{msg.date}</span>
              </div>
              <p className={`text-xs truncate ${msg.read ? 'text-gray-500' : 'text-gray-800 dark:text-gray-200 font-medium'}`}>{msg.subject}</p>
            </div>
            {!msg.read && <div className="w-2 h-2 rounded-full bg-[#51459d] mt-1 shrink-0" />}
            {(msg as any).priority_score != null && (msg as any).priority_score >= 0.7 && (
              <span className="text-[9px] font-bold text-[#ff3a6e] uppercase shrink-0">Urgent</span>
            )}
            {(msg as any).is_pinned && (
              <svg className="h-3 w-3 text-[#ffa21d] shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path d="M5 5a2 2 0 012-2h6a2 2 0 012 2v2h2a1 1 0 010 2h-1l-1 8a2 2 0 01-2 2H7a2 2 0 01-2-2L4 9H3a1 1 0 010-2h2V5z" />
              </svg>
            )}
            {(msg as any).ai_category && (
              <span className={`text-[9px] px-1.5 py-0.5 rounded-full shrink-0 ${
                (msg as any).ai_category === 'finance-invoice' ? 'bg-green-100 text-green-700' :
                (msg as any).ai_category === 'support-request' ? 'bg-red-100 text-red-700' :
                (msg as any).ai_category === 'deal-related' ? 'bg-blue-100 text-blue-700' :
                (msg as any).ai_category === 'newsletter' ? 'bg-gray-100 text-gray-500' :
                'bg-purple-100 text-purple-700'
              }`}>
                {(msg as any).ai_category.replace('-', ' ')}
              </span>
            )}
          </div>
        </button>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function MailPage() {
  const [selectedFolder, setSelectedFolder] = useState('inbox')
  const [selectedMessage, setSelectedMessage] = useState<string | null>(null)
  const [composeOpen, setComposeOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [snoozeMessageId, setSnoozeMessageId] = useState<string | null>(null)
  const [showShortcutsHelp, setShowShortcutsHelp] = useState(false)
  const [dragOverFolder, setDragOverFolder] = useState<string | null>(null)
  const [showSaveToDrive, setShowSaveToDrive] = useState(false)
  const [showLinkCRM, setShowLinkCRM] = useState(false)
  const [showConvertToTask, setShowConvertToTask] = useState(false)
  const [showSaveAsNote, setShowSaveAsNote] = useState(false)
  const [replyContext, setReplyContext] = useState<{ messageId: string; subject: string; from: string; body: string; replyAll?: boolean } | null>(null)
  const [forwardContext, setForwardContext] = useState<{ messageId: string; subject: string; body: string } | null>(null)
  const [inboxTab, setInboxTab] = useState<'all' | 'focused' | 'other'>('all')
  const [showCopilot, setShowCopilot] = useState(false)
  const [showAnalytics, setShowAnalytics] = useState(false)
  const [showScheduleSend, setShowScheduleSend] = useState(false)

  // ─── API hooks ──────────────────────────────────────────────────────────────

  const { data: foldersData, isError: foldersError } = useMailFolders()
  const folders: MailFolder[] = foldersData ?? []
  const serverDown = foldersError

  const { data: messagesData, isLoading: messagesLoading } = useMailMessages({ folder: selectedFolder })
  const defaultMessages: MailMessageSummary[] = messagesData?.messages ?? []

  const { data: detailData, isLoading: detailLoading } = useMailMessage(selectedMessage ?? '')
  const detail: MailMessageFull | null = detailData ?? null

  const markAsRead = useMarkAsRead()
  const deleteMessage = useDeleteMessage()
  const moveMessage = useMoveMessage()
  const triageInbox = useTriageInbox()
  const pinMessage = usePinMessage()
  const flagMessage = useFlagMessage()
  const { data: smartFolders } = useSmartFolders()
  const { data: focusedData } = useFocusedInbox()
  const { data: otherData } = useOtherInbox()

  // Determine which message source to use based on inbox tab
  const allMessages: MailMessageSummary[] =
    selectedFolder === 'inbox' && inboxTab === 'focused'
      ? (focusedData?.messages ?? [])
      : selectedFolder === 'inbox' && inboxTab === 'other'
        ? (otherData?.messages ?? [])
        : defaultMessages

  const messages = allMessages.filter(
    (m) =>
      !search ||
      m.subject.toLowerCase().includes(search.toLowerCase()) ||
      (m.from.name ?? m.from.email).toLowerCase().includes(search.toLowerCase()),
  )

  // Keyboard shortcuts
  useMailKeyboardShortcuts({
    messages: messages.map((m) => ({ id: m.id, read: m.read })),
    selectedMessage,
    onSelectMessage: setSelectedMessage,
    onReply: () => handleReply(false),
    onCompose: () => setComposeOpen(true),
  })

  // Mark as read when a message is selected
  useEffect(() => {
    if (selectedMessage && detail && !detailLoading) {
      // Find the message in the list to check if unread
      const msg = allMessages.find((m) => m.id === selectedMessage)
      if (msg && !msg.read) {
        markAsRead.mutate(selectedMessage)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMessage, detail])

  const handleReply = (replyAll = false) => {
    if (!selectedMessage || !detail) return
    setReplyContext({
      messageId: selectedMessage,
      subject: detail.subject,
      from: detail.from[0]?.email ?? '',
      body: detail.html_body || detail.text_body,
      replyAll,
    })
  }

  const handleForward = () => {
    if (!selectedMessage || !detail) return
    setForwardContext({
      messageId: selectedMessage,
      subject: detail.subject,
      body: detail.html_body || detail.text_body,
    })
  }

  const handleDelete = () => {
    if (!selectedMessage) return
    if (confirm('Delete this message?')) {
      deleteMessage.mutate(selectedMessage, {
        onSuccess: () => setSelectedMessage(null),
      })
    }
  }

  const folderIcons: Record<string, string> = {
    inbox: 'M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4',
    sent: 'M12 19l9 2-9-18-9 18 9-2zm0 0v-8',
    drafts: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z',
    archive: 'M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4',
    trash: 'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16',
  }

  return (
    <div className="h-full flex flex-col">
      {/* Server down banner */}
      {serverDown && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 flex items-center gap-2 shrink-0">
          <svg className="h-4 w-4 text-amber-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
          <p className="text-xs text-amber-700">Mail server not configured — showing empty mailbox. Configure SMTP/IMAP in Settings to enable real mail.</p>
        </div>
      )}

      <div className="flex-1 flex overflow-hidden">
        {/* Left: Folder sidebar - hidden on mobile */}
        <aside className="hidden md:flex w-52 shrink-0 bg-white dark:bg-gray-900 border-r border-gray-100 dark:border-gray-800 flex-col">
          <div className="p-3 border-b border-gray-100 dark:border-gray-800">
            <button
              onClick={() => setComposeOpen(true)}
              className="w-full flex items-center justify-center gap-2 bg-[#51459d] hover:bg-[#3d3480] text-white text-sm font-medium rounded-[8px] px-4 py-2.5 transition-colors shadow-sm"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              Compose
            </button>
          </div>

          <nav className="flex-1 overflow-y-auto py-2 px-2">
            {folders.map((folder) => (
              <button
                key={folder.id}
                onClick={() => { setSelectedFolder(folder.id); setSelectedMessage(null) }}
                onDragOver={(e) => { e.preventDefault(); setDragOverFolder(folder.id) }}
                onDragLeave={() => setDragOverFolder(null)}
                onDrop={(e) => {
                  e.preventDefault()
                  setDragOverFolder(null)
                  const msgId = e.dataTransfer.getData('text/mail-message-id')
                  if (msgId) moveMessage.mutate({ messageId: msgId, folder: folder.id })
                }}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-[8px] text-sm transition-colors mb-0.5 ${
                  dragOverFolder === folder.id
                    ? 'bg-[#51459d]/20 border-2 border-dashed border-[#51459d]'
                    : selectedFolder === folder.id
                      ? 'bg-[#51459d]/10 text-[#51459d] font-medium'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d={folderIcons[folder.id] ?? folderIcons.inbox} />
                  </svg>
                  {folder.name}
                </div>
                {folder.unread_emails > 0 && (
                  <span className="bg-[#51459d] text-white text-[10px] font-bold rounded-full px-1.5 py-0.5 min-w-[18px] text-center">
                    {folder.unread_emails}
                  </span>
                )}
              </button>
            ))}

            <div className="mt-4 px-3">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Labels</p>
              {['Important', 'Work', 'Personal', 'Invoices'].map((label) => (
                <button key={label} className="w-full flex items-center gap-2 px-1 py-1.5 text-xs text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 transition-colors rounded-[6px] hover:bg-gray-50 dark:hover:bg-gray-800">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${label === 'Important' ? 'bg-red-400' : label === 'Work' ? 'bg-blue-400' : label === 'Personal' ? 'bg-green-400' : 'bg-yellow-400'}`} />
                  {label}
                </button>
              ))}
            </div>

            <div className="mt-4 px-3">
              <button
                onClick={() => setShowAnalytics(true)}
                className="w-full flex items-center gap-2 px-1 py-1.5 text-xs text-gray-500 hover:text-[#51459d] transition-colors rounded-[6px] hover:bg-[#51459d]/5"
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                Mail Analytics
              </button>
            </div>

            {smartFolders && smartFolders.length > 0 && (
              <div className="mt-4 px-3">
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Smart Folders</p>
                {smartFolders.map((sf) => (
                  <button
                    key={sf.id}
                    className="w-full flex items-center justify-between px-1 py-1.5 text-xs text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 transition-colors rounded-[6px] hover:bg-gray-50 dark:hover:bg-gray-800"
                  >
                    <div className="flex items-center gap-2">
                      <svg className="h-3 w-3 text-[#3ec9d6]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                      {sf.name}
                    </div>
                    {sf.message_count > 0 && (
                      <span className="text-[10px] text-gray-400">{sf.message_count}</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </nav>
        </aside>

        {/* Middle: Message list - full width on mobile, fixed width on desktop */}
        <div className={`${selectedMessage ? 'hidden md:flex' : 'flex'} w-full md:w-80 shrink-0 bg-white dark:bg-gray-900 border-r border-gray-100 dark:border-gray-800 flex-col`}>
          <div className="p-3 border-b border-gray-100 dark:border-gray-800 shrink-0">
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search mail…"
                className="w-full pl-9 pr-3 py-2 text-xs bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-700 rounded-[8px] focus:outline-none focus:ring-1 focus:ring-[#51459d]/30"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 px-3 py-1.5 border-b border-gray-100 dark:border-gray-800 shrink-0">
            <button
              onClick={() => triageInbox.mutate()}
              disabled={triageInbox.isPending}
              className="flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-medium text-[#51459d] bg-[#51459d]/10 rounded-full hover:bg-[#51459d]/20 transition-colors disabled:opacity-50"
            >
              <svg className={`h-3 w-3 ${triageInbox.isPending ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              {triageInbox.isPending ? 'Triaging...' : 'AI Triage'}
            </button>
          </div>

          <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100 dark:border-gray-800 shrink-0">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 capitalize">{selectedFolder}</h2>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400">{messages.length}</span>
              <button
                onClick={() => setComposeOpen(true)}
                className="md:hidden w-8 h-8 rounded-[8px] bg-[#51459d] text-white flex items-center justify-center"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              </button>
            </div>
          </div>

          {selectedFolder === 'inbox' && (
            <div className="flex items-center gap-1 px-3 py-1.5 border-b border-gray-100 dark:border-gray-800 shrink-0">
              {(['all', 'focused', 'other'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setInboxTab(tab)}
                  className={`px-3 py-1 text-xs rounded-full transition-colors ${
                    inboxTab === tab
                      ? 'bg-[#51459d] text-white font-medium'
                      : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  {tab === 'all' ? 'All' : tab === 'focused' ? 'Focused' : 'Other'}
                </button>
              ))}
            </div>
          )}

          <QuickStepsBar selectedMessageId={selectedMessage ?? undefined} />

          <div className="flex-1 overflow-y-auto">
            {messagesLoading ? (
              Array.from({ length: 6 }).map((_, i) => <MessageSkeleton key={i} />)
            ) : messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-center px-4">
                <svg className="h-8 w-8 text-gray-300 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" /></svg>
                <p className="text-sm text-gray-400">No messages</p>
              </div>
            ) : (
              messages.map((msg) => (
                <SwipeableMailItem
                  key={msg.id}
                  msg={msg}
                  isSelected={selectedMessage === msg.id}
                  onSelect={setSelectedMessage}
                  onArchive={(id) => moveMessage.mutate({ messageId: id, folder: 'archive' })}
                  onDelete={(id) => deleteMessage.mutate(id, { onSuccess: () => { if (selectedMessage === id) setSelectedMessage(null) } })}
                  onSnooze={(id) => setSnoozeMessageId(id)}
                />
              ))
            )}
          </div>
        </div>

        {/* Right: Message detail - full width on mobile when message selected */}
        <div className={`${selectedMessage ? 'flex' : 'hidden md:flex'} flex-1 bg-gray-50 dark:bg-gray-950 flex-col overflow-hidden`}>
          {!selectedMessage ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center">
              <svg className="h-12 w-12 text-gray-200 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
              <p className="text-sm text-gray-400">Select a message to read</p>
            </div>
          ) : detailLoading ? (
            <div className="flex-1 flex items-center justify-center">
              <svg className="animate-spin h-5 w-5 text-[#51459d]" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
            </div>
          ) : detail ? (
            <div className="flex-1 overflow-y-auto">
              {/* Detail header */}
              <div className="bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-800 px-4 sm:px-6 py-4">
                <button
                  onClick={() => setSelectedMessage(null)}
                  className="md:hidden flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 mb-3 min-h-[44px]"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                  Back to inbox
                </button>
                <div className="flex items-start justify-between mb-4">
                  <h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-gray-100 pr-4">{detail.subject}</h2>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => handleReply(false)} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-[6px] text-gray-500" title="Reply">
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" /></svg>
                    </button>
                    <button onClick={() => handleReply(true)} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-[6px] text-gray-500" title="Reply All">
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" /></svg>
                    </button>
                    <button onClick={handleForward} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-[6px] text-gray-500" title="Forward">
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 10H11a8 8 0 00-8 8v2m18-10l-6-6m6 6l-6 6" /></svg>
                    </button>
                    <button onClick={handleDelete} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-[6px] text-gray-500" title="Delete">
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                    <button onClick={() => setSnoozeMessageId(selectedMessage)} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-[6px] text-gray-500" title="Snooze">
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    </button>
                    <button
                      onClick={() => pinMessage.mutate({ messageId: selectedMessage!, pinned: !(detail as any)?.is_pinned })}
                      className={`p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-[6px] ${(detail as any)?.is_pinned ? 'text-[#ffa21d]' : 'text-gray-500'}`}
                      title="Pin"
                    >
                      <svg className="h-4 w-4" fill={(detail as any)?.is_pinned ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => flagMessage.mutate({
                        messageId: selectedMessage!,
                        flag_status: (detail as any)?.flag_status === 'flagged' ? 'none' : 'flagged',
                      })}
                      className={`p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-[6px] ${(detail as any)?.flag_status === 'flagged' ? 'text-[#ff3a6e]' : 'text-gray-500'}`}
                      title="Flag"
                    >
                      <svg className="h-4 w-4" fill={(detail as any)?.flag_status === 'flagged' ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2z" />
                      </svg>
                    </button>
                    <span className="w-px h-4 bg-gray-200 dark:bg-gray-700" />
                    {/* Cross-module actions */}
                    <button onClick={() => setShowSaveToDrive(true)} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-[6px] text-gray-500" title="Save attachments to Drive">
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
                    </button>
                    <button onClick={() => setShowLinkCRM(true)} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-[6px] text-gray-500" title="Link to CRM">
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                    </button>
                    <button onClick={() => setShowConvertToTask(true)} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-[6px] text-gray-500" title="Convert to Task">
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
                    </button>
                    <button onClick={() => setShowSaveAsNote(true)} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-[6px] text-gray-500" title="Save as Note">
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                    </button>
                    <span className="w-px h-4 bg-gray-200 dark:bg-gray-700" />
                    <button
                      onClick={() => setShowCopilot(!showCopilot)}
                      className={`p-1.5 rounded-[6px] transition ${showCopilot ? 'bg-[#51459d] text-white' : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500'}`}
                      title="AI Copilot"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                    </button>
                    <button onClick={() => setShowScheduleSend(true)} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-[6px] text-gray-500" title="Schedule Send">
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    </button>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className={`w-9 h-9 rounded-full ${getAvatarColor(detail.from[0]?.name ?? detail.from[0]?.email ?? '?')} flex items-center justify-center text-white text-xs font-bold shrink-0`}>
                    {getInitials(detail.from[0]?.name ?? detail.from[0]?.email ?? '?')}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <div>
                        <ContactCard email={detail.from[0]?.email ?? ''} name={detail.from[0]?.name}>
                          <span className="text-sm font-semibold text-gray-900 dark:text-gray-100 hover:text-[#51459d] cursor-pointer transition">{detail.from[0]?.name ?? detail.from[0]?.email}</span>
                        </ContactCard>
                        <span className="text-xs text-gray-400 ml-2">&lt;{detail.from[0]?.email}&gt;</span>
                      </div>
                      <span className="text-xs text-gray-400 shrink-0">{detail.date}</span>
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5">
                      To: {detail.to.map((a) => a.name ?? a.email).join(', ')}
                      {detail.cc && detail.cc.length > 0 && <> · Cc: {detail.cc.map((a) => a.name ?? a.email).join(', ')}</>}
                    </div>
                  </div>
                </div>
              </div>

              {/* Predictive Action Bar */}
              {detail && (detail as any).predicted_actions && (
                <div className="bg-gradient-to-r from-[#51459d]/5 to-[#3ec9d6]/5 border-b border-gray-100 dark:border-gray-800 px-6 py-3">
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Suggested Actions</p>
                  <div className="flex flex-wrap gap-2">
                    {((detail as any).predicted_actions as Array<{label: string; type: string}>)?.map((action: {label: string; type: string}, i: number) => (
                      <button
                        key={i}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-full text-xs font-medium text-[#51459d] hover:bg-[#51459d]/10 transition-colors"
                      >
                        {action.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* AI Summary Banner */}
              {detail && (detail as any).ai_summary && (
                <div className="bg-blue-50 dark:bg-blue-950/30 border-b border-blue-100 dark:border-blue-900 px-6 py-3">
                  <div className="flex items-start gap-2">
                    <svg className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    <div>
                      <p className="text-[10px] font-semibold text-blue-600 uppercase tracking-wider mb-0.5">AI Summary</p>
                      <p className="text-xs text-blue-800 dark:text-blue-300">{(detail as any).ai_summary}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Financial Context Ribbon */}
              {detail?.from[0]?.email && (
                <FinancialRibbon senderEmail={detail.from[0].email} />
              )}

              {/* Body */}
              <div className="px-6 py-5">
                <div
                  className="prose prose-sm max-w-none text-gray-700 dark:text-gray-300 leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(detail.html_body || detail.text_body) }}
                />
              </div>

              {/* Attachments */}
              {detail.attachments && detail.attachments.length > 0 && (
                <div className="px-6 pb-6">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Attachments</p>
                  <div className="flex flex-wrap gap-2">
                    {detail.attachments.map((att: MailAttachment) => (
                      <div key={att.name} className="flex items-center gap-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-[8px] px-3 py-2 text-xs">
                        <svg className="h-4 w-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                        <div>
                          <p className="font-medium text-gray-700 dark:text-gray-300">{att.name}</p>
                          <p className="text-gray-400">{att.size}</p>
                        </div>
                        <button className="ml-1 text-[#51459d] hover:underline">Download</button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Annotations (Internal Team Notes) */}
              {selectedMessage && <AnnotationsPanel messageId={selectedMessage} />}
            </div>
          ) : null}

          {/* AI Copilot Side Panel */}
          {showCopilot && selectedMessage && detail && (
            <AICopilotPanel
              messageId={selectedMessage}
              senderEmail={detail.from[0]?.email}
              onInsertDraft={(html) => {
                setReplyContext({
                  messageId: selectedMessage,
                  subject: detail.subject,
                  from: detail.from[0]?.email ?? '',
                  body: html,
                })
                setShowCopilot(false)
              }}
              onClose={() => setShowCopilot(false)}
            />
          )}
        </div>
      </div>

      {composeOpen && <ComposeModal onClose={() => setComposeOpen(false)} />}
      {replyContext && (
        <ComposeModal
          replyTo={replyContext}
          onClose={() => setReplyContext(null)}
        />
      )}
      {forwardContext && (
        <ComposeModal
          forwardFrom={forwardContext}
          onClose={() => setForwardContext(null)}
        />
      )}
      {snoozeMessageId && <SnoozeDialog messageId={snoozeMessageId} onClose={() => setSnoozeMessageId(null)} />}
      {showSaveToDrive && selectedMessage && (
        <SaveToDriveDialog
          messageId={selectedMessage}
          hasAttachments={!!(detail?.attachments && detail.attachments.length > 0)}
          onClose={() => setShowSaveToDrive(false)}
        />
      )}
      {showLinkCRM && selectedMessage && (
        <LinkCRMDialog messageId={selectedMessage} onClose={() => setShowLinkCRM(false)} />
      )}
      {showConvertToTask && selectedMessage && (
        <ConvertToTaskDialog messageId={selectedMessage} onClose={() => setShowConvertToTask(false)} />
      )}
      {showSaveAsNote && selectedMessage && (
        <SaveAsNoteDialog messageId={selectedMessage} onClose={() => setShowSaveAsNote(false)} />
      )}
      {showAnalytics && <MailAnalytics onClose={() => setShowAnalytics(false)} />}
      {showScheduleSend && selectedMessage && (
        <ScheduleSendDialog
          messageId={selectedMessage}
          currentScheduledAt={(detail as any)?.scheduled_send_at}
          onClose={() => setShowScheduleSend(false)}
        />
      )}

      {/* Keyboard shortcuts help toggle */}
      <div className="fixed bottom-4 right-4 z-30">
        <button
          onClick={() => setShowShortcutsHelp(!showShortcutsHelp)}
          className="w-8 h-8 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-full shadow-md flex items-center justify-center text-gray-400 hover:text-[#51459d] transition-colors"
          title="Keyboard shortcuts"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </button>
        {showShortcutsHelp && (
          <div className="absolute bottom-10 right-0 mb-2">
            <KeyboardShortcutsHelp />
          </div>
        )}
      </div>
    </div>
  )
}
