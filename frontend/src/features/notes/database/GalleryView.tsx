/**
 * GalleryView — Card grid view for NoteDatabase rows.
 * Shows rows as cards with cover image, title, and key properties.
 */
import { useState } from 'react'
import {
  useDatabaseRows, useCreateRow, useDeleteRow,
  type NoteDatabase, type DatabaseRow,
} from '../../../api/noteDatabases'

interface GalleryViewProps {
  database: NoteDatabase
  filteredRows?: DatabaseRow[]
}

export default function GalleryView({ database, filteredRows }: GalleryViewProps) {
  const properties = (database.properties ?? []).filter((p) => p.is_visible)
  const { data: fetchedRows = [], isLoading } = useDatabaseRows(database.id)
  const rows = filteredRows ?? fetchedRows
  const createRow = useCreateRow()
  const deleteRow = useDeleteRow()
  const [hovered, setHovered] = useState<string | null>(null)

  // First text property = card title; first url/file = cover image
  const titleProp = properties.find((p) => p.property_type === 'text' || p.property_type === 'email')
  const imageProp = properties.find((p) => p.property_type === 'url' || p.property_type === 'file')
  const otherProps = properties.filter((p) => p !== titleProp && p !== imageProp).slice(0, 3)

  const STATUS_COLORS: Record<string, string> = {
    done: 'bg-green-100 text-green-700',
    active: 'bg-blue-100 text-blue-700',
    blocked: 'bg-red-100 text-red-700',
    review: 'bg-yellow-100 text-yellow-700',
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
    <div className="flex-1 overflow-auto p-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
        {rows.map((row) => {
          const title = titleProp ? row.values[titleProp.id] : 'Untitled'
          const imageUrl = imageProp ? row.values[imageProp.id] : null

          return (
            <div
              key={row.id}
              className="group bg-white dark:bg-gray-800 rounded-[10px] border border-gray-200 dark:border-gray-700 overflow-hidden hover:shadow-md transition-all cursor-pointer relative"
              onMouseEnter={() => setHovered(row.id)}
              onMouseLeave={() => setHovered(null)}
            >
              {/* Cover */}
              <div className="h-28 bg-gradient-to-br from-[#51459d]/10 to-[#3ec9d6]/10 overflow-hidden">
                {imageUrl ? (
                  <img src={imageUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-3xl opacity-30">
                    {database.icon ?? '📄'}
                  </div>
                )}
              </div>

              {/* Content */}
              <div className="p-2.5">
                <p className="text-xs font-medium text-gray-800 dark:text-gray-100 line-clamp-2 mb-1.5">
                  {String(title || 'Untitled')}
                </p>
                {otherProps.map((prop) => {
                  const val = row.values[prop.id]
                  if (!val && val !== 0) return null
                  return (
                    <div key={prop.id} className="flex items-center gap-1 mb-0.5">
                      <span className="text-[9px] text-gray-400 shrink-0 truncate max-w-[50px]">{prop.name}</span>
                      {prop.property_type === 'select' || prop.property_type === 'status' ? (
                        <span className={`text-[9px] font-medium px-1 py-0.5 rounded-full ${STATUS_COLORS[String(val).toLowerCase()] ?? 'bg-gray-100 text-gray-600'}`}>
                          {String(val)}
                        </span>
                      ) : prop.property_type === 'checkbox' ? (
                        <span className="text-[9px]">{val ? '✓' : '✗'}</span>
                      ) : (
                        <span className="text-[9px] text-gray-600 dark:text-gray-400 truncate">{String(val)}</span>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Delete overlay */}
              {hovered === row.id && (
                <button
                  onClick={(e) => { e.stopPropagation(); deleteRow.mutate({ dbId: database.id, rowId: row.id }) }}
                  className="absolute top-1.5 right-1.5 p-1 bg-white/80 dark:bg-gray-800/80 rounded-full text-gray-400 hover:text-red-500 shadow-sm transition-colors"
                >
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          )
        })}

        {/* Add card */}
        <button
          onClick={() => createRow.mutate({ dbId: database.id })}
          disabled={createRow.isPending}
          className="h-full min-h-[160px] flex flex-col items-center justify-center rounded-[10px] border-2 border-dashed border-gray-200 dark:border-gray-700 text-gray-400 hover:border-[#51459d] hover:text-[#51459d] transition-colors"
        >
          <svg className="h-6 w-6 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
          </svg>
          <span className="text-xs">New card</span>
        </button>
      </div>
    </div>
  )
}
