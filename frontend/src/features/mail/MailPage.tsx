import { useState, useEffect } from 'react'
import DOMPurify from 'dompurify'
import {
  useMailFolders,
  useMailMessages,
  useMailMessage,
  useSendMail,
  useReplyMail,
  useForwardMail,
  useMarkAsRead,
  useDeleteMessage,
} from '../../api/mail'
import type { MailFolder, MailMessageSummary, MailMessageFull, MailAttachment } from '../../api/mail'

// ─── Compose Modal ────────────────────────────────────────────────────────────

function ComposeModal({ onClose }: { onClose: () => void }) {
  const [to, setTo] = useState('')
  const [cc, setCc] = useState('')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [showCc, setShowCc] = useState(false)

  const send = useSendMail()

  const handleSend = () => {
    send.mutate(
      {
        to: to.split(',').map((e) => e.trim()),
        cc: cc ? cc.split(',').map((e) => e.trim()) : undefined,
        subject,
        body,
      },
      { onSuccess: () => onClose() },
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-[10px] shadow-2xl w-full max-w-2xl flex flex-col" style={{ maxHeight: '80vh' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 shrink-0">
          <h3 className="text-sm font-semibold text-gray-900">New Message</h3>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-[6px] text-gray-500">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
        </div>

        {/* Fields */}
        <div className="flex-1 overflow-y-auto">
          <div className="border-b border-gray-100">
            <div className="flex items-center px-4 py-2 gap-2">
              <span className="text-xs text-gray-400 w-12 shrink-0">To</span>
              <input value={to} onChange={(e) => setTo(e.target.value)} placeholder="Recipients" className="flex-1 text-sm text-gray-900 focus:outline-none placeholder:text-gray-400" />
              <button onClick={() => setShowCc(!showCc)} className="text-xs text-[#51459d] hover:underline shrink-0">Cc</button>
            </div>
          </div>
          {showCc && (
            <div className="border-b border-gray-100">
              <div className="flex items-center px-4 py-2 gap-2">
                <span className="text-xs text-gray-400 w-12 shrink-0">Cc</span>
                <input value={cc} onChange={(e) => setCc(e.target.value)} placeholder="Cc recipients" className="flex-1 text-sm text-gray-900 focus:outline-none placeholder:text-gray-400" />
              </div>
            </div>
          )}
          <div className="border-b border-gray-100">
            <div className="flex items-center px-4 py-2 gap-2">
              <span className="text-xs text-gray-400 w-12 shrink-0">Subject</span>
              <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Message subject" className="flex-1 text-sm text-gray-900 focus:outline-none placeholder:text-gray-400" />
            </div>
          </div>
          <div className="p-4">
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Compose your message…"
              rows={10}
              className="w-full text-sm text-gray-900 focus:outline-none resize-none placeholder:text-gray-400"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 shrink-0">
          <div className="flex items-center gap-2">
            <button className="p-1.5 hover:bg-gray-100 rounded-[6px] text-gray-500" title="Attach file">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-[8px] transition-colors">Discard</button>
            <button
              onClick={handleSend}
              disabled={!to || !subject || send.isPending}
              className="px-4 py-2 text-sm bg-[#51459d] text-white rounded-[8px] hover:bg-[#3d3480] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {send.isPending ? (
                <span className="flex items-center gap-1.5"><svg className="animate-spin h-3.5 w-3.5" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>Sending…</span>
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
    <div className="px-3 py-3 border-b border-gray-50 animate-pulse">
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-full bg-gray-200 shrink-0" />
        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="flex justify-between">
            <div className="h-3 bg-gray-200 rounded w-24" />
            <div className="h-3 bg-gray-200 rounded w-12" />
          </div>
          <div className="h-3 bg-gray-200 rounded w-48" />
          <div className="h-3 bg-gray-100 rounded w-full" />
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

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function MailPage() {
  const [selectedFolder, setSelectedFolder] = useState('inbox')
  const [selectedMessage, setSelectedMessage] = useState<string | null>(null)
  const [composeOpen, setComposeOpen] = useState(false)
  const [search, setSearch] = useState('')

  // ─── API hooks ──────────────────────────────────────────────────────────────

  const { data: foldersData, isError: foldersError } = useMailFolders()
  const folders: MailFolder[] = foldersData ?? []
  const serverDown = foldersError

  const { data: messagesData, isLoading: messagesLoading } = useMailMessages({ folder: selectedFolder })
  const allMessages: MailMessageSummary[] = messagesData?.messages ?? []
  const messages = allMessages.filter(
    (m) =>
      !search ||
      m.subject.toLowerCase().includes(search.toLowerCase()) ||
      (m.from.name ?? m.from.email).toLowerCase().includes(search.toLowerCase()),
  )

  const { data: detailData, isLoading: detailLoading } = useMailMessage(selectedMessage ?? '')
  const detail: MailMessageFull | null = detailData ?? null

  const markAsRead = useMarkAsRead()
  const replyMail = useReplyMail()
  const forwardMail = useForwardMail()
  const deleteMessage = useDeleteMessage()

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

  const handleReply = () => {
    if (!selectedMessage) return
    const body = prompt('Enter your reply:')
    if (body) {
      replyMail.mutate({ message_id: selectedMessage, body })
    }
  }

  const handleForward = () => {
    if (!selectedMessage) return
    const to = prompt('Forward to (comma-separated emails):')
    if (to) {
      forwardMail.mutate({
        message_id: selectedMessage,
        to: to.split(',').map((e) => e.trim()),
      })
    }
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
          <p className="text-xs text-amber-700">Mail server not configured — showing empty mailbox. Configure Stalwart JMAP in Settings to enable real mail.</p>
        </div>
      )}

      <div className="flex-1 flex overflow-hidden">
        {/* Left: Folder sidebar */}
        <aside className="w-52 shrink-0 bg-white border-r border-gray-100 flex flex-col">
          <div className="p-3 border-b border-gray-100">
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
                className={`w-full flex items-center justify-between px-3 py-2 rounded-[8px] text-sm transition-colors mb-0.5 ${
                  selectedFolder === folder.id
                    ? 'bg-[#51459d]/10 text-[#51459d] font-medium'
                    : 'text-gray-600 hover:bg-gray-100'
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
                <button key={label} className="w-full flex items-center gap-2 px-1 py-1.5 text-xs text-gray-500 hover:text-gray-800 transition-colors rounded-[6px] hover:bg-gray-50">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${label === 'Important' ? 'bg-red-400' : label === 'Work' ? 'bg-blue-400' : label === 'Personal' ? 'bg-green-400' : 'bg-yellow-400'}`} />
                  {label}
                </button>
              ))}
            </div>
          </nav>
        </aside>

        {/* Middle: Message list */}
        <div className="w-80 shrink-0 bg-white border-r border-gray-100 flex flex-col">
          <div className="p-3 border-b border-gray-100 shrink-0">
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search mail…"
                className="w-full pl-9 pr-3 py-2 text-xs bg-gray-50 border border-gray-200 rounded-[8px] focus:outline-none focus:ring-1 focus:ring-[#51459d]/30"
              />
            </div>
          </div>

          <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100 shrink-0">
            <h2 className="text-sm font-semibold text-gray-900 capitalize">{selectedFolder}</h2>
            <span className="text-xs text-gray-400">{messages.length} messages</span>
          </div>

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
                <button
                  key={msg.id}
                  onClick={() => setSelectedMessage(msg.id)}
                  className={`w-full text-left px-3 py-3 border-b border-gray-50 hover:bg-gray-50 transition-colors ${
                    selectedMessage === msg.id ? 'bg-[#51459d]/5 border-l-2 border-l-[#51459d]' : ''
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    <div className={`w-8 h-8 rounded-full ${getAvatarColor(msg.from.name ?? msg.from.email)} flex items-center justify-center text-white text-[10px] font-bold shrink-0`}>
                      {getInitials(msg.from.name ?? msg.from.email)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className={`text-xs truncate ${msg.read ? 'text-gray-600' : 'text-gray-900 font-semibold'}`}>{msg.from.name ?? msg.from.email}</span>
                        <span className="text-[10px] text-gray-400 shrink-0 ml-1">{msg.date}</span>
                      </div>
                      <p className={`text-xs truncate ${msg.read ? 'text-gray-500' : 'text-gray-800 font-medium'}`}>{msg.subject}</p>
                    </div>
                    {!msg.read && <div className="w-2 h-2 rounded-full bg-[#51459d] mt-1 shrink-0" />}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Right: Message detail */}
        <div className="flex-1 bg-gray-50 flex flex-col overflow-hidden">
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
              <div className="bg-white border-b border-gray-100 px-6 py-4">
                <div className="flex items-start justify-between mb-4">
                  <h2 className="text-lg font-semibold text-gray-900 pr-4">{detail.subject}</h2>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={handleReply} className="p-1.5 hover:bg-gray-100 rounded-[6px] text-gray-500" title="Reply">
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" /></svg>
                    </button>
                    <button onClick={handleForward} className="p-1.5 hover:bg-gray-100 rounded-[6px] text-gray-500" title="Forward">
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 10H11a8 8 0 00-8 8v2m18-10l-6-6m6 6l-6 6" /></svg>
                    </button>
                    <button onClick={handleDelete} className="p-1.5 hover:bg-gray-100 rounded-[6px] text-gray-500" title="Delete">
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
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
                        <span className="text-sm font-semibold text-gray-900">{detail.from[0]?.name ?? detail.from[0]?.email}</span>
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

              {/* Body */}
              <div className="px-6 py-5">
                <div
                  className="prose prose-sm max-w-none text-gray-700 leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(detail.html_body || detail.text_body) }}
                />
              </div>

              {/* Attachments */}
              {detail.attachments && detail.attachments.length > 0 && (
                <div className="px-6 pb-6">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Attachments</p>
                  <div className="flex flex-wrap gap-2">
                    {detail.attachments.map((att: MailAttachment) => (
                      <div key={att.name} className="flex items-center gap-2 bg-white border border-gray-200 rounded-[8px] px-3 py-2 text-xs">
                        <svg className="h-4 w-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                        <div>
                          <p className="font-medium text-gray-700">{att.name}</p>
                          <p className="text-gray-400">{att.size}</p>
                        </div>
                        <button className="ml-1 text-[#51459d] hover:underline">Download</button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>

      {composeOpen && <ComposeModal onClose={() => setComposeOpen(false)} />}
    </div>
  )
}
