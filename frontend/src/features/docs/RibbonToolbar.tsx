import { useState, useRef, useEffect } from 'react'
import { useActiveEditors, useConvertDocument, useAttachToEmail, useLinkToNote, ActiveEditor } from '../../api/docs'

// ─── Types ───────────────────────────────────────────────────────────────────

interface RibbonToolbarProps {
  fileId: string
  fileName: string
  fileExtension: string
  onBack: () => void
  onSave?: () => void
  onShare?: () => void
  onPrint?: () => void
  onToggleComments?: () => void
  onToggleVersions?: () => void
  onToggleAI?: () => void
  commentsActive?: boolean
  versionsActive?: boolean
  aiActive?: boolean
}

type MenuKey = 'file' | 'edit' | 'insert' | 'format' | null

// ─── Ribbon Menu Data ────────────────────────────────────────────────────────

interface MenuItem {
  label: string
  shortcut?: string
  divider?: boolean
  onClick?: () => void
  disabled?: boolean
}

// ─── Active Editors Avatars ──────────────────────────────────────────────────

function EditorAvatars({ fileId }: { fileId: string }) {
  const { data } = useActiveEditors(fileId)
  const editors = data?.editors ?? []

  if (editors.length === 0) return null

  const colors = ['#51459d', '#6fd943', '#3ec9d6', '#ffa21d', '#ff3a6e']

  return (
    <div className="flex items-center gap-1 mr-2">
      {editors.slice(0, 5).map((editor: ActiveEditor, idx: number) => {
        const initial = (editor.user_name || '?')[0].toUpperCase()
        const bg = colors[idx % colors.length]
        return (
          <div
            key={editor.user_id}
            className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white border-2 border-white shadow-sm"
            style={{ backgroundColor: bg }}
            title={`${editor.user_name} (editing)`}
          >
            {initial}
          </div>
        )
      })}
      {editors.length > 5 && (
        <span className="text-[10px] text-gray-500 ml-1">+{editors.length - 5}</span>
      )}
      <span className="text-[10px] text-gray-400 ml-1">editing</span>
    </div>
  )
}

// ─── Dropdown Menu Component ─────────────────────────────────────────────────

