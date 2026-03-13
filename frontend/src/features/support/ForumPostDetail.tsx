import { useState } from 'react'
import { Button, Card, Badge, toast } from '../../components/ui'
import {
  useForumPost,
  useCreateForumReply,
  useUpvotePost,
  useMarkBestAnswer,
  type ForumReply,
} from '@/api/support_phase2'

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

interface Props {
  postId: string
}

export default function ForumPostDetail({ postId }: Props) {
  const { data: post, isLoading } = useForumPost(postId)
  const createReply = useCreateForumReply()
  const upvotePost = useUpvotePost()
  const markBestAnswer = useMarkBestAnswer()

  const [replyContent, setReplyContent] = useState('')
  const [upvoted, setUpvoted] = useState(false)

  const replies: ForumReply[] = post?.replies ?? []

  const handleUpvotePost = async () => {
    if (upvoted) return
    try {
      await upvotePost.mutateAsync(postId)
      setUpvoted(true)
      toast('success', 'Upvoted')
    } catch {
      toast('error', 'Failed to upvote')
    }
  }

  const handleMarkBest = async (replyId: string) => {
    try {
      await markBestAnswer.mutateAsync(replyId)
      toast('success', 'Marked as best answer')
    } catch {
      toast('error', 'Failed to mark best answer')
    }
  }

  const handleReply = async () => {
    if (!replyContent.trim()) { toast('error', 'Reply cannot be empty'); return }
    try {
      await createReply.mutateAsync({ postId, content: replyContent })
      toast('success', 'Reply posted')
      setReplyContent('')
    } catch {
      toast('error', 'Failed to post reply')
    }
  }

  if (isLoading) {
    return (
      <div className="p-6 text-center text-gray-400">Loading post...</div>
    )
  }

  if (!post) {
    return (
      <div className="p-6 text-center text-gray-400">Post not found.</div>
    )
  }

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto">
      {/* Back link */}
      <button
        onClick={() => window.history.back()}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-primary transition-colors mb-5"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to Forum
      </button>

      {/* Post */}
      <Card className="mb-5">
        <div className="flex items-start gap-4">
          {/* Upvote column */}
          <div className="flex flex-col items-center gap-1 flex-shrink-0">
            <button
              onClick={handleUpvotePost}
              disabled={upvoted || upvotePost.isPending}
              className={`flex flex-col items-center gap-0.5 rounded-[10px] p-2 transition-colors ${
                upvoted
                  ? 'text-[#51459d] bg-primary/10'
                  : 'text-gray-400 hover:text-primary hover:bg-primary/5'
              }`}
              title={upvoted ? 'Already upvoted' : 'Upvote this post'}
            >
              <svg className="h-5 w-5" fill={upvoted ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
              </svg>
              <span className="text-sm font-bold">{post.upvote_count + (upvoted ? 1 : 0)}</span>
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              {post.is_pinned && <Badge variant="warning">Pinned</Badge>}
              {post.is_locked && <Badge variant="default">Locked</Badge>}
              {post.category_name && <Badge variant="info">{post.category_name}</Badge>}
            </div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-3">{post.title}</h1>
            <p className="text-gray-700 dark:text-gray-300 text-sm whitespace-pre-wrap leading-relaxed">{post.content}</p>
            <div className="flex items-center gap-4 mt-4 pt-4 border-t border-gray-100 dark:border-gray-700 text-xs text-gray-500">
              <span>By <span className="font-medium text-gray-700 dark:text-gray-300">{post.author_name ?? 'Unknown'}</span></span>
              <span>{formatDate(post.created_at)}</span>
              <span>{post.view_count} views</span>
              <span>{post.reply_count} replies</span>
            </div>
          </div>
        </div>
      </Card>

      {/* Replies */}
      <div className="mb-5">
        <h2 className="text-base font-semibold text-gray-800 dark:text-gray-200 mb-3">
          {replies.length} {replies.length === 1 ? 'Reply' : 'Replies'}
        </h2>

        {replies.length === 0 ? (
          <div className="text-center py-8 text-gray-400 text-sm">No replies yet. Be the first to respond!</div>
        ) : (
          <div className="space-y-3">
            {replies.map((reply: ForumReply) => (
              <Card
                key={reply.id}
                className={`${reply.is_best_answer ? 'border-[#6fd943] bg-[#6fd943]/5' : ''}`}
              >
                <div className="flex items-start gap-4">
                  {/* Upvote */}
                  <div className="flex flex-col items-center gap-0.5 flex-shrink-0 text-gray-400">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                    </svg>
                    <span className="text-xs font-medium">{reply.upvote_count}</span>
                  </div>

                  {/* Reply content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      {reply.is_best_answer && (
                        <Badge variant="success">Best Answer</Badge>
                      )}
                      <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{reply.author_name ?? 'Unknown'}</span>
                      <span className="text-xs text-gray-400">{formatDate(reply.created_at)}</span>
                    </div>
                    <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">{reply.content}</p>

                    {/* Actions */}
                    {!reply.is_best_answer && (
                      <div className="mt-3 flex gap-2">
                        <button
                          onClick={() => handleMarkBest(reply.id)}
                          className="text-xs text-gray-400 hover:text-[#6fd943] transition-colors flex items-center gap-1"
                        >
                          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          Mark Best Answer
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Reply Form */}
      {!post.is_locked ? (
        <Card>
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Post a Reply</h3>
          <textarea
            className="w-full rounded-[10px] border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary min-h-[100px] mb-3"
            value={replyContent}
            onChange={(e) => setReplyContent(e.target.value)}
            placeholder="Write your reply here..."
          />
          <div className="flex justify-end">
            <Button onClick={handleReply} loading={createReply.isPending}>Post Reply</Button>
          </div>
        </Card>
      ) : (
        <Card>
          <p className="text-sm text-gray-500 text-center py-2">This post is locked. No new replies allowed.</p>
        </Card>
      )}
    </div>
  )
}
