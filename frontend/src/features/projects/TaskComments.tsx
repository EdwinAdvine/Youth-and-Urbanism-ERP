import { useState } from 'react'
import { useTaskComments, useCreateComment, useDeleteComment, type TaskCommentData } from '@/api/projects_enhanced'

interface TaskCommentsProps {
  projectId: string
  taskId: string
}

function CommentItem({
  comment,
  projectId,
  taskId,
  currentUserId,
  onReply,
}: {
  comment: TaskCommentData
  projectId: string
  taskId: string
  currentUserId?: string
  onReply: (parentId: string) => void
}) {
  const deleteComment = useDeleteComment()

  return (
    <div className="space-y-2">
      <div className="flex gap-3">
        <div className="w-8 h-8 rounded-full bg-[#51459d]/10 flex items-center justify-center text-xs font-medium text-[#51459d] shrink-0">
          {comment.author_id.slice(0, 2).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-700">
              {comment.author_id.slice(0, 8)}...
            </span>
            <span className="text-xs text-gray-400">
              {new Date(comment.created_at).toLocaleString()}
            </span>
            {comment.is_edited && (
              <span className="text-xs text-gray-400 italic">(edited)</span>
            )}
          </div>
          <p className="text-sm text-gray-600 mt-1 whitespace-pre-wrap">{comment.content}</p>
          <div className="flex items-center gap-3 mt-1">
            <button
              onClick={() => onReply(comment.id)}
              className="text-xs text-[#51459d] hover:text-[#51459d]/80"
            >
              Reply
            </button>
            {currentUserId === comment.author_id && (
              <button
                onClick={() => deleteComment.mutate({ project_id: projectId, task_id: taskId, comment_id: comment.id })}
                className="text-xs text-gray-400 hover:text-red-500"
              >
                Delete
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Replies */}
      {comment.replies && comment.replies.length > 0 && (
        <div className="ml-10 space-y-2 border-l-2 border-gray-100 pl-3">
          {comment.replies.map((reply) => (
            <CommentItem
              key={reply.id}
              comment={reply}
              projectId={projectId}
              taskId={taskId}
              currentUserId={currentUserId}
              onReply={onReply}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export default function TaskComments({ projectId, taskId }: TaskCommentsProps) {
  const { data, isLoading } = useTaskComments(projectId, taskId)
  const createComment = useCreateComment()
  const [content, setContent] = useState('')
  const [replyTo, setReplyTo] = useState<string | null>(null)

  const handleSubmit = () => {
    if (!content.trim()) return
    createComment.mutate(
      {
        project_id: projectId,
        task_id: taskId,
        content: content.trim(),
        parent_id: replyTo || undefined,
      },
      {
        onSuccess: () => {
          setContent('')
          setReplyTo(null)
        },
      }
    )
  }

  if (isLoading) {
    return <div className="text-sm text-gray-400 py-2">Loading comments...</div>
  }

  const comments = data?.comments || []

  return (
    <div className="space-y-4">
      {comments.length === 0 && (
        <p className="text-sm text-gray-400 text-center py-4">No comments yet</p>
      )}

      <div className="space-y-4">
        {comments.map((c) => (
          <CommentItem
            key={c.id}
            comment={c}
            projectId={projectId}
            taskId={taskId}
            onReply={setReplyTo}
          />
        ))}
      </div>

      {/* Comment input */}
      <div className="space-y-2">
        {replyTo && (
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <span>Replying to comment</span>
            <button onClick={() => setReplyTo(null)} className="text-red-400 hover:text-red-500">
              Cancel
            </button>
          </div>
        )}
        <div className="flex gap-2">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSubmit()
            }}
            placeholder="Write a comment... (Cmd+Enter to submit, use @[user-id] to mention)"
            className="flex-1 text-sm border border-gray-300 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-[#51459d]/30"
            rows={2}
          />
          <button
            onClick={handleSubmit}
            disabled={createComment.isPending || !content.trim()}
            className="self-end px-4 py-2 bg-[#51459d] text-white text-sm rounded-lg hover:bg-[#51459d]/90 disabled:opacity-50"
          >
            Post
          </button>
        </div>
      </div>
    </div>
  )
}
