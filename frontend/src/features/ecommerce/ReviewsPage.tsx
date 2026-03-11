import { useState } from 'react'
import { Button, Card, Table, Badge, Select, toast } from '../../components/ui'
import {
  useProductReviews,
  useApproveReview,
  type Review,
} from '../../api/ecommerce_ext'

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <svg
          key={star}
          className={`h-4 w-4 ${star <= rating ? 'text-yellow-400' : 'text-gray-200'}`}
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </div>
  )
}

const statusBadge = (status: string) => {
  switch (status) {
    case 'approved': return <Badge variant="success">Approved</Badge>
    case 'rejected': return <Badge variant="danger">Rejected</Badge>
    default: return <Badge variant="warning">Pending</Badge>
  }
}

export default function ReviewsPage() {
  const [statusFilter, setStatusFilter] = useState('')
  const [page, setPage] = useState(1)
  const limit = 20

  const { data, isLoading, error } = useProductReviews({
    status: statusFilter || undefined,
    skip: (page - 1) * limit,
    limit,
  })
  const approveReview = useApproveReview()

  const handleApprove = async (id: string, action: 'approved' | 'rejected') => {
    try {
      await approveReview.mutateAsync({ id, action })
      toast('success', `Review ${action}`)
    } catch {
      toast('error', `Failed to ${action} review`)
    }
  }

  if (error) return <div className="p-6 text-danger">Failed to load reviews</div>

  const columns = [
    {
      key: 'product',
      label: 'Product',
      render: (r: Review) => <span className="font-medium text-gray-900">{r.product_name || r.product_id}</span>,
    },
    {
      key: 'customer',
      label: 'Customer',
      render: (r: Review) => <span className="text-sm text-gray-600">{r.customer_name || 'Anonymous'}</span>,
    },
    {
      key: 'rating',
      label: 'Rating',
      render: (r: Review) => <StarRating rating={r.rating} />,
    },
    {
      key: 'title',
      label: 'Review',
      render: (r: Review) => (
        <div className="max-w-xs">
          {r.title && <p className="font-medium text-sm text-gray-900 truncate">{r.title}</p>}
          {r.content && <p className="text-xs text-gray-500 truncate">{r.content}</p>}
        </div>
      ),
    },
    {
      key: 'verified',
      label: 'Verified',
      render: (r: Review) => (
        r.is_verified_purchase
          ? <Badge variant="info">Verified</Badge>
          : <span className="text-xs text-gray-400">No</span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (r: Review) => statusBadge(r.status),
    },
    {
      key: 'date',
      label: 'Date',
      render: (r: Review) => <span className="text-sm text-gray-500">{new Date(r.created_at).toLocaleDateString()}</span>,
    },
    {
      key: 'actions',
      label: '',
      render: (r: Review) => (
        r.status === 'pending' ? (
          <div className="flex gap-2">
            <Button size="sm" variant="primary" onClick={() => handleApprove(r.id, 'approved')} loading={approveReview.isPending}>
              Approve
            </Button>
            <Button size="sm" variant="danger" onClick={() => handleApprove(r.id, 'rejected')} loading={approveReview.isPending}>
              Reject
            </Button>
          </div>
        ) : null
      ),
    },
  ]

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Review Moderation</h1>
          <p className="text-sm text-gray-500 mt-1">Approve or reject customer reviews</p>
        </div>
        <Select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}
          options={[
            { value: '', label: 'All Status' },
            { value: 'pending', label: 'Pending' },
            { value: 'approved', label: 'Approved' },
            { value: 'rejected', label: 'Rejected' },
          ]}
        />
      </div>

      <Card padding={false}>
        <Table
          columns={columns}
          data={data?.reviews ?? []}
          loading={isLoading}
          keyExtractor={(r) => r.id}
          emptyText="No reviews found"
        />
        {data && data.total > limit && (
          <div className="flex justify-center gap-2 p-4 border-t border-gray-100 dark:border-gray-800">
            <Button size="sm" variant="ghost" disabled={page === 1} onClick={() => setPage(page - 1)}>Previous</Button>
            <span className="text-sm text-gray-500 self-center">Page {page} of {Math.ceil(data.total / limit)}</span>
            <Button size="sm" variant="ghost" disabled={page * limit >= data.total} onClick={() => setPage(page + 1)}>Next</Button>
          </div>
        )}
      </Card>
    </div>
  )
}
