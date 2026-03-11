import { useParams, useNavigate } from 'react-router-dom'
import { Button, Spinner, Badge, Card, toast } from '../../components/ui'
import { useReturn, useApproveReturn, useCompleteReturn } from '../../api/supplychain'

const STATUS_BADGE: Record<string, 'success' | 'danger' | 'info' | 'warning' | 'default'> = {
  draft: 'default',
  pending_approval: 'info',
  approved: 'success',
  shipped: 'warning',
  completed: 'success',
  cancelled: 'danger',
}

function formatCurrency(value: string | number) {
  const num = typeof value === 'string' ? parseFloat(value) : value
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(num)
}

export default function ReturnDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: ret, isLoading } = useReturn(id ?? '')
  const approveReturn = useApproveReturn()
  const completeReturn = useCompleteReturn()

  if (isLoading) return <div className="flex items-center justify-center min-h-[60vh]"><Spinner size="lg" /></div>
  if (!ret) return <div className="p-6 text-gray-500">Return not found</div>

  async function handleApprove() {
    try { await approveReturn.mutateAsync(ret!.id); toast('success', 'Return approved') } catch { toast('error', 'Failed to approve') }
  }
  async function handleComplete() {
    try { await completeReturn.mutateAsync(ret!.id); toast('success', 'Return completed') } catch { toast('error', 'Failed to complete') }
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/supply-chain/returns')} className="text-gray-400 hover:text-gray-600">
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        </button>
        <h1 className="text-xl font-bold text-gray-900">{ret.return_number}</h1>
        <Badge variant={STATUS_BADGE[ret.status] ?? 'default'}>{ret.status.replace(/_/g, ' ')}</Badge>
        <div className="ml-auto flex gap-2">
          {(ret.status === 'draft' || ret.status === 'pending_approval') && (
            <Button size="sm" onClick={handleApprove} loading={approveReturn.isPending}>Approve</Button>
          )}
          {ret.status === 'approved' && (
            <Button size="sm" onClick={handleComplete} loading={completeReturn.isPending}>Complete</Button>
          )}
        </div>
      </div>

      <Card className="p-5">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div><span className="text-gray-400">Supplier ID</span><p className="font-medium font-mono text-xs">{ret.supplier_id.slice(0, 8)}...</p></div>
          <div><span className="text-gray-400">Warehouse ID</span><p className="font-medium font-mono text-xs">{ret.warehouse_id.slice(0, 8)}...</p></div>
          <div><span className="text-gray-400">Total Value</span><p className="font-medium">{formatCurrency(ret.total_value)}</p></div>
          <div><span className="text-gray-400">Status</span><p className="font-medium capitalize">{ret.status.replace(/_/g, ' ')}</p></div>
        </div>
        <div className="mt-3"><span className="text-gray-400 text-sm">Reason</span><p className="text-sm mt-1">{ret.reason}</p></div>
      </Card>

      <Card className="p-5">
        <h3 className="font-semibold text-gray-900 mb-3">Return Line Items</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-gray-100 dark:border-gray-800 text-left text-gray-500">
              <th className="pb-2 pr-4">Item ID</th>
              <th className="pb-2 pr-4 text-right">Quantity</th>
              <th className="pb-2 pr-4 text-right">Unit Cost</th>
              <th className="pb-2 pr-4 text-right">Subtotal</th>
              <th className="pb-2">Reason</th>
            </tr></thead>
            <tbody>
              {(ret.lines ?? []).map((line) => (
                <tr key={line.id} className="border-b border-gray-50 dark:border-gray-800">
                  <td className="py-2 pr-4 font-mono text-xs">{line.item_id.slice(0, 8)}...</td>
                  <td className="py-2 pr-4 text-right">{line.quantity}</td>
                  <td className="py-2 pr-4 text-right">{formatCurrency(line.unit_cost)}</td>
                  <td className="py-2 pr-4 text-right">{formatCurrency(line.quantity * line.unit_cost)}</td>
                  <td className="py-2 text-gray-400">{line.reason ?? '—'}</td>
                </tr>
              ))}
              {(!ret.lines || ret.lines.length === 0) && (
                <tr><td colSpan={5} className="py-8 text-center text-gray-400">No line items</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
