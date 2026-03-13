import { useState, useMemo } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useCreateNote } from '../../api/notes'
import {
  useNoteTemplates,
  useCreateNoteTemplate,
  type NoteTemplate,
} from '../../api/notes_ext'

// ─── Category config ─────────────────────────────────────────────────────────

const BUILTIN_CATEGORIES = [
  { id: 'meetings',   label: 'Meetings',        color: '#51459d' },
  { id: 'projects',   label: 'Projects',         color: '#3ec9d6' },
  { id: 'hr',         label: 'HR & People',      color: '#6fd943' },
  { id: 'finance',    label: 'Finance & Sales',  color: '#ffa21d' },
  { id: 'strategy',   label: 'Strategy',         color: '#51459d' },
  { id: 'research',   label: 'Research',         color: '#3ec9d6' },
  { id: 'my',         label: 'My Templates',     color: '#ff3a6e' },
] as const

type CategoryId = (typeof BUILTIN_CATEGORIES)[number]['id']

// ─── Category icons ───────────────────────────────────────────────────────────

function CategoryIcon({ category }: { category: string | null }) {
  const c = (category ?? '').toLowerCase()
  if (c.includes('meet')) return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
    </svg>
  )
  if (c.includes('project')) return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
    </svg>
  )
  if (c.includes('hr') || c.includes('people')) return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
    </svg>
  )
  if (c.includes('finance') || c.includes('sales')) return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
    </svg>
  )
  if (c.includes('strategy')) return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
    </svg>
  )
  if (c.includes('research')) return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23-.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" />
    </svg>
  )
  // default — document icon
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
    </svg>
  )
}

// ─── Category badge ───────────────────────────────────────────────────────────

function CategoryBadge({ category }: { category: string | null }) {
  if (!category) return null
  const cfg = BUILTIN_CATEGORIES.find(
    (c) => c.label.toLowerCase() === category.toLowerCase() || c.id === category.toLowerCase()
  )
  const color = cfg?.color ?? '#6b7280'
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium"
      style={{ backgroundColor: `${color}18`, color }}
    >
      {category}
    </span>
  )
}

// ─── Preview modal ────────────────────────────────────────────────────────────

interface PreviewModalProps {
  template: NoteTemplate | null
  onClose: () => void
  onUse: (t: NoteTemplate) => void
  isUsing: boolean
}

