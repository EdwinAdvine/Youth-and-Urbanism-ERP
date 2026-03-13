/**
 * NotebookNav — Tree-view sidebar navigation for Y&U Notes.
 *
 * Replaces FolderSidebar with hierarchical Notebook > Section > Page navigation.
 * Supports collapsible nodes, quick-add buttons, and context menus.
 */
import { useState } from 'react'
import { useNotebooks, useNotebookTree, useCreateNotebook } from '../../api/notebooks'

// ── Types ──────────────────────────────────────────────────────────────────

interface PageTreeItem {
  id: string
  title: string
  icon?: string | null
  parent_page_id?: string | null
  sort_order: number
  is_pinned: boolean
  is_archived: boolean
  updated_at: string
  sub_pages: PageTreeItem[]
}

interface SectionTreeItem {
  id: string
  notebook_id: string
  title: string
  color?: string | null
  sort_order: number
  pages: PageTreeItem[]
  page_count: number
}

// ── Page Tree Node ─────────────────────────────────────────────────────────

function PageNode({
  page,
  depth,
  selectedId,
  onSelect,
}: {
  page: PageTreeItem
  depth: number
  selectedId?: string | null
  onSelect: (id: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const hasChildren = page.sub_pages.length > 0
  const isSelected = selectedId === page.id

  return (
    <div>
      <button
        type="button"
        className={`w-full flex items-center gap-1.5 px-2 py-1 text-left text-[13px] rounded-[6px] transition-colors group ${
          isSelected
            ? 'bg-[#51459d]/10 text-[#51459d] font-medium'
            : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700/50'
        }`}
        style={{ paddingLeft: `${8 + depth * 16}px` }}
        onClick={() => onSelect(page.id)}
      >
        {/* Expand/collapse toggle */}
        {hasChildren ? (
          <button
            type="button"
            className="w-4 h-4 flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 shrink-0"
            onClick={(e) => { e.stopPropagation(); setExpanded(!expanded) }}
          >
            <svg
              className={`h-3 w-3 transition-transform ${expanded ? 'rotate-90' : ''}`}
              viewBox="0 0 24 24" fill="currentColor"
            >
              <path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6z" />
            </svg>
          </button>
        ) : (
          <span className="w-4 shrink-0" />
        )}

        {/* Icon */}
        <span className="text-sm shrink-0">{page.icon || '📄'}</span>

        {/* Title */}
        <span className="truncate flex-1">{page.title || 'Untitled'}</span>

        {/* Pin indicator */}
        {page.is_pinned && (
          <span className="text-[10px] shrink-0">📌</span>
        )}
      </button>

      {/* Sub-pages */}
      {expanded && hasChildren && (
        <div>
          {page.sub_pages.map((sp) => (
            <PageNode
              key={sp.id}
              page={sp}
              depth={depth + 1}
              selectedId={selectedId}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Section Node ───────────────────────────────────────────────────────────

function SectionNode({
  section,
  selectedPageId,
  onSelectPage,
  onAddPage,
}: {
  section: SectionTreeItem
  selectedPageId?: string | null
  onSelectPage: (id: string) => void
  onAddPage: (sectionId: string) => void
}) {
  const [expanded, setExpanded] = useState(true)

  return (
    <div className="mb-0.5">
      {/* Section header */}
      <button
        type="button"
        className="w-full flex items-center gap-1.5 px-2 py-1 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-400 rounded-[4px] group"
        onClick={() => setExpanded(!expanded)}
      >
        <svg
          className={`h-3 w-3 transition-transform shrink-0 ${expanded ? 'rotate-90' : ''}`}
          viewBox="0 0 24 24" fill="currentColor"
        >
          <path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6z" />
        </svg>
        {section.color && (
          <span
            className="w-2 h-2 rounded-full shrink-0"
            style={{ backgroundColor: section.color }}
          />
        )}
        <span className="truncate flex-1">{section.title}</span>
        <span className="text-[10px] text-gray-300 dark:text-gray-600 font-normal">
          {section.page_count}
        </span>
        {/* Quick add page */}
        <button
          type="button"
          className="opacity-0 group-hover:opacity-100 w-4 h-4 flex items-center justify-center text-gray-400 hover:text-[#51459d] transition-opacity shrink-0"
          onClick={(e) => { e.stopPropagation(); onAddPage(section.id) }}
          title="Add page"
        >
          <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>
      </button>

      {/* Pages */}
      {expanded && (
        <div>
          {section.pages.length === 0 ? (
            <div className="px-4 py-2 text-[11px] text-gray-300 dark:text-gray-600 italic">
              No pages yet
            </div>
          ) : (
            section.pages.map((page) => (
              <PageNode
                key={page.id}
                page={page}
                depth={0}
                selectedId={selectedPageId}
                onSelect={onSelectPage}
              />
            ))
          )}
        </div>
      )}
    </div>
  )
}

// ── Main NotebookNav ───────────────────────────────────────────────────────

export default function NotebookNav({
  selectedNotebookId,
  selectedPageId,
  onSelectNotebook,
  onSelectPage,
  onAddPage,
}: {
  selectedNotebookId?: string | null
  selectedPageId?: string | null
  onSelectNotebook: (id: string) => void
  onSelectPage: (id: string) => void
  onAddPage: (notebookId: string, sectionId: string) => void
}) {
  const { data: notebooksData } = useNotebooks()
  const { data: treeData } = useNotebookTree(selectedNotebookId || '')
  const createNotebook = useCreateNotebook()
  const [showNewNotebook, setShowNewNotebook] = useState(false)
  const [newNotebookTitle, setNewNotebookTitle] = useState('')

  const notebooks = notebooksData?.notebooks ?? []
  const sections: SectionTreeItem[] = treeData?.sections ?? []

  const handleCreateNotebook = async () => {
    if (!newNotebookTitle.trim()) return
    await createNotebook.mutateAsync({ title: newNotebookTitle.trim() })
    setNewNotebookTitle('')
    setShowNewNotebook(false)
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-gray-100 dark:border-gray-800">
        <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200">Notebooks</h2>
        <button
          type="button"
          onClick={() => setShowNewNotebook(true)}
          className="w-6 h-6 flex items-center justify-center rounded-[4px] text-gray-400 hover:text-[#51459d] hover:bg-[#51459d]/10 transition-colors"
          title="New notebook"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>
      </div>

      {/* New notebook input */}
      {showNewNotebook && (
        <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-800">
          <input
            type="text"
            value={newNotebookTitle}
            onChange={(e) => setNewNotebookTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCreateNotebook()
              if (e.key === 'Escape') setShowNewNotebook(false)
            }}
            placeholder="Notebook name..."
            className="w-full px-2 py-1.5 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-[6px] focus:border-[#51459d] focus:outline-none"
            autoFocus
          />
        </div>
      )}

      {/* Notebook list */}
      <div className="flex-1 overflow-y-auto py-1">
        {/* Quick links */}
        <div className="px-2 mb-2">
          <button
            type="button"
            className="w-full flex items-center gap-2 px-2 py-1.5 text-left text-[13px] text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700/50 rounded-[6px] transition-colors"
            onClick={() => onSelectPage('recent')}
          >
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="10" /><polyline points="12,6 12,12 16,14" /></svg>
            Recent
          </button>
          <button
            type="button"
            className="w-full flex items-center gap-2 px-2 py-1.5 text-left text-[13px] text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700/50 rounded-[6px] transition-colors"
            onClick={() => onSelectPage('favorites')}
          >
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26" /></svg>
            Favorites
          </button>
          <button
            type="button"
            className="w-full flex items-center gap-2 px-2 py-1.5 text-left text-[13px] text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700/50 rounded-[6px] transition-colors"
            onClick={() => onSelectPage('databases')}
          >
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><ellipse cx="12" cy="5" rx="9" ry="3" /><path d="M21 12c0 1.66-4.03 3-9 3S3 13.66 3 12" /><path d="M3 5v14c0 1.66 4.03 3 9 3s9-1.34 9-3V5" /></svg>
            Databases
          </button>
          <button
            type="button"
            className="w-full flex items-center gap-2 px-2 py-1.5 text-left text-[13px] text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700/50 rounded-[6px] transition-colors"
            onClick={() => onSelectPage('analytics')}
          >
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></svg>
            Analytics
          </button>
        </div>

        <div className="px-2 mb-1">
          <div className="h-px bg-gray-100 dark:bg-gray-800" />
        </div>

        {/* Notebooks */}
        {notebooks.map((nb: any) => {
          const isSelected = selectedNotebookId === nb.id
          return (
            <div key={nb.id} className="px-2 mb-1">
              <button
                type="button"
                className={`w-full flex items-center gap-2 px-2 py-1.5 text-left text-[13px] rounded-[6px] transition-colors group ${
                  isSelected
                    ? 'bg-[#51459d]/10 text-[#51459d] font-medium'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700/50'
                }`}
                onClick={() => onSelectNotebook(nb.id)}
              >
                <span className="text-sm">{nb.icon || '📓'}</span>
                <span className="truncate flex-1">{nb.title}</span>
                <span className="text-[10px] text-gray-300 dark:text-gray-600 font-normal">
                  {nb.page_count ?? 0}
                </span>
              </button>

              {/* Show sections & pages for selected notebook */}
              {isSelected && sections.length > 0 && (
                <div className="ml-2 mt-0.5 border-l-2 border-gray-100 dark:border-gray-800 pl-1">
                  {sections.map((sec) => (
                    <SectionNode
                      key={sec.id}
                      section={sec}
                      selectedPageId={selectedPageId}
                      onSelectPage={onSelectPage}
                      onAddPage={(sectionId) => onAddPage(nb.id, sectionId)}
                    />
                  ))}
                </div>
              )}
            </div>
          )
        })}

        {notebooks.length === 0 && (
          <div className="px-4 py-8 text-center">
            <p className="text-sm text-gray-400 dark:text-gray-500 mb-3">No notebooks yet</p>
            <button
              type="button"
              onClick={() => setShowNewNotebook(true)}
              className="text-sm text-[#51459d] hover:underline"
            >
              Create your first notebook
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
