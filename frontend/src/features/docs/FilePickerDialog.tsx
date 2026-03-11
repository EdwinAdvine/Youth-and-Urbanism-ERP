import { useState } from 'react'
import { useDocuments, useCreateDocument, type Document } from '../../api/docs'

const DOC_TYPES = [
  {
    value: 'docx',
    label: 'Document',
    description: 'Word processing',
    icon: 'W',
    color: 'text-blue-700 bg-blue-50 border-blue-200',
  },
  {
    value: 'xlsx',
    label: 'Spreadsheet',
    description: 'Data & analysis',
    icon: 'X',
    color: 'text-green-700 bg-green-50 border-green-200',
  },
  {
    value: 'pptx',
    label: 'Presentation',
    description: 'Slides & decks',
    icon: 'P',
    color: 'text-orange-700 bg-orange-50 border-orange-200',
  },
]

interface FilePickerDialogProps {
  open: boolean
  onClose: () => void
  onOpenFile?: (doc: Document) => void
  onCreateFile?: (name: string, type: string) => void
}

export default function FilePickerDialog({
  open,
  onClose,
  onOpenFile,
  onCreateFile,
}: FilePickerDialogProps) {
  const [mode, setMode] = useState<'create' | 'open'>('create')
  const [newName, setNewName] = useState('')
  const [selectedType, setSelectedType] = useState('docx')
  const [search, setSearch] = useState('')

  const { data } = useDocuments()
  const createDoc = useCreateDocument()
  const documents = (data?.documents ?? []).filter(
    (f) => !search || f.name.toLowerCase().includes(search.toLowerCase())
  )

  if (!open) return null

  const handleCreate = () => {
    const filename = newName || `Untitled.${selectedType}`
    const fullName = filename.endsWith(`.${selectedType}`) ? filename : `${filename}.${selectedType}`
    if (onCreateFile) {
      onCreateFile(fullName, selectedType)
    } else {
      createDoc.mutate(
        { filename: fullName, doc_type: selectedType },
        { onSuccess: () => onClose() }
      )
    }
    onClose()
  }

  const ext = (doc: Document) => doc.extension.replace(/^\./, '')
  const getConfig = (e: string) =>
    DOC_TYPES.find((t) => t.value === e) ?? DOC_TYPES[0]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-gray-800 rounded-[10px] shadow-2xl w-full max-w-lg">
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            {mode === 'create' ? 'Create New Document' : 'Open Document'}
          </h3>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-[6px] text-gray-500">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-100 dark:border-gray-800">
          {(['create', 'open'] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`flex-1 py-2.5 text-xs font-medium capitalize transition-colors ${ mode === m ? 'text-[#51459d] border-b-2 border-[#51459d]' : 'text-gray-500 hover:text-gray-700' }`}
            >
              {m === 'create' ? 'Create New' : 'Open Existing'}
            </button>
          ))}
        </div>

        <div className="p-5">
          {mode === 'create' ? (
            <div className="space-y-4">
              {/* Type selection */}
              <div>
                <label className="text-xs font-medium text-gray-700 dark:text-gray-300 block mb-2">
                  Document type
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {DOC_TYPES.map((t) => (
                    <button
                      key={t.value}
                      onClick={() => setSelectedType(t.value)}
                      className={`flex flex-col items-center gap-2 p-4 rounded-[10px] border-2 transition-all ${ selectedType === t.value ? 'border-[#51459d] bg-[#51459d]/5 shadow-sm' : 'border-gray-200 hover:border-gray-300' }`}
                    >
                      <div
                        className={`w-10 h-10 rounded-[8px] border flex items-center justify-center text-base font-bold ${t.color}`}
                      >
                        {t.icon}
                      </div>
                      <div className="text-center">
                        <p className="text-xs font-semibold text-gray-800 dark:text-gray-200">{t.label}</p>
                        <p className="text-[10px] text-gray-400">{t.description}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* File name */}
              <div>
                <label className="text-xs font-medium text-gray-700 dark:text-gray-300 block mb-1.5">
                  File name
                </label>
                <input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder={`Untitled.${selectedType}`}
                  className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-[8px] focus:outline-none focus:ring-1 focus:ring-[#51459d]/40"
                  onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                  autoFocus
                />
              </div>

              <button
                onClick={handleCreate}
                className="w-full px-4 py-2.5 text-sm bg-[#51459d] text-white rounded-[8px] hover:bg-[#3d3480] transition-colors font-medium"
              >
                Create Document
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Search */}
              <div className="relative">
                <svg
                  className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400"
                  fill="none" viewBox="0 0 24 24" stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search documents..."
                  className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-[8px] focus:outline-none focus:ring-1 focus:ring-[#51459d]/40"
                  autoFocus
                />
              </div>

              {/* File list */}
              <div className="max-h-64 overflow-y-auto space-y-1">
                {documents.length === 0 ? (
                  <p className="text-xs text-gray-400 text-center py-8">
                    {search ? 'No documents found' : 'No documents yet'}
                  </p>
                ) : (
                  documents.map((doc) => {
                    const cfg = getConfig(ext(doc))
                    return (
                      <button
                        key={doc.id}
                        onClick={() => {
                          onOpenFile?.(doc)
                          onClose()
                        }}
                        className="w-full flex items-center gap-3 p-2.5 rounded-[8px] hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-left"
                      >
                        <div
                          className={`w-8 h-8 rounded-[6px] border flex items-center justify-center text-xs font-bold shrink-0 ${cfg.color}`}
                        >
                          {cfg.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-gray-800 dark:text-gray-200 truncate">
                            {doc.name}
                          </p>
                          <p className="text-[10px] text-gray-400">
                            Modified {new Date(doc.updated_at).toLocaleDateString()}
                          </p>
                        </div>
                      </button>
                    )
                  })
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