function PreviewModal({ template, onClose, onUse, isUsing }: PreviewModalProps) {
  if (!template) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white dark:bg-gray-900 rounded-[10px] shadow-2xl w-full max-w-2xl flex flex-col max-h-[80vh]">
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800 shrink-0">
          <div className="flex items-center gap-3">
            <span className="p-2 rounded-[10px] bg-primary/10 text-primary">
              <CategoryIcon category={template.category} />
            </span>
            <div>
              <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">{template.name}</h2>
              {template.description && (
                <p className="text-xs text-gray-500 mt-0.5">{template.description}</p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        {/* Content preview */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <pre className="text-xs text-gray-700 dark:text-gray-300 whitespace-pre-wrap font-mono leading-relaxed bg-gray-50 dark:bg-gray-950 rounded-[10px] p-4">
            {template.content}
          </pre>
        </div>
        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 dark:border-gray-800 shrink-0">
          <div className="flex items-center gap-2">
            <CategoryBadge category={template.category} />
            <span className="text-[11px] text-gray-400">
              {new Date(template.created_at).toLocaleDateString()}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-[10px] transition-colors"
            >
              Close
            </button>
            <button
              onClick={() => onUse(template)}
              disabled={isUsing}
              className="flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium text-white bg-primary hover:bg-primary/90 disabled:opacity-60 rounded-[10px] transition-colors"
            >
              {isUsing ? (
                <>
                  <svg className="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Creating...
                </>
              ) : 'Use Template'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Create template modal ────────────────────────────────────────────────────

interface CreateTemplateModalProps {
  open: boolean
  onClose: () => void
}

function CreateTemplateModal({ open, onClose }: CreateTemplateModalProps) {
  const qc = useQueryClient()
  const createTemplate = useCreateNoteTemplate()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [content, setContent] = useState('')
  const [category, setCategory] = useState('')
  const [error, setError] = useState('')

  const handleSubmit = () => {
    if (!name.trim()) { setError('Name is required'); return }
    if (!content.trim()) { setError('Content is required'); return }
    setError('')
    createTemplate.mutate(
      { name: name.trim(), description: description.trim() || undefined, content: content.trim(), category: category.trim() || undefined },
      {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: ['notes', 'templates'] })
          setName(''); setDescription(''); setContent(''); setCategory('')
          onClose()
        },
        onError: () => setError('Failed to create template'),
      }
    )
  }

  const handleClose = () => {
    setName(''); setDescription(''); setContent(''); setCategory(''); setError('')
    onClose()
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={handleClose} />
      <div className="relative bg-white dark:bg-gray-900 rounded-[10px] shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800">
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">New Template</h2>
          <button onClick={handleClose} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="px-6 py-4 space-y-4">
          {error && (
            <div className="text-xs text-red-600 bg-red-50 dark:bg-red-900/20 rounded-[10px] px-3 py-2">{error}</div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Name *</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Template name"
                className="w-full text-sm rounded-[10px] border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Category</label>
              <input
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="e.g. Meetings"
                list="template-categories"
                className="w-full text-sm rounded-[10px] border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              />
              <datalist id="template-categories">
                {BUILTIN_CATEGORIES.filter(c => c.id !== 'my').map(c => (
                  <option key={c.id} value={c.label} />
                ))}
              </datalist>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What this template is for"
              className="w-full text-sm rounded-[10px] border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Content *</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Template content (Markdown supported)..."
              rows={10}
              className="w-full text-sm rounded-[10px] border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary font-mono"
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-100 dark:border-gray-800">
          <button
            onClick={handleClose}
            className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-[10px] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={createTemplate.isPending}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 disabled:opacity-60 rounded-[10px] transition-colors"
          >
            {createTemplate.isPending ? (
              <>
                <svg className="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Creating...
              </>
            ) : 'Create Template'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Template card ────────────────────────────────────────────────────────────

interface TemplateCardProps {
  template: NoteTemplate
  onPreview: (t: NoteTemplate) => void
  onUse: (t: NoteTemplate) => void
  isUsing: boolean
}

function TemplateCard({ template, onPreview, onUse, isUsing }: TemplateCardProps) {
  const [hovered, setHovered] = useState(false)

  return (
    <div
      className="group relative bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-[10px] p-4 flex flex-col gap-3 hover:shadow-md hover:border-primary/30 transition-all cursor-pointer"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => onPreview(template)}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="shrink-0 p-1.5 rounded-lg bg-primary/8 text-primary">
            <CategoryIcon category={template.category} />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{template.name}</p>
            {template.description && (
              <p className="text-[11px] text-gray-500 truncate mt-0.5">{template.description}</p>
            )}
          </div>
        </div>
        {/* Use button — always visible on hover */}
        <button
          onClick={(e) => { e.stopPropagation(); onUse(template) }}
          disabled={isUsing}
          className={`shrink-0 flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded-lg transition-all ${
            hovered
              ? 'bg-primary text-white opacity-100'
              : 'bg-primary/10 text-primary opacity-0 group-hover:opacity-100'
          } disabled:opacity-50`}
        >
          {isUsing ? (
            <svg className="animate-spin w-3 h-3" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          ) : (
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
          )}
          Use
        </button>
      </div>

      {/* Content preview */}
      <div className="bg-gray-50 dark:bg-gray-950 rounded-lg px-3 py-2 text-[11px] text-gray-500 dark:text-gray-400 line-clamp-3 font-mono leading-relaxed">
        {template.content}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between">
        <CategoryBadge category={template.category} />
        <span className="text-[10px] text-gray-400">
          {new Date(template.created_at).toLocaleDateString()}
        </span>
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function NoteTemplatesPage() {
  const { data: templates = [], isLoading } = useNoteTemplates()
  const createNote = useCreateNote()

  const [activeTab, setActiveTab] = useState<CategoryId | 'all'>('all')
  const [search, setSearch] = useState('')
  const [preview, setPreview] = useState<NoteTemplate | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)

  const showToast = (type: 'success' | 'error', msg: string) => {
    setNotification({ type, msg })
    setTimeout(() => setNotification(null), 3500)
  }

  const filtered = useMemo(() => {
    let list = templates
    if (activeTab === 'my') {
      // My Templates = those without a builtin-matching category OR user-created ones
      // For now: templates whose category doesn't match any builtin label
      const builtinLabels = BUILTIN_CATEGORIES.filter(c => c.id !== 'my').map(c => c.label.toLowerCase())
      list = list.filter(t => !t.category || !builtinLabels.includes(t.category.toLowerCase()))
    } else if (activeTab !== 'all') {
      const label = BUILTIN_CATEGORIES.find(c => c.id === activeTab)?.label.toLowerCase() ?? activeTab
      list = list.filter(t => t.category?.toLowerCase() === label)
    }
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(
        t =>
          t.name.toLowerCase().includes(q) ||
          (t.description ?? '').toLowerCase().includes(q) ||
          (t.category ?? '').toLowerCase().includes(q) ||
          t.content.toLowerCase().includes(q)
      )
    }
    return list
  }, [templates, activeTab, search])

  const handleUse = (tmpl: NoteTemplate) => {
    createNote.mutate(
      { title: `${tmpl.name} — ${new Date().toLocaleDateString()}`, content: tmpl.content },
      {
        onSuccess: () => {
          setPreview(null)
          showToast('success', `Note created from "${tmpl.name}"`)
        },
        onError: () => showToast('error', 'Failed to create note'),
      }
    )
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Toast notification */}
      {notification && (
        <div
          className={`fixed top-4 right-4 z-[100] flex items-center gap-2 px-4 py-2.5 rounded-[10px] shadow-lg text-sm font-medium ${
            notification.type === 'success'
              ? 'bg-[#6fd943]/10 text-[#6fd943] border border-[#6fd943]/20'
              : 'bg-[#ff3a6e]/10 text-[#ff3a6e] border border-[#ff3a6e]/20'
          }`}
        >
          {notification.type === 'success' ? (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126z" />
            </svg>
          )}
          {notification.msg}
        </div>
      )}

      {/* Page header */}
      <div className="px-6 pt-6 pb-4 flex items-center justify-between gap-4 shrink-0">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Note Templates</h1>
          <p className="text-xs text-gray-500 mt-0.5">Start from a template — {templates.length} available</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-[10px] transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          New Template
        </button>
      </div>

      {/* Search bar */}
      <div className="px-6 pb-3 shrink-0">
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search templates by name, description or content..."
            className="w-full pl-9 pr-4 py-2 text-sm rounded-[10px] border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Category tabs */}
      <div className="px-6 pb-4 shrink-0">
        <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide">
          <button
            onClick={() => setActiveTab('all')}
            className={`shrink-0 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              activeTab === 'all'
                ? 'bg-primary text-white'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
            }`}
          >
            All ({templates.length})
          </button>
          {BUILTIN_CATEGORIES.map((cat) => {
            const count =
              cat.id === 'my'
                ? templates.filter(t => {
                    const builtinLabels = BUILTIN_CATEGORIES.filter(c => c.id !== 'my').map(c => c.label.toLowerCase())
                    return !t.category || !builtinLabels.includes(t.category.toLowerCase())
                  }).length
                : templates.filter(t => t.category?.toLowerCase() === cat.label.toLowerCase()).length
            return (
              <button
                key={cat.id}
                onClick={() => setActiveTab(cat.id)}
                className={`shrink-0 flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                  activeTab === cat.id
                    ? 'text-white'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                }`}
                style={activeTab === cat.id ? { backgroundColor: cat.color } : {}}
              >
                {cat.label}
                {count > 0 && (
                  <span
                    className={`px-1 rounded-full text-[10px] ${
                      activeTab === cat.id ? 'bg-white/20' : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                    }`}
                  >
                    {count}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Template grid */}
      <div className="flex-1 overflow-y-auto px-6 pb-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-24">
            <svg className="animate-spin w-8 h-8 text-primary" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-14 h-14 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-4 text-gray-400">
              <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
              </svg>
            </div>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {search ? 'No templates match your search' : 'No templates in this category'}
            </p>
            <p className="text-xs text-gray-400 mt-1 max-w-xs">
              {search
                ? 'Try a different keyword or clear the search'
                : 'Create a new template or switch to another category'}
            </p>
            {!search && (
              <button
                onClick={() => setShowCreate(true)}
                className="mt-4 px-4 py-2 text-sm font-medium text-primary border border-primary/30 rounded-[10px] hover:bg-primary/5 transition-colors"
              >
                Create Template
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map((tmpl) => (
              <TemplateCard
                key={tmpl.id}
                template={tmpl}
                onPreview={setPreview}
                onUse={handleUse}
                isUsing={createNote.isPending}
              />
            ))}
          </div>
        )}
      </div>

      {/* Preview modal */}
      <PreviewModal
        template={preview}
        onClose={() => setPreview(null)}
        onUse={handleUse}
        isUsing={createNote.isPending}
      />

      {/* Create template modal */}
      <CreateTemplateModal open={showCreate} onClose={() => setShowCreate(false)} />
    </div>
  )
}