function DropdownMenu({ items, onClose }: { items: MenuItem[]; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  return (
    <div
      ref={ref}
      className="absolute top-full left-0 mt-0.5 w-56 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-[8px] shadow-xl z-50 py-1"
    >
      {items.map((item, i) =>
        item.divider ? (
          <div key={i} className="h-px bg-gray-100 dark:bg-gray-800 my-1" />
        ) : (
          <button
            key={i}
            onClick={() => {
              if (!item.disabled && item.onClick) {
                item.onClick()
                onClose()
              }
            }}
            disabled={item.disabled}
            className={`w-full text-left px-4 py-2 text-xs flex items-center justify-between transition-colors ${
              item.disabled
                ? 'text-gray-300 cursor-not-allowed'
                : 'text-gray-700 dark:text-gray-300 hover:bg-[#51459d]/5 hover:text-[#51459d]'
            }`}
          >
            <span>{item.label}</span>
            {item.shortcut && (
              <span className="text-[10px] text-gray-400 ml-4">{item.shortcut}</span>
            )}
          </button>
        )
      )}
    </div>
  )
}

// ─── Convert Dialog ──────────────────────────────────────────────────────────

function ConvertDialog({ fileId, fileName, onClose }: { fileId: string; fileName: string; onClose: () => void }) {
  const convert = useConvertDocument(fileId)
  const [format, setFormat] = useState('pdf')
  const formats = ['pdf', 'docx', 'xlsx', 'pptx', 'odt', 'csv', 'html', 'txt']

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-gray-800 rounded-[10px] shadow-2xl w-full max-w-sm">
        <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Convert Document</h3>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-[6px] text-gray-500">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="p-5 space-y-4">
          <p className="text-xs text-gray-500">Convert <strong>{fileName}</strong> to:</p>
          <div className="grid grid-cols-4 gap-2">
            {formats.map((f) => (
              <button
                key={f}
                onClick={() => setFormat(f)}
                className={`px-3 py-2 text-xs font-medium rounded-[6px] border-2 transition-colors uppercase ${
                  format === f
                    ? 'border-[#51459d] bg-[#51459d]/5 text-[#51459d]'
                    : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
          {convert.isSuccess && convert.data?.conversion?.file_url && (
            <div className="bg-green-50 border border-green-200 rounded-[8px] p-3">
              <p className="text-xs text-green-700 font-medium">Conversion complete!</p>
              <a
                href={convert.data.conversion.file_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-[#51459d] hover:underline mt-1 inline-block"
              >
                Download converted file
              </a>
            </div>
          )}
          {convert.isError && (
            <p className="text-xs text-[#ff3a6e]">Conversion failed. The document server may be unavailable.</p>
          )}
        </div>
        <div className="px-5 py-3 border-t border-gray-100 dark:border-gray-800 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-[8px] transition-colors">
            Cancel
          </button>
          <button
            onClick={() => convert.mutate({ output_format: format })}
            disabled={convert.isPending}
            className="px-4 py-2 text-sm bg-[#51459d] text-white rounded-[8px] hover:bg-[#3d3480] transition-colors disabled:opacity-50"
          >
            {convert.isPending ? 'Converting...' : 'Convert'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Link to Note Dialog ─────────────────────────────────────────────────────

function LinkToNoteDialog({ fileId, onClose }: { fileId: string; onClose: () => void }) {
  const linkToNote = useLinkToNote()
  const [noteId, setNoteId] = useState('')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-gray-800 rounded-[10px] shadow-2xl w-full max-w-sm">
        <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Link to Note</h3>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-[6px] text-gray-500">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="p-5 space-y-3">
          <div>
            <label className="text-xs font-medium text-gray-700 dark:text-gray-300 block mb-1.5">Note ID</label>
            <input
              value={noteId}
              onChange={(e) => setNoteId(e.target.value)}
              placeholder="Paste note UUID..."
              className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-[8px] focus:outline-none focus:ring-1 focus:ring-[#51459d]/40"
            />
          </div>
          {linkToNote.isSuccess && (
            <p className="text-xs text-[#6fd943] font-medium">Document linked to note successfully.</p>
          )}
          {linkToNote.isError && (
            <p className="text-xs text-[#ff3a6e]">Failed to link. Note may not exist or document is already linked.</p>
          )}
        </div>
        <div className="px-5 py-3 border-t border-gray-100 dark:border-gray-800 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-[8px] transition-colors">
            Cancel
          </button>
          <button
            onClick={() => noteId.trim() && linkToNote.mutate({ fileId, noteId: noteId.trim() })}
            disabled={!noteId.trim() || linkToNote.isPending}
            className="px-4 py-2 text-sm bg-[#51459d] text-white rounded-[8px] hover:bg-[#3d3480] transition-colors disabled:opacity-50"
          >
            {linkToNote.isPending ? 'Linking...' : 'Link'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Ribbon Toolbar ─────────────────────────────────────────────────────

export default function RibbonToolbar({
  fileId,
  fileName,
  fileExtension,
  onBack,
  onSave,
  onShare,
  onPrint,
  onToggleComments,
  onToggleVersions,
  onToggleAI,
  commentsActive,
  versionsActive,
  aiActive,
}: RibbonToolbarProps) {
  const [activeMenu, setActiveMenu] = useState<MenuKey>(null)
  const [showConvert, setShowConvert] = useState(false)
  const [showLinkNote, setShowLinkNote] = useState(false)
  const attachToEmail = useAttachToEmail()

  const ext = fileExtension.replace(/^\./, '')
  const FILE_CONFIG: Record<string, { color: string; bg: string; label: string; icon: string }> = {
    docx: { color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200', label: 'Word', icon: 'W' },
    xlsx: { color: 'text-green-700', bg: 'bg-green-50 border-green-200', label: 'Excel', icon: 'X' },
    pptx: { color: 'text-orange-700', bg: 'bg-orange-50 border-orange-200', label: 'PowerPoint', icon: 'P' },
    pdf: { color: 'text-red-700', bg: 'bg-red-50 border-red-200', label: 'PDF', icon: 'PDF' },
  }
  const cfg = FILE_CONFIG[ext] ?? FILE_CONFIG.docx

  const handleToggleMenu = (menu: MenuKey) => {
    setActiveMenu((prev) => (prev === menu ? null : menu))
  }

  const fileMenuItems: MenuItem[] = [
    { label: 'Save', shortcut: 'Ctrl+S', onClick: onSave },
    { label: 'Share...', shortcut: 'Ctrl+Shift+S', onClick: onShare },
    { divider: true } as MenuItem,
    { label: 'Convert to...', onClick: () => setShowConvert(true) },
    { label: 'Print...', shortcut: 'Ctrl+P', onClick: onPrint },
    { divider: true } as MenuItem,
    { label: 'Attach to Email', onClick: () => attachToEmail.mutate(fileId) },
    { label: 'Link to Note', onClick: () => setShowLinkNote(true) },
    { divider: true } as MenuItem,
    { label: 'Close', onClick: onBack },
  ]

  const editMenuItems: MenuItem[] = [
    { label: 'Undo', shortcut: 'Ctrl+Z', disabled: true },
    { label: 'Redo', shortcut: 'Ctrl+Y', disabled: true },
    { divider: true } as MenuItem,
    { label: 'Cut', shortcut: 'Ctrl+X', disabled: true },
    { label: 'Copy', shortcut: 'Ctrl+C', disabled: true },
    { label: 'Paste', shortcut: 'Ctrl+V', disabled: true },
    { divider: true } as MenuItem,
    { label: 'Find & Replace', shortcut: 'Ctrl+H', disabled: true },
  ]

  const insertMenuItems: MenuItem[] = [
    { label: 'Image...', disabled: true },
    { label: 'Table...', disabled: true },
    { label: 'Chart...', disabled: true },
    { divider: true } as MenuItem,
    { label: 'Link...', disabled: true },
    { label: 'Comment', onClick: onToggleComments },
    { divider: true } as MenuItem,
    { label: 'Page Break', disabled: true },
    { label: 'Header / Footer', disabled: true },
  ]

  const formatMenuItems: MenuItem[] = [
    { label: 'Bold', shortcut: 'Ctrl+B', disabled: true },
    { label: 'Italic', shortcut: 'Ctrl+I', disabled: true },
    { label: 'Underline', shortcut: 'Ctrl+U', disabled: true },
    { divider: true } as MenuItem,
    { label: 'Paragraph Styles...', disabled: true },
    { label: 'Text Color...', disabled: true },
    { label: 'Highlight Color...', disabled: true },
    { divider: true } as MenuItem,
    { label: 'Clear Formatting', disabled: true },
  ]

  const menus: { key: MenuKey; label: string; items: MenuItem[] }[] = [
    { key: 'file', label: 'File', items: fileMenuItems },
    { key: 'edit', label: 'Edit', items: editMenuItems },
    { key: 'insert', label: 'Insert', items: insertMenuItems },
    { key: 'format', label: 'Format', items: formatMenuItems },
  ]

  return (
    <>
      {/* Top bar: branding + file info + editor avatars + action buttons */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-800 shrink-0">
        {/* Row 1: File name + actions */}
        <div className="px-4 py-2 flex items-center gap-3">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </button>
          <div className="h-4 w-px bg-gray-200 dark:bg-gray-700" />
          <div className={`px-2 py-0.5 rounded border text-[10px] font-bold ${cfg.bg} ${cfg.color}`}>
            {cfg.icon}
          </div>
          <span className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate max-w-[200px]">{fileName}</span>

          <div className="flex-1" />

          {/* Co-editing presence avatars */}
          <EditorAvatars fileId={fileId} />

          {/* Toolbar toggle buttons */}
          <button
            onClick={onToggleComments}
            className={`px-3 py-1.5 text-xs border rounded-[6px] transition-colors ${
              commentsActive
                ? 'border-[#51459d] bg-[#51459d]/10 text-[#51459d]'
                : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
            }`}
          >
            Comments
          </button>
          <button
            onClick={onToggleVersions}
            className={`px-3 py-1.5 text-xs border rounded-[6px] transition-colors ${
              versionsActive
                ? 'border-[#51459d] bg-[#51459d]/10 text-[#51459d]'
                : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
            }`}
          >
            History
          </button>
          <button
            onClick={onToggleAI}
            className={`px-3 py-1.5 text-xs border rounded-[6px] transition-colors ${
              aiActive
                ? 'border-[#51459d] bg-[#51459d]/10 text-[#51459d]'
                : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
            }`}
          >
            AI Assist
          </button>
          <button
            onClick={onSave}
            className="px-3 py-1.5 text-xs bg-[#51459d] text-white rounded-[6px] hover:bg-[#3d3480] transition-colors"
          >
            Save
          </button>
          <button
            onClick={onShare}
            className="px-3 py-1.5 text-xs border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 rounded-[6px] hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            Share
          </button>
          <button
            onClick={onPrint}
            className="px-3 py-1.5 text-xs border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 rounded-[6px] hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            Print
          </button>
        </div>

        {/* Row 2: Ribbon menus (File, Edit, Insert, Format) */}
        <div className="px-4 py-1 flex items-center gap-0.5 border-t border-gray-50 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50">
          {menus.map(({ key, label, items }) => (
            <div key={key} className="relative">
              <button
                onClick={() => handleToggleMenu(key)}
                onMouseEnter={() => activeMenu && handleToggleMenu(key)}
                className={`px-3 py-1.5 text-xs font-medium rounded-[4px] transition-colors ${
                  activeMenu === key
                    ? 'bg-[#51459d]/10 text-[#51459d]'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-gray-100'
                }`}
              >
                {label}
              </button>
              {activeMenu === key && (
                <DropdownMenu items={items} onClose={() => setActiveMenu(null)} />
              )}
            </div>
          ))}

          {/* Attach to email toast feedback */}
          {attachToEmail.isSuccess && (
            <span className="ml-4 text-[10px] text-[#6fd943] font-medium animate-pulse">
              Attachment URL copied! Use in mail compose.
            </span>
          )}
        </div>
      </div>

      {/* Dialogs */}
      {showConvert && (
        <ConvertDialog fileId={fileId} fileName={fileName} onClose={() => setShowConvert(false)} />
      )}
      {showLinkNote && (
        <LinkToNoteDialog fileId={fileId} onClose={() => setShowLinkNote(false)} />
      )}
    </>
  )
}
