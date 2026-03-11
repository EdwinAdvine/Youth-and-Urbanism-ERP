import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Badge, Spinner, toast } from '../../components/ui'
import {
  useQualityInspections,
  useCreateQualityInspection,
  type CreateQualityInspectionPayload,
} from '../../api/supplychain_ext'

const statusColors: Record<string, 'default' | 'warning' | 'success' | 'danger' | 'info'> = {
  pending: 'warning',
  in_progress: 'info',
  passed: 'success',
  failed: 'danger',
  partial: 'warning',
}

// ---- Inspection Item (mobile card for pass/fail per item) ----

interface InspectionItem {
  id: string
  name: string
  result: 'pending' | 'pass' | 'fail'
  notes: string
}

function InspectionItemCard({
  item,
  onResult,
  onNotesChange,
}: {
  item: InspectionItem
  onResult: (result: 'pass' | 'fail') => void
  onNotesChange: (notes: string) => void
}) {
  return (
    <div className={`rounded-[10px] border p-4 space-y-3 transition-colors ${
      item.result === 'pass' ? 'border-green-300 bg-green-50/50' :
      item.result === 'fail' ? 'border-red-300 bg-red-50/50' :
      'border-gray-200 bg-white'
    }`}>
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-gray-900">{item.name}</span>
        {item.result !== 'pending' && (
          <Badge variant={item.result === 'pass' ? 'success' : 'danger'}>
            {item.result === 'pass' ? 'PASS' : 'FAIL'}
          </Badge>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => onResult('pass')}
          className={`min-h-[56px] rounded-[10px] flex flex-col items-center justify-center gap-1 text-sm font-medium transition-all active:scale-95 ${
            item.result === 'pass'
              ? 'bg-green-500 text-white shadow-sm'
              : 'bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 active:bg-green-200'
          }`}
        >
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          Pass
        </button>
        <button
          onClick={() => onResult('fail')}
          className={`min-h-[56px] rounded-[10px] flex flex-col items-center justify-center gap-1 text-sm font-medium transition-all active:scale-95 ${
            item.result === 'fail'
              ? 'bg-red-500 text-white shadow-sm'
              : 'bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 active:bg-red-200'
          }`}
        >
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
          Fail
        </button>
      </div>

      <textarea
        value={item.notes}
        onChange={(e) => onNotesChange(e.target.value)}
        placeholder="Notes (optional)..."
        rows={2}
        className="w-full rounded-[10px] border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary placeholder:text-gray-400 min-h-[48px]"
      />
    </div>
  )
}

// ---- New Inspection Form ----

function NewInspectionForm({ onClose }: { onClose: () => void }) {
  const createInspection = useCreateQualityInspection()
  const [refType, setRefType] = useState<'grn' | 'shipment' | 'production'>('grn')
  const [refId, setRefId] = useState('')
  const [items, setItems] = useState<InspectionItem[]>([
    { id: '1', name: 'Item 1', result: 'pending', notes: '' },
  ])
  const [generalNotes, setGeneralNotes] = useState('')

  const addItem = () => {
    const id = String(items.length + 1)
    setItems([...items, { id, name: `Item ${id}`, result: 'pending', notes: '' }])
  }

  const updateItemResult = (id: string, result: 'pass' | 'fail') => {
    setItems(items.map((i) => (i.id === id ? { ...i, result } : i)))
  }

  const updateItemNotes = (id: string, notes: string) => {
    setItems(items.map((i) => (i.id === id ? { ...i, notes } : i)))
  }

  const totalInspected = items.filter((i) => i.result !== 'pending').length
  const totalPassed = items.filter((i) => i.result === 'pass').length
  const totalFailed = items.filter((i) => i.result === 'fail').length

  const handleSubmit = async () => {
    if (!refId.trim()) {
      toast('warning', 'Reference ID is required')
      return
    }
    if (totalInspected === 0) {
      toast('warning', 'Inspect at least one item')
      return
    }

    const allNotes = [
      generalNotes,
      ...items
        .filter((i) => i.notes)
        .map((i) => `${i.name}: ${i.notes}`),
    ].filter(Boolean).join(' | ')

    const payload: CreateQualityInspectionPayload = {
      reference_type: refType,
      reference_id: refId.trim(),
      total_inspected: totalInspected,
      total_passed: totalPassed,
      total_failed: totalFailed,
      notes: allNotes || undefined,
    }

    try {
      await createInspection.mutateAsync(payload)
      toast('success', 'Inspection recorded')
      onClose()
    } catch {
      toast('error', 'Failed to create inspection')
    }
  }

  return (
    <div className="space-y-4">
      {/* Reference info */}
      <div className="bg-white rounded-[10px] border border-gray-200 p-4 space-y-3">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Reference Type</label>
          <div className="grid grid-cols-3 gap-2">
            {(['grn', 'shipment', 'production'] as const).map((rt) => (
              <button
                key={rt}
                onClick={() => setRefType(rt)}
                className={`min-h-[48px] rounded-[10px] text-sm font-medium border transition-all active:scale-95 ${
                  refType === rt
                    ? 'border-primary bg-primary text-white'
                    : 'border-gray-200 bg-white text-gray-700 active:bg-gray-50'
                }`}
              >
                {rt.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Reference ID</label>
          <input
            type="text"
            value={refId}
            onChange={(e) => setRefId(e.target.value)}
            placeholder="Enter GRN / Shipment / Production ID"
            className="w-full min-h-[48px] rounded-[10px] border border-gray-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>
      </div>

      {/* Summary counters */}
      <div className="bg-white rounded-[10px] border border-gray-200 p-4">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-xs text-gray-500">Inspected</p>
            <p className="text-2xl font-bold text-gray-900">{totalInspected}</p>
          </div>
          <div>
            <p className="text-xs text-green-600">Passed</p>
            <p className="text-2xl font-bold text-green-700">{totalPassed}</p>
          </div>
          <div>
            <p className="text-xs text-red-600">Failed</p>
            <p className="text-2xl font-bold text-red-700">{totalFailed}</p>
          </div>
        </div>
        {totalInspected > 0 && (
          <div className="mt-3">
            <div className="w-full bg-gray-100 rounded-full h-3">
              <div
                className="h-full rounded-full bg-green-500 transition-all"
                style={{ width: `${(totalPassed / totalInspected) * 100}%` }}
              />
            </div>
            <p className="text-xs text-gray-500 mt-1 text-center">
              {((totalPassed / totalInspected) * 100).toFixed(0)}% pass rate
            </p>
          </div>
        )}
      </div>

      {/* Items */}
      {items.map((item) => (
        <InspectionItemCard
          key={item.id}
          item={item}
          onResult={(result) => updateItemResult(item.id, result)}
          onNotesChange={(notes) => updateItemNotes(item.id, notes)}
        />
      ))}

      <button
        onClick={addItem}
        className="w-full min-h-[48px] rounded-[10px] border-2 border-dashed border-gray-300 text-gray-500 text-sm font-medium hover:border-primary hover:text-primary active:bg-primary/5 transition-colors"
      >
        + Add Item
      </button>

      {/* General notes */}
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">General Notes</label>
        <textarea
          value={generalNotes}
          onChange={(e) => setGeneralNotes(e.target.value)}
          placeholder="Overall inspection notes..."
          rows={3}
          className="w-full rounded-[10px] border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-gray-400 min-h-[56px]"
        />
      </div>

      {/* Submit */}
      <Button
        className="w-full min-h-[56px] text-base font-semibold"
        size="lg"
        onClick={handleSubmit}
        loading={createInspection.isPending}
        disabled={totalInspected === 0 || !refId.trim()}
      >
        Submit Inspection ({totalPassed} Pass / {totalFailed} Fail)
      </Button>
    </div>
  )
}

// ---- Recent Inspections List ----

function RecentInspections({ onNewInspection }: { onNewInspection: () => void }) {
  const { data, isLoading } = useQualityInspections({ limit: 20 })

  return (
    <div className="space-y-4">
      <Button
        className="w-full min-h-[52px] text-base"
        size="lg"
        onClick={onNewInspection}
      >
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        New Inspection
      </Button>

      <h2 className="text-sm font-medium text-gray-500">Recent Inspections</h2>

      {isLoading ? (
        <div className="flex justify-center py-8"><Spinner /></div>
      ) : (data?.inspections ?? []).length === 0 ? (
        <div className="text-center py-8 text-gray-400 text-sm">No inspections yet</div>
      ) : (
        <div className="space-y-3">
          {(data?.inspections ?? []).map((insp) => {
            const passRate = insp.total_inspected > 0 ? (insp.total_passed / insp.total_inspected) * 100 : 0
            return (
              <div key={insp.id} className="bg-white rounded-[10px] border border-gray-200 p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-bold text-gray-900">{insp.inspection_number}</span>
                  <Badge variant={statusColors[insp.status]}>{insp.status.replace(/_/g, ' ')}</Badge>
                </div>
                <div className="flex items-center gap-4 text-xs text-gray-500 mb-2">
                  <span>{insp.reference_type.toUpperCase()}</span>
                  <span>{insp.total_inspected} inspected</span>
                  <span className="text-green-600">{insp.total_passed} pass</span>
                  <span className="text-red-600">{insp.total_failed} fail</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2">
                  <div
                    className={`h-full rounded-full transition-all ${passRate >= 80 ? 'bg-green-500' : passRate >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`}
                    style={{ width: `${passRate}%` }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ---- Main Component ----

export default function MobileQualityInspection() {
  const navigate = useNavigate()
  const [mode, setMode] = useState<'list' | 'new'>('list')

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3">
        <button
          onClick={() => mode === 'new' ? setMode('list') : navigate('/supply-chain/quality-inspections')}
          className="min-h-[48px] min-w-[48px] flex items-center justify-center rounded-[10px] text-gray-500 hover:bg-gray-100 active:bg-gray-200 transition-colors"
        >
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-lg font-bold text-gray-900">
          {mode === 'new' ? 'New Inspection' : 'Quality Inspection'}
        </h1>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        {mode === 'list' ? (
          <RecentInspections onNewInspection={() => setMode('new')} />
        ) : (
          <NewInspectionForm onClose={() => setMode('list')} />
        )}
      </div>
    </div>
  )
}
