import { useState } from 'react'
import { Button } from '@/components/ui'
import { useSubmitFeedback } from '@/api/handbook'

interface FeedbackWidgetProps {
  articleId: string
}

export default function FeedbackWidget({ articleId }: FeedbackWidgetProps) {
  const [submitted, setSubmitted] = useState(false)
  const [showComment, setShowComment] = useState(false)
  const [comment, setComment] = useState('')
  const feedback = useSubmitFeedback()

  const handleFeedback = (isHelpful: boolean) => {
    if (isHelpful) {
      feedback.mutate({ articleId, is_helpful: true }, { onSuccess: () => setSubmitted(true) })
    } else {
      setShowComment(true)
    }
  }

  const handleSubmitComment = () => {
    feedback.mutate(
      { articleId, is_helpful: false, comment: comment || undefined },
      { onSuccess: () => setSubmitted(true) }
    )
  }

  if (submitted) {
    return (
      <div className="rounded-[10px] border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 p-4 text-center">
        <svg className="h-6 w-6 text-success mx-auto mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Thanks for your feedback!</p>
      </div>
    )
  }

  return (
    <div className="rounded-[10px] border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 p-4">
      <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Was this article helpful?</p>
      {!showComment ? (
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleFeedback(true)}
            loading={feedback.isPending}
          >
            <svg className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
            </svg>
            Yes
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleFeedback(false)}
          >
            <svg className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14H5.236a2 2 0 01-1.789-2.894l3.5-7A2 2 0 018.736 3h4.018a2 2 0 01.485.06l3.76.94m-7 10v5a2 2 0 002 2h.096c.5 0 .905-.405.905-.904 0-.715.211-1.413.608-2.008L17 13V4m-7 10h2m5-10h2a2 2 0 012 2v6a2 2 0 01-2 2h-2.5" />
            </svg>
            No
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="How can we improve this article? (optional)"
            className="w-full rounded-[10px] border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3 text-sm focus:border-primary focus:ring-1 focus:ring-primary/40 resize-none"
            rows={3}
          />
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={handleSubmitComment} loading={feedback.isPending}>
              Submit
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setShowComment(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
