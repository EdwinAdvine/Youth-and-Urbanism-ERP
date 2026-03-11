import { useState, useRef, useEffect } from 'react'
import { useExportNote } from '../../api/notes'

interface ExportMenuProps {
  noteId: string
  noteTitle: string
}

const EXPORT_FORMATS = [
  { id: 'pdf' as const, label: 'PDF Document', icon: '📕', ext: '.pdf' },
  { id: 'markdown' as const, label: 'Markdown', icon: '📝', ext: '.md' },
  { id: 'text' as const, label: 'Plain Text', icon: '📄', ext: '.txt' },
]

export default function ExportMenu({ noteId, noteTitle }: ExportMenuProps) {
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const exportNote = useExportNote()

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  const handleExport = async (format: 'pdf' | 'markdown' | 'text') => {
    try {
      const blob = await exportNote.mutateAsync({ noteId, format })
      const ext = EXPORT_FORMATS.find((f) => f.id === format)?.ext ?? '.txt'
      const safeName = noteTitle.replace(/[^a-zA-Z0-9_\- ]/g, '').trim() || 'note'
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${safeName}${ext}`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      setOpen(false)
    } catch {
      alert('Export failed. Please try again.')
    }
  }

  return (
    <div ref={menuRef} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-[6px] transition-colors"
        title="Export note"
      >
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 z-30 bg-white border border-gray-200 rounded-[10px] shadow-lg py-1 w-48">
          <p className="px-3 py-1.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
            Export as
          </p>
          {EXPORT_FORMATS.map((fmt) => (
            <button
              key={fmt.id}
              onClick={() => handleExport(fmt.id)}
              disabled={exportNote.isPending}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              <span>{fmt.icon}</span>
              <span>{fmt.label}</span>
              <span className="ml-auto text-[10px] text-gray-400">{fmt.ext}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
