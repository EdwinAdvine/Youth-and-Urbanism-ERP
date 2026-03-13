/**
 * ListView — Compact list view for NoteDatabase rows.
 */
import { useState } from 'react'
import {
  useDatabaseRows, useCreateRow, useDeleteRow,
  type NoteDatabase, type DatabaseRow,
} from '../../../api/noteDatabases'

interface ListViewProps {
  database: NoteDatabase
  filteredRows?: DatabaseRow[]
}

export default function ListView({ database, filteredRows }: ListViewProps) {
  const properties = (database.properties ?? []).filter((p) => p.is_visible)
  const { data: fetchedRows = [], isLoading } = useDatabaseRows(database.id)
  const rows = filteredRows ?? fetchedRows
  const createRow = useCreateRow()
  const deleteRow = useDeleteRow()
  const [hovered, setHovered] = useState<string | null>(null)

  const titleProp = properties[0]
  const secondaryProps = properties.slice(1, 4)

  const STATUS_COLORS: Record<string, string> = {
    done: 'text-green-600 bg-green-50',
    active: 'text-blue-600 bg-blue-50',
    blocked: 'text-red-600 bg-red-50',
    review: 'text-yellow-600 bg-yellow-50',
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
    <div className="flex-1 overflow-auto">
      <div className="divide-y divide-gray-100 dark:divide-gray-800">
        {rows.map((row) => {
          const title = titleProp ? row.values[titleProp.id] : 'Untitled'

          return (
            <div
              key={row.id}
              className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors group"
              onMouseEnter={() => setHovered(row.id)}
              onMouseLeave={() => setHovered(null)}
            >
              <div className="w-4 h-4 rounded border border-gray-300 dark:border-gray-600 shrink-0" />

              <span className="text-xs font-medium text-gray-800 dark:text-gray-100 flex-1 truncate">
                {String(title || 'Untitled')}
              </span>

              <div className="flex items-center gap-3">
                {secondaryProps.map((prop) => {
                  const val = row.values[prop.id]
                  if (!val && val !== false) return null
                  return (
                    <div key={prop.id} className="flex items-center gap-1">
                      {prop.property_type === 'checkbox' ? (
                        <span className={`text-[10px] ${val ? 'text-green-600' : 'text-gray-400'}`}>
                          {val ? '✓' : '○'} {prop.name}
                        </span>
                      ) : prop.property_type === 'select' || prop.property_type === 'status' ? (
                        <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded-full ${STATUS_COLORS[String(val).toLowerCase()] ?? 'bg-gray-100 text-gray-600'}`}>
                          {String(val)}
                        </span>
                      ) : prop.property_type === 'date' && val ? (
                        <span className="text-[10px] text-gray-400">
                          {new Date(val).toLocaleDateString('en-KE', { day: 'numeric', month: 'short' })}
                        </span>
                      ) : (
                        <span className="text-[10px] text-gray-500 max-w-[100px] truncate">{String(val)}</span>
                      )}
                    </div>
                  )
                })}
              </div>

              {hovered === row.id && (
                <button
                  onClick={() => deleteRow.mutate({ dbId: database.id, rowId: row.id })}
                  className="text-gray-300 hover:text-red-500 shrink-0 transition-colors"
                >
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          )
        })}

        <div className="px-4 py-2">
          <button
            onClick={() => createRow.mutate({ dbId: database.id })}
            disabled={createRow.isPending}
            className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-[#51459d] transition-colors"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New item
          </button>
        </div>
      </div>
    </div>
  )
}
