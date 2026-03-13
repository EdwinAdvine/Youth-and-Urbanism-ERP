/**
 * DatabaseView — Container switching between Table / Kanban / Gallery / List views.
 * Manages view switching, property editor panel, ERP import dialog, filter bar.
 */
import { useState } from 'react'
import {
  useDatabase, useCreateView, useCreateProperty, useImportFromERP, useDatabaseRows,
  type ViewType, type DatabaseView, type DatabaseRow,
} from '../../../api/noteDatabases'
import TableView from './TableView'
import KanbanView from './KanbanView'
import GalleryView from './GalleryView'
import ListView from './ListView'
import CalendarView from './CalendarView'
import TimelineView from './TimelineView'
import FilterBar from './FilterBar'

// ── View Icons ────────────────────────────────────────────────────────────────

const VIEW_ICONS: Record<ViewType, JSX.Element> = {
  table: <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>,
  kanban: <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" /></svg>,
  calendar: <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>,
  gallery: <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>,
  list: <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg>,
  timeline: <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>,
}

// ── ERP Import Dialog ─────────────────────────────────────────────────────────

const ERP_SOURCES = [
  { key: 'crm_deals', label: 'CRM Deals', icon: '🤝' },
  { key: 'projects_tasks', label: 'Project Tasks', icon: '✅' },
  { key: 'finance_invoices', label: 'Finance Invoices', icon: '🧾' },
  { key: 'hr_employees', label: 'HR Employees', icon: '👥' },
  { key: 'support_tickets', label: 'Support Tickets', icon: '🎫' },
]

function ERPImportDialog({ dbId, onClose }: { dbId: string; onClose: () => void }) {
  const [source, setSource] = useState(ERP_SOURCES[0].key)
  const importFromERP = useImportFromERP()

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-[12px] shadow-xl w-80 p-5" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">Import from ERP</h3>
        <p className="text-[11px] text-gray-400 mb-4">Pull live ERP data into this database as rows.</p>

        <div className="space-y-2 mb-4">
          {ERP_SOURCES.map((s) => (
            <label key={s.key} className="flex items-center gap-2 cursor-pointer p-2 rounded-[8px] hover:bg-gray-50 dark:hover:bg-gray-700">
              <input type="radio" name="erp-source" value={s.key} checked={source === s.key} onChange={() => setSource(s.key)} className="accent-[#51459d]" />
              <span className="text-sm">{s.icon}</span>
              <span className="text-xs text-gray-700 dark:text-gray-300">{s.label}</span>
            </label>
          ))}
        </div>

        <div className="flex gap-2">
          <button
            onClick={async () => {
              await importFromERP.mutateAsync({ dbId, source })
              onClose()
            }}
            disabled={importFromERP.isPending}
            className="flex-1 text-xs bg-[#51459d] text-white py-2 rounded-[8px] hover:bg-[#3d3480] disabled:opacity-50"
          >
            {importFromERP.isPending ? 'Importing...' : 'Import'}
          </button>
          <button onClick={onClose} className="text-xs text-gray-400 px-3">Cancel</button>
        </div>
      </div>
    </div>
  )
}

// ── Add Property Dialog ───────────────────────────────────────────────────────

const PROPERTY_TYPES = [
  { type: 'text', label: 'Text', icon: 'Aa' },
  { type: 'number', label: 'Number', icon: '12' },
  { type: 'select', label: 'Select', icon: '○' },
  { type: 'multi_select', label: 'Multi-select', icon: '◎' },
  { type: 'date', label: 'Date', icon: '📅' },
  { type: 'checkbox', label: 'Checkbox', icon: '☑' },
  { type: 'url', label: 'URL', icon: '🔗' },
  { type: 'email', label: 'Email', icon: '✉' },
  { type: 'phone', label: 'Phone', icon: '📱' },
  { type: 'person', label: 'Person', icon: '👤' },
  { type: 'status', label: 'Status', icon: '●' },
]

function AddPropertyDialog({ dbId, onClose }: { dbId: string; onClose: () => void }) {
  const [name, setName] = useState('')
  const [type, setType] = useState<string>('text')
  const createProp = useCreateProperty()

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-[12px] shadow-xl w-80 p-5" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">Add Property</h3>

        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Property name"
          autoFocus
          className="w-full px-3 py-2 text-xs border border-gray-200 dark:border-gray-700 rounded-[8px] focus:outline-none focus:border-[#51459d] bg-transparent mb-3"
        />

        <div className="grid grid-cols-3 gap-1.5 mb-4">
          {PROPERTY_TYPES.map((pt) => (
            <button
              key={pt.type}
              onClick={() => setType(pt.type)}
              className={`flex flex-col items-center gap-0.5 py-2 rounded-[6px] border text-[10px] transition-colors ${type === pt.type ? 'border-[#51459d] bg-[#51459d]/10 text-[#51459d]' : 'border-gray-200 dark:border-gray-700 text-gray-500 hover:border-gray-300'}`}
            >
              <span className="text-sm font-mono">{pt.icon}</span>
              <span>{pt.label}</span>
            </button>
          ))}
        </div>

        <div className="flex gap-2">
          <button
            onClick={async () => {
              if (!name.trim()) return
              await createProp.mutateAsync({ dbId, name: name.trim(), property_type: type as any })
              onClose()
            }}
            disabled={createProp.isPending || !name.trim()}
            className="flex-1 text-xs bg-[#51459d] text-white py-2 rounded-[8px] hover:bg-[#3d3480] disabled:opacity-50"
          >
            {createProp.isPending ? 'Adding...' : 'Add Property'}
          </button>
          <button onClick={onClose} className="text-xs text-gray-400 px-3">Cancel</button>
        </div>
      </div>
    </div>
  )
}

