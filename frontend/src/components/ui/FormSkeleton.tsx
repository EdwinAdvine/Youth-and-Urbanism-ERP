/**
 * FormSkeleton — animated placeholder for detail/edit forms while loading.
 *
 * Usage:
 *   if (isLoading) return <FormSkeleton fields={6} />
 */

interface FormSkeletonProps {
  /** Number of form fields to simulate (default: 6) */
  fields?: number
  /** Show action buttons skeleton (default: true) */
  showActions?: boolean
}

export function FormSkeleton({ fields = 6, showActions = true }: FormSkeletonProps) {
  return (
    <div className="p-6 space-y-5 animate-pulse max-w-2xl">
      {/* Title */}
      <div className="h-7 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-6" />

      {/* Fields */}
      {Array.from({ length: fields }).map((_, i) => (
        <div key={i} className="space-y-1.5">
          {/* Label */}
          <div className="h-3.5 bg-gray-200 dark:bg-gray-700 rounded w-24" />
          {/* Input */}
          <div className="h-10 bg-gray-100 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700" />
        </div>
      ))}

      {/* Action buttons */}
      {showActions && (
        <div className="flex gap-3 pt-4">
          <div className="h-10 w-28 bg-gray-200 dark:bg-gray-700 rounded-lg" />
          <div className="h-10 w-20 bg-gray-100 dark:bg-gray-800 rounded-lg" />
        </div>
      )}
    </div>
  )
}
