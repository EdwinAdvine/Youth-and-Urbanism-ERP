import { useState, useEffect, useRef } from 'react'
import { useDocuments, useCreateDocument, useEditorConfig, Document } from '../../api/docs'
import { formatFileSize } from '../../api/drive'

// ─── File type config ─────────────────────────────────────────────────────────

const FILE_CONFIG: Record<string, { color: string; bg: string; label: string; icon: string }> = {
  docx: { color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200',  label: 'Word',       icon: 'W' },
  xlsx: { color: 'text-green-700', bg: 'bg-green-50 border-green-200', label: 'Excel',    icon: 'X' },
  pptx: { color: 'text-orange-700', bg: 'bg-orange-50 border-orange-200', label: 'PowerPoint', icon: 'P' },
  pdf:  { color: 'text-red-700',  bg: 'bg-red-50 border-red-200',    label: 'PDF',        icon: 'PDF' },
}

// ─── ONLYOFFICE Editor ────────────────────────────────────────────────────────

declare global {
  interface Window {
    DocsAPI?: {
      DocEditor: new (container: string, config: Record<string, unknown>) => unknown
    }
  }
}

function OnlyOfficeEditor({ file, onClose }: { file: Document; onClose: () => void }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const { data: editorData, isError: configError } = useEditorConfig(file.id)

  const ext = file.extension.replace(/^\./, '')
  const cfg = FILE_CONFIG[ext] ?? FILE_CONFIG.docx

  useEffect(() => {
    if (configError) {
      setError(true)
      setLoading(false)
      return
    }
    if (!editorData) return

    const scriptId = 'onlyoffice-api-script'
    let script = document.getElementById(scriptId) as HTMLScriptElement | null

    const initEditor = () => {
      if (!window.DocsAPI) {
        setError(true)
        return
      }
      try {
        new window.DocsAPI.DocEditor('onlyoffice-editor', editorData.editor_config as Record<string, unknown>)
        setLoading(false)
      } catch {
        setError(true)
      }
    }

    const onlyofficeUrl = editorData.onlyoffice_url

    if (!script) {
      script = document.createElement('script')
      script.id = scriptId
      script.src = `${onlyofficeUrl}/web-apps/apps/api/documents/api.js`
      script.onload = initEditor
      script.onerror = () => { setError(true); setLoading(false) }
      document.head.appendChild(script)
    } else if (window.DocsAPI) {
      initEditor()
    } else {
      script.addEventListener('load', initEditor)
    }

    return () => {
      // cleanup: remove editor container content
    }
  }, [editorData, configError])

  return (
    <div className="flex-1 flex flex-col h-full">
      {/* Editor toolbar */}
      <div className="bg-white border-b border-gray-100 px-4 py-2 flex items-center gap-3 shrink-0">
        <button onClick={onClose} className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-800 transition-colors">
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          Back to files
        </button>
        <div className="h-4 w-px bg-gray-200" />
        <div className={`px-2 py-0.5 rounded border text-[10px] font-bold ${cfg.bg} ${cfg.color}`}>
          {cfg.label}
        </div>
        <span className="text-sm font-medium text-gray-900">{file.name}</span>
        <div className="ml-auto flex items-center gap-2">
          <button className="px-3 py-1.5 text-xs bg-[#51459d] text-white rounded-[6px] hover:bg-[#3d3480] transition-colors">Save</button>
          <button className="px-3 py-1.5 text-xs border border-gray-200 text-gray-600 rounded-[6px] hover:bg-gray-50 transition-colors">Share</button>
        </div>
      </div>

      {/* Editor area */}
      <div className="flex-1 relative" ref={containerRef}>
        {loading && !error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-50 z-10">
            <svg className="animate-spin h-6 w-6 text-[#51459d] mb-3" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
            <p className="text-sm text-gray-500">Loading ONLYOFFICE editor...</p>
          </div>
        )}
        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-50 z-10">
            <div className="text-center max-w-sm">
              <div className="w-14 h-14 rounded-2xl bg-amber-100 flex items-center justify-center text-2xl mx-auto mb-3">📄</div>
              <h3 className="text-base font-semibold text-gray-900 mb-1">ONLYOFFICE not available</h3>
              <p className="text-sm text-gray-500 mb-4">The document server is not reachable. Check your configuration in Settings.</p>
            </div>
          </div>
        )}
        <div id="onlyoffice-editor" className="w-full h-full" />
      </div>
    </div>
  )
}

