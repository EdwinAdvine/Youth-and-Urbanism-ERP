/**
 * VirtualTable — high-performance virtualized table for large datasets.
 *
 * Uses @tanstack/react-virtual to render only visible rows + overscan,
 * keeping the DOM lean regardless of dataset size. Replaces standard
 * <table> rendering for lists with 50+ rows.
 *
 * Usage:
 *   <VirtualTable
 *     data={invoices}
 *     columns={columns}
 *     rowHeight={52}
 *     height={600}
 *   />
 *
 * Column definition:
 *   const columns: Column<Invoice>[] = [
 *     { key: 'number', header: 'Invoice #', width: '160px',
 *       render: (row) => <span>{row.invoice_number}</span> },
 *     { key: 'status', header: 'Status', render: (row) => <Badge>{row.status}</Badge> },
 *   ]
 */

import { useRef, memo } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'

export interface Column<T> {
  /** Unique column key */
  key: string
  /** Column header label */
  header: string
  /** Optional fixed width (CSS value, e.g. "120px") */
  width?: string
  /** Cell renderer */
  render: (row: T, index: number) => React.ReactNode
}

interface VirtualTableProps<T> {
  /** Dataset to display */
  data: T[]
  /** Column definitions */
  columns: Column<T>[]
  /** Height of each row in pixels (default: 52) */
  rowHeight?: number
  /** Height of the scrollable container in pixels (default: 600) */
  height?: number
  /** Number of rows to render beyond the visible area (default: 5) */
  overscan?: number
  /** Function to extract a unique key from each row */
  getRowKey?: (row: T, index: number) => string | number
  /** Called when a row is clicked */
  onRowClick?: (row: T) => void
  /** Empty state message */
  emptyMessage?: string
  /** Whether data is loading (shows skeleton instead) */
  isLoading?: boolean
  /** Number of loading rows to show */
  loadingRows?: number
}

const ROW_OVERSCAN = 5

function VirtualTableInner<T>({
  data,
  columns,
  rowHeight = 52,
  height = 600,
  overscan = ROW_OVERSCAN,
  getRowKey,
  onRowClick,
  emptyMessage = 'No records found.',
}: VirtualTableProps<T>) {
  const parentRef = useRef<HTMLDivElement>(null)

  const rowVirtualizer = useVirtualizer({
    count: data.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => rowHeight,
    overscan,
  })

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center py-16 text-sm text-gray-500 dark:text-gray-400">
        {emptyMessage}
      </div>
    )
  }

  return (
    <div className="w-full overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
      {/* Header */}
      <div className="flex bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-10">
        {columns.map((col) => (
          <div
            key={col.key}
            className="px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide truncate"
            style={{ width: col.width, flex: col.width ? `0 0 ${col.width}` : 1 }}
          >
            {col.header}
          </div>
        ))}
      </div>

      {/* Scrollable body */}
      <div
        ref={parentRef}
        style={{ height, overflowY: 'auto' }}
        className="relative"
      >
        {/* Total height spacer */}
        <div style={{ height: rowVirtualizer.getTotalSize(), position: 'relative' }}>
          {rowVirtualizer.getVirtualItems().map((virtualRow) => {
            const row = data[virtualRow.index]
            const rowKey = getRowKey
              ? getRowKey(row, virtualRow.index)
              : virtualRow.index

            return (
              <div
                key={rowKey}
                data-index={virtualRow.index}
                ref={rowVirtualizer.measureElement}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  transform: `translateY(${virtualRow.start}px)`,
                }}
                className={[
                  'flex items-center border-b border-gray-100 dark:border-gray-800',
                  'hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors',
                  onRowClick ? 'cursor-pointer' : '',
                ].join(' ')}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
              >
                {columns.map((col) => (
                  <div
                    key={col.key}
                    className="px-4 py-0 text-sm text-gray-700 dark:text-gray-200 truncate"
                    style={{
                      width: col.width,
                      flex: col.width ? `0 0 ${col.width}` : 1,
                      height: rowHeight,
                      display: 'flex',
                      alignItems: 'center',
                    }}
                  >
                    {col.render(row, virtualRow.index)}
                  </div>
                ))}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export const VirtualTable = memo(VirtualTableInner) as typeof VirtualTableInner
