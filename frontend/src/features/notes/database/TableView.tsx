/**
 * TableView — Spreadsheet-style table for NoteDatabase rows.
 * Supports inline cell editing, sortable columns, add row.
 */
import { useState, useCallback } from 'react'
import {
  useDatabaseRows, useCreateRow, useUpdateRow, useDeleteRow,
  type NoteDatabase, type DatabaseRow,
} from '../../../api/noteDatabases'

// ── Cell Renderer ─────────────────────────────────────────────────────────────

interface CellProps {
  value: any
  propType: string
  onSave: (val: any) => void
}

function Cell({ value, propType, onSave }: CellProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<string>(value ?? '')

  const commit = () => { setEditing(false); onSave(draft) }

  if (!editing) {
    return (
      <div
        onClick={() => { setDraft(value ?? ''); setEditing(true) }}
        className="w-full h-full min-h-[28px] px-2 py-1 text-xs text-gray-700 dark:text-gray-300 cursor-text truncate"
      >
        {propType === 'checkbox' ? (
          <input type="checkbox" checked={!!value} readOnly className="accent-[#51459d]" />
        ) : propType === 'date' && value ? (
          new Date(value).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })
        ) : propType === 'select' || propType === 'status' ? (
          value ? (
            <span className="px-1.5 py-0.5 text-[10px] bg-[#51459d]/10 text-[#51459d] rounded-full">{value}</span>
          ) : null
        ) : propType === 'multi_select' ? (
          <div className="flex flex-wrap gap-1">
            {(Array.isArray(value) ? value : []).map((v: string, i: number) => (
              <span key={i} className="px-1.5 py-0.5 text-[10px] bg-[#3ec9d6]/10 text-[#3ec9d6] rounded-full">{v}</span>
            ))}
          </div>
        ) : propType === 'number' ? (
          value !== null && value !== undefined ? Number(value).toLocaleString() : ''
        ) : (
          String(value ?? '')
        )}
      </div>
    )
  }

  if (propType === 'checkbox') {
    return (
      <input
        type="checkbox"
        checked={!!value}
        onChange={(e) => { onSave(e.target.checked); setEditing(false) }}
        autoFocus
        className="mx-2 accent-[#51459d]"
      />
    )
  }

  if (propType === 'date') {
    return (
      <input
        type="date"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        autoFocus
        className="w-full px-2 py-1 text-xs focus:outline-none bg-white dark:bg-gray-800"
      />
    )
  }

  return (
    <input
      type={propType === 'number' ? 'number' : propType === 'email' ? 'email' : propType === 'url' ? 'url' : 'text'}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false) }}
      autoFocus
      className="w-full px-2 py-1 text-xs focus:outline-none bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100"
    />
  )
}

// ── Table View ────────────────────────────────────────────────────────────────

interface TableViewProps {
  database: NoteDatabase
  filteredRows?: DatabaseRow[]
}

export default function TableView({ database, filteredRows }: TableViewProps) {
  const properties = (database.properties ?? []).filter((p) => p.is_visible)
  const { data: fetchedRows = [], isLoading } = useDatabaseRows(database.id)
  const rows = filteredRows ?? fetchedRows
  const createRow = useCreateRow()
  const updateRow = useUpdateRow()
  const deleteRow = useDeleteRow()

  const [sortProp, setSortProp] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [hoveredRow, setHoveredRow] = useState<string | null>(null)

  const handleSort = (propId: string) => {
    if (sortProp === propId) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortProp(propId); setSortDir('asc') }
  }

  const sortedRows = [...rows].sort((a, b) => {
    if (!sortProp) return a.sort_order - b.sort_order
    const av = a.values[sortProp] ?? ''
    const bv = b.values[sortProp] ?? ''
    const cmp = String(av).localeCompare(String(bv))
    return sortDir === 'asc' ? cmp : -cmp
  })

  const handleCellSave = useCallback((row: DatabaseRow, propId: string, val: any) => {
    updateRow.mutate({ dbId: database.id, rowId: row.id, values: { ...row.values, [propId]: val } })
  }, [database.id, updateRow])

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
    <div className="flex-1 overflow-auto">
      <table className="w-full text-xs border-collapse" style={{ minWidth: Math.max(600, properties.reduce((s, p) => s + (p.width || 160), 80)) }}>
        <thead>
          <tr className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
            {/* Row number */}
            <th className="w-10 px-2 py-2 text-gray-400 font-normal text-left border-r border-gray-200 dark:border-gray-700">#</th>
            {properties.map((prop) => (
              <th
                key={prop.id}
                style={{ width: prop.width || 160, minWidth: prop.width || 160 }}
                className="px-2 py-2 text-left font-medium text-gray-600 dark:text-gray-400 border-r border-gray-200 dark:border-gray-700 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 select-none"
                onClick={() => handleSort(prop.id)}
              >
                <div className="flex items-center gap-1">
                  <span className="truncate">{prop.name}</span>
                  {sortProp === prop.id && (
                    <span className="text-[#51459d]">{sortDir === 'asc' ? '↑' : '↓'}</span>
                  )}
                </div>
              </th>
            ))}
            {/* Actions col */}
            <th className="w-8" />
          </tr>
        </thead>
        <tbody>
          {sortedRows.map((row, idx) => (
            <tr
              key={row.id}
              className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-colors"
              onMouseEnter={() => setHoveredRow(row.id)}
              onMouseLeave={() => setHoveredRow(null)}
            >
              <td className="w-10 px-2 py-1 text-gray-300 text-right text-[10px] border-r border-gray-100 dark:border-gray-800 select-none">
                {idx + 1}
              </td>
              {properties.map((prop) => (
                <td
                  key={prop.id}
                  style={{ width: prop.width || 160, maxWidth: prop.width || 160 }}
                  className="border-r border-gray-100 dark:border-gray-800 p-0"
                >
                  <Cell
                    value={row.values[prop.id]}
                    propType={prop.property_type}
                    onSave={(val) => handleCellSave(row, prop.id, val)}
                  />
                </td>
              ))}
              <td className="w-8 px-1">
                {hoveredRow === row.id && (
                  <button
                    onClick={() => deleteRow.mutate({ dbId: database.id, rowId: row.id })}
                    className="p-0.5 text-gray-300 hover:text-red-500 transition-colors"
                    title="Delete row"
                  >
                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </td>
            </tr>
          ))}
          {/* Add row */}
          <tr>
            <td colSpan={properties.length + 2} className="px-3 py-2">
              <button
                onClick={() => createRow.mutate({ dbId: database.id })}
                disabled={createRow.isPending}
                className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-[#51459d] transition-colors"
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add row
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}
