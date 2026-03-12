/**
 * Annotations Panel — internal team comments on email messages.
 * Comments are invisible to the email sender, visible only to team members.
 */
import { useState } from 'react'
import { useMessageAnnotations, useCreateAnnotation, useDeleteAnnotation } from '../../api/mail'

interface AnnotationsPanelProps {
  messageId: string
}

export default function AnnotationsPanel({ messageId }: AnnotationsPanelProps) {
  const [content, setContent] = useState('')
  const { data, isLoading } = useMessageAnnotations(messageId)
  const createAnnotation = useCreateAnnotation()
  const deleteAnnotation = useDeleteAnnotation()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!content.trim()) return
    createAnnotation.mutate({ messageId, content: content.trim() }, {
      onSuccess: () => setContent(''),
    })
  }

  return (
    <div className="border-t border-gray-200 dark:border-gray-700 bg-amber-50/50 dark:bg-amber-900/10">
      <div className="px-4 py-2 flex items-center gap-2">
        <svg className="w-3.5 h-3.5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
        </svg>
        <span className="text-xs font-semibold text-amber-700 dark:text-amber-400">
          Internal Notes ({data?.total ?? 0})
        </span>
      </div>

      {/* Existing annotations */}
      {!isLoading && data?.annotations && data.annotations.length > 0 && (
        <div className="px-4 pb-2 space-y-2">
          {data.annotations.map((a) => (
            <div key={a.id} className="flex items-start gap-2 group">
              <div className="w-5 h-5 rounded-full bg-amber-200 dark:bg-amber-800 flex items-center justify-center text-[10px] font-bold text-amber-700 dark:text-amber-300 mt-0.5">
                N
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-gray-700 dark:text-gray-300">{a.content}</p>
                <p className="text-[10px] text-gray-400 mt-0.5">
                  {a.created_at ? new Date(a.created_at).toLocaleString() : ''}
                </p>
              </div>
              <button
                onClick={() => deleteAnnotation.mutate(a.id)}
                className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-[#ff3a6e] p-0.5 transition"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add annotation form */}
      <form onSubmit={handleSubmit} className="px-4 pb-3 flex gap-2">
        <input
          type="text"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Add internal note..."
          className="flex-1 px-3 py-1.5 text-xs border border-amber-200 dark:border-amber-700 rounded-lg bg-white dark:bg-gray-800 focus:ring-1 focus:ring-amber-400"
        />
        <button
          type="submit"
          disabled={createAnnotation.isPending || !content.trim()}
          className="px-3 py-1.5 text-xs bg-amber-500 text-white rounded-lg hover:bg-amber-600 disabled:opacity-50 transition"
        >
          Add
        </button>
      </form>
    </div>
  )
}
