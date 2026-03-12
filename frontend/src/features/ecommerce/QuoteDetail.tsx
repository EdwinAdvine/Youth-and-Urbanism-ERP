import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button, Card, Badge, Spinner, toast } from '../../components/ui'

// ─── Types ────────────────────────────────────────────────────────────────────

interface QuoteItem {
  id: string
  product_name: string
  quantity: number
  requested_price: number
  approved_price: number | null
}

interface Quote {
  id: string
  company_name: string
  requester_email: string
  status: 'draft' | 'submitted' | 'reviewed' | 'approved' | 'rejected' | 'converted'
  po_number: string | null
  valid_until: string | null
  admin_notes: string
  converted_order_number: string | null
  items: QuoteItem[]
  created_at: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(amount)
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

const STATUS_BADGE: Record<string, 'default' | 'info' | 'warning' | 'success' | 'danger' | 'primary'> = {
  draft: 'default', submitted: 'info', reviewed: 'warning',
  approved: 'success', rejected: 'danger', converted: 'primary',
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function QuoteDetail() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const qc = useQueryClient()

  const { data: quote, isLoading } = useQuery<Quote>({
    queryKey: ['b2b-quote', id],
    queryFn: async () => ({
      id: id!,
      company_name: '',
      requester_email: '',
      status: 'submitted',
      po_number: null,
      valid_until: null,
      admin_notes: '',
      converted_order_number: null,
      items: [],
      created_at: new Date().toISOString(),
    }),
    enabled: !!id,
  })

  const [approvedPrices, setApprovedPrices] = useState<Record<string, number>>({})
  const [adminNotes, setAdminNotes] = useState('')

  const actionMutation = useMutation({
    mutationFn: async (payload: { action: 'approve' | 'reject' | 'convert'; approved_prices?: Record<string, number>; notes?: string }) => {
      // POST /api/v1/ecommerce/b2b/quotes/{id}/{action}
      return payload
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['b2b-quote', id] })
      const labels = { approve: 'approved', reject: 'rejected', convert: 'converted to order' }
      toast('success', `Quote ${labels[vars.action]}`)
    },
    onError: () => toast('error', 'Action failed'),
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Spinner size="lg" />
      </div>
    )
  }

  if (!quote) {
    return <div className="p-6 text-center text-gray-500">Quote not found</div>
  }

  const getApprovedPrice = (item: QuoteItem) =>
    approvedPrices[item.id] !== undefined ? approvedPrices[item.id] : (item.approved_price ?? item.requested_price)

  const totalApproved = quote.items.reduce((sum, item) => sum + item.quantity * getApprovedPrice(item), 0)
  const canApprove = ['submitted', 'reviewed'].includes(quote.status)
  const canConvert = quote.status === 'approved'

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Quote Review</h1>
          <p className="text-sm text-gray-500 mt-1">Submitted on {formatDate(quote.created_at)}</p>
        </div>
        <div className="flex gap-2 items-center">
          <Badge variant={STATUS_BADGE[quote.status]} className="text-sm px-3 py-1">
            {quote.status.charAt(0).toUpperCase() + quote.status.slice(1)}
          </Badge>
          <Button variant="ghost" onClick={() => navigate('/ecommerce/b2b')}>Back</Button>
        </div>
      </div>

      {/* Meta info */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Company</p>
          <p className="font-semibold text-gray-900">{quote.company_name || '-'}</p>
        </Card>
        <Card>
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Requester</p>
          <p className="font-semibold text-gray-900">{quote.requester_email || '-'}</p>
        </Card>
        <Card>
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">PO Number / Valid Until</p>
          <p className="font-semibold text-gray-900">{quote.po_number ?? 'N/A'}</p>
          {quote.valid_until && <p className="text-xs text-gray-500 mt-1">Until {formatDate(quote.valid_until)}</p>}
        </Card>
      </div>

      {/* Converted order notice */}
      {quote.converted_order_number && (
        <div className="bg-primary/5 border border-primary/20 rounded-[10px] px-4 py-3 text-sm text-primary font-medium">
          Converted to Order: <span className="font-bold">{quote.converted_order_number}</span>
        </div>
      )}

      {/* Items table */}
      <Card padding={false}>
        <div className="p-5 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">Quote Items</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                {['Product', 'Qty', 'Requested Price', 'Approved Price', 'Total'].map((h) => (
                  <th key={h} className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {quote.items.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-8 text-gray-400">No items</td></tr>
              ) : (
                quote.items.map((item) => (
                  <tr key={item.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                    <td className="py-3 px-4 font-medium text-gray-900">{item.product_name}</td>
                    <td className="py-3 px-4 text-gray-700">{item.quantity}</td>
                    <td className="py-3 px-4 text-gray-600">{formatCurrency(item.requested_price)}</td>
                    <td className="py-3 px-4">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        disabled={!canApprove}
                        value={getApprovedPrice(item)}
                        onChange={(e) => setApprovedPrices({ ...approvedPrices, [item.id]: parseFloat(e.target.value) || 0 })}
                        className="border border-gray-200 rounded-[10px] px-2 py-1 text-sm w-32 focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:bg-gray-50 disabled:text-gray-400"
                      />
                    </td>
                    <td className="py-3 px-4 font-medium text-gray-900">
                      {formatCurrency(item.quantity * getApprovedPrice(item))}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {quote.items.length > 0 && (
              <tfoot>
                <tr className="border-t border-gray-100 bg-gray-50">
                  <td colSpan={4} className="py-3 px-4 text-right text-sm font-semibold text-gray-700">Approved Total</td>
                  <td className="py-3 px-4 font-bold text-gray-900">{formatCurrency(totalApproved)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </Card>

      {/* Admin notes */}
      <Card>
        <h2 className="text-base font-semibold text-gray-900 mb-3">Admin Notes</h2>
        <textarea
          className="w-full rounded-[10px] border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary min-h-[80px]"
          placeholder="Add internal notes about this quote..."
          value={adminNotes || quote.admin_notes}
          onChange={(e) => setAdminNotes(e.target.value)}
          disabled={quote.status === 'converted'}
        />
      </Card>

      {/* Action buttons */}
      {(canApprove || canConvert) && (
        <div className="flex gap-3">
          {canApprove && (
            <>
              <Button
                className="bg-[#6fd943] hover:bg-[#5ec835] text-white"
                loading={actionMutation.isPending}
                onClick={() => actionMutation.mutate({ action: 'approve', approved_prices: approvedPrices, notes: adminNotes })}
              >
                Approve Quote
              </Button>
              <Button
                variant="danger"
                loading={actionMutation.isPending}
                onClick={() => actionMutation.mutate({ action: 'reject', notes: adminNotes })}
              >
                Reject Quote
              </Button>
            </>
          )}
          {canConvert && (
            <Button
              variant="outline"
              loading={actionMutation.isPending}
              onClick={() => { if (confirm('Convert this quote to an order?')) actionMutation.mutate({ action: 'convert' }) }}
            >
              Convert to Order
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
