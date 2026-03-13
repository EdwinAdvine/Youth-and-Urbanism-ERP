import { cn } from './index'

interface SkeletonProps {
  className?: string
  variant?: 'text' | 'circular' | 'rectangular'
  width?: string | number
  height?: string | number
  /** Renders multiple skeleton lines with decreasing widths */
  count?: number
}

export default function Skeleton({
  className,
  variant = 'text',
  width,
  height,
  count,
}: SkeletonProps) {
  const baseClass = 'animate-pulse bg-gray-200 dark:bg-gray-700'

  const variantClass = {
    text: 'rounded-md h-4',
    circular: 'rounded-full',
    rectangular: 'rounded-[10px]',
  }[variant]

  const style: React.CSSProperties = {
    width: typeof width === 'number' ? `${width}px` : width,
    height: typeof height === 'number' ? `${height}px` : height,
  }

  if (count && count > 1) {
    const widths = ['100%', '90%', '80%', '70%', '60%']
    return (
      <div className="space-y-2">
        {Array.from({ length: count }, (_, i) => (
          <div
            key={i}
            className={cn(baseClass, variantClass, className)}
            style={{ ...style, width: widths[i % widths.length] }}
          />
        ))}
      </div>
    )
  }

  return (
    <div
      className={cn(baseClass, variantClass, className)}
      style={style}
    />
  )
}

/* ── Preset skeleton patterns ───────────────────────────────────────── */

export function SkeletonCard() {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-[10px] border border-gray-100 dark:border-gray-700 p-6 space-y-4">
      <Skeleton variant="text" width="60%" />
      <Skeleton variant="text" count={3} />
    </div>
  )
}

export function SkeletonTable({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      <Skeleton variant="rectangular" height={40} />
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} variant="rectangular" height={48} />
      ))}
    </div>
  )
}

export function SkeletonAvatar({ size = 40 }: { size?: number }) {
  return <Skeleton variant="circular" width={size} height={size} />
}
