import { useParams, useNavigate } from 'react-router-dom'
import { Button, Spinner, Badge, Card, toast } from '../../components/ui'
import { useState } from 'react'
import { useGRN, useAcceptGRN, useRejectGRN, usePostGRN } from '../../api/supplychain'

const STATUS_BADGE: Record<string, 'success' | 'danger' | 'info' | 'warning' | 'default'> = {
  draft: 'default',
  inspecting: 'info',
  accepted: 'success',
  partial: 'warning',
  rejected: 'danger',
}

export default function GRNDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: grn, isLoading } = useGRN(id ?? '')
  const accept = useAcceptGRN()
  const reject = useRejectGRN()
  const postGRN = usePostGRN()
  const [showPostConfirm, setShowPostConfirm] = useState(false)

  if (isLoading) return <div className="flex items-center justify-center min-h-[60vh]"><Spinner size="lg" /></div>
  if (!grn) return <div className="p-6 text-gray-500">GRN not found</div>

  async function handleAccept() {
    try { await accept.mutateAsync(grn!.id); toast('success', 'GRN accepted') } catch { toast('error', 'Failed to accept') }
  }
  async function handleReject() {
    try { await reject.mutateAsync(grn!.id); toast('success', 'GRN rejected') } catch { toast('error', 'Failed to reject') }
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/supply-chain/grn')} className="text-gray-400 hover:text-gray-600">
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        </button>
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">{grn.grn_number}</h1>
        <Badge variant={STATUS_BADGE[grn.status] ?? 'default'}>{grn.status}</Badge>
        <div className="ml-auto flex gap-2">
          {(grn.status === 'draft' || grn.status === 'pending') && (
            <Button size="sm" onClick={() => setShowPostConfirm(true)} loading={postGRN.isPending} className="bg-[#51459d] hover:bg-[#3d3480]">
              Post GRN
            </Button>
          )}
          {grn.status === 'draft' && (
            <>
              <Button size="sm" variant="outline" onClick={handleReject} loading={reject.isPending}>Reject</Button>
              <Button size="sm" onClick={handleAccept} loading={accept.isPending}>Accept</Button>
            </>
          )}
        </div>
      </div>

      <Card className="p-5">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div><span className="text-gray-400">Received Date</span><p className="font-medium">{grn.received_date}</p></div>
          <div><span className="text-gray-400">PO ID</span><p className="font-medium font-mono text-xs">{grn.purchase_order_id.slice(0, 8)}...</p></div>
          <div><span className="text-gray-400">Supplier ID</span><p className="font-medium font-mono text-xs">{grn.supplier_id.slice(0, 8)}...</p></div>
          <div><span className="text-gray-400">Warehouse ID</span><p className="font-medium font-mono text-xs">{grn.warehouse_id.slice(0, 8)}...</p></div>
        </div>
        {grn.notes && <p className="text-sm text-gray-500 mt-3">{grn.notes}</p>}
      </Card>

      <Card className="p-5">
        <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-3">Line Items — Ordered vs Received</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-gray-100 dark:border-gray-800 text-left text-gray-500">
              <th className="pb-2 pr-4">Item ID</th>
              <th className="pb-2 pr-4 text-right">Ordered</th>
              <th className="pb-2 pr-4 text-right">Received</th>
              <th className="pb-2 pr-4 text-right">Accepted</th>
              <th className="pb-2 pr-4 text-right">Rejected</th>
              <th className="pb-2">Rejection Reason</th>
            </tr></thead>
            <tbody>
              {(grn.lines ?? []).map((line) => (
                <tr key={line.id} className="border-b border-gray-50 dark:border-gray-800">
                  <td className="py-2 pr-4 font-mono text-xs">{line.item_id.slice(0, 8)}...</td>
                  <td className="py-2 pr-4 text-right">{line.ordered_quantity}</td>
                  <td className="py-2 pr-4 text-right">{line.received_quantity}</td>
                  <td className="py-2 pr-4 text-right text-green-600">{line.accepted_quantity}</td>
                  <td className="py-2 pr-4 text-right text-red-600">{line.rejected_quantity}</td>
                  <td className="py-2 text-gray-400">{line.rejection_reason ?? '—'}</td>
                </tr>
              ))}
              {(!grn.lines || grn.lines.length === 0) && (
                <tr><td colSpan={6} className="py-8 text-center text-gray-400">No line items</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Post GRN Confirmation Dialog */}
      {showPostConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-gray-800 rounded-[10px] shadow-2xl w-full max-w-sm p-6">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">Post GRN</h3>
            <p className="text-sm text-gray-500 mb-4">Are you sure you want to post this GRN? This action will update inventory and cannot be undone.</p>
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="outline" onClick={() => setShowPostConfirm(false)}>Cancel</Button>
              <Button
                size="sm"
                loading={postGRN.isPending}
                className="bg-[#51459d] hover:bg-[#3d3480]"
                onClick={async () => {
                  try {
                    await postGRN.mutateAsync(grn!.id)
                    toast('success', 'GRN posted successfully')
                  } catch {
                    toast('error', 'Failed to post GRN')
                  }
                  setShowPostConfirm(false)
                }}
              >
                Confirm Post
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
