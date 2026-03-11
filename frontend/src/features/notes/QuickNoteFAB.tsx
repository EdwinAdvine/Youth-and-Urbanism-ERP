import { useState } from 'react'
import { useCreateNote } from '../../api/notes'

interface QuickNoteFABProps {
  onNoteCreated: (noteId: string) => void
}

export default function QuickNoteFAB({ onNoteCreated }: QuickNoteFABProps) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const createNote = useCreateNote()

  const handleCreate = async () => {
    try {
      const data = await createNote.mutateAsync({
        title: title.trim() || 'Untitled Note',
        content: content ? `<p>${content}</p>` : '',
        tags: [],
        is_pinned: false,
      })
      onNoteCreated(data.id)
      setTitle('')
      setContent('')
      setOpen(false)
    } catch {
      // silent fail, createNote shows error via query
    }
  }

  return (
    <>
      {/* FAB button - mobile only */}
      <button
        onClick={() => setOpen(true)}
        className="md:hidden fixed bottom-6 right-6 z-30 w-14 h-14 rounded-full bg-[#51459d] text-white shadow-lg hover:bg-[#3d3480] active:scale-95 transition-all flex items-center justify-center"
        aria-label="Quick add note"
      >
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
      </button>

      {/* Bottom sheet */}
      {open && (
        <div className="md:hidden fixed inset-0 z-50 flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="relative bg-white dark:bg-gray-800 rounded-t-[16px] shadow-2xl p-5 pb-8" style={{ animation: 'slideUp 0.25s ease-out' }}>
            <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto mb-4" />
            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-4">Quick Note</h3>

            <div className="space-y-3">
              <input
                autoFocus
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Note title..."
                className="w-full px-3 py-3 text-sm border border-gray-200 dark:border-gray-700 rounded-[10px] focus:outline-none focus:ring-2 focus:ring-[#51459d]/30 focus:border-[#51459d] min-h-[44px]"
              />
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Start writing..."
                rows={4}
                className="w-full px-3 py-3 text-sm border border-gray-200 dark:border-gray-700 rounded-[10px] focus:outline-none focus:ring-2 focus:ring-[#51459d]/30 focus:border-[#51459d] resize-none min-h-[44px]"
              />
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setOpen(false)}
                  className="flex-1 px-4 py-3 text-sm text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-900 rounded-[10px] hover:bg-gray-200 transition-colors min-h-[44px]"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreate}
                  disabled={createNote.isPending}
                  className="flex-1 px-4 py-3 text-sm text-white bg-[#51459d] rounded-[10px] hover:bg-[#3d3480] transition-colors disabled:opacity-50 min-h-[44px] flex items-center justify-center gap-2"
                >
                  {createNote.isPending ? (
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                  ) : 'Create Note'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes slideUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
      `}</style>
    </>
  )
}
