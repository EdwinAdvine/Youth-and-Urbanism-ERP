import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import { Button, Card, Badge, Input, Select, Modal, toast } from '../../components/ui'

// ─── Types ───────────────────────────────────────────────────────────────────

type PostStatus = 'draft' | 'published'

interface BlogPost {
  id: string
  title: string
  slug: string
  status: PostStatus
  published_at: string | null
  view_count: number
  author_name: string
  tags: string[]
}

interface BlogPostsResponse {
  items: BlogPost[]
  total: number
  page: number
  pages: number
}

// ─── API ─────────────────────────────────────────────────────────────────────

const fetchBlogPosts = (params: { page: number; status: string; search: string }): Promise<BlogPostsResponse> =>
  axios.get('/api/v1/ecommerce/blog', { params }).then((r) => r.data)

const deleteBlogPost = (id: string): Promise<void> =>
  axios.delete(`/api/v1/ecommerce/blog/${id}`).then((r) => r.data)

const bulkDeletePosts = (ids: string[]): Promise<void> =>
  axios.post('/api/v1/ecommerce/blog/bulk-delete', { ids }).then((r) => r.data)

const publishPost = (id: string): Promise<BlogPost> =>
  axios.post(`/api/v1/ecommerce/blog/${id}/publish`).then((r) => r.data)

// ─── Component ───────────────────────────────────────────────────────────────

export default function BlogAdminPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()

  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState<'' | PostStatus>('')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [deleteTarget, setDeleteTarget] = useState<BlogPost | null>(null)
  const [bulkConfirm, setBulkConfirm] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['blog-posts', page, statusFilter, search],
    queryFn: () => fetchBlogPosts({ page, status: statusFilter, search }),
    placeholderData: (prev) => prev,
  })

  const posts = data?.items ?? []
  const allSelected = posts.length > 0 && posts.every((p) => selected.has(p.id))

  const deleteMutation = useMutation({
    mutationFn: deleteBlogPost,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['blog-posts'] })
      setDeleteTarget(null)
      toast('success', 'Post deleted.')
    },
    onError: () => toast('error', 'Failed to delete post.'),
  })

  const bulkDeleteMutation = useMutation({
    mutationFn: bulkDeletePosts,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['blog-posts'] })
      setSelected(new Set())
      setBulkConfirm(false)
      toast('success', 'Selected posts deleted.')
    },
    onError: () => toast('error', 'Bulk delete failed.'),
  })

  const publishMutation = useMutation({
    mutationFn: publishPost,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['blog-posts'] })
      toast('success', 'Post published.')
    },
    onError: () => toast('error', 'Failed to publish post.'),
  })

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleAll() {
    if (allSelected) {
      setSelected(new Set())
    } else {
      setSelected(new Set(posts.map((p) => p.id)))
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Blog Posts</h1>
          <p className="text-sm text-gray-500 mt-1">Manage your storefront blog content</p>
        </div>
        <Button onClick={() => navigate('/ecommerce/blog/new')}>+ New Post</Button>
      </div>

      {/* Filters */}
      <Card>
        <div className="flex flex-wrap items-end gap-4">
          <Input
            label="Search"
            placeholder="Search posts..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            className="w-60"
          />
          <Select
            label="Status"
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value as typeof statusFilter); setPage(1) }}
            options={[
              { value: '', label: 'All statuses' },
              { value: 'draft', label: 'Draft' },
              { value: 'published', label: 'Published' },
            ]}
            className="w-40"
          />
          {selected.size > 0 && (
            <Button variant="danger" onClick={() => setBulkConfirm(true)}>
              Delete {selected.size} selected
            </Button>
          )}
        </div>
      </Card>

      {/* Table */}
      <Card padding={false}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="px-4 py-3 w-8">
                  <input type="checkbox" checked={allSelected} onChange={toggleAll} className="rounded" />
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Title</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Published</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Views</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Author</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Tags</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="text-center py-12">
                    <div className="flex justify-center">
                      <svg className="animate-spin h-6 w-6 text-primary" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                      </svg>
                    </div>
                  </td>
                </tr>
              ) : posts.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-gray-400">No posts found</td>
                </tr>
              ) : (
                posts.map((post) => (
                  <tr key={post.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <input type="checkbox" checked={selected.has(post.id)} onChange={() => toggleSelect(post.id)} className="rounded" />
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium text-gray-900 truncate max-w-[280px]">{post.title}</p>
                        <p className="text-xs text-gray-400">{post.slug}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={post.status === 'published' ? 'success' : 'default'} className="capitalize">
                        {post.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {post.published_at ? new Date(post.published_at).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-gray-600">
                      {post.view_count.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{post.author_name}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {post.tags.slice(0, 3).map((tag) => (
                          <Badge key={tag} variant="primary">{tag}</Badge>
                        ))}
                        {post.tags.length > 3 && (
                          <span className="text-xs text-gray-400">+{post.tags.length - 3}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 justify-end">
                        <Button size="sm" variant="ghost" onClick={() => navigate(`/ecommerce/blog/${post.id}/edit`)}>Edit</Button>
                        {post.status === 'draft' && (
                          <Button size="sm" variant="outline" loading={publishMutation.isPending} onClick={() => publishMutation.mutate(post.id)}>
                            Publish
                          </Button>
                        )}
                        <Button size="sm" variant="danger" onClick={() => setDeleteTarget(post)}>Delete</Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {data && data.pages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 text-sm text-gray-600">
            <span>{data.total} posts total</span>
            <div className="flex items-center gap-1">
              <Button size="sm" variant="ghost" disabled={page === 1} onClick={() => setPage(page - 1)}>Previous</Button>
              <span className="px-3 py-1 text-xs">Page {page} of {data.pages}</span>
              <Button size="sm" variant="ghost" disabled={page === data.pages} onClick={() => setPage(page + 1)}>Next</Button>
            </div>
          </div>
        )}
      </Card>

      {/* Single Delete Confirm */}
      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Delete Post" size="sm">
        <p className="text-sm text-gray-600 mb-6">
          Delete <strong>"{deleteTarget?.title}"</strong>? This is permanent.
        </p>
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setDeleteTarget(null)}>Cancel</Button>
          <Button variant="danger" loading={deleteMutation.isPending}
            onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}>
            Delete
          </Button>
        </div>
      </Modal>

      {/* Bulk Delete Confirm */}
      <Modal open={bulkConfirm} onClose={() => setBulkConfirm(false)} title="Bulk Delete" size="sm">
        <p className="text-sm text-gray-600 mb-6">
          Permanently delete <strong>{selected.size}</strong> selected post{selected.size !== 1 ? 's' : ''}?
        </p>
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setBulkConfirm(false)}>Cancel</Button>
          <Button variant="danger" loading={bulkDeleteMutation.isPending}
            onClick={() => bulkDeleteMutation.mutate(Array.from(selected))}>
            Delete All
          </Button>
        </div>
      </Modal>
    </div>
  )
}
