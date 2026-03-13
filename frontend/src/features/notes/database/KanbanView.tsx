/**
 * KanbanView — Drag-drop Kanban board for NoteDatabase rows.
 * Groups rows by a select/status property. Drag between columns.
 */
import { useState } from 'react'
import {
  useDatabaseRows, useCreateRow, useUpdateRow, useDeleteRow,
  type NoteDatabase, type DatabaseRow, type DatabaseProperty,
} from '../../../api/noteDatabases'

// ── Card ──────────────────────────────────────────────────────────────────────

function KanbanCard({
  row,
  properties,
  groupProp,
  dbId,
  onDragStart,
}: {
  row: DatabaseRow
  properties: DatabaseProperty[]
  groupProp: DatabaseProperty
  dbId: string
  onDragStart: (rowId: string) => void
}) {
  const deleteRow = useDeleteRow()
  const [hovered, setHovered] = useState(false)

  // Show first 3 non-group, non-date visible properties as card fields
  const visibleProps = properties.filter(
    (p) => p.id !== groupProp.id && p.is_visible && p.property_type !== 'created_time' && p.property_type !== 'last_edited_time'
  ).slice(0, 3)

  const title = row.values['__title__'] ?? row.values[properties[0]?.id] ?? 'Untitled'

  return (
    <div
      draggable
      onDragStart={() => onDragStart(row.id)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="bg-white dark:bg-gray-800 rounded-[8px] border border-gray-200 dark:border-gray-700 p-3 cursor-grab active:cursor-grabbing shadow-sm hover:shadow-md transition-all group"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium text-gray-800 dark:text-gray-100 line-clamp-2">{String(title)}</p>
        {hovered && (
          <button
            onClick={(e) => { e.stopPropagation(); deleteRow.mutate({ dbId, rowId: row.id }) }}
            className="p-0.5 text-gray-300 hover:text-red-500 shrink-0 transition-colors"
          >
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
      {visibleProps.length > 0 && (
        <div className="mt-2 space-y-1">
          {visibleProps.map((prop) => {
            const val = row.values[prop.id]
            if (val === null || val === undefined || val === '') return null
            return (
              <div key={prop.id} className="flex items-center gap-1.5">
                <span className="text-[10px] text-gray-400 shrink-0">{prop.name}</span>
                <span className="text-[10px] text-gray-600 dark:text-gray-400 truncate">
                  {prop.property_type === 'checkbox' ? (val ? '✓' : '✗')
                    : prop.property_type === 'date' ? new Date(val).toLocaleDateString('en-KE', { day: 'numeric', month: 'short' })
                    : String(val)}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Column ────────────────────────────────────────────────────────────────────

function KanbanColumn({
  label,
  color,
  rows,
  properties,
  groupProp,
  dbId,
  onDrop,
  draggedRowId,
}: {
  label: string
  color?: string
  rows: DatabaseRow[]
  properties: DatabaseProperty[]
  groupProp: DatabaseProperty
  dbId: string
  onDrop: (rowId: string, newValue: string) => void
  draggedRowId: string | null
}) {
  const createRow = useCreateRow()
  const [isDragOver, setIsDragOver] = useState(false)

  const COLUMN_COLORS: Record<string, string> = {
    'Not Started': 'bg-gray-100 text-gray-600',
    'In Progress': 'bg-blue-100 text-blue-700',
    'Done': 'bg-green-100 text-green-700',
    'Blocked': 'bg-red-100 text-red-700',
    'Review': 'bg-yellow-100 text-yellow-700',
  }
  const chipCls = COLUMN_COLORS[label] ?? (color ? '' : 'bg-gray-100 text-gray-600')

  return (
    <div
      className={`flex flex-col w-64 shrink-0 rounded-[10px] bg-gray-50 dark:bg-gray-900/50 border ${isDragOver ? 'border-[#51459d] border-dashed' : 'border-gray-200 dark:border-gray-700'} overflow-hidden transition-colors`}
      onDragOver={(e) => { e.preventDefault(); setIsDragOver(true) }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={(e) => { e.preventDefault(); setIsDragOver(false); if (draggedRowId) onDrop(draggedRowId, label) }}
    >
      {/* Column Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <div className="flex items-center gap-1.5">
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${chipCls}`}>{label}</span>
          <span className="text-[10px] text-gray-400">{rows.length}</span>
        </div>
        <button
          onClick={() => createRow.mutate({ dbId, values: { [groupProp.id]: label } })}
          className="text-gray-400 hover:text-[#51459d] transition-colors"
          title="Add card"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </button>
      </div>

      {/* Cards */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2 min-h-[120px]">
        {rows.map((row) => (
          <KanbanCard
            key={row.id}
            row={row}
            properties={properties}
            groupProp={groupProp}
            dbId={dbId}
            onDragStart={() => {}}
          />
        ))}
        {rows.length === 0 && (
          <p className="text-[10px] text-gray-400 text-center py-4">Drop cards here</p>
        )}
      </div>
    </div>
  )
}

// ── Kanban View ───────────────────────────────────────────────────────────────

interface KanbanViewProps {
  database: NoteDatabase
  filteredRows?: DatabaseRow[]
}

export default function KanbanView({ database, filteredRows }: KanbanViewProps) {
  const properties = database.properties ?? []
  const { data: fetchedRows = [], isLoading } = useDatabaseRows(database.id)
  const rows = filteredRows ?? fetchedRows
  const updateRow = useUpdateRow()
  const [draggedRowId, setDraggedRowId] = useState<string | null>(null)

  // Find the group-by property (first select or status column)
  const groupProp = properties.find((p) => p.property_type === 'select' || p.property_type === 'status' || p.property_type === 'multi_select')

  if (!groupProp) {
    return (
      <div className="flex-1 flex items-center justify-center text-sm text-gray-400">
        Add a <strong className="mx-1">Select</strong> or <strong className="mx-1">Status</strong> property to use Kanban view.
      </div>
    )
  }

  // Extract unique values from config options or from existing row values
  const optionsFromConfig: string[] = groupProp.config?.options?.map((o: any) => o.label || o) ?? []
  const optionsFromRows: string[] = [...new Set(rows.map((r) => r.values[groupProp.id]).filter(Boolean))]
  const allOptions = [...new Set([...optionsFromConfig, ...optionsFromRows])]
  if (allOptions.length === 0) allOptions.push('No Status')

  const grouped: Record<string, DatabaseRow[]> = {}
  allOptions.forEach((opt) => { grouped[opt] = [] })
  rows.forEach((row) => {
    const val = row.values[groupProp.id] || 'No Status'
    if (!grouped[val]) grouped[val] = []
    grouped[val].push(row)
  })

  const handleDrop = (rowId: string, newValue: string) => {
    const row = rows.find((r) => r.id === rowId)
    if (!row) return
    updateRow.mutate({ dbId: database.id, rowId, values: { ...row.values, [groupProp.id]: newValue } })
    setDraggedRowId(null)
  }

  if (isLoading && !filteredRows) {
    return (
      <div className="flex items-center justify-center h-48">
        <svg className="animate-spin h-5 w-5 text-[#51459d]" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-x-auto overflow-y-hidden">
      <div className="flex gap-3 p-4 h-full items-start">
        {allOptions.map((option) => (
          <KanbanColumn
            key={option}
            label={option}
            rows={grouped[option] ?? []}
            properties={properties}
            groupProp={groupProp}
            dbId={database.id}
            onDrop={handleDrop}
            draggedRowId={draggedRowId}
          />
        ))}

        {/* Add column button */}
        <button className="flex items-center gap-1.5 px-3 py-2 text-xs text-gray-400 hover:text-[#51459d] border border-dashed border-gray-200 dark:border-gray-700 rounded-[8px] hover:border-[#51459d] transition-colors shrink-0 whitespace-nowrap">
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add group
        </button>
      </div>
    </div>
  )
}
