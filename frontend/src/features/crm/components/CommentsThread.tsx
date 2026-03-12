import { useState } from 'react'
import {
  useComments,
  useCreateComment,
  useUpdateComment,
  useDeleteComment,
  type CRMComment,
} from '@/api/crm_collaboration'
import { Button, Badge, Spinner, toast } from '@/components/ui'
import { MentionsInput } from './MentionsInput'

interface CommentsThreadProps {
  entityType: string
  entityId: string
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleString()
}

function CommentItem({
  comment,
  children,
  currentUserId,
  onReply,
  onEdit,
  onDelete,
  depth,
}: {
  comment: CRMComment
  children: CRMComment[]
  currentUserId: string
  onReply: (parentId: string) => void
  onEdit: (comment: CRMComment) => void
  onDelete: (id: string) => void
  depth: number
}) {
  const isOwn = comment.author_id === currentUserId

  return (
    <div className={depth > 0 ? 'ml-6 border-l-2 border-gray-200 dark:border-gray-700 pl-4' : ''}>
      <div className="py-3">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
            {comment.author_id.slice(0, 8)}
          </span>
          <span className="text-xs text-gray-400">{formatDate(comment.created_at)}</span>
          {comment.is_edited && (
            <Badge variant="default">edited</Badge>
          )}
        </div>

        {/* Render content with @mention highlighting */}
        <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
          {comment.content.split(/(@\w+)/g).map((part, i) =>
            part.startsWith('@') ? (
              <span key={i} className="text-[#51459d] font-medium">
                {part}
              </span>
            ) : (
              <span key={i}>{part}</span>
            )
          )}
        </p>

        <div className="flex items-center gap-3 mt-2">
          <button
            className="text-xs text-[#51459d] hover:underline"
            onClick={() => onReply(comment.id)}
          >
            Reply
          </button>
          {isOwn && (
            <>
              <button
                className="text-xs text-gray-500 hover:underline"
                onClick={() => onEdit(comment)}
              >
                Edit
              </button>
              <button
                className="text-xs text-[#ff3a6e] hover:underline"
                onClick={() => onDelete(comment.id)}
              >
                Delete
              </button>
            </>
          )}
        </div>
      </div>

      {/* Render children (replies) */}
      {children.map((child) => (
        <CommentItem
          key={child.id}
          comment={child}
          children={[]}
          currentUserId={currentUserId}
          onReply={onReply}
          onEdit={onEdit}
          onDelete={onDelete}
          depth={depth + 1}
        />
      ))}
    </div>
  )
}

export default function CommentsThread({ entityType, entityId }: CommentsThreadProps) {
  const { data: commentsData, isLoading } = useComments({ entity_type: entityType, entity_id: entityId })
  const createComment = useCreateComment()
  const updateComment = useUpdateComment()
  const deleteComment = useDeleteComment()

  const [newContent, setNewContent] = useState('')
  const [replyToId, setReplyToId] = useState<string | null>(null)
  const [editingComment, setEditingComment] = useState<CRMComment | null>(null)
  const [editContent, setEditContent] = useState('')

  const comments: CRMComment[] = commentsData?.items ?? commentsData ?? []

  // TODO: get from auth store
  const currentUserId = 'current-user'

  // Build tree: top-level + children
  const topLevel = comments.filter((c) => !c.parent_id)
  const childrenMap: Record<string, CRMComment[]> = {}
  for (const c of comments) {
    if (c.parent_id) {
      if (!childrenMap[c.parent_id]) childrenMap[c.parent_id] = []
      childrenMap[c.parent_id].push(c)
    }
  }

  async function handlePost() {
    if (!newContent.trim()) return
    try {
      await createComment.mutateAsync({
        entity_type: entityType,
        entity_id: entityId,
        content: newContent,
        parent_id: replyToId,
      })
      setNewContent('')
      setReplyToId(null)
      toast('success', 'Comment posted')
    } catch {
      toast('error', 'Failed to post comment')
    }
  }

  function startEdit(comment: CRMComment) {
    setEditingComment(comment)
    setEditContent(comment.content)
  }

  async function handleUpdate() {
    if (!editingComment || !editContent.trim()) return
    try {
      await updateComment.mutateAsync({ id: editingComment.id, content: editContent })
      setEditingComment(null)
      setEditContent('')
      toast('success', 'Comment updated')
    } catch {
      toast('error', 'Failed to update comment')
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this comment?')) return
    try {
      await deleteComment.mutateAsync(id)
      toast('success', 'Comment deleted')
    } catch {
      toast('error', 'Failed to delete comment')
    }
  }

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 uppercase tracking-wide">
        Comments
      </h3>

      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Spinner />
        </div>
      ) : comments.length === 0 ? (
        <p className="text-sm text-gray-400 py-4">No comments yet. Be the first to comment.</p>
      ) : (
        <div className="divide-y divide-gray-100 dark:divide-gray-700">
          {topLevel.map((comment) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              children={childrenMap[comment.id] ?? []}
              currentUserId={currentUserId}
              onReply={(parentId) => setReplyToId(parentId)}
              onEdit={startEdit}
              onDelete={handleDelete}
              depth={0}
            />
          ))}
        </div>
      )}

      {/* Edit Modal (inline) */}
      {editingComment && (
        <div className="border border-[#3ec9d6] rounded-[10px] p-3 bg-[#3ec9d6]/5">
          <p className="text-xs text-[#3ec9d6] font-medium mb-2">Editing comment</p>
          <MentionsInput
            value={editContent}
            onChange={setEditContent}
            placeholder="Update your comment..."
          />
          <div className="flex items-center gap-2 mt-2">
            <Button size="sm" onClick={handleUpdate} loading={updateComment.isPending}>
              Save
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setEditingComment(null)}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* New Comment / Reply */}
      <div className="border border-gray-200 dark:border-gray-700 rounded-[10px] p-3">
        {replyToId && (
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs text-[#51459d] font-medium">
              Replying to comment {replyToId.slice(0, 8)}...
            </span>
            <button
              className="text-xs text-gray-400 hover:text-gray-600"
              onClick={() => setReplyToId(null)}
            >
              Cancel reply
            </button>
          </div>
        )}
        <MentionsInput
          value={newContent}
          onChange={setNewContent}
          placeholder={replyToId ? 'Write a reply...' : 'Write a comment... Use @username to mention someone'}
        />
        <div className="flex justify-end mt-2">
          <Button
            size="sm"
            onClick={handlePost}
            loading={createComment.isPending}
            disabled={!newContent.trim()}
          >
            {replyToId ? 'Reply' : 'Post Comment'}
          </Button>
        </div>
      </div>
    </div>
  )
}
