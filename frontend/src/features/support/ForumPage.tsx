import { useState } from 'react'
import { Button, Card, Badge, Modal, Input, toast } from '../../components/ui'
import {
  useForumCategories,
  useForumPosts,
  useCreateForumPost,
  type ForumCategory,
  type ForumPost,
} from '@/api/support_phase2'

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function ForumPage() {
  const { data: categories, isLoading: loadingCats } = useForumCategories()
  const [activeCategoryId, setActiveCategoryId] = useState<string | undefined>(undefined)
  const [page, setPage] = useState(1)
  const { data: postsData, isLoading: loadingPosts } = useForumPosts(activeCategoryId, page)
  const createPost = useCreateForumPost()

  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({ category_id: '', title: '', content: '' })

  const posts: ForumPost[] = postsData?.posts ?? postsData ?? []

  const handleCreatePost = async () => {
    if (!form.title.trim()) { toast('error', 'Title is required'); return }
    if (!form.content.trim()) { toast('error', 'Content is required'); return }
    if (!form.category_id) { toast('error', 'Please select a category'); return }
    try {
      await createPost.mutateAsync(form)
      toast('success', 'Post created')
      setShowCreate(false)
      setForm({ category_id: '', title: '', content: '' })
    } catch {
      toast('error', 'Failed to create post')
    }
  }

  return (
    <div className="p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100">Community Forum</h1>
          <p className="text-sm text-gray-500 mt-0.5">Ask questions and share knowledge</p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Post
        </Button>
      </div>

      <div className="flex flex-col md:flex-row gap-5">
        {/* Left Sidebar — Categories */}
        <aside className="w-full md:w-56 flex-shrink-0">
          <Card padding={false}>
            <div className="p-3 border-b border-gray-100 dark:border-gray-700">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Categories</p>
            </div>
            {loadingCats ? (
              <div className="p-4 text-sm text-gray-400">Loading...</div>
            ) : (
              <ul className="py-1">
                <li>
                  <button
                    onClick={() => { setActiveCategoryId(undefined); setPage(1) }}
                    className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                      activeCategoryId === undefined
                        ? 'bg-primary/10 text-primary font-medium'
                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
                    }`}
                  >
                    All Categories
                  </button>
                </li>
                {(categories ?? []).map((cat: ForumCategory) => (
                  <li key={cat.id}>
                    <button
                      onClick={() => { setActiveCategoryId(cat.id); setPage(1) }}
                      className={`w-full text-left px-4 py-2.5 text-sm transition-colors flex items-center justify-between gap-2 ${
                        activeCategoryId === cat.id
                          ? 'bg-primary/10 text-primary font-medium'
                          : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
                      }`}
                    >
                      <span className="truncate">{cat.name}</span>
                      <span className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-500 rounded-full px-1.5 py-0.5 flex-shrink-0">
                        {cat.post_count}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </aside>

        {/* Main — Posts */}
        <div className="flex-1 min-w-0">
          {loadingPosts ? (
            <div className="text-center py-16 text-gray-400">Loading posts...</div>
          ) : posts.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <svg className="mx-auto h-12 w-12 mb-3 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              No posts yet. Be the first to start a discussion!
            </div>
          ) : (
            <div className="space-y-3">
              {posts.map((post: ForumPost) => (
                <Card key={post.id} className="hover:border-primary/30 transition-colors cursor-pointer">
                  <div className="flex items-start gap-4">
                    {/* Vote count */}
                    <div className="flex flex-col items-center gap-0.5 flex-shrink-0 min-w-[36px]">
                      <span className="text-lg font-bold text-gray-700 dark:text-gray-200">{post.upvote_count}</span>
                      <span className="text-[10px] text-gray-400 uppercase tracking-wide">votes</span>
                    </div>

                    {/* Post info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        {post.is_pinned && <Badge variant="warning">Pinned</Badge>}
                        {post.is_locked && <Badge variant="default">Locked</Badge>}
                        {post.category_name && <Badge variant="info">{post.category_name}</Badge>}
                      </div>
                      <p className="font-semibold text-gray-900 dark:text-gray-100 hover:text-primary transition-colors">
                        {post.title}
                      </p>
                      <p className="text-xs text-gray-500 mt-1 line-clamp-2">{post.content}</p>
                    </div>

                    {/* Metadata */}
                    <div className="flex-shrink-0 text-right hidden sm:block">
                      <p className="text-xs text-gray-500">{post.author_name ?? 'Unknown'}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{formatDate(post.created_at)}</p>
                      <div className="flex items-center justify-end gap-3 mt-2 text-xs text-gray-400">
                        <span className="flex items-center gap-1">
                          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                          {post.view_count}
                        </span>
                        <span className="flex items-center gap-1">
                          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                          </svg>
                          {post.reply_count}
                        </span>
                      </div>
                    </div>
                  </div>
                </Card>
              ))}

              {/* Pagination */}
              <div className="flex justify-center gap-3 pt-4">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                  Previous
                </Button>
                <span className="flex items-center text-sm text-gray-500">Page {page}</span>
                <Button variant="outline" size="sm" disabled={posts.length < 20} onClick={() => setPage(page + 1)}>
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Create Post Modal */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="New Forum Post" size="lg">
        <div className="space-y-4">
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Category</label>
            <select
              className="w-full rounded-[10px] border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/30"
              value={form.category_id}
              onChange={(e) => setForm({ ...form, category_id: e.target.value })}
            >
              <option value="">Select category...</option>
              {(categories ?? []).map((c: ForumCategory) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <Input
            label="Title"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="Descriptive title for your post"
          />
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Content</label>
            <textarea
              className="w-full rounded-[10px] border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 min-h-[140px]"
              value={form.content}
              onChange={(e) => setForm({ ...form, content: e.target.value })}
              placeholder="Describe your question or topic in detail..."
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button onClick={handleCreatePost} loading={createPost.isPending}>Post</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
