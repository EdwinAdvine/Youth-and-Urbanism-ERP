import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Badge, Spinner, toast } from '../../components/ui'
import {
  useGRNs,
  useGRN,
  useAcceptGRN,
  useRejectGRN,
  type GoodsReceivedNote,
  type GRNLine,
} from '../../api/supplychain'

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

const STATUS_BADGE: Record<string, 'success' | 'danger' | 'info' | 'warning' | 'default'> = {
  draft: 'default',
  inspecting: 'warning',
  accepted: 'success',
  partial: 'warning',
  rejected: 'danger',
}

// ---- Line Item Card (mobile optimized) ----

function LineItemCard({
  line,
  accepted,
  rejected,
  onAcceptedChange,
  onRejectedChange,
}: {
  line: GRNLine
  accepted: number
  rejected: number
  onAcceptedChange: (val: number) => void
  onRejectedChange: (val: number) => void
}) {
  return (
    <div className="bg-white rounded-[10px] border border-gray-200 p-4 space-y-3">
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-gray-900 truncate">{line.item_id}</p>
          <p className="text-xs text-gray-500">
            Ordered: {line.ordered_quantity} | Received: {line.received_quantity}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-green-700 mb-1">Accepted</label>
          <input
            type="number"
            min="0"
            max={line.received_quantity}
            value={accepted}
            onChange={(e) => onAcceptedChange(Math.max(0, parseInt(e.target.value) || 0))}
            className="w-full min-h-[52px] rounded-[10px] border border-green-200 bg-green-50 px-4 py-3 text-lg font-bold text-green-800 text-center focus:outline-none focus:ring-2 focus:ring-green-400"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-red-700 mb-1">Rejected</label>
          <input
            type="number"
            min="0"
            max={line.received_quantity}
            value={rejected}
            onChange={(e) => onRejectedChange(Math.max(0, parseInt(e.target.value) || 0))}
            className="w-full min-h-[52px] rounded-[10px] border border-red-200 bg-red-50 px-4 py-3 text-lg font-bold text-red-800 text-center focus:outline-none focus:ring-2 focus:ring-red-400"
          />
        </div>
      </div>

      {/* Quick action buttons */}
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => {
            onAcceptedChange(line.received_quantity)
            onRejectedChange(0)
          }}
          className="min-h-[44px] rounded-[10px] bg-green-100 text-green-700 text-xs font-medium hover:bg-green-200 active:bg-green-300 active:scale-95 transition-all"
        >
          Accept All
        </button>
        <button
          onClick={() => {
            onAcceptedChange(0)
            onRejectedChange(line.received_quantity)
          }}
          className="min-h-[44px] rounded-[10px] bg-red-100 text-red-700 text-xs font-medium hover:bg-red-200 active:bg-red-300 active:scale-95 transition-all"
        >
          Reject All
        </button>
      </div>
    </div>
  )
}

// ---- GRN Selection View ----

function GRNSelector({
  onSelect,
}: {
  onSelect: (grn: GoodsReceivedNote) => void
}) {
  const { data, isLoading } = useGRNs({ status: 'draft', limit: 50 })
  const { data: inspecting } = useGRNs({ status: 'inspecting', limit: 50 })

  const allGRNs = useMemo(() => {
    const list = [...(data?.grns ?? []), ...(inspecting?.grns ?? [])]
    return list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  }, [data, inspecting])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner size="lg" />
      </div>
    )
  }

  if (allGRNs.length === 0) {
    return (
      <div className="text-center py-12">
        <svg className="h-16 w-16 mx-auto text-gray-300 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
        </svg>
        <p className="text-gray-500 font-medium">No pending GRNs</p>
        <p className="text-gray-400 text-sm mt-1">All goods received notes have been processed</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-500 font-medium">{allGRNs.length} pending GRN(s)</p>
      {allGRNs.map((grn) => (
        <button
          key={grn.id}
          onClick={() => onSelect(grn)}
          className="w-full bg-white rounded-[10px] border border-gray-200 p-4 text-left hover:border-primary active:bg-primary/5 active:scale-[0.98] transition-all min-h-[72px]"
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm font-bold text-primary">{grn.grn_number}</span>
            <Badge variant={STATUS_BADGE[grn.status] ?? 'default'}>
              {grn.status}
            </Badge>
          </div>
          <div className="flex items-center gap-4 text-xs text-gray-500">
            <span>Received: {formatDate(grn.received_date)}</span>
            {grn.notes && <span className="truncate">{grn.notes}</span>}
          </div>
        </button>
      ))}
    </div>
  )
}

// ---- Main Component ----

