/**
 * DatabasesPage — Lists all NoteDatabase objects and opens DatabaseView.
 * Accessible from the NotebookNav or directly from /notes/databases route.
 */
import { useState } from 'react'
import { useDatabases, useCreateDatabase, useDeleteDatabase, type NoteDatabase } from '../../../api/noteDatabases'
import DatabaseView from './DatabaseView'

const DB_ICONS = ['🗃️', '📊', '📋', '🏗️', '📌', '🧩', '🎯', '📈', '🔗', '💡']

function DatabaseCard({ db, onClick, onDelete }: { db: NoteDatabase; onClick: () => void; onDelete: () => void }) {
  const [hovered, setHovered] = useState(false)

  return (
    <div
      className="group bg-white dark:bg-gray-800 rounded-[12px] border border-gray-200 dark:border-gray-700 p-4 cursor-pointer hover:shadow-md transition-all relative"
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="flex items-start gap-3">
        <div className="text-2xl shrink-0">{db.icon ?? '🗃️'}</div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100 truncate">{db.title}</h3>
          {db.description && <p className="text-[11px] text-gray-400 mt-0.5 line-clamp-2">{db.description}</p>}
          <div className="flex items-center gap-2 mt-2">
            <span className="text-[10px] text-gray-400">{new Date(db.created_at).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
            {db.is_shared && <span className="text-[9px] px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded-full">Shared</span>}
          </div>
        </div>
      </div>

      {hovered && (
        <button
          onClick={(e) => { e.stopPropagation(); onDelete() }}
          className="absolute top-2 right-2 p-1 text-gray-300 hover:text-red-500 transition-colors rounded"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      )}
    </div>
  )
}

function NewDatabaseDialog({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const [title, setTitle] = useState('')
  const [icon, setIcon] = useState(DB_ICONS[0])
  const [desc, setDesc] = useState('')
  const create = useCreateDatabase()

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-[14px] shadow-xl w-96 p-6" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-4">New Database</h3>

        {/* Icon picker */}
        <div className="flex flex-wrap gap-2 mb-4">
          {DB_ICONS.map((ic) => (
            <button
              key={ic}
              onClick={() => setIcon(ic)}
              className={`w-8 h-8 rounded-[6px] text-lg flex items-center justify-center transition-colors ${icon === ic ? 'bg-[#51459d]/10 ring-1 ring-[#51459d]' : 'hover:bg-gray-100 dark:hover:bg-gray-700'}`}
            >
              {ic}
            </button>
          ))}
        </div>

        <div className="space-y-3 mb-4">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Database name"
            autoFocus
            className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-[8px] focus:outline-none focus:border-[#51459d] bg-transparent"
          />
          <textarea
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            placeholder="Description (optional)"
            rows={2}
            className="w-full px-3 py-2 text-xs border border-gray-200 dark:border-gray-700 rounded-[8px] focus:outline-none focus:border-[#51459d] bg-transparent resize-none"
          />
        </div>

        <div className="flex gap-2">
          <button
            onClick={async () => {
              if (!title.trim()) return
              const db = await create.mutateAsync({ title: title.trim(), icon, description: desc || undefined })
              onCreated(db.id)
              onClose()
            }}
            disabled={create.isPending || !title.trim()}
            className="flex-1 bg-[#51459d] text-white text-sm py-2 rounded-[8px] hover:bg-[#3d3480] disabled:opacity-50"
          >
            {create.isPending ? 'Creating...' : 'Create Database'}
          </button>
          <button onClick={onClose} className="text-sm text-gray-400 px-4">Cancel</button>
        </div>
      </div>
    </div>
  )
}

export default function DatabasesPage() {
  const { data: databases = [], isLoading } = useDatabases()
  const deleteDb = useDeleteDatabase()
  const [openDbId, setOpenDbId] = useState<string | null>(null)
  const [showNew, setShowNew] = useState(false)

  if (openDbId) {
    return (
      <div className="h-full flex flex-col overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-100 dark:border-gray-800 shrink-0">
          <button
            onClick={() => setOpenDbId(null)}
            className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 transition-colors"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            All Databases
          </button>
        </div>
        <DatabaseView databaseId={openDbId} />
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col bg-white dark:bg-gray-900 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800 shrink-0">
        <div>
          <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">Databases</h1>
          <p className="text-xs text-gray-400 mt-0.5">Notion-style tables, kanban boards, and galleries — powered by ERP data</p>
        </div>
        <button
          onClick={() => setShowNew(true)}
          className="flex items-center gap-1.5 px-3 py-2 bg-[#51459d] text-white text-xs rounded-[8px] hover:bg-[#3d3480] transition-colors"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Database
        </button>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto p-6">
        {isLoading ? (
          <div className="flex items-center justify-center h-48">
            <svg className="animate-spin h-6 w-6 text-[#51459d]" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
        ) : databases.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <div className="w-14 h-14 rounded-2xl bg-[#51459d]/10 flex items-center justify-center text-2xl mb-3">🗃️</div>
            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-1">No Databases Yet</h3>
            <p className="text-sm text-gray-400 mb-4 max-w-xs">Create a Notion-style database to organize your ERP data with tables, kanban boards, and gallery views.</p>
            <button
              onClick={() => setShowNew(true)}
              className="px-4 py-2 bg-[#51459d] text-white text-sm rounded-[8px] hover:bg-[#3d3480]"
            >
              Create First Database
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {databases.map((db) => (
              <DatabaseCard
                key={db.id}
                db={db}
                onClick={() => setOpenDbId(db.id)}
                onDelete={() => { if (window.confirm(`Delete "${db.title}"?`)) deleteDb.mutate(db.id) }}
              />
            ))}
          </div>
        )}
      </div>

      {showNew && (
        <NewDatabaseDialog onClose={() => setShowNew(false)} onCreated={(id) => setOpenDbId(id)} />
      )}
    </div>
  )
}
