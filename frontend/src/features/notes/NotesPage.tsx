import { useState, useRef, useEffect, useCallback } from 'react'
import DOMPurify from 'dompurify'
import { useNotes, useCreateNote, useUpdateNote, useDeleteNote, type Note } from '../../api/notes'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function stripHtml(html: string): string {
  const tmp = document.createElement('div')
  tmp.innerHTML = html
  return tmp.textContent || tmp.innerText || ''
}

// ─── Formatting toolbar ───────────────────────────────────────────────────────

const TOOLBAR_BUTTONS = [
  { cmd: 'bold',           label: 'B',  title: 'Bold',        style: 'font-bold' },
  { cmd: 'italic',         label: 'I',  title: 'Italic',      style: 'italic' },
  { cmd: 'underline',      label: 'U',  title: 'Underline',   style: 'underline' },
  { cmd: 'strikeThrough',  label: 'S',  title: 'Strikethrough', style: 'line-through' },
]

function execCmd(cmd: string, value?: string) {
  document.execCommand(cmd, false, value)
}

// ─── Note editor ──────────────────────────────────────────────────────────────

function NoteEditor({ note, onSave, onDelete }: {
  note: Note;
  onSave: (updated: { title?: string; content?: string; tags?: string[]; is_pinned?: boolean }) => void;
  onDelete: (id: string) => void;
}) {
  const [title, setTitle] = useState(note.title)
  const [tags, setTags] = useState((note.tags || []).join(', '))
  const [tagInput, setTagInput] = useState('')
  const editorRef = useRef<HTMLDivElement>(null)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    setTitle(note.title)
    setTags((note.tags || []).join(', '))
    if (editorRef.current) {
      const sanitized = DOMPurify.sanitize(note.content || '')
      if (editorRef.current.innerHTML !== sanitized) {
        editorRef.current.innerHTML = sanitized
      }
    }
  }, [note.id])

  const triggerSave = useCallback(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      const content = editorRef.current?.innerHTML ?? ''
      onSave({ title, content, tags: tags.split(',').map((t) => t.trim()).filter(Boolean) })
    }, 800)
  }, [title, tags, onSave])

  const handleToolbar = (cmd: string) => {
    editorRef.current?.focus()
    execCmd(cmd)
    triggerSave()
  }

  const handleHeading = (level: 'h1' | 'h2' | 'p') => {
    editorRef.current?.focus()
    execCmd('formatBlock', level)
    triggerSave()
  }

  const handleList = (type: 'insertUnorderedList' | 'insertOrderedList') => {
    editorRef.current?.focus()
    execCmd(type)
    triggerSave()
  }

  const formatDate = (iso: string) => {
    return new Date(iso).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div className="flex-1 flex flex-col bg-white h-full overflow-hidden">
      {/* Toolbar */}
      <div className="border-b border-gray-100 px-4 py-2 flex flex-wrap items-center gap-1 shrink-0">
        {TOOLBAR_BUTTONS.map((btn) => (
          <button
            key={btn.cmd}
            onMouseDown={(e) => { e.preventDefault(); handleToolbar(btn.cmd) }}
            title={btn.title}
            className="w-7 h-7 rounded-[5px] text-xs font-semibold text-gray-600 hover:bg-gray-100 transition-colors flex items-center justify-center"
          >
            <span className={btn.style}>{btn.label}</span>
          </button>
        ))}

        <div className="h-4 w-px bg-gray-200 mx-1" />

        <button onMouseDown={(e) => { e.preventDefault(); handleHeading('h1') }} title="Heading 1" className="px-2 h-7 rounded-[5px] text-xs font-bold text-gray-600 hover:bg-gray-100 transition-colors">H1</button>
        <button onMouseDown={(e) => { e.preventDefault(); handleHeading('h2') }} title="Heading 2" className="px-2 h-7 rounded-[5px] text-xs font-semibold text-gray-600 hover:bg-gray-100 transition-colors">H2</button>
        <button onMouseDown={(e) => { e.preventDefault(); handleHeading('p') }} title="Paragraph" className="px-2 h-7 rounded-[5px] text-xs text-gray-600 hover:bg-gray-100 transition-colors">P</button>

        <div className="h-4 w-px bg-gray-200 mx-1" />

        <button onMouseDown={(e) => { e.preventDefault(); handleList('insertUnorderedList') }} title="Bullet list" className="w-7 h-7 rounded-[5px] text-gray-600 hover:bg-gray-100 transition-colors flex items-center justify-center">
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg>
        </button>
        <button onMouseDown={(e) => { e.preventDefault(); handleList('insertOrderedList') }} title="Numbered list" className="w-7 h-7 rounded-[5px] text-gray-600 hover:bg-gray-100 transition-colors flex items-center justify-center">
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
        </button>
        <button onMouseDown={(e) => { e.preventDefault(); execCmd('formatBlock', 'pre'); triggerSave() }} title="Code block" className="w-7 h-7 rounded-[5px] text-gray-600 hover:bg-gray-100 transition-colors flex items-center justify-center font-mono text-xs">
          {'</>'}
        </button>

        <div className="flex-1" />

        <button
          onClick={() => onDelete(note.id)}
          className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-[6px] transition-colors"
          title="Delete note"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
        </button>
      </div>

      {/* Title */}
      <div className="px-6 pt-5 pb-1 shrink-0">
        <input
          value={title}
          onChange={(e) => { setTitle(e.target.value); triggerSave() }}
          placeholder="Note title…"
          className="w-full text-xl font-bold text-gray-900 focus:outline-none placeholder:text-gray-300"
        />
        <p className="text-xs text-gray-400 mt-1">Last edited {formatDate(note.updated_at)}</p>
      </div>

      {/* Tags */}
      <div className="px-6 py-2 flex flex-wrap items-center gap-1.5 shrink-0">
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
              triggerSave()
            }
          }}
          placeholder="+ Add tag"
          className="text-[10px] text-[#51459d] focus:outline-none placeholder:text-gray-300 w-16"
        />
      </div>

      <div className="h-px bg-gray-100 mx-6 shrink-0" />

      {/* Editor body */}
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onInput={triggerSave}
        className="flex-1 overflow-y-auto px-6 py-4 text-sm text-gray-700 leading-relaxed focus:outline-none min-h-0"
      />

      <style>{`
        [contenteditable] h1 { font-size: 1.25rem; font-weight: 700; margin: 0.75rem 0 0.25rem; color: #111827; }
        [contenteditable] h2 { font-size: 1.05rem; font-weight: 600; margin: 0.5rem 0 0.25rem; color: #374151; }
        [contenteditable] ul { list-style: disc; padding-left: 1.25rem; margin: 0.25rem 0; }
        [contenteditable] ol { list-style: decimal; padding-left: 1.25rem; margin: 0.25rem 0; }
        [contenteditable] li { margin: 0.15rem 0; }
        [contenteditable] pre { background: #f3f4f6; border-radius: 6px; padding: 0.5rem 0.75rem; font-family: monospace; font-size: 0.8rem; margin: 0.5rem 0; }
        [contenteditable] a { color: #51459d; text-decoration: underline; }
      `}</style>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function NotesPage() {
  const [selectedId, setSelectedId] = useState<string>('')
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'pinned'>('all')

  const { data: notesData, isLoading } = useNotes(
    filter === 'pinned' ? { pinned: true } : undefined
  )
  const notes = notesData?.notes ?? []

  const createNote = useCreateNote()
  const updateNote = useUpdateNote()
  const deleteNote = useDeleteNote()

  // Auto-select first note
  useEffect(() => {
    if (!selectedId && notes.length > 0) {
      setSelectedId(notes[0].id)
    }
  }, [notes, selectedId])

  const filteredNotes = notes.filter((n) => {
    if (!search) return true
    const contentText = n.content ? stripHtml(n.content) : ''
    return n.title.toLowerCase().includes(search.toLowerCase()) || contentText.toLowerCase().includes(search.toLowerCase())
  })

  const selectedNote = notes.find((n) => n.id === selectedId) ?? null

  const formatPreviewDate = (iso: string) => {
    const d = new Date(iso)
    const now = new Date()
    if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' })
    return d.toLocaleDateString('en-KE', { day: 'numeric', month: 'short' })
  }

  return (
    <div className="h-full flex overflow-hidden">
      {/* Notes list */}
      <aside className="w-72 shrink-0 bg-white border-r border-gray-100 flex flex-col">
        <div className="p-3 border-b border-gray-100 space-y-2">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search notes…" className="w-full pl-8 pr-3 py-1.5 text-xs bg-gray-50 border border-gray-200 rounded-[8px] focus:outline-none" />
            </div>
            <button
              onClick={() => createNote.mutate({ title: 'Untitled Note', content: '', tags: [], is_pinned: false }, {
                onSuccess: (data) => setSelectedId(data.id),
              })}
              disabled={createNote.isPending}
              className="w-8 h-8 rounded-[8px] bg-[#51459d] text-white flex items-center justify-center hover:bg-[#3d3480] transition-colors shrink-0 disabled:opacity-50"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            </button>
          </div>

          <div className="flex gap-1">
            {(['all', 'pinned'] as const).map((f) => (
              <button key={f} onClick={() => setFilter(f)} className={`flex-1 py-1 text-xs rounded-[6px] transition-colors capitalize ${filter === f ? 'bg-[#51459d] text-white' : 'text-gray-500 hover:bg-gray-100'}`}>
                {f}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center h-48">
              <svg className="animate-spin h-5 w-5 text-[#51459d]" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
            </div>
          ) : filteredNotes.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-center px-4">
              <p className="text-sm text-gray-400">No notes found</p>
              <button
                onClick={() => createNote.mutate({ title: 'Untitled Note' }, { onSuccess: (data) => setSelectedId(data.id) })}
                className="mt-2 text-xs text-[#51459d] hover:underline"
              >
                Create a note →
              </button>
            </div>
          ) : (
            filteredNotes.map((note) => {
              const previewText = note.content ? stripHtml(note.content) : 'Empty note'
              return (
                <button
                  key={note.id}
                  onClick={() => setSelectedId(note.id)}
                  className={`w-full text-left px-4 py-3.5 border-b border-gray-50 hover:bg-gray-50 transition-colors ${selectedId === note.id ? 'bg-[#51459d]/5 border-l-2 border-l-[#51459d]' : ''}`}
                >
                  <div className="flex items-start gap-2.5">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <div className="flex items-center gap-1.5 min-w-0">
                          {note.is_pinned && <span className="text-[10px]">📌</span>}
                          <p className={`text-xs font-semibold truncate ${selectedId === note.id ? 'text-[#51459d]' : 'text-gray-800'}`}>{note.title}</p>
                        </div>
                        <span className="text-[10px] text-gray-400 shrink-0 ml-1">{formatPreviewDate(note.updated_at)}</span>
                      </div>
                      <p className="text-[11px] text-gray-400 truncate leading-snug">{previewText}</p>
                      {note.tags && note.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {note.tags.slice(0, 2).map((tag) => (
                            <span key={tag} className="text-[9px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">{tag}</span>
                          ))}
                          {note.tags.length > 2 && <span className="text-[9px] text-gray-400">+{note.tags.length - 2}</span>}
                        </div>
                      )}
                    </div>
                  </div>
                </button>
              )
            })
          )}
        </div>
      </aside>

      {/* Editor */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {selectedNote ? (
          <NoteEditor
            note={selectedNote}
            onSave={(updated) => updateNote.mutate({ id: selectedNote.id, ...updated })}
            onDelete={(id) => {
              deleteNote.mutate(id)
              const next = filteredNotes.find((n) => n.id !== id)
              setSelectedId(next?.id ?? '')
            }}
          />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center bg-gray-50 text-center">
            <div className="w-14 h-14 rounded-2xl bg-[#51459d]/10 flex items-center justify-center text-2xl mb-3">📝</div>
            <h3 className="text-base font-semibold text-gray-900 mb-1">Your Notes</h3>
            <p className="text-sm text-gray-400 mb-4">Select a note to start editing, or create a new one.</p>
            <button
              onClick={() => createNote.mutate({ title: 'Untitled Note' }, { onSuccess: (data) => setSelectedId(data.id) })}
              className="px-4 py-2 bg-[#51459d] text-white text-sm rounded-[8px] hover:bg-[#3d3480] transition-colors"
            >
              New Note
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
