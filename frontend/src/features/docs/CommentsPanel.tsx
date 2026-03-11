import { useState } from 'react'
import { Button, Spinner, Badge, toast } from '../../components/ui'
import { useDocCommentsExt, useCreateCommentExt, useResolveComment } from '../../api/docs_ext'
import type { DocComment } from '../../api/docs'

interface Props {
  fileId: string
  onClose?: () => void
}

export default function CommentsPanel({ fileId, onClose }: Props) {
  const { data: comments, isLoading } = useDocCommentsExt(fileId)
  const createComment = useCreateCommentExt(fileId)
  const resolveComment = useResolveComment(fileId)
  const [newComment, setNewComment] = useState('')
  const [replyTo, setReplyTo] = useState<string | null>(null)

  const handleSubmit = () => {
    if (!newComment.trim()) return
    createComment.mutate(
      { content: newComment, parent_id: replyTo ?? undefined },
      {
        onSuccess: () => {
          toast('success', replyTo ? 'Reply added' : 'Comment added')
          setNewComment('')
          setReplyTo(null)
        },
        onError: () => toast('error', 'Failed to add comment'),
      }
    )
  }

  const handleResolve = (commentId: string) => {
    resolveComment.mutate(commentId, {
      onSuccess: () => toast('success', 'Comment resolved'),
      onError: () => toast('error', 'Failed to resolve comment'),
    })
  }

  const topLevelComments = (comments ?? []).filter((c) => !c.parent_id)

  return (
    <div className="w-80 border-l border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-800 h-full flex flex-col">
      <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-gray-800 shrink-0">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Comments</h3>
        {onClose && (
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {isLoading ? (
          <div className="flex items-center justify-center py-12"><Spinner /></div>
        ) : topLevelComments.length === 0 ? (
          <div className="text-center py-8 text-sm text-gray-400">No comments yet. Be the first to comment.</div>
        ) : (
          topLevelComments.map((comment) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              onResolve={handleResolve}
              onReply={(id) => { setReplyTo(id); setNewComment('') }}
              isResolving={resolveComment.isPending}
            />
          ))
        )}
      </div>

      {/* New comment input */}
      <div className="p-3 border-t border-gray-100 dark:border-gray-800 shrink-0">
        {replyTo && (
          <div className="flex items-center justify-between mb-2 text-xs text-gray-500">
            <span>Replying to comment</span>
            <button onClick={() => setReplyTo(null)} className="text-gray-400 hover:text-gray-600">Cancel</button>
          </div>
        )}
        <div className="flex gap-2">
          <textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder={replyTo ? 'Write a reply...' : 'Add a comment...'}
            className="flex-1 rounded-[10px] border border-gray-200 dark:border-gray-700 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            rows={2}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSubmit()
            }}
          />
        </div>
        <div className="flex justify-end mt-2">
          <Button size="sm" onClick={handleSubmit} loading={createComment.isPending} disabled={!newComment.trim()}>
            {replyTo ? 'Reply' : 'Comment'}
          </Button>
        </div>
      </div>
    </div>
  )
}

function CommentItem({
  comment,
  onResolve,
  onReply,
  isResolving,
}: {
  comment: DocComment
  onResolve: (id: string) => void
  onReply: (id: string) => void
  isResolving: boolean
}) {
  return (
    <div className={`rounded-lg p-3 ${comment.resolved ? 'bg-gray-50 dark:bg-gray-950 opacity-60' : 'bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-800'}`}>
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0">
            {comment.author_name?.charAt(0)?.toUpperCase() ?? '?'}
          </div>
          <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">{comment.author_name}</span>
        </div>
        <span className="text-xs text-gray-400">
          {new Date(comment.created_at).toLocaleDateString()}
        </span>
      </div>
      <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">{comment.content}</p>
      {comment.resolved && <Badge variant="success" className="mt-2">Resolved</Badge>}
      <div className="flex items-center gap-2 mt-2">
        {!comment.resolved && (
          <button
            onClick={() => onResolve(comment.id)}
            disabled={isResolving}
            className="text-xs text-gray-400 hover:text-green-600"
          >
            Resolve
          </button>
        )}
        <button
          onClick={() => onReply(comment.id)}
          className="text-xs text-gray-400 hover:text-primary"
        >
          Reply
        </button>
      </div>
      {/* Replies */}
      {comment.replies && comment.replies.length > 0 && (
        <div className="mt-2 ml-4 space-y-2 border-l-2 border-gray-100 dark:border-gray-800 pl-3">
          {comment.replies.map((reply) => (
            <div key={reply.id} className="text-sm">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-semibold text-gray-600 dark:text-gray-400">{reply.author_name}</span>
                <span className="text-xs text-gray-400">{new Date(reply.created_at).toLocaleDateString()}</span>
              </div>
              <p className="text-gray-500 mt-0.5">{reply.content}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
