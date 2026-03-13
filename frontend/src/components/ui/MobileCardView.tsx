import React, { useRef, useState } from 'react'
import { cn } from './index'

/* ── Types ──────────────────────────────────────────────────────────── */

interface FieldConfig<T> {
  key: keyof T & string
  label: string
  format?: (value: unknown, row: T) => React.ReactNode
}

interface SwipeAction<T> {
  label: string
  color: string // Tailwind bg class e.g. 'bg-danger' or 'bg-success'
  action: (row: T) => void
}

interface MobileCardViewProps<T> {
  data: T[]
  /** Field shown as card title (bold) */
  primaryField: keyof T & string
  /** Optional formatter for the primary field */
  primaryFormat?: (value: unknown, row: T) => React.ReactNode
  /** Key-value rows below the title */
  secondaryFields: FieldConfig<T>[]
  /** Status field mapped to the top color bar */
  statusField?: keyof T & string
  /** Maps status values to Tailwind bg classes */
  statusColorMap?: Record<string, string>
  /** Action buttons at bottom of each card */
  actions?: Array<{
    label: string
    onClick: (row: T) => void
    variant?: 'primary' | 'outline' | 'danger'
  }>
  /** Swipe-to-reveal actions */
  swipeLeft?: SwipeAction<T>
  swipeRight?: SwipeAction<T>
  /** Click handler for the whole card */
  onRowClick?: (row: T) => void
  /** Unique key extractor */
  keyExtractor: (row: T) => string
  /** Empty state text */
  emptyText?: string
  className?: string
}

/* ── Component ──────────────────────────────────────────────────────── */

export default function MobileCardView<T>({
  data,
  primaryField,
  primaryFormat,
  secondaryFields,
  statusField,
  statusColorMap,
  actions,
  swipeLeft,
  swipeRight,
  onRowClick,
  keyExtractor,
  emptyText = 'No data found',
  className,
}: MobileCardViewProps<T>) {
  if (data.length === 0) {
    return (
      <div className="py-12 text-center text-sm text-gray-400">
        {emptyText}
      </div>
    )
  }

  return (
    <div className={cn('space-y-2', className)}>
      {data.map((row) => (
        <SwipeableCard
          key={keyExtractor(row)}
          row={row}
          primaryField={primaryField}
          primaryFormat={primaryFormat}
          secondaryFields={secondaryFields}
          statusField={statusField}
          statusColorMap={statusColorMap}
          actions={actions}
          swipeLeft={swipeLeft}
          swipeRight={swipeRight}
          onRowClick={onRowClick}
        />
      ))}
    </div>
  )
}

/* ── Swipeable Card ─────────────────────────────────────────────────── */

function SwipeableCard<T>({
  row,
  primaryField,
  primaryFormat,
  secondaryFields,
  statusField,
  statusColorMap,
  actions,
  swipeLeft,
  swipeRight,
  onRowClick,
}: Omit<MobileCardViewProps<T>, 'data' | 'keyExtractor' | 'emptyText' | 'className'> & { row: T }) {
  const [offsetX, setOffsetX] = useState(0)
  const touchStartX = useRef(0)
  const touchStartY = useRef(0)
  const isHorizontal = useRef<boolean | null>(null)

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX
    touchStartY.current = e.touches[0].clientY
    isHorizontal.current = null
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    const deltaX = e.touches[0].clientX - touchStartX.current
    const deltaY = e.touches[0].clientY - touchStartY.current

    // Determine direction lock
    if (isHorizontal.current === null && (Math.abs(deltaX) > 10 || Math.abs(deltaY) > 10)) {
      isHorizontal.current = Math.abs(deltaX) > Math.abs(deltaY) * 2
    }

    if (!isHorizontal.current) return

    // Only swipe if there's a configured action for that direction
    if (deltaX < 0 && swipeLeft) {
      setOffsetX(Math.max(deltaX, -100))
    } else if (deltaX > 0 && swipeRight) {
      setOffsetX(Math.min(deltaX, 100))
    }
  }

  const handleTouchEnd = () => {
    if (offsetX < -80 && swipeLeft) {
      swipeLeft.action(row)
    } else if (offsetX > 80 && swipeRight) {
      swipeRight.action(row)
    }
    setOffsetX(0)
    isHorizontal.current = null
  }

  const statusValue = statusField ? String((row as Record<string, unknown>)[statusField] ?? '') : ''
  const statusColor = statusColorMap?.[statusValue] ?? 'bg-gray-300'

  const actionVariants = {
    primary: 'bg-primary text-white active:bg-primary-600',
    outline: 'border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 active:bg-gray-100 dark:active:bg-gray-800',
    danger: 'bg-danger text-white active:opacity-90',
  }

  return (
    <div className="relative overflow-hidden rounded-[10px]">
      {/* Swipe background */}
      {swipeLeft && offsetX < 0 && (
        <div className={cn('absolute inset-y-0 right-0 w-24 flex items-center justify-center text-white text-xs font-semibold', swipeLeft.color)}>
          {swipeLeft.label}
        </div>
      )}
      {swipeRight && offsetX > 0 && (
        <div className={cn('absolute inset-y-0 left-0 w-24 flex items-center justify-center text-white text-xs font-semibold', swipeRight.color)}>
          {swipeRight.label}
        </div>
      )}

      {/* Card */}
      <div
        className="relative bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-[10px] shadow-sm active:scale-[0.99] transition-transform"
        style={{
          transform: `translateX(${offsetX}px)`,
          transition: offsetX === 0 ? 'transform 200ms ease-out' : 'none',
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={onRowClick ? () => onRowClick(row) : undefined}
        role={onRowClick ? 'button' : undefined}
        tabIndex={onRowClick ? 0 : undefined}
      >
        {/* Status bar */}
        {statusField && (
          <div className={cn('h-1 rounded-t-[10px]', statusColor)} />
        )}

        <div className="p-3 space-y-2">
          {/* Primary field */}
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            {primaryFormat
              ? primaryFormat((row as Record<string, unknown>)[primaryField], row)
              : String((row as Record<string, unknown>)[primaryField] ?? '')}
          </p>

          {/* Secondary fields */}
          {secondaryFields.map((field) => (
            <div key={field.key} className="flex items-center justify-between text-xs">
              <span className="text-gray-400">{field.label}</span>
              <span className="text-gray-700 dark:text-gray-300 font-medium">
                {field.format
                  ? field.format((row as Record<string, unknown>)[field.key], row)
                  : String((row as Record<string, unknown>)[field.key] ?? '—')}
              </span>
            </div>
          ))}

          {/* Actions */}
          {actions && actions.length > 0 && (
            <div className="flex items-center gap-2 pt-1">
              {actions.map((action) => (
                <button
                  key={action.label}
                  onClick={(e) => {
                    e.stopPropagation()
                    action.onClick(row)
                  }}
                  className={cn(
                    'flex-1 min-h-[44px] rounded-[8px] text-xs font-medium transition-colors',
                    actionVariants[action.variant ?? 'outline']
                  )}
                >
                  {action.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
