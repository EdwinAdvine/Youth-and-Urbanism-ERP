import { useState } from 'react'
import { useNoteComments, useCreateComment, useResolveComment, useDeleteComment, type NoteComment } from '../../../api/noteCollab'

function CommentThread({ comment, allComments, noteId, onReply }: {
  comment: NoteComment
  allComments: NoteComment[]
  noteId: string
  onReply: (parentId: string) => void
}) {
  const replies = allComments.filter(c => c.parent_comment_id === comment.id)
  const resolve = useResolveComment(noteId)
  const del = useDeleteComment(noteId)

  return (
    <div className="border border-gray-100 dark:border-gray-700 rounded-[10px] p-3 mb-2">
      {/* Anchor context */}
      {comment.anchor_text && (
        <div className="text-[10px] text-gray-400 bg-gray-50 dark:bg-gray-800 rounded px-2 py-1 mb-2 border-l-2 border-[#51459d] truncate">
          "{comment.anchor_text}"
        </div>
      )}

      {/* Author + time */}
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1.5">
          <div className="w-5 h-5 rounded-full bg-[#51459d] flex items-center justify-center text-[8px] text-white font-bold">
            {comment.author_name.slice(0, 2).toUpperCase()}
          </div>
          <span className="text-[11px] font-medium text-gray-700 dark:text-gray-300">{comment.author_name}</span>
        </div>
        <span className="text-[10px] text-gray-400">{new Date(comment.created_at).toLocaleDateString('en-KE', { day: 'numeric', month: 'short' })}</span>
      </div>

      {/* Content */}
      <p className="text-[12px] text-gray-700 dark:text-gray-300 mb-2 leading-relaxed">{comment.content}</p>

      {/* Actions */}
      {!comment.is_resolved && (
        <div className="flex items-center gap-2">
          <button onClick={() => onReply(comment.id)} className="text-[10px] text-[#51459d] hover:underline">Reply</button>
          <button onClick={() => resolve.mutate(comment.id)} className="text-[10px] text-gray-400 hover:text-green-600">Resolve</button>
          <button onClick={() => del.mutate(comment.id)} className="text-[10px] text-gray-400 hover:text-red-500">Delete</button>
        </div>
      )}
      {comment.is_resolved && (
        <span className="text-[9px] px-1.5 py-0.5 bg-green-50 text-green-600 rounded-full">Resolved</span>
      )}

      {/* Replies */}
      {replies.length > 0 && (
        <div className="mt-2 ml-3 border-l-2 border-gray-100 dark:border-gray-700 pl-2 space-y-2">
          {replies.map(r => (
            <div key={r.id} className="text-[11px]">
              <span className="font-medium text-gray-700 dark:text-gray-300 mr-1">{r.author_name}:</span>
              <span className="text-gray-600 dark:text-gray-400">{r.content}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function CommentsSidebar({ noteId, onClose }: { noteId: string; onClose: () => void }) {
  const { data: comments = [], isLoading } = useNoteComments(noteId)
  const createComment = useCreateComment(noteId)
  const [replyTo, setReplyTo] = useState<string | null>(null)
  const [text, setText] = useState('')
  const [showResolved, setShowResolved] = useState(false)

  const rootComments = comments.filter(c => !c.parent_comment_id)
  const visibleComments = showResolved ? rootComments : rootComments.filter(c => !c.is_resolved)

  const handleSubmit = async () => {
    if (!text.trim()) return
    await createComment.mutateAsync({
      content: text.trim(),
      parent_comment_id: replyTo ?? undefined,
    })
    setText('')
    setReplyTo(null)
  }

  return (
    <div className="w-80 border-l border-gray-100 dark:border-gray-800 flex flex-col bg-white dark:bg-gray-900 h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800 shrink-0">
        <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">Comments</h3>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowResolved(!showResolved)}
            className={`text-[10px] px-2 py-0.5 rounded-full transition-colors ${showResolved ? 'bg-green-100 text-green-700' : 'text-gray-400 hover:text-gray-600'}`}
          >
            {showResolved ? 'Hide resolved' : 'Show resolved'}
          </button>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Comments list */}
      <div className="flex-1 overflow-y-auto p-3">
        {isLoading ? (
          <div className="flex justify-center py-8">
            <svg className="animate-spin h-5 w-5 text-[#51459d]" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
        ) : visibleComments.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-2xl mb-2">💬</div>
            <p className="text-sm text-gray-400">No comments yet</p>
            <p className="text-[11px] text-gray-300 mt-1">Add a comment below</p>
          </div>
        ) : (
          visibleComments.map(c => (
            <CommentThread
              key={c.id}
              comment={c}
              allComments={comments}
              noteId={noteId}
              onReply={(id) => setReplyTo(id)}
            />
          ))
        )}
      </div>

      {/* New comment input */}
      <div className="shrink-0 border-t border-gray-100 dark:border-gray-800 p-3">
        {replyTo && (
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] text-gray-500">Replying to comment</span>
            <button onClick={() => setReplyTo(null)} className="text-[10px] text-gray-400 hover:text-gray-600">Cancel</button>
          </div>
        )}
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleSubmit()
          }}
          placeholder="Add a comment... (Ctrl+Enter to submit)"
          rows={2}
          className="w-full text-[12px] px-2.5 py-2 border border-gray-200 dark:border-gray-700 rounded-[8px] focus:outline-none focus:border-[#51459d] bg-transparent resize-none"
        />
        <button
          onClick={handleSubmit}
          disabled={!text.trim() || createComment.isPending}
          className="mt-1.5 w-full py-1.5 text-[12px] bg-[#51459d] text-white rounded-[8px] hover:bg-[#3d3480] disabled:opacity-50 transition-colors"
        >
          {createComment.isPending ? 'Adding...' : 'Add Comment'}
        </button>
      </div>
    </div>
  )
}
