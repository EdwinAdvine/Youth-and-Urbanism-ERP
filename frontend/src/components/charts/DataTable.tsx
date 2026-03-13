import React, { useState, useMemo } from 'react'
import { useIsMobile } from '../../hooks/useMediaQuery'
import MobileCardView from '../ui/MobileCardView'

interface Column {
  key: string
  label: string
  align?: 'left' | 'right' | 'center'
  format?: (value: unknown) => string
  sortable?: boolean
}

interface MobileCardConfig {
  /** Field shown as card title */
  primaryField: string
  /** Key-value rows */
  secondaryFields: Array<{ key: string; label: string; format?: (value: unknown, row: Record<string, unknown>) => React.ReactNode }>
  /** Status field for top color bar */
  statusField?: string
  /** Maps status values to Tailwind bg classes */
  statusColorMap?: Record<string, string>
  /** Click handler for the whole card */
  onRowClick?: (row: Record<string, unknown>) => void
}

interface DataTableProps {
  columns: Column[]
  data: Record<string, unknown>[]
  pageSize?: number
  title?: string
  subtitle?: string
  maxHeight?: number
  onExport?: () => void
  /** When provided, shows MobileCardView on mobile instead of table */
  mobileCardConfig?: MobileCardConfig
}

export default function DataTable({
  columns,
  data,
  pageSize = 10,
  title,
  subtitle,
  maxHeight,
  onExport,
  mobileCardConfig,
}: DataTableProps) {
  const isMobile = useIsMobile()
  const [page, setPage] = useState(0)
  const [sortKey, setSortKey] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    if (!search) return data
    const lower = search.toLowerCase()
    return data.filter((row) =>
      columns.some((col) => {
        const v = row[col.key]
        return v !== null && v !== undefined && String(v).toLowerCase().includes(lower)
      })
    )
  }, [data, search, columns])

  const sorted = useMemo(() => {
    if (!sortKey) return filtered
    return [...filtered].sort((a, b) => {
      const av = a[sortKey], bv = b[sortKey]
      if (av == null && bv == null) return 0
      if (av == null) return 1
      if (bv == null) return -1
      const cmp = typeof av === 'number' && typeof bv === 'number'
        ? av - bv
        : String(av).localeCompare(String(bv))
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [filtered, sortKey, sortDir])

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize))
  const paged = sorted.slice(page * pageSize, (page + 1) * pageSize)

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  // Mobile card view
  if (isMobile && mobileCardConfig) {
    return (
      <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-[10px] shadow-sm overflow-hidden">
        {(title || onExport) && (
          <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
            <div>
              {title && <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{title}</h3>}
              {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
            </div>
            {onExport && (
              <button onClick={onExport} className="text-xs text-[#51459d] hover:text-[#51459d]/80 font-medium min-h-[44px]">
                Export
              </button>
            )}
          </div>
        )}
        <div className="px-3 py-3">
          <input
            type="text"
            placeholder="Search..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0) }}
            className="w-full text-sm border border-gray-200 dark:border-gray-600 rounded-[8px] px-3 py-2 min-h-[44px] bg-transparent focus:outline-none focus:ring-1 focus:ring-[#51459d]/40 mb-2"
          />
          <MobileCardView
            data={paged}
            primaryField={mobileCardConfig.primaryField}
            secondaryFields={mobileCardConfig.secondaryFields}
            statusField={mobileCardConfig.statusField}
            statusColorMap={mobileCardConfig.statusColorMap}
            onRowClick={mobileCardConfig.onRowClick}
            keyExtractor={(row) => String(row[mobileCardConfig.primaryField] ?? Math.random())}
            emptyText="No data available"
          />
        </div>
        {totalPages > 1 && (
          <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between text-xs text-gray-500">
            <span>{sorted.length} rows</span>
            <div className="flex items-center gap-2">
              <button
                className="min-h-[44px] px-3 rounded-[8px] hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40 active:bg-gray-200"
                disabled={page === 0}
                onClick={() => setPage(page - 1)}
              >
                Prev
              </button>
              <span>{page + 1} / {totalPages}</span>
              <button
                className="min-h-[44px] px-3 rounded-[8px] hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40 active:bg-gray-200"
                disabled={page >= totalPages - 1}
                onClick={() => setPage(page + 1)}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-[10px] shadow-sm overflow-hidden">
      {(title || onExport) && (
        <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <div>
            {title && <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{title}</h3>}
            {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
          </div>
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <input
              type="text"
              placeholder="Search..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0) }}
              className="text-xs border border-gray-200 dark:border-gray-600 rounded-[8px] px-3 py-1.5 min-h-[44px] sm:min-h-0 bg-transparent focus:outline-none focus:ring-1 focus:ring-[#51459d]/40 w-full sm:w-40"
            />
            {onExport && (
              <button
                onClick={onExport}
                className="text-xs text-[#51459d] hover:text-[#51459d]/80 font-medium"
              >
                Export
              </button>
            )}
          </div>
        </div>
      )}
      <div className="overflow-x-auto" style={maxHeight ? { maxHeight, overflowY: 'auto' } : undefined}>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 dark:border-gray-700">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`py-3 px-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide ${
                    col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'
                  } ${col.sortable !== false ? 'cursor-pointer hover:text-gray-700 dark:hover:text-gray-300 select-none' : ''}`}
                  onClick={() => col.sortable !== false && handleSort(col.key)}
                >
                  <span className="inline-flex items-center gap-1">
                    {col.label}
                    {sortKey === col.key && (
                      <svg className={`h-3 w-3 ${sortDir === 'desc' ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                      </svg>
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paged.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="py-8 text-center text-gray-400 text-xs">
                  No data available
                </td>
              </tr>
            ) : (
              paged.map((row, ri) => (
                <tr key={ri} className="border-b border-gray-50 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                  {columns.map((col) => {
                    const val = row[col.key]
                    const display = col.format ? col.format(val) : val !== null && val !== undefined ? String(val) : '-'
                    return (
                      <td
                        key={col.key}
                        className={`py-2.5 px-4 text-gray-700 dark:text-gray-300 ${
                          col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'
                        }`}
                      >
                        {display}
                      </td>
                    )
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {totalPages > 1 && (
        <div className="px-5 py-3 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between text-xs text-gray-500">
          <span>{sorted.length} rows</span>
          <div className="flex items-center gap-1">
            <button
              className="px-3 py-1.5 min-h-[44px] rounded-[8px] hover:bg-gray-100 dark:hover:bg-gray-700 active:bg-gray-200 disabled:opacity-40"
              disabled={page === 0}
              onClick={() => setPage(page - 1)}
            >
              Prev
            </button>
            <span className="px-2">{page + 1} / {totalPages}</span>
            <button
              className="px-3 py-1.5 min-h-[44px] rounded-[8px] hover:bg-gray-100 dark:hover:bg-gray-700 active:bg-gray-200 disabled:opacity-40"
              disabled={page >= totalPages - 1}
              onClick={() => setPage(page + 1)}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