export default function MobileGoodsReceipt() {
  const navigate = useNavigate()
  const [selectedGRNId, setSelectedGRNId] = useState<string | null>(null)
  const [lineQuantities, setLineQuantities] = useState<Record<string, { accepted: number; rejected: number }>>({})

  const { data: grnDetail, isLoading: detailLoading } = useGRN(selectedGRNId ?? '')
  const acceptMutation = useAcceptGRN()
  const rejectMutation = useRejectGRN()

  const handleSelectGRN = (grn: GoodsReceivedNote) => {
    setSelectedGRNId(grn.id)
    setLineQuantities({})
  }

  const getLineQty = (lineId: string, receivedQty: number) => {
    return lineQuantities[lineId] ?? { accepted: receivedQty, rejected: 0 }
  }

  const setLineAccepted = (lineId: string, value: number) => {
    setLineQuantities((prev) => ({
      ...prev,
      [lineId]: {
        accepted: value,
        rejected: prev[lineId]?.rejected ?? 0,
      },
    }))
  }

  const setLineRejected = (lineId: string, defaultAccepted: number, value: number) => {
    setLineQuantities((prev) => ({
      ...prev,
      [lineId]: {
        accepted: prev[lineId]?.accepted ?? defaultAccepted,
        rejected: value,
      },
    }))
  }

  const totalAccepted = grnDetail?.lines?.reduce((sum, l) => sum + (getLineQty(l.id, l.received_quantity).accepted), 0) ?? 0
  const totalRejected = grnDetail?.lines?.reduce((sum, l) => sum + (getLineQty(l.id, l.received_quantity).rejected), 0) ?? 0

  const handleAccept = async () => {
    if (!selectedGRNId) return
    try {
      await acceptMutation.mutateAsync(selectedGRNId)
      toast('success', 'GRN accepted - stock updated')
      setSelectedGRNId(null)
      setLineQuantities({})
    } catch {
      toast('error', 'Failed to accept GRN')
    }
  }

  const handleReject = async () => {
    if (!selectedGRNId) return
    try {
      await rejectMutation.mutateAsync(selectedGRNId)
      toast('success', 'GRN rejected')
      setSelectedGRNId(null)
      setLineQuantities({})
    } catch {
      toast('error', 'Failed to reject GRN')
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3">
        <button
          onClick={() => selectedGRNId ? (setSelectedGRNId(null), setLineQuantities({})) : navigate('/supply-chain/grn')}
          className="min-h-[48px] min-w-[48px] flex items-center justify-center rounded-[10px] text-gray-500 hover:bg-gray-100 active:bg-gray-200 transition-colors"
        >
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold text-gray-900">
            {selectedGRNId ? 'Receive Goods' : 'Goods Receipt'}
          </h1>
          {grnDetail && (
            <p className="text-sm text-primary font-medium">{grnDetail.grn_number}</p>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        {!selectedGRNId ? (
          <GRNSelector onSelect={handleSelectGRN} />
        ) : detailLoading ? (
          <div className="flex items-center justify-center py-20">
            <Spinner size="lg" />
          </div>
        ) : grnDetail ? (
          <div className="space-y-4">
            {/* Summary banner */}
            <div className="bg-white rounded-[10px] border border-gray-200 p-4">
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-xs text-gray-500">Lines</p>
                  <p className="text-lg font-bold text-gray-900">{grnDetail.lines?.length ?? 0}</p>
                </div>
                <div>
                  <p className="text-xs text-green-600">Accepted</p>
                  <p className="text-lg font-bold text-green-700">{totalAccepted}</p>
                </div>
                <div>
                  <p className="text-xs text-red-600">Rejected</p>
                  <p className="text-lg font-bold text-red-700">{totalRejected}</p>
                </div>
              </div>
            </div>

            {/* Line items */}
            {(grnDetail.lines ?? []).map((line) => {
              const qty = getLineQty(line.id, line.received_quantity)
              return (
                <LineItemCard
                  key={line.id}
                  line={line}
                  accepted={qty.accepted}
                  rejected={qty.rejected}
                  onAcceptedChange={(val) => setLineAccepted(line.id, val)}
                  onRejectedChange={(val) => setLineRejected(line.id, line.received_quantity, val)}
                />
              )
            })}

            {(!grnDetail.lines || grnDetail.lines.length === 0) && (
              <div className="text-center py-8 text-gray-400">
                No line items in this GRN
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-12 text-gray-400">GRN not found</div>
        )}
      </div>

      {/* Bottom actions (only when viewing GRN detail) */}
      {selectedGRNId && grnDetail && (grnDetail.status === 'draft' || grnDetail.status === 'inspecting') && (
        <div className="sticky bottom-0 bg-white border-t border-gray-200 p-4 space-y-2">
          <div className="grid grid-cols-2 gap-3">
            <Button
              variant="danger"
              className="min-h-[52px] text-base"
              onClick={handleReject}
              loading={rejectMutation.isPending}
            >
              Reject GRN
            </Button>
            <Button
              className="min-h-[52px] text-base"
              onClick={handleAccept}
              loading={acceptMutation.isPending}
            >
              Accept GRN
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