// ── Main DatabaseView ─────────────────────────────────────────────────────────

interface DatabaseViewProps {
  databaseId: string
  initialViewType?: ViewType
}

export default function DatabaseView({ databaseId, initialViewType = 'table' }: DatabaseViewProps) {
  const { data: db, isLoading, error } = useDatabase(databaseId)
  const createView = useCreateView()
  const [activeViewId, setActiveViewId] = useState<string | null>(null)
  const [showImport, setShowImport] = useState(false)
  const [showAddProp, setShowAddProp] = useState(false)
  const [showViewMenu, setShowViewMenu] = useState(false)
  const [filteredRows, setFilteredRows] = useState<DatabaseRow[] | null>(null)

  // Fetch all rows for FilterBar (needed to compute filtered subsets)
  const { data: allRows = [] } = useDatabaseRows(databaseId)

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <svg className="animate-spin h-6 w-6 text-[#51459d]" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    )
  }

  if (error || !db) {
    return <div className="flex-1 flex items-center justify-center text-sm text-red-500">Failed to load database.</div>
  }

  const views: DatabaseView[] = db.views ?? []
  const activeView = activeViewId ? views.find((v) => v.id === activeViewId) : (views.find((v) => v.is_default) ?? views[0])
  const viewType: ViewType = activeView?.view_type ?? initialViewType

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-white dark:bg-gray-900">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-2.5 border-b border-gray-100 dark:border-gray-800 shrink-0">
        <span className="text-lg">{db.icon ?? '🗃️'}</span>
        <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100">{db.title}</h2>
        <div className="flex-1" />

        {/* View tabs */}
        <div className="flex items-center gap-0.5 bg-gray-100 dark:bg-gray-800 rounded-[8px] p-0.5">
          {views.map((view) => (
            <button
              key={view.id}
              onClick={() => setActiveViewId(view.id)}
              className={`flex items-center gap-1.5 px-2.5 py-1 text-[11px] rounded-[6px] transition-colors ${activeView?.id === view.id ? 'bg-white dark:bg-gray-700 text-[#51459d] shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              {VIEW_ICONS[view.view_type]}
              {view.name}
            </button>
          ))}

          {/* Add view */}
          <div className="relative">
            <button
              onClick={() => setShowViewMenu(!showViewMenu)}
              className="px-2 py-1 text-gray-400 hover:text-gray-600 transition-colors"
              title="Add view"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>
            {showViewMenu && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setShowViewMenu(false)} />
                <div className="absolute right-0 top-full mt-1 z-40 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-[8px] shadow-lg py-1 w-36">
                  {(['table', 'kanban', 'gallery', 'list'] as ViewType[]).map((vt) => (
                    <button
                      key={vt}
                      onClick={async () => {
                        await createView.mutateAsync({ dbId: db.id, name: vt.charAt(0).toUpperCase() + vt.slice(1), view_type: vt })
                        setShowViewMenu(false)
                      }}
                      className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 capitalize"
                    >
                      {VIEW_ICONS[vt]} {vt}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Actions */}
        <button
          onClick={() => setShowAddProp(true)}
          className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-gray-500 hover:text-[#51459d] hover:bg-[#51459d]/5 rounded-[6px] transition-colors"
          title="Add property"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          Property
        </button>
        <button
          onClick={() => setShowImport(true)}
          className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-[#3ec9d6] hover:bg-[#3ec9d6]/5 rounded-[6px] border border-[#3ec9d6]/30 transition-colors"
          title="Import from ERP"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
          Import ERP
        </button>
      </div>

      {/* Filter Bar */}
      <FilterBar
        properties={db.properties ?? []}
        rows={allRows}
        onFilteredRows={(rows) => setFilteredRows(rows)}
      />

      {/* View Content */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        {viewType === 'table' && <TableView database={db} filteredRows={filteredRows ?? undefined} />}
        {viewType === 'kanban' && <KanbanView database={db} filteredRows={filteredRows ?? undefined} />}
        {viewType === 'gallery' && <GalleryView database={db} filteredRows={filteredRows ?? undefined} />}
        {viewType === 'list' && <ListView database={db} filteredRows={filteredRows ?? undefined} />}
        {viewType === 'calendar' && (
          <CalendarView
            databaseId={db.id}
            properties={db.properties ?? []}
            filteredRows={filteredRows ?? undefined}
          />
        )}
        {viewType === 'timeline' && (
          <TimelineView
            databaseId={db.id}
            properties={db.properties ?? []}
            filteredRows={filteredRows ?? undefined}
          />
        )}
      </div>

      {/* Dialogs */}
      {showImport && <ERPImportDialog dbId={db.id} onClose={() => setShowImport(false)} />}
      {showAddProp && <AddPropertyDialog dbId={db.id} onClose={() => setShowAddProp(false)} />}
    </div>
  )
}