// ─── Create file modal ────────────────────────────────────────────────────────

function CreateFileModal({ onClose, onCreate }: { onClose: () => void; onCreate: (name: string, type: string) => void }) {
  const [name, setName] = useState('')
  const [type, setType] = useState('docx')

  const types = [
    { value: 'docx', label: 'Word Document', icon: 'W', color: 'text-blue-700 bg-blue-50 border-blue-200' },
    { value: 'xlsx', label: 'Excel Spreadsheet', icon: 'X', color: 'text-green-700 bg-green-50 border-green-200' },
    { value: 'pptx', label: 'PowerPoint Presentation', icon: 'P', color: 'text-orange-700 bg-orange-50 border-orange-200' },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-[10px] shadow-2xl w-full max-w-md">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900">Create New Document</h3>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-[6px] text-gray-500">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="text-xs font-medium text-gray-700 block mb-1.5">Document type</label>
            <div className="grid grid-cols-3 gap-2">
              {types.map((t) => (
                <button
                  key={t.value}
                  onClick={() => setType(t.value)}
                  className={`flex flex-col items-center gap-2 p-3 rounded-[8px] border-2 text-center transition-colors ${
                    type === t.value ? `border-[#51459d] bg-[#51459d]/5` : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className={`w-8 h-8 rounded-[6px] border flex items-center justify-center text-sm font-bold ${t.color}`}>{t.icon}</div>
                  <span className="text-[10px] text-gray-600 leading-tight">{t.label}</span>
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-700 block mb-1.5">File name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={`Untitled.${type}`}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-[8px] focus:outline-none focus:ring-1 focus:ring-[#51459d]/40"
              onKeyDown={(e) => e.key === 'Enter' && name && onCreate(name, type)}
            />
          </div>
        </div>
        <div className="px-5 py-3 border-t border-gray-100 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-[8px] transition-colors">Cancel</button>
          <button
            onClick={() => name && onCreate(name.endsWith(`.${type}`) ? name : `${name}.${type}`, type)}
            disabled={!name}
            className="px-4 py-2 text-sm bg-[#51459d] text-white rounded-[8px] hover:bg-[#3d3480] transition-colors disabled:opacity-50"
          >
            Create
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function DocsPage() {
  const [openFile, setOpenFile] = useState<Document | null>(null)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [showCreate, setShowCreate] = useState(false)
  const [search, setSearch] = useState('')

  const { data, isError } = useDocuments()
  const documents = (data?.documents ?? []).filter((f) =>
    !search || f.name.toLowerCase().includes(search.toLowerCase())
  )

  const createDoc = useCreateDocument()

  const handleCreate = (name: string, type: string) => {
    createDoc.mutate(
      { filename: name, doc_type: type },
      {
        onSuccess: () => setShowCreate(false),
        onError: () => setShowCreate(false),
      }
    )
  }

  if (openFile) {
    return <OnlyOfficeEditor file={openFile} onClose={() => setOpenFile(null)} />
  }

  return (
    <div className="h-full flex flex-col">
      {isError && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 flex items-center gap-2 shrink-0">
          <svg className="h-4 w-4 text-amber-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
          <p className="text-xs text-amber-700">Docs API not available — please check backend configuration.</p>
        </div>
      )}

      {/* Toolbar */}
      <div className="bg-white border-b border-gray-100 px-5 py-3 flex items-center gap-3 shrink-0">
        <h1 className="text-base font-semibold text-gray-900">Documents</h1>
        <div className="flex-1" />
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search documents..." className="pl-9 pr-3 py-1.5 text-xs bg-gray-50 border border-gray-200 rounded-[8px] focus:outline-none focus:ring-1 focus:ring-[#51459d]/30 w-48" />
        </div>
        <div className="flex items-center border border-gray-200 rounded-[8px] overflow-hidden">
          <button onClick={() => setViewMode('grid')} className={`p-1.5 transition-colors ${viewMode === 'grid' ? 'bg-[#51459d]/10 text-[#51459d]' : 'text-gray-400 hover:bg-gray-50'}`}>
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>
          </button>
          <button onClick={() => setViewMode('list')} className={`p-1.5 transition-colors ${viewMode === 'list' ? 'bg-[#51459d]/10 text-[#51459d]' : 'text-gray-400 hover:bg-gray-50'}`}>
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg>
          </button>
        </div>
        <button onClick={() => setShowCreate(true)} className="flex items-center gap-1.5 bg-[#51459d] text-white text-xs font-medium rounded-[8px] px-3 py-2 hover:bg-[#3d3480] transition-colors">
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          New Document
        </button>
      </div>

      {/* File area */}
      <div className="flex-1 overflow-y-auto p-5">
        {documents.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center text-2xl mb-3">📄</div>
            <p className="text-sm font-medium text-gray-700">No documents found</p>
            <p className="text-xs text-gray-400 mt-1">Create a new document to get started</p>
            <button onClick={() => setShowCreate(true)} className="mt-4 px-4 py-2 bg-[#51459d] text-white text-sm rounded-[8px] hover:bg-[#3d3480] transition-colors">Create Document</button>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {documents.map((doc) => {
              const ext = doc.extension.replace(/^\./, '')
              const cfg = FILE_CONFIG[ext] ?? FILE_CONFIG.docx
              return (
                <button
                  key={doc.id}
                  onDoubleClick={() => setOpenFile(doc)}
                  onClick={() => {}}
                  className="flex flex-col items-center gap-2.5 p-4 bg-white border border-gray-100 rounded-[10px] hover:border-[#51459d]/30 hover:shadow-md transition-all text-center group"
                >
                  <div className={`w-14 h-16 rounded-[8px] border-2 flex items-center justify-center text-xl font-bold ${cfg.bg} ${cfg.color}`}>
                    {cfg.icon}
                  </div>
                  <div className="w-full">
                    <p className="text-xs font-medium text-gray-800 truncate group-hover:text-[#51459d] transition-colors">{doc.name}</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">{formatFileSize(doc.size)} · {new Date(doc.updated_at).toLocaleDateString()}</p>
                  </div>
                </button>
              )
            })}
          </div>
        ) : (
          <div className="bg-white rounded-[10px] border border-gray-100 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Name</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Modified</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500">Size</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {documents.map((doc) => {
                  const ext = doc.extension.replace(/^\./, '')
                  const cfg = FILE_CONFIG[ext] ?? FILE_CONFIG.docx
                  return (
                    <tr key={doc.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className={`w-7 h-7 rounded-[6px] border flex items-center justify-center text-xs font-bold ${cfg.bg} ${cfg.color}`}>{cfg.icon}</div>
                          <span className="text-sm text-gray-800 font-medium">{doc.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">{new Date(doc.updated_at).toLocaleDateString()}</td>
                      <td className="px-4 py-3 text-xs text-gray-500 text-right">{formatFileSize(doc.size)}</td>
                      <td className="px-4 py-3 text-right">
                        <button onClick={() => setOpenFile(doc)} className="text-xs text-[#51459d] hover:underline">Open</button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {viewMode === 'grid' && documents.length > 0 && (
          <p className="text-[10px] text-gray-400 text-center mt-4">Double-click a file to open in ONLYOFFICE editor</p>
        )}
      </div>

      {showCreate && (
        <CreateFileModal
          onClose={() => setShowCreate(false)}
          onCreate={handleCreate}
        />
      )}
    </div>
  )
}
